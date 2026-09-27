-- Commerce repair. Applied by the root migration after profile/role hardening.
create schema if not exists private;

-- All money and order writes go through authenticated, atomic entrypoints.
revoke all on public.orders,public.order_items,public.order_status_history,public.iuh_wallets,public.wallet_transactions from public,anon,authenticated;
grant select on public.orders,public.order_items,public.order_status_history,public.iuh_wallets,public.wallet_transactions to authenticated;
grant execute on function public.ensure_iuh_wallet() to authenticated;
create or replace function private.can_read_order(p_id bigint) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_admin() or exists(select 1 from public.orders where id=p_id and buyer_id=auth.uid())
   or exists(select 1 from public.order_items where order_id=p_id and seller_id=auth.uid()))
$$;
revoke all on function private.can_read_order(bigint) from public,anon;
grant execute on function private.can_read_order(bigint) to authenticated;
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('orders','order_items','order_status_history','iuh_wallets','wallet_transactions') loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
create policy orders_read on public.orders for select to authenticated using(private.can_read_order(id));
create policy order_items_read on public.order_items for select to authenticated using(private.can_read_order(order_id));
create policy order_history_read on public.order_status_history for select to authenticated using(private.can_read_order(order_id));
create policy wallets_read on public.iuh_wallets for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy wallet_transactions_read on public.wallet_transactions for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));

alter table public.orders add column if not exists idempotency_key text;
alter table public.orders add column if not exists request_hash text;
alter table public.orders add column if not exists escrow_admin_id uuid references public.users(user_id);
alter table public.orders add column if not exists captured_amount numeric(14,2) not null default 0;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists needs_payment_review boolean not null default false;
alter table public.orders add column if not exists platform_fee_paid_at timestamptz;
alter table public.order_items add column if not exists consignor_id uuid references public.users(user_id);
alter table public.products add column if not exists creation_key text;
alter table public.products add column if not exists creation_hash text;
create unique index if not exists orders_buyer_request_key on public.orders(buyer_id,idempotency_key) where idempotency_key is not null;
create unique index if not exists orders_bank_reference on public.orders(payment_reference) where payment_reference is not null;
create unique index if not exists products_seller_creation_key on public.products(seller_id,creation_key) where creation_key is not null;

-- Existing financial inconsistencies require review, never another automatic debit.
update public.orders set needs_payment_review=true
where idempotency_key is null and payment_method in ('iuh_wallet','qr') and settled_at is null
  and status <> 'cancelled';

