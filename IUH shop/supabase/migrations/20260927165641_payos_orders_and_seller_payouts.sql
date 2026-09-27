-- Order codes share the package sequence so the webhook can route unambiguously.
alter table public.orders
 add column payos_order_code bigint unique,
 add column payos_link_id text,
 add column payos_checkout_url text,
 add column payos_status text check(payos_status in ('creating','pending','paid','cancelled','expired','review')),
 add column payos_expires_at timestamptz,
 add column payos_received_amount bigint,
 add column payos_reference text,
 add column payos_note text,
 add column payos_checked_at timestamptz;
grant select on public.orders to service_role;

create table public.order_bank_payouts (
 id uuid primary key default gen_random_uuid(),
 order_id bigint not null references public.orders(id),
 seller_id uuid not null references public.users(user_id),
 amount numeric(14,2) not null check(amount>0),
 status text not null default 'pending' check(status in ('pending','paid')),
 bank_reference text, paid_by uuid references auth.users(id),paid_at timestamptz,
 created_at timestamptz not null default now(),unique(order_id,seller_id)
);
create index order_bank_payouts_seller on public.order_bank_payouts(seller_id);
create index order_bank_payouts_pending on public.order_bank_payouts(order_id) where status='pending';
alter table public.order_bank_payouts enable row level security;
revoke all on public.order_bank_payouts from public,anon,authenticated;
grant select on public.order_bank_payouts to authenticated;
create policy order_payouts_read on public.order_bank_payouts for select to authenticated
 using(seller_id=(select auth.uid()) or (select private.is_admin()));

create function private.guard_payos_order() returns trigger language plpgsql set search_path='' as $$
begin
 if old.payos_order_code is not null and current_setting('role',true)<>'service_role' then
  if new.payment_status='paid' and old.payment_status<>'paid' then raise exception 'Thanh toán payOS phải được xác minh qua cổng thanh toán.'; end if;
  if new.status='cancelled' and old.status<>'cancelled' and old.payment_status='unpaid' and old.payos_status in ('creating','pending') then
   raise exception 'Cần kiểm tra và hủy link payOS trước khi hủy đơn.';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_payos_order() from public,anon,authenticated;
create trigger guard_payos_order before update on public.orders for each row execute function private.guard_payos_order();

