create table public.iuh_trial_settings (
    id boolean primary key default true check (id),
    enabled boolean not null default true
);
insert into public.iuh_trial_settings(id, enabled) values (true, true);
alter table public.iuh_trial_settings enable row level security;
revoke all on public.iuh_trial_settings from public, anon, authenticated;

create function private.iuh_trial_mode_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
    select coalesce((select enabled from public.iuh_trial_settings where id), false);
$$;
revoke all on function private.iuh_trial_mode_enabled() from public, anon, authenticated;

create function public.set_iuh_trial_mode(p_enabled boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
    if auth.uid() is null or not private.is_admin() then
        raise exception 'Chỉ Admin được thay đổi chế độ dùng thử.' using errcode = '42501';
    end if;
    update public.iuh_trial_settings set enabled = p_enabled where id;
    return p_enabled;
end;
$$;
revoke all on function public.set_iuh_trial_mode(boolean) from public, anon;
grant execute on function public.set_iuh_trial_mode(boolean) to authenticated;

alter table public.service_package_payments drop constraint if exists service_package_payments_payment_method_check;
alter table public.service_package_payments add constraint service_package_payments_payment_method_check
    check (payment_method in ('wallet', 'bank', 'trial'));
alter table public.service_packages drop constraint if exists service_packages_payment_method_check;
alter table public.service_packages add constraint service_packages_payment_method_check
  check (payment_method in ('wallet', 'bank', 'trial'));

create or replace function private.fulfill_service_package_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    v_payment public.service_package_payments%rowtype;
    v_package public.service_packages%rowtype;
    v_admin uuid;
    v_admin_wallet bigint;
    v_buyer_wallet bigint;
    v_balance numeric;
    v_expiry timestamptz;
begin
    perform pg_advisory_xact_lock(192837, 1);
    select * into v_payment from public.service_package_payments where id = p_payment_id for update;
    if v_payment.id is null then raise exception 'Không tìm thấy yêu cầu thanh toán.'; end if;
    if v_payment.status = 'paid' then return private.service_package_receipt(v_payment); end if;
    if v_payment.status <> 'pending' then raise exception 'Yêu cầu này đã được hủy.'; end if;
    if v_payment.payment_method = 'trial' and not private.iuh_trial_mode_enabled() then
        raise exception 'Chế độ thanh toán thử nghiệm hiện đã tắt.';
    end if;

    select * into v_package from public.service_packages
    where owner_id = v_payment.owner_id and status in ('pending', 'active')
    order by created_at desc limit 1 for update;
    if v_package.status = 'active' and v_package.expires_at > now()
       and v_package.plan_type <> v_payment.plan_type then
        raise exception 'Gói hiện tại còn hạn. Chỉ có thể gia hạn cùng gói; đổi loại gói sau khi hết hạn.';
    end if;
    if cardinality(v_payment.member_ids) > 2
       or (v_payment.plan_type = 'personal' and cardinality(v_payment.member_ids) <> 0)
       or v_payment.owner_id = any(v_payment.member_ids)
       or array_position(v_payment.member_ids, null) is not null
       or (select count(distinct x) from unnest(v_payment.member_ids) x) <> cardinality(v_payment.member_ids) then
        raise exception 'Danh sách thành viên không hợp lệ. Nhóm tối đa 3 tài khoản gồm chủ gói.';
    end if;
    if (select count(*) from public.users where user_id = any(v_payment.member_ids)) <> cardinality(v_payment.member_ids) then
        raise exception 'Một thành viên không còn tài khoản hợp lệ.';
    end if;
    if exists (
        select 1 from public.service_packages p
        left join public.service_package_members m on m.package_id = p.id
        where p.status = 'active' and p.expires_at > now()
          and p.id is distinct from v_package.id
          and (p.owner_id = any(array_append(v_payment.member_ids, v_payment.owner_id))
               or m.user_id = any(array_append(v_payment.member_ids, v_payment.owner_id)))
    ) then raise exception 'Bạn hoặc một thành viên đang dùng gói khác. Vui lòng chờ gói đó hết hạn.'; end if;

    if v_payment.payment_method <> 'trial' then
        select user_id into v_admin from public.users where lower(role) = 'admin' order by user_id limit 1;
        if v_admin is null then raise exception 'Chưa có tài khoản Admin nhận thanh toán.'; end if;
        insert into public.iuh_wallets(user_id) values(v_admin) on conflict(user_id) do nothing;
        if v_payment.payment_method = 'wallet' then
            insert into public.iuh_wallets(user_id) values(v_payment.owner_id) on conflict(user_id) do nothing;
        end if;
        perform 1 from public.iuh_wallets
        where user_id in (v_admin, v_payment.owner_id) order by id for update;
        select id into v_admin_wallet from public.iuh_wallets where user_id = v_admin;
        if v_payment.payment_method = 'wallet' then
            select id, balance into v_buyer_wallet, v_balance from public.iuh_wallets where user_id = v_payment.owner_id;
            if v_balance < v_payment.price then raise exception 'Số dư Ví IUH không đủ.'; end if;
            update public.iuh_wallets set balance = balance - v_payment.price, updated_at = now() where id = v_buyer_wallet;
            insert into public.wallet_transactions(wallet_id, user_id, type, title, amount, description)
            values(v_buyer_wallet, v_payment.owner_id, 'payment', 'Thanh toán gói dịch vụ', v_payment.price, v_payment.transaction_code);
        end if;
        update public.iuh_wallets set balance = balance + v_payment.price, updated_at = now() where id = v_admin_wallet;
        insert into public.wallet_transactions(wallet_id, user_id, type, title, amount, description)
        values(v_admin_wallet, v_admin, 'fee', 'Gói dịch vụ', v_payment.price, v_payment.transaction_code || ' / ' || v_payment.payment_method);
    end if;

    v_expiry := greatest(now(), case when v_package.status = 'active' then v_package.expires_at else now() end) + interval '30 days';
    if v_package.id is null then
        insert into public.service_packages(owner_id, plan_type, price, payment_method, transaction_code, status, starts_at, expires_at)
        values(v_payment.owner_id, v_payment.plan_type, v_payment.price, v_payment.payment_method,
            v_payment.transaction_code, 'active', now(), v_expiry) returning * into v_package;
    else
        update public.service_packages set plan_type = v_payment.plan_type, price = v_payment.price,
            payment_method = v_payment.payment_method, transaction_code = v_payment.transaction_code,
            status = 'active', starts_at = case when expires_at > now() and status = 'active' then starts_at else now() end,
            expires_at = v_expiry where id = v_package.id returning * into v_package;
    end if;
    delete from public.service_package_members where package_id = v_package.id and member_role = 'member';
    insert into public.service_package_members(package_id, user_id, member_role)
    values(v_package.id, v_payment.owner_id, 'owner') on conflict(package_id, user_id) do update set member_role = 'owner';
    insert into public.service_package_members(package_id, user_id, member_role)
    select v_package.id, id, 'member' from unnest(v_payment.member_ids) id;
    update public.service_package_payments set status = 'paid', package_id = v_package.id,
        expires_at = v_expiry, completed_at = now() where id = v_payment.id returning * into v_payment;
    return private.service_package_receipt(v_payment);
end;
$$;

create or replace function public.purchase_service_package(
    p_plan_type text, p_payment_method text, p_transaction_code text, p_member_ids uuid[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_payment public.service_package_payments%rowtype; v_members uuid[];
begin
    if v_user is null then raise exception 'Vui lòng đăng nhập.'; end if;
    if p_plan_type is null or p_plan_type not in ('personal', 'group')
       or p_payment_method is null or p_payment_method not in ('wallet', 'bank', 'trial') then raise exception 'Gói hoặc phương thức không hợp lệ.'; end if;
    if p_payment_method = 'trial' and not private.iuh_trial_mode_enabled() then raise exception 'Chế độ thanh toán thử nghiệm hiện đã tắt.'; end if;
    if p_transaction_code is null or p_transaction_code !~ '^[A-Za-z0-9_-]{12,80}$' then raise exception 'Mã giao dịch không hợp lệ.'; end if;
    select coalesce(array_agg(x order by x), '{}'::uuid[]) into v_members from unnest(coalesce(p_member_ids, '{}'::uuid[])) x;
    if cardinality(v_members) > 2 or (p_plan_type = 'personal' and cardinality(v_members) > 0)
       or v_user = any(v_members) or array_position(v_members, null) is not null
       or (select count(distinct x) from unnest(v_members) x) <> cardinality(v_members) then
        raise exception 'Danh sách thành viên không hợp lệ.';
    end if;
    perform pg_advisory_xact_lock(192837, 1);
    select * into v_payment from public.service_package_payments where transaction_code = p_transaction_code for update;
    if v_payment.id is not null then
        if v_payment.owner_id <> v_user or v_payment.plan_type <> p_plan_type
           or v_payment.payment_method <> p_payment_method or v_payment.member_ids <> v_members then
            raise exception 'Mã giao dịch đã được dùng cho yêu cầu khác.';
        end if;
        if v_payment.status = 'cancelled' then raise exception 'Yêu cầu này đã được hủy. Vui lòng tạo yêu cầu mới.'; end if;
        return private.service_package_receipt(v_payment);
    end if;
    if exists(select 1 from public.service_package_payments where owner_id = v_user and status = 'pending') then
        raise exception 'Bạn đang có yêu cầu chuyển khoản chờ xác nhận. Hãy xử lý hoặc hủy yêu cầu đó trước.';
    end if;
    if exists(select 1 from public.service_packages where owner_id = v_user and status = 'active'
       and expires_at > now() and plan_type <> p_plan_type) then
        raise exception 'Gói hiện tại còn hạn. Chỉ có thể gia hạn cùng gói; đổi loại gói sau khi hết hạn.';
    end if;
    insert into public.service_package_payments(owner_id, transaction_code, plan_type, price, payment_method, member_ids)
    values(v_user, p_transaction_code, p_plan_type, case when p_plan_type = 'personal' then 19000 else 29000 end,
        p_payment_method, v_members) returning * into v_payment;
    if p_payment_method = 'bank' then return private.service_package_receipt(v_payment); end if;
    return private.fulfill_service_package_payment(v_payment.id);
end;
$$;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('cash', 'qr', 'iuh_wallet', 'trial'));

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
  if p_payment_method is null or p_payment_method not in ('cash','qr','iuh_wallet','trial') then raise exception 'Phương thức thanh toán không hợp lệ.'; end if;
  if p_payment_method = 'trial' and not private.iuh_trial_mode_enabled() then raise exception 'Chế độ thanh toán thử nghiệm hiện đã tắt.'; end if;
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
    shipping_method,shipping_fee,payment_method,subtotal,total_amount,order_type,status,payment_status,
    captured_amount,paid_at,idempotency_key,request_hash)
  values('IUH'||replace(gen_random_uuid()::text,'-',''),uid,btrim(p_recipient_name),btrim(p_recipient_phone),btrim(p_recipient_address),p_note,
    p_shipping_method,shipping,p_payment_method,subtotal,total,case when cons then 'consignment' else 'normal' end,'pending',
    case when p_payment_method='trial' then 'paid' else 'unpaid' end,
    0,
    case when p_payment_method='trial' then now() else null end,p_idempotency_key,h)
  returning * into o;
  for r in select * from jsonb_to_recordset(authoritative) as x(id bigint,seller uuid,consignor uuid,name text,image text,price numeric,qty integer) loop
    insert into public.order_items(order_id,product_id,seller_id,consignor_id,product_name,product_image,price,quantity,subtotal)
    values(o.id,r.id,r.seller,r.consignor,r.name,r.image,r.price,r.qty,r.price*r.qty);
    update public.products set quantity=quantity-r.qty,status=case when quantity-r.qty=0 then 'deleted' else status end,updated_at=now() where id=r.id;
  end loop;
  if p_payment_method='iuh_wallet' then perform private.capture_order(o.id); end if;
  delete from public.cart_items where user_id=uid and id=any(coalesce(p_cart_ids,'{}'::bigint[]))
    and product_id in(select (i->>'id')::bigint from jsonb_array_elements(authoritative) i);
  insert into public.order_status_history(order_id,status,changed_by,note)
  values(o.id,'pending',uid,case when p_payment_method='trial' then 'Đơn được tạo ở chế độ dùng thử miễn phí.' else 'Đơn được tạo; thanh toán được xử lý nguyên tử.' end);
  return json_build_object('success',true,'order_id',o.id,'order_code',o.order_code,
    'payment_status',case when p_payment_method in ('iuh_wallet','trial') then 'paid' else 'unpaid' end,'total_amount',total);
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
  if o.payment_status='paid' and o.payment_method<>'trial' then
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
  for r in select product_id,sum(quantity)::integer qty from public.order_items where order_id=p_order_id group by product_id order by product_id loop
    update public.products set quantity=quantity+r.qty,status=case when status='deleted' and quantity=0 then 'active' else status end,updated_at=now() where id=r.product_id;
  end loop;
  update public.orders set status='cancelled',payment_status=case when refund>0 and o.payment_method='qr' then 'refund_pending' when refund>0 then 'refunded' else 'unpaid' end,updated_at=now() where id=o.id;
  update public.consignment_requests c set status='selling',updated_at=now() where status='sold' and exists
    (select 1 from public.products p join public.order_items i on i.product_id=p.id where i.order_id=o.id and p.consignment_request_id=c.id);
  insert into public.order_status_history(order_id,status,changed_by,note) values(o.id,'cancelled',auth.uid(),case when refund>0 and o.payment_method='qr' then 'Hủy đơn; chờ hoàn tiền ngân hàng.' else 'Hủy đơn; đã xử lý số dư nội bộ nếu có.' end);
  return json_build_object('success',true,'order_id',o.id,'refunded',refund>0,
    'refund_pending',refund>0 and o.payment_method='qr','refund_amount',refund);
end $$;

alter function private.settle_order(bigint) rename to settle_order_before_trial;
create or replace function private.settle_order(p_order_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
    select * into o from public.orders where id = p_order_id for update;
      if o.payment_method = 'trial' then
        if o.status <> 'completed' then raise exception 'Đơn hàng chưa hoàn tất.'; end if;
        update public.orders set settled_at = now(), updated_at = now() where id = o.id and settled_at is null;
        return;
    end if;
      perform private.settle_order_before_trial(p_order_id);
end;
$$;
revoke all on function private.settle_order(bigint) from public, anon, authenticated;

drop view public.admin_order_financials;
create view public.admin_order_financials with (security_invoker=true) as
select o.id order_id,o.total_amount,o.subtotal,o.shipping_fee,
 coalesce(s.net,0) seller_net,o.subtotal-coalesce(s.net,0) platform_fee,
 case when o.order_type='consignment' then 10 else 5 end fee_rate,
 case when o.payment_method='trial' then 'trial' when o.payos_order_code is null then 'wallet' else 'bank' end payout_method,
 case when o.payment_method='trial' then 'trial'
 when o.needs_payment_review then 'review' when o.payment_method='cash' then 'cash'
 when o.payment_status<>'paid' or o.status<>'completed' or o.settled_at is null then 'not_ready'
 when o.payos_order_code is null then 'wallet_credited'
 when exists(select 1 from public.order_bank_payouts p where p.order_id=o.id and p.status='pending') then 'pending' else 'paid' end payout_status,
 coalesce((select sum(amount) from public.order_bank_payouts p where p.order_id=o.id and status='pending'),0) remaining_payout
from public.orders o left join lateral (
 select sum(amount) net from (select round(sum(subtotal)*case when o.order_type='consignment' then 0.9 else 1 end) amount
 from public.order_items where order_id=o.id group by coalesce(consignor_id,seller_id)) x
) s on true where (select private.is_admin());
revoke all on public.admin_order_financials from public,anon;
grant select on public.admin_order_financials to authenticated;