create table public.bank_refund_requests (
 id uuid primary key default gen_random_uuid(),
 order_id bigint not null unique references public.orders(id),
 user_id uuid not null references public.users(user_id),
 escrow_admin_id uuid not null references public.users(user_id),
 amount numeric(14,2) not null check(amount>0),
 status text not null default 'pending' check(status in ('pending','completed')),
 bank_reference text,completed_by uuid references auth.users(id),completed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.bank_refund_requests enable row level security;
revoke all on public.bank_refund_requests from public,anon,authenticated;
grant select on public.bank_refund_requests to authenticated;
create policy bank_refunds_read on public.bank_refund_requests for select to authenticated
using(user_id=(select auth.uid()) or (select private.is_admin()));

create or replace function private.commerce_admin_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select u.user_id from public.users u where lower(u.role)='admin' order by u.user_id limit 1
$$;
revoke all on function private.commerce_admin_id() from public,anon,authenticated;

create or replace function private.capture_order(p_order_id bigint,p_bank_reference text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders; a uuid; bw public.iuh_wallets; aw public.iuh_wallets;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found or o.status='cancelled' then raise exception 'Đơn không hợp lệ.'; end if;
  if o.payment_status='paid' then return; end if;
  if o.needs_payment_review then raise exception 'Đơn cũ cần đối soát thủ công, không được thu tiền lại.'; end if;
  if o.payment_method not in ('iuh_wallet','qr') then raise exception 'Đơn không thanh toán online.'; end if;
  if o.total_amount<=0 then raise exception 'Tổng tiền không hợp lệ.'; end if;
  a:=private.commerce_admin_id();
  if a is null then raise exception 'Chưa thiết lập tài khoản nhận tiền.'; end if;
  insert into public.iuh_wallets(user_id) values(a),(o.buyer_id) on conflict(user_id) do nothing;
  perform 1 from public.iuh_wallets where user_id in(a,o.buyer_id) order by user_id for update;
  select * into aw from public.iuh_wallets where user_id=a;
  select * into bw from public.iuh_wallets where user_id=o.buyer_id;
  if o.payment_method='iuh_wallet' then
    if bw.balance<o.total_amount then raise exception 'Số dư Ví IUH không đủ.'; end if;
    update public.iuh_wallets set balance=balance-o.total_amount,updated_at=now() where id=bw.id;
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description)
      values(bw.id,o.buyer_id,'payment','Thanh toán đơn hàng',o.total_amount,'Đơn '||o.order_code);
  elsif nullif(btrim(p_bank_reference),'') is null then
    raise exception 'Cần mã giao dịch ngân hàng đã đối soát.';
  end if;
  if o.payment_method='qr' then perform private.register_bank_receipt(p_bank_reference,'order',o.id::text); end if;
  update public.iuh_wallets set pending=pending+o.total_amount,updated_at=now() where id=aw.id;
  insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description)
    values(aw.id,a,'sale','Tiền giữ hộ đơn hàng',o.total_amount,'Đơn '||o.order_code);
  update public.orders set payment_status='paid',paid_at=now(),captured_amount=total_amount,
    escrow_admin_id=a,payment_reference=nullif(btrim(p_bank_reference),''),updated_at=now() where id=o.id;
end $$;
revoke all on function private.capture_order(bigint,text) from public,anon,authenticated;

drop function if exists public.create_order(text,text,text,text,text,numeric,text,numeric,numeric,jsonb,bigint[]);
create or replace function public.create_order(
  p_recipient_name text,p_recipient_phone text,p_recipient_address text,p_note text,
  p_shipping_method text,p_shipping_fee numeric,p_payment_method text,p_subtotal numeric,
  p_total_amount numeric,p_items jsonb,p_cart_ids bigint[],p_idempotency_key text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); h text; o public.orders; p public.products; r record;
  subtotal numeric:=0; shipping numeric; total numeric; cons boolean; seller uuid;
  consignor uuid; authoritative jsonb:='[]'::jsonb; product_image text;