create function public.payos_prepare_order(p_order_id bigint,p_buyer_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_order_id and buyer_id=p_buyer_id for update;
 if o.id is null or o.payment_method<>'qr' then raise exception 'Không tìm thấy đơn chuyển khoản của bạn.'; end if;
 if o.needs_payment_review then raise exception 'Đơn này cần hỗ trợ đối soát.'; end if;
 if o.payment_status<>'unpaid' or o.status='cancelled' then return to_jsonb(o); end if;
 if o.total_amount<=0 or o.total_amount<>trunc(o.total_amount) or o.total_amount>9007199254740991 then raise exception 'Số tiền không hợp lệ.'; end if;
 if o.payos_order_code is null then
  update public.orders set payos_order_code=nextval('private.payos_order_codes'),payos_status='creating',payos_expires_at=now()+interval '30 minutes' where id=o.id returning * into o;
 end if;
 return to_jsonb(o);
end $$;
create function public.payos_bind_order(p_order_code bigint,p_link_id text,p_checkout_url text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_link_id is null or p_link_id!~'^[A-Za-z0-9_-]{10,100}$' or p_checkout_url is distinct from ('https://pay.payos.vn/web/'||p_link_id) then raise exception 'Link thanh toán không hợp lệ.'; end if;
 update public.orders set payos_link_id=p_link_id,payos_checkout_url=p_checkout_url,
 payos_status=case when payos_status='creating' then 'pending' else payos_status end
 where payos_order_code=p_order_code and (payos_link_id is null or payos_link_id=p_link_id);
 if not found then raise exception 'Không khớp mã thanh toán.'; end if;
end $$;
create function public.payos_claim_order_check(p_order_code bigint) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.orders set payos_checked_at=now() where payos_order_code=p_order_code and (payos_checked_at is null or payos_checked_at<now()-interval '5 seconds');
 return found;
end $$;
create function public.payos_sync_order(p_order_code bigint,p_link_id text,p_state text,p_amount bigint,p_received bigint,p_reference text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders; failure text;
begin
 select * into o from public.orders where payos_order_code=p_order_code for update;
 if o.id is null or o.payos_link_id is distinct from p_link_id then raise exception 'Không khớp đơn thanh toán.'; end if;
 if o.payos_status='paid' then return to_jsonb(o); end if;
 if p_amount is distinct from o.total_amount or p_received is null or p_received<0 then raise exception 'Số tiền không hợp lệ.'; end if;
 update public.orders set payos_checked_at=now(),payos_received_amount=p_received where id=o.id returning * into o;
 if o.payos_status='review' then return to_jsonb(o); end if;
 if p_state='PAID' or p_received>0 and p_state in ('CANCELLED','EXPIRED') then
  if p_state<>'PAID' or p_received<>o.total_amount or o.status='cancelled' or o.payment_status<>'unpaid' or o.needs_payment_review then
   update public.orders set payos_status='review',needs_payment_review=true,payos_reference=p_reference,payos_note='Đã có tiền nhưng số tiền/trạng thái cần đối soát; không thanh toán lại.' where id=o.id returning * into o;
   return to_jsonb(o);
  end if;
  begin
   perform private.capture_order(o.id,p_reference);
   update public.orders set payos_status='paid',payos_reference=p_reference,payos_note=null where id=o.id returning * into o;
  exception when others then
   get stacked diagnostics failure=MESSAGE_TEXT;
   update public.orders set payos_status='review',needs_payment_review=true,payos_reference=p_reference,payos_note=left(failure,500) where id=o.id returning * into o;
  end;
 elsif p_state in ('CANCELLED','EXPIRED') and p_received=0 then
  update public.orders set payos_status=lower(p_state) where id=o.id returning * into o;
 elsif p_state in ('PENDING','PROCESSING') then
  update public.orders set payos_status='pending' where id=o.id returning * into o;
 else raise exception 'Trạng thái payOS không hợp lệ.';
 end if;
 return to_jsonb(o);
end $$;
revoke all on function public.payos_prepare_order(bigint,uuid),public.payos_bind_order(bigint,text,text),public.payos_claim_order_check(bigint),public.payos_sync_order(bigint,text,text,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.payos_prepare_order(bigint,uuid),public.payos_bind_order(bigint,text,text),public.payos_claim_order_check(bigint),public.payos_sync_order(bigint,text,text,bigint,bigint,text) to service_role;

-- Keep legacy / wallet settlement unchanged; payOS sales have a separate bank payable.
alter function private.settle_order(bigint) rename to settle_order_wallet;
create function private.settle_order(p_order_id bigint) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders; payout numeric; fee numeric; a public.iuh_wallets;
begin
 select * into o from public.orders where id=p_order_id for update;
 if o.payos_order_code is null then perform private.settle_order_wallet(p_order_id); return; end if;
 if o.status<>'completed' then raise exception 'Đơn hàng chưa hoàn tất.'; end if;
 if o.settled_at is not null then return; end if;
 if o.needs_payment_review or o.payment_status<>'paid' or o.payos_status<>'paid' or o.captured_amount<>o.total_amount or o.escrow_admin_id is null then raise exception 'Đơn chưa được xác minh thanh toán.'; end if;
 if not exists(select 1 from public.order_items where order_id=o.id) or exists(select 1 from public.order_items where order_id=o.id and o.order_type='consignment' and consignor_id is null) then raise exception 'Thiếu thông tin người hưởng tiền.'; end if;
 insert into public.order_bank_payouts(order_id,seller_id,amount)
 select o.id,coalesce(consignor_id,seller_id),round(sum(subtotal)*case when o.order_type='consignment' then 0.9 else 1 end)
 from public.order_items where order_id=o.id group by 2;
 select sum(amount) into payout from public.order_bank_payouts where order_id=o.id;
 fee:=o.captured_amount-payout;
 if payout<=0 or fee<0 then raise exception 'Số tiền phân bổ không hợp lệ.'; end if;
 select * into a from public.iuh_wallets where user_id=o.escrow_admin_id for update;
 if a.id is null or a.pending<o.captured_amount then raise exception 'Thiếu số dư tiền giữ hộ.'; end if;
 update public.iuh_wallets set pending=pending-fee,balance=balance+fee,updated_at=now() where id=a.id;
 if fee>0 then insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description)
 values(a.id,a.user_id,'sale','Phí dịch vụ đã hoàn tất',fee,'Đơn '||o.order_code); end if;
 update public.orders set settled_at=now(),updated_at=now() where id=o.id;
 update public.consignment_requests c set status='completed',payout_status='pending',paid_at=null,updated_at=now()
 where exists(select 1 from public.products p join public.order_items i on i.product_id=p.id where i.order_id=o.id and p.consignment_request_id=c.id);
end $$;
revoke all on function private.settle_order(bigint) from public,anon,authenticated;

create function public.admin_complete_order_payout(p_payout_id uuid,p_reference text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.order_bank_payouts; o public.orders; a public.iuh_wallets;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ quản trị viên được ghi nhận chuyển tiền.' using errcode='42501'; end if;
 select * into p from public.order_bank_payouts where id=p_payout_id;
 if p.id is null then raise exception 'Không tìm thấy khoản cần chuyển.'; end if;
 select * into o from public.orders where id=p.order_id for update;
 select * into p from public.order_bank_payouts where id=p_payout_id for update;
 if p.status='paid' then return jsonb_build_object('success',true,'already_paid',true); end if;
 if o.status<>'completed' or o.payment_status<>'paid' or o.needs_payment_review or o.settled_at is null then raise exception 'Đơn chưa đủ điều kiện chuyển tiền.'; end if;
 perform private.register_bank_receipt(p_reference,'order_payout',p.id::text);
 select * into a from public.iuh_wallets where user_id=o.escrow_admin_id for update;
 if a.id is null or a.pending<p.amount then raise exception 'Thiếu số dư giữ hộ.'; end if;
 update public.iuh_wallets set pending=pending-p.amount,updated_at=now() where id=a.id;
 insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description)
 values(a.id,a.user_id,'payment','Đã chuyển ngân hàng cho người bán',p.amount,'Đơn '||o.order_code);
 update public.order_bank_payouts set status='paid',bank_reference=upper(btrim(p_reference)),paid_by=auth.uid(),paid_at=now() where id=p.id;
 return jsonb_build_object('success',true,'amount',p.amount);
end $$;
revoke all on function public.admin_complete_order_payout(uuid,text) from public,anon;
grant execute on function public.admin_complete_order_payout(uuid,text) to authenticated;

create view public.admin_order_financials with (security_invoker=true) as
select o.id order_id,o.total_amount,o.subtotal,o.shipping_fee,
 coalesce(s.net,0) seller_net,o.subtotal-coalesce(s.net,0) platform_fee,
 case when o.order_type='consignment' then 10 else 5 end fee_rate,
 case when o.payos_order_code is null then 'wallet' else 'bank' end payout_method,
 case when o.needs_payment_review then 'review' when o.payment_method='cash' then 'cash'
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
  if o.payment_method='qr' then
    if o.payos_order_code is null then perform private.register_bank_receipt(p_bank_reference,'order',o.id::text);
    else
      if current_setting('role',true)<>'service_role' then raise exception 'Thanh toán payOS phải được xác minh qua cổng thanh toán.'; end if;
      if length(coalesce(btrim(p_bank_reference),'')) not between 4 and 200 then raise exception 'Thiếu chứng từ payOS.'; end if;
      insert into public.bank_receipts(reference,kind,entity_id,source) values(upper(btrim(p_bank_reference)),'order',o.id::text,'payos') on conflict(reference) do nothing;
      if not exists(select 1 from public.bank_receipts where reference=upper(btrim(p_bank_reference)) and kind='order' and entity_id=o.id::text) then raise exception 'Chứng từ đã được dùng cho giao dịch khác.'; end if;
    end if;
  end if;
  update public.iuh_wallets set pending=pending+o.total_amount,updated_at=now() where id=aw.id;
  insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description)
    values(aw.id,a,'sale','Tiền giữ hộ đơn hàng',o.total_amount,'Đơn '||o.order_code);
  update public.orders set payment_status='paid',paid_at=now(),captured_amount=total_amount,
    escrow_admin_id=a,payment_reference=nullif(btrim(p_bank_reference),''),updated_at=now() where id=o.id;
end $$;
revoke all on function private.capture_order(bigint,text) from public,anon,authenticated;


create or replace function public.admin_operations_list(p_kind text default 'orders',p_status text default '',p_payment text default '',p_search text default '',p_page integer default 1,p_attention boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ quản trị viên được truy cập' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('orders','packages','wallet_requests','bank_refund_requests','donations','contact_requests','product_reports','user_reports','verification') or p_page is null or p_page<1 or p_page>100000 or length(p_search)>120 then raise exception 'Bộ lọc không hợp lệ'; end if;
 with filtered as materialized (
   select * from public.admin_operation_summaries s where kind=p_kind
   and (coalesce(p_status,'')='' or status=p_status)
   and (coalesce(p_payment,'')='' or payment_status=p_payment)
   and (not coalesce(p_attention,false) or attention or needs_payment_review)
   and (coalesce(p_search,'')='' or strpos(lower(concat_ws(' ',code,id,actor_name,actor_id)),lower(btrim(p_search)))>0)
 ), page as (select * from filtered order by created_at desc nulls last,id desc limit 20 offset (p_page-1)*20)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p)||case when p.kind='orders' then jsonb_build_object('finance',(select to_jsonb(f) from public.admin_order_financials f where f.order_id::text=p.id)) else '{}'::jsonb end) from page p),'[]'::jsonb),'total',(select count(*) from filtered),
 'counts',(select coalesce(jsonb_object_agg(kind,n),'{}'::jsonb) from (select kind,count(*) n from public.admin_operation_summaries where attention or needs_payment_review group by kind) c)) into result;
 return result;