begin
  if uid is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  if nullif(btrim(p_idempotency_key),'') is null or length(p_idempotency_key)>100 then raise exception 'Vui lòng tải lại trang đặt hàng.'; end if;
  if nullif(btrim(p_recipient_name),'') is null or nullif(btrim(p_recipient_address),'') is null
     or p_recipient_phone !~ '^[+0-9 ().-]{8,20}$' then raise exception 'Thông tin nhận hàng không hợp lệ.'; end if;
  if p_payment_method is null or p_payment_method not in ('cash','qr','iuh_wallet') then raise exception 'Phương thức thanh toán không hợp lệ.'; end if;
  if p_shipping_method is null or p_shipping_method not in ('meet','mid') then raise exception 'Phương thức giao hàng không hợp lệ.'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Giỏ hàng không hợp lệ.'; end if;
  h:=md5(jsonb_build_object('name',p_recipient_name,'phone',p_recipient_phone,'address',p_recipient_address,
    'note',p_note,'shipping',p_shipping_method,'payment',p_payment_method,'items',p_items,'cart',p_cart_ids)::text);
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_idempotency_key,0));
  select * into o from public.orders where buyer_id=uid and idempotency_key=p_idempotency_key;
  if found then
    if o.request_hash<>h then raise exception 'Yêu cầu đã được dùng cho một đơn khác. Hãy tải lại trang.'; end if;
    return json_build_object('success',true,'order_id',o.id,'order_code',o.order_code,'payment_status',o.payment_status,'total_amount',o.total_amount,'already_created',true);
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) i where
    coalesce(i->>'product_id','') !~ '^[0-9]+$' or coalesce(i->>'quantity','') !~ '^[1-9][0-9]{0,5}$') then raise exception 'Số lượng không hợp lệ.'; end if;
  for r in select (i->>'product_id')::bigint id,sum((i->>'quantity')::integer)::integer qty
    from jsonb_array_elements(p_items) i group by 1 order by 1 loop
    select * into p from public.products where id=r.id for update;
    if not found or p.status<>'active' or p.quantity<r.qty then raise exception 'Sản phẩm không còn bán hoặc không đủ tồn kho.'; end if;
    if p.seller_id=uid then raise exception 'Bạn không thể mua sản phẩm của chính mình.'; end if;
    if p.price<=0 then raise exception 'Sản phẩm chưa có giá bán hợp lệ.'; end if;
    if cons is not null and cons<>p.is_consignment then raise exception 'Vui lòng đặt sản phẩm thường và ký gửi thành hai đơn.'; end if;
    if seller is not null and seller<>p.seller_id then raise exception 'Vui lòng đặt riêng sản phẩm của từng người bán.'; end if;
    cons:=p.is_consignment; seller:=p.seller_id; consignor:=null;
    if cons then
      select user_id into consignor from public.consignment_requests where id=p.consignment_request_id;
      if consignor is null then raise exception 'Thiếu thông tin chủ ký gửi.'; end if;
    end if;
    subtotal:=subtotal+round(p.price*case when cons then 1 else 1.05 end)*r.qty;
    product_image:=p.image_urls->>0;
    authoritative:=authoritative||jsonb_build_array(jsonb_build_object('id',p.id,'seller',p.seller_id,
      'consignor',consignor,'name',p.name,'image',product_image,'price',p.price,'qty',r.qty));
  end loop;
  shipping:=case when p_shipping_method='mid' then 5000 else 0 end; total:=subtotal+shipping;
  if p_total_amount is distinct from total then raise exception 'Giá sản phẩm đã thay đổi. Vui lòng tải lại để kiểm tra tổng tiền.'; end if;
  insert into public.orders(order_code,buyer_id,recipient_name,recipient_phone,recipient_address,note,
    shipping_method,shipping_fee,payment_method,subtotal,total_amount,order_type,status,payment_status,idempotency_key,request_hash)
  values('IUH'||replace(gen_random_uuid()::text,'-',''),uid,btrim(p_recipient_name),btrim(p_recipient_phone),btrim(p_recipient_address),p_note,
    p_shipping_method,shipping,p_payment_method,subtotal,total,case when cons then 'consignment' else 'normal' end,'pending','unpaid',p_idempotency_key,h)
  returning * into o;
  for r in select * from jsonb_to_recordset(authoritative) as x(id bigint,seller uuid,consignor uuid,name text,image text,price numeric,qty integer) loop
    insert into public.order_items(order_id,product_id,seller_id,consignor_id,product_name,product_image,price,quantity,subtotal)
    values(o.id,r.id,r.seller,r.consignor,r.name,r.image,r.price,r.qty,r.price*r.qty);
    update public.products set quantity=quantity-r.qty,status=case when quantity-r.qty=0 then 'deleted' else status end,updated_at=now() where id=r.id;
  end loop;
  if p_payment_method='iuh_wallet' then perform private.capture_order(o.id); end if;
  delete from public.cart_items where user_id=uid and id=any(coalesce(p_cart_ids,'{}'::bigint[]))
    and product_id in(select (i->>'id')::bigint from jsonb_array_elements(authoritative) i);
  insert into public.order_status_history(order_id,status,changed_by,note) values(o.id,'pending',uid,'Đơn được tạo; thanh toán được xử lý nguyên tử.');
  return json_build_object('success',true,'order_id',o.id,'order_code',o.order_code,'payment_status',case when p_payment_method='iuh_wallet' then 'paid' else 'unpaid' end,'total_amount',total);
end $$;

create or replace function public.admin_confirm_order_payment(p_order_id bigint,p_reference text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ quản trị viên được đối soát.'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found or o.payment_method<>'qr' then raise exception 'Đơn không phải chuyển khoản chờ đối soát.'; end if;
  perform private.capture_order(o.id,p_reference);
  return jsonb_build_object('success',true,'order_id',o.id,'payment_status','paid');
end $$;

create or replace function private.settle_order(p_order_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders; r record; aw public.iuh_wallets; rw public.iuh_wallets; payout numeric:=0;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.status<>'completed' then raise exception 'Đơn hàng chưa hoàn tất.'; end if;
  if o.settled_at is not null or o.payment_method='cash' then return; end if;
  if o.needs_payment_review or o.payment_status<>'paid' or o.captured_amount<>o.total_amount or o.escrow_admin_id is null then raise exception 'Đơn chưa được đối soát thanh toán.'; end if;
  if exists(select 1 from public.order_items where order_id=o.id and o.order_type='consignment' and consignor_id is null) then raise exception 'Đơn cũ cần xác minh chủ ký gửi.'; end if;
  insert into public.iuh_wallets(user_id)
    select distinct coalesce(consignor_id,seller_id) from public.order_items where order_id=o.id on conflict(user_id) do nothing;
  perform 1 from public.iuh_wallets where user_id=o.escrow_admin_id or user_id in
    (select coalesce(consignor_id,seller_id) from public.order_items where order_id=o.id) order by user_id for update;
  select * into aw from public.iuh_wallets where user_id=o.escrow_admin_id;
  for r in select coalesce(consignor_id,seller_id) beneficiary,
      round(sum(subtotal)*case when o.order_type='consignment' then 0.9 else 1 end) amount
      from public.order_items where order_id=o.id group by 1 loop
    payout:=payout+r.amount;
    if r.amount<=0 then raise exception 'Giá trị giải ngân không hợp lệ.'; end if;
    select * into rw from public.iuh_wallets where user_id=r.beneficiary;
    update public.iuh_wallets set balance=balance+r.amount,total_received=total_received+r.amount,updated_at=now() where id=rw.id;
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description) values
      (aw.id,aw.user_id,'payment','Giải ngân đơn hàng',r.amount,'Đơn '||o.order_code),
      (rw.id,rw.user_id,'sale','Tiền bán hàng',r.amount,'Đơn '||o.order_code);
  end loop;
  if payout>o.captured_amount then raise exception 'Tổng giải ngân vượt tiền đã thu.'; end if;
  update public.iuh_wallets set pending=pending-o.captured_amount,balance=balance+o.captured_amount-payout,updated_at=now() where id=aw.id;
  if o.captured_amount>payout then
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description)
      values(aw.id,aw.user_id,'sale','Phí dịch vụ đã hoàn tất',o.captured_amount-payout,'Đơn '||o.order_code);
  end if;
  update public.orders set settled_at=now(),updated_at=now() where id=o.id;
  update public.consignment_requests c set status='completed',payout_status='available',paid_at=null,updated_at=now()
    where exists(select 1 from public.products p join public.order_items i on i.product_id=p.id where i.order_id=o.id and p.consignment_request_id=c.id);
end $$;
revoke all on function private.settle_order(bigint) from public,anon,authenticated;