end $$;

create or replace function public.admin_operation_detail(p_kind text,p_id text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare raw jsonb; record jsonb; people jsonb; items jsonb='[]'; history jsonb='[]'; receipts jsonb='[]'; payouts jsonb='[]'; actor uuid; target uuid;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ quản trị viên được truy cập' using errcode='42501'; end if;
 case p_kind
 when 'orders' then
   select to_jsonb(o),buyer_id into raw,actor from public.orders o where id=p_id::bigint;
   select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'product_id',i.product_id,'product_name',i.product_name,'quantity',i.quantity,'price',i.price,'subtotal',i.subtotal,'seller_id',i.seller_id,'seller_name',u.fullname)),'[]') into items from public.order_items i left join public.users u on u.user_id=i.seller_id where order_id=p_id::bigint;
   select coalesce(jsonb_agg(jsonb_build_object('status',h.status,'note',h.note,'created_at',h.created_at,'changed_by',h.changed_by,'actor_name',u.fullname) order by h.created_at),'[]') into history from public.order_status_history h left join public.users u on u.user_id=h.changed_by where order_id=p_id::bigint;
   select coalesce(jsonb_agg(jsonb_build_object('user_id',p.beneficiary,'fullname',u.fullname,'amount',p.amount,'payout_id',bp.id,'payout_status',bp.status,'bank_reference',bp.bank_reference,'paid_at',bp.paid_at)),'[]') into payouts from
     (select coalesce(consignor_id,seller_id) beneficiary,round(sum(subtotal)*case when raw->>'order_type'='consignment' then 0.9 else 1 end) amount from public.order_items where order_id=p_id::bigint group by 1) p
     left join public.users u on u.user_id=p.beneficiary left join public.order_bank_payouts bp on bp.order_id=p_id::bigint and bp.seller_id=p.beneficiary;
 when 'packages' then select to_jsonb(p),owner_id into raw,actor from public.service_package_payments p where id=p_id::uuid;
 when 'wallet_requests' then select to_jsonb(w),user_id into raw,actor from public.wallet_requests w where id=p_id::uuid;
 when 'bank_refund_requests' then select to_jsonb(r),user_id into raw,actor from public.bank_refund_requests r where id=p_id::uuid;
 when 'donations' then select to_jsonb(d),donor_id into raw,actor from public.donations d where id=p_id::bigint;
 when 'contact_requests' then select to_jsonb(c),user_id into raw,actor from public.contact_requests c where id=p_id::bigint;
 when 'product_reports' then select to_jsonb(r),reporter_id into raw,actor from public.product_reports r where id=p_id::bigint;
 when 'user_reports' then select to_jsonb(r),reporter_id,reported_user_id into raw,actor,target from public.user_reports r where id=p_id::bigint;
 when 'verification' then select jsonb_build_object('user_id',user_id,'fullname',fullname,'verification_status',verification_status,'student_card_url',student_card_url,'verified_at',verified_at,'created_at',created_at),user_id into raw,actor from public.users where user_id=p_id::uuid;
 else raise exception 'Nhóm không hợp lệ';
 end case;
 if raw is null then raise exception 'Không tìm thấy hồ sơ'; end if;
 -- Allowlist prevents future schema changes from accidentally exposing extra fields.
 select jsonb_object_agg(key,value) into record from jsonb_each(raw) where key=any(array[
 'id','user_id','order_id','order_code','status','payment_status','payment_method','created_at','updated_at','paid_at','settled_at','completed_at','reviewed_at','expires_at','verified_at',
 'recipient_name','recipient_phone','recipient_address','note','shipping_method','shipping_fee','subtotal','total_amount','captured_amount','payment_reference','needs_payment_review','order_type',
 'transaction_code','plan_type','price','amount','member_ids','kind','bank','account','customer_reference','bank_reference','admin_note','cancellation_reason','donor_name','bank_name','transfer_content',
 'fullname','email','phone','message','reason','description','product_id','reported_user_id','verification_status','student_card_url','payos_order_code','payos_status','payos_received_amount','payos_reference','payos_note']);
 select coalesce(jsonb_agg(jsonb_build_object('user_id',u.user_id,'fullname',u.fullname,'role',case when u.user_id=actor then 'Người tạo / người mua' else 'Người được báo cáo' end)),'[]') into people from public.users u where user_id=actor or user_id=target;
 select coalesce(jsonb_agg(jsonb_build_object('reference',b.reference,'created_at',b.created_at,'reviewed_by',u.fullname)),'[]') into receipts from public.bank_receipts b left join public.users u on u.user_id=b.reviewed_by where b.entity_id=p_id and b.kind=case p_kind when 'orders' then 'order' when 'packages' then 'service_package' when 'wallet_requests' then 'wallet_'||(raw->>'kind') when 'bank_refund_requests' then 'bank_refund' when 'donations' then 'donation' else '' end;
 return jsonb_build_object('record',record,'people',people,'items',items,'history',history,'receipts',receipts,'payouts',payouts,'finance',case when p_kind='orders' then (select to_jsonb(f) from public.admin_order_financials f where f.order_id=p_id::bigint) else null end);