create or replace function public.settle_online_order(p_order_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (private.is_admin() or exists(select 1 from public.orders where id=p_order_id and buyer_id=auth.uid())
    or exists(select 1 from public.order_items where order_id=p_order_id and (seller_id=auth.uid() or consignor_id=auth.uid()))) then raise exception 'Không có quyền xử lý đơn.'; end if;
  perform private.settle_order(p_order_id);
  return jsonb_build_object('success',true,'settled',true,'order_id',p_order_id);
end $$;

create or replace function public.update_order_status(p_order_id bigint,p_new_status text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare o public.orders; allowed boolean; states text[]:=array['pending','confirmed','shipping','delivered','completed'];
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng.'; end if;
  allowed:=private.is_admin() or (exists(select 1 from public.order_items where order_id=o.id and seller_id=auth.uid())
    and not exists(select 1 from public.order_items where order_id=o.id and seller_id<>auth.uid()))
    or (p_new_status='completed' and o.buyer_id=auth.uid());
  if not allowed then raise exception 'Không có quyền cập nhật đơn.'; end if;
  if p_new_status='completed' and o.buyer_id<>auth.uid() and not private.is_admin() then
    raise exception 'Chỉ người mua hoặc quản trị viên được xác nhận đã nhận hàng.';
  end if;
  if o.status='cancelled' or p_new_status is null or not(p_new_status=any(states)) then raise exception 'Trạng thái không hợp lệ.'; end if;
  if o.status=p_new_status then
    if p_new_status='completed' then perform private.settle_order(o.id); end if;
    return true;
  end if;
  if array_position(states,p_new_status)<>array_position(states,o.status)+1 then raise exception 'Vui lòng cập nhật lần lượt từng trạng thái.'; end if;
  if o.payment_method<>'cash' and (o.payment_status<>'paid' or o.needs_payment_review) then raise exception 'Đơn đang chờ đối soát thanh toán.'; end if;
  update public.orders set status=p_new_status,updated_at=now() where id=o.id;
  if p_new_status='completed' then perform private.settle_order(o.id); end if;
  insert into public.order_status_history(order_id,status,changed_by,note) values(o.id,p_new_status,auth.uid(),'Cập nhật trạng thái và giải ngân nguyên tử.');
  return true;
end $$;

create or replace function public.cancel_order(p_order_id bigint) returns json
language plpgsql security definer set search_path = '' as $$
declare o public.orders; b public.iuh_wallets; a public.iuh_wallets; r record; refund numeric:=0;
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found or not(o.buyer_id=auth.uid() or private.is_admin()) then raise exception 'Không có quyền hủy đơn.'; end if;
  if o.status='cancelled' then return json_build_object('success',true,'already_cancelled',true,'refunded',false); end if;
  if o.status not in ('pending','confirmed') or o.settled_at is not null then raise exception 'Đơn hiện không thể hủy.'; end if;
  if o.needs_payment_review then raise exception 'Đơn cũ cần quản trị viên đối soát trước khi hủy/hoàn tiền.'; end if;
  if o.payment_status='paid' then
    if o.captured_amount<>o.total_amount or o.escrow_admin_id is null then raise exception 'Thiếu chứng từ giữ hộ, cần đối soát.'; end if;
    insert into public.iuh_wallets(user_id) values(o.buyer_id) on conflict(user_id) do nothing;
    perform 1 from public.iuh_wallets where user_id in(o.buyer_id,o.escrow_admin_id) order by user_id for update;
    select * into b from public.iuh_wallets where user_id=o.buyer_id;
    select * into a from public.iuh_wallets where user_id=o.escrow_admin_id;
    refund:=o.captured_amount;
    if o.payment_method='qr' then
      insert into public.bank_refund_requests(order_id,user_id,escrow_admin_id,amount)
      values(o.id,o.buyer_id,o.escrow_admin_id,refund);
    else
    update public.iuh_wallets set pending=pending-refund,updated_at=now() where id=a.id;
    update public.iuh_wallets set balance=balance+refund,updated_at=now() where id=b.id;
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description) values
      (a.id,a.user_id,'payment','Hoàn tiền đơn hàng',refund,'Đơn '||o.order_code),
      (b.id,b.user_id,'deposit','Hoàn tiền đơn hàng',refund,'Đơn '||o.order_code);
    end if;
  end if;
  for r in select product_id,sum(quantity)::integer qty from public.order_items where order_id=o.id group by product_id order by product_id loop
    update public.products set quantity=quantity+r.qty,status=case when status='deleted' and quantity=0 then 'active' else status end,updated_at=now() where id=r.product_id;
  end loop;
  update public.orders set status='cancelled',payment_status=case when refund>0 and o.payment_method='qr' then 'refund_pending' when refund>0 then 'refunded' else 'unpaid' end,updated_at=now() where id=o.id;
  update public.consignment_requests c set status='selling',updated_at=now() where status='sold' and exists
    (select 1 from public.products p join public.order_items i on i.product_id=p.id where i.order_id=o.id and p.consignment_request_id=c.id);
  insert into public.order_status_history(order_id,status,changed_by,note) values(o.id,'cancelled',auth.uid(),case when refund>0 and o.payment_method='qr' then 'Hủy đơn; chờ hoàn tiền ngân hàng.' else 'Hủy đơn; đã xử lý số dư nội bộ nếu có.' end);
  return json_build_object('success',true,'refunded',refund>0 and o.payment_method<>'qr','refund_pending',refund>0 and o.payment_method='qr','refund_amount',refund,'order_id',o.id);
end $$;

-- Old two-step checkout must never debit again.
create or replace function public.pay_order_to_admin(p_order_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  select * into o from public.orders where id=p_order_id;
  if not found or o.buyer_id<>auth.uid() then raise exception 'Không có quyền xem thanh toán.'; end if;
  if o.payment_status<>'paid' then raise exception 'Đơn chưa thanh toán; vui lòng dùng luồng đặt hàng mới hoặc chờ đối soát.'; end if;
  return jsonb_build_object('success',true,'already_paid',true,'order_id',o.id);
end $$;

create or replace function public.create_product_with_boost(p_name text,p_category text,p_quantity integer,p_price numeric,
  p_description text,p_image_urls jsonb,p_boost boolean,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); pid bigint; h text; oldhash text; freeboost boolean; fee numeric:=0;
  a uuid; w public.iuh_wallets; aw public.iuh_wallets;
begin
  if uid is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  if nullif(btrim(p_idempotency_key),'') is null or length(p_idempotency_key)>100 then raise exception 'Yêu cầu không hợp lệ.'; end if;
  if nullif(btrim(p_name),'') is null or length(p_name)>200 or nullif(btrim(p_category),'') is null
    or p_quantity is null or p_quantity<1 or p_price is null or p_price<1000 or p_price<>round(p_price)
    or nullif(btrim(p_description),'') is null or length(p_description)>2000 then raise exception 'Thông tin sản phẩm không hợp lệ.'; end if;
  if jsonb_typeof(p_image_urls) is distinct from 'array' or jsonb_array_length(p_image_urls) not between 1 and 5 then raise exception 'Cần từ 1 đến 5 ảnh.'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_image_urls) u where u not like
    'https://xecxofmogvqysejjpxvl.supabase.co/storage/v1/object/public/products/'||uid::text||'/%') then raise exception 'Ảnh phải thuộc tài khoản đăng tin.'; end if;
  if not exists(select 1 from public.users where user_id=uid and (terms_accepted=true or lower(role) in('admin','moderator'))) then raise exception 'Vui lòng đồng ý điều khoản đăng tin.'; end if;
  h:=md5(jsonb_build_array(p_name,p_category,p_quantity,p_price,p_description,p_image_urls,p_boost)::text);
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_idempotency_key,0));
  select id,creation_hash into pid,oldhash from public.products where seller_id=uid and creation_key=p_idempotency_key;
  if found then
    if oldhash<>h then raise exception 'Yêu cầu đăng tin đã thay đổi. Vui lòng tải lại trang.'; end if;
    return jsonb_build_object('success',true,'id',pid,'already_created',true);
  end if;
  select exists(select 1 from public.service_package_members m join public.service_packages s on s.id=m.package_id
    where m.user_id=uid and s.status='active' and s.expires_at>now()) into freeboost;
  if coalesce(p_boost,false) and not freeboost then
    fee:=3000; a:=private.commerce_admin_id();
    if a is null then raise exception 'Chưa thiết lập ví nhận phí.'; end if;
    insert into public.iuh_wallets(user_id) values(uid),(a) on conflict(user_id) do nothing;
    perform 1 from public.iuh_wallets where user_id in(uid,a) order by user_id for update;
    select * into w from public.iuh_wallets where user_id=uid;
    select * into aw from public.iuh_wallets where user_id=a;
    if w.balance<fee then raise exception 'Cần 3.000đ trong ví hoặc gói dịch vụ còn hạn để đẩy tin.'; end if;
    update public.iuh_wallets set balance=balance-fee,updated_at=now() where id=w.id;
    update public.iuh_wallets set balance=balance+fee,updated_at=now() where id=aw.id;
  end if;
  insert into public.products(seller_id,name,category,quantity,price,description,image_urls,status,
    is_boosted,boost_started_at,boost_expires_at,creation_key,creation_hash)
  values(uid,btrim(p_name),p_category,p_quantity,p_price,btrim(p_description),p_image_urls,'active',coalesce(p_boost,false),
    case when p_boost then now() end,case when p_boost then now()+interval '24 hours' end,p_idempotency_key,h) returning id into pid;
  if fee>0 then
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description) values
      (w.id,uid,'payment','Phí đẩy tin',fee,'Sản phẩm #'||pid),
      (aw.id,a,'sale','Phí đẩy tin',fee,'Sản phẩm #'||pid);
  end if;
  return jsonb_build_object('success',true,'id',pid,'boost_fee',fee,'package_benefit',freeboost and coalesce(p_boost,false));
end $$;

create or replace function public.set_product_status(p_product_id bigint,p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.products;
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  select * into p from public.products where id=p_product_id for update;
  if not found or not(p.seller_id=auth.uid() or private.is_admin()) then raise exception 'Không có quyền cập nhật tin.'; end if;
  if p_status is null or p_status not in('active','hidden','deleted') then raise exception 'Trạng thái không hợp lệ.'; end if;
  if p_status='active' and p.quantity<=0 then raise exception 'Tin hết hàng không thể khôi phục.'; end if;
  update public.products set status=p_status,updated_at=now() where id=p.id;
  return jsonb_build_object('success',true,'id',p.id,'status',p_status);
end $$;

create or replace function public.pay_order_platform_fee(p_order_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders; uid uuid:=auth.uid(); a uuid; w public.iuh_wallets; aw public.iuh_wallets; fee numeric;
begin
  if uid is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found or o.payment_method<>'cash' or o.order_type<>'normal' or o.status<>'completed' then raise exception 'Đơn chưa có phí COD cần thanh toán.'; end if;
  if not exists(select 1 from public.order_items where order_id=o.id and seller_id=uid)
    or exists(select 1 from public.order_items where order_id=o.id and seller_id<>uid) then raise exception 'Bạn không phải người bán của toàn đơn.'; end if;
  if o.platform_fee_paid_at is not null then return jsonb_build_object('success',true,'already_paid',true,'order_id',o.id); end if;
  select o.total_amount-coalesce(sum(subtotal),0) into fee from public.order_items where order_id=o.id;
  if fee<0 then raise exception 'Đơn cũ có số liệu phí không hợp lệ, cần đối soát.'; end if;
  if fee>0 then
    a:=private.commerce_admin_id();
    if a is null then raise exception 'Chưa thiết lập ví thu phí.'; end if;
    insert into public.iuh_wallets(user_id) values(uid),(a) on conflict(user_id) do nothing;
    perform 1 from public.iuh_wallets where user_id in(uid,a) order by user_id for update;
    select * into w from public.iuh_wallets where user_id=uid;
    select * into aw from public.iuh_wallets where user_id=a;
    if w.balance<fee then raise exception 'Số dư ví không đủ để thanh toán phí.'; end if;
    update public.iuh_wallets set balance=balance-fee,updated_at=now() where id=w.id;
    update public.iuh_wallets set balance=balance+fee,updated_at=now() where id=aw.id;
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description) values
      (w.id,uid,'payment','Phí đơn COD',fee,'Đơn '||o.order_code),
      (aw.id,a,'sale','Phí đơn COD',fee,'Đơn '||o.order_code);
  end if;
  update public.orders set platform_fee_paid_at=now(),updated_at=now() where id=o.id;
  return jsonb_build_object('success',true,'order_id',o.id,'fee_amount',fee);
end $$;

-- Direct ordinary edits cannot assign paid entitlements or consignment ownership.
-- SECURITY INVOKER retains current_user, so audited definer RPCs can set these fields.
create or replace function private.guard_product_fields() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') or private.is_admin() then return new; end if;
  if tg_op='INSERT' then
    if new.is_boosted or new.boost_started_at is not null or new.boost_expires_at is not null
      or new.is_consignment or new.consignment_request_id is not null or new.creation_key is not null or new.creation_hash is not null then
      raise exception 'Các quyền đẩy tin và ký gửi phải do hệ thống xác nhận.';
    end if;
  elsif row(new.is_boosted,new.boost_started_at,new.boost_expires_at,new.is_consignment,new.consignment_request_id,new.creation_key,new.creation_hash,new.seller_id)
    is distinct from row(old.is_boosted,old.boost_started_at,old.boost_expires_at,old.is_consignment,old.consignment_request_id,old.creation_key,old.creation_hash,old.seller_id) then
    raise exception 'Không được sửa quyền đẩy tin, ký gửi hoặc chủ tin.';
  end if;
  return new;
end $$;
drop trigger if exists guard_product_fields on public.products;
create trigger guard_product_fields before insert or update on public.products for each row execute function private.guard_product_fields();

create or replace function public.get_my_orders() returns setof jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  return query select to_jsonb(o)||jsonb_build_object('order_items',coalesce(
    (select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb))
  from public.orders o where o.buyer_id=auth.uid() or exists(select 1 from public.order_items i
    where i.order_id=o.id and (i.seller_id=auth.uid() or i.consignor_id=auth.uid())) order by o.created_at desc;
end $$;
revoke all on function public.get_my_orders() from public,anon;
grant execute on function public.get_my_orders() to authenticated;
revoke all on function public.pay_boost_fee(),public.record_boost_qr_payment() from public,anon,authenticated;
revoke all on function public.create_order(text,text,text,text,text,numeric,text,numeric,numeric,jsonb,bigint[],text),
 public.admin_confirm_order_payment(bigint,text),public.settle_online_order(bigint),public.update_order_status(bigint,text),
 public.cancel_order(bigint),public.pay_order_to_admin(bigint),
 public.create_product_with_boost(text,text,integer,numeric,text,jsonb,boolean,text),public.set_product_status(bigint,text),public.pay_order_platform_fee(bigint)
 from public,anon;
grant execute on function public.create_order(text,text,text,text,text,numeric,text,numeric,numeric,jsonb,bigint[],text),
 public.admin_confirm_order_payment(bigint,text),public.settle_online_order(bigint),public.update_order_status(bigint,text),
 public.cancel_order(bigint),public.pay_order_to_admin(bigint),
 public.create_product_with_boost(text,text,integer,numeric,text,jsonb,boolean,text),public.set_product_status(bigint,text),public.pay_order_platform_fee(bigint)
 to authenticated;