end $$;
revoke all on function public.admin_operations_list(text,text,text,text,integer,boolean) from public,anon;
revoke all on function public.admin_operation_detail(text,text) from public,anon;
grant execute on function public.admin_operations_list(text,text,text,text,integer,boolean) to authenticated;
grant execute on function public.admin_operation_detail(text,text) to authenticated;

create or replace view public.admin_operation_summaries with (security_invoker=true) as
select r.*, u.fullname as actor_name from (
 select 'orders'::text kind,id::text id,coalesce(order_code,id::text) code,buyer_id actor_id,total_amount amount,status,payment_status,payment_method,created_at,needs_payment_review,
   (status not in ('completed','cancelled') or payment_status='refund_pending' or exists(select 1 from public.order_bank_payouts bp where bp.order_id=orders.id and bp.status='pending')) attention from public.orders
 union all select 'packages',id::text,transaction_code,owner_id,price,status,
   case when status='paid' then 'paid' when status='pending' then 'unpaid' else status end,payment_method,created_at,coalesce(payos_status='review',false),status='pending' or payos_status='review' from public.service_package_payments
 union all select 'wallet_requests',id::text,case when kind='deposit' then 'Nạp ví' else 'Rút ví' end,user_id,amount,status,null,kind,created_at,false,status='pending' from public.wallet_requests
 union all select 'bank_refund_requests',id::text,'Hoàn đơn #'||order_id,user_id,amount,status,null,'bank',created_at,false,status='pending' from public.bank_refund_requests
 union all select 'donations',id::text,coalesce(transfer_code,id::text),donor_id,amount,status,null,payment_method,created_at,false,status='pending' from public.donations
 union all select 'contact_requests',id::text,'Liên hệ hỗ trợ',user_id,null,status,null,null,created_at,false,status in ('pending','reviewing') from public.contact_requests
 union all select 'product_reports',id::text,'Báo cáo sản phẩm #'||product_id,reporter_id,null,status,null,null,created_at,false,status in ('pending','reviewing') from public.product_reports
 union all select 'user_reports',id::text,'Báo cáo người dùng',reporter_id,null,status,null,null,created_at,false,status in ('pending','reviewing') from public.user_reports
 union all select 'verification',user_id::text,'Xác minh sinh viên',user_id,null,verification_status,null,null,created_at::timestamptz,false,verification_status='pending' from public.users where verification_status in ('pending','approved','rejected')
) r left join public.users u on u.user_id=r.actor_id where (select private.is_admin());
revoke all on public.admin_operation_summaries from public,anon;
grant select on public.admin_operation_summaries to authenticated;


