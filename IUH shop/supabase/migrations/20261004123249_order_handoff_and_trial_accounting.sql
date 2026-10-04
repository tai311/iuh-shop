-- One handoff workflow for trial and live orders. Trial accounting is recorded
-- separately from withdrawable funds, but included in operating reports.
alter table public.orders
  add column if not exists payment_approved_at timestamptz,
  add column if not exists payment_approved_by uuid references public.users(user_id),
  add column if not exists buyer_confirmed_at timestamptz;

-- Preserve orders already approved under the previous workflow.
update public.orders set payment_approved_at=coalesce(paid_at,updated_at)
where payment_status='paid' and status in ('confirmed','shipping','delivered','completed');

create table public.trial_financial_entries (
  id bigint generated always as identity primary key,
  source_type text not null check(source_type in ('order','package')),
  source_id text not null,
  recipient_id uuid not null references public.users(user_id),
  kind text not null check(kind in ('seller','platform','shipping','package')),
  amount numeric(14,2) not null check(amount>=0 and amount<1000000000000),
  title text not null,
  created_at timestamptz not null default now(),
  unique(source_type,source_id,recipient_id,kind)
);
alter table public.trial_financial_entries enable row level security;
create unique index trial_platform_entry_once on public.trial_financial_entries(source_type,source_id,kind) where kind<>'seller';
revoke all on public.trial_financial_entries from public,anon,authenticated;
grant select on public.trial_financial_entries to authenticated;
create policy trial_entries_read on public.trial_financial_entries for select to authenticated
using(recipient_id=(select auth.uid()) or (select private.is_admin()));

create table public.order_notifications (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.users(user_id),
  event text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique(order_id,user_id,event)
);
alter table public.order_notifications enable row level security;
revoke all on public.order_notifications from public,anon,authenticated;
grant select,update(is_read) on public.order_notifications to authenticated;
create policy order_notifications_read on public.order_notifications for select to authenticated using(user_id=(select auth.uid()));
create policy order_notifications_mark_read on public.order_notifications for update to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create index order_notifications_user_unread on public.order_notifications(user_id,is_read,created_at desc);

create function private.notify_order_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.order_notifications(order_id,user_id,event,message)
 select new.id,user_id,'payment_requested','Đơn '||new.order_code||' đang chờ xác nhận thanh toán.'
 from public.users where lower(role)='admin' on conflict do nothing;
 return new;
end $$;
revoke all on function private.notify_order_created() from public,anon,authenticated;
create trigger notify_order_created after insert on public.orders for each row execute function private.notify_order_created();

create or replace function private.can_read_order(p_id bigint) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_admin() or exists(
   select 1 from public.orders o where o.id=p_id and (o.buyer_id=auth.uid() or
     (o.payment_approved_at is not null and exists(select 1 from public.order_items i
       where i.order_id=o.id and (i.seller_id=auth.uid() or i.consignor_id=auth.uid()))))))
$$;

-- The deployed RPC had drifted to buyer-only and omitted acknowledgement fields.
drop function public.get_my_orders();
create function public.get_my_orders() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(row_data order by created_at desc),'[]'::jsonb) from (
   select o.created_at,to_jsonb(o)||jsonb_build_object('order_items',coalesce(
     (select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb)) row_data
   from public.orders o where o.buyer_id=auth.uid() or (o.payment_approved_at is not null and exists(
     select 1 from public.order_items i where i.order_id=o.id and (i.seller_id=auth.uid() or i.consignor_id=auth.uid())))
 ) x
$$;
revoke all on function public.get_my_orders() from public,anon;
grant execute on function public.get_my_orders() to authenticated;

create or replace function private.record_trial_order(p_order_id bigint) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders; r record; admin_id uuid; seller_total numeric:=0; fee numeric;
begin
 select * into o from public.orders where id=p_order_id for update;
 if o.payment_method is distinct from 'trial' or o.status<>'completed' or o.payment_status<>'paid' then
   raise exception 'Đơn chạy thử chưa đủ điều kiện ghi nhận tài chính.';
 end if;
 admin_id:=private.commerce_admin_id();
 if admin_id is null then raise exception 'Chưa có tài khoản admin nhận phí.'; end if;
 for r in select coalesce(consignor_id,seller_id) recipient,
   round(sum(subtotal)*case when o.order_type='consignment' then 0.9 else 1 end) amount
   from public.order_items where order_id=o.id group by 1 loop
   if r.recipient is null or r.amount<=0 then raise exception 'Thiếu người bán hoặc giá trị đơn không hợp lệ.'; end if;
   seller_total:=seller_total+r.amount;
   insert into public.trial_financial_entries(source_type,source_id,recipient_id,kind,amount,title,created_at)
   values('order',o.id::text,r.recipient,'seller',r.amount,'Tiền bán hàng · '||o.order_code,coalesce(o.settled_at,now())) on conflict do nothing;
 end loop;
 fee:=o.subtotal-seller_total;
 if seller_total<=0 or fee<0 then raise exception 'Phân bổ tiền đơn không hợp lệ.'; end if;
 insert into public.trial_financial_entries(source_type,source_id,recipient_id,kind,amount,title,created_at)
 values('order',o.id::text,admin_id,'platform',fee,
   case when o.order_type='consignment' then 'Phí ký gửi · ' else 'Phí sàn · ' end||o.order_code,coalesce(o.settled_at,now())),
 ('order',o.id::text,admin_id,'shipping',o.shipping_fee,'Phí vận chuyển · '||o.order_code,coalesce(o.settled_at,now())) on conflict do nothing;
end $$;
revoke all on function private.record_trial_order(bigint) from public,anon,authenticated;

create or replace function private.settle_order(p_order_id bigint) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_order_id for update;
 if o.payment_method='trial' then
   perform private.record_trial_order(o.id);
   update public.orders set settled_at=coalesce(settled_at,now()),updated_at=now() where id=o.id;
 else
   perform private.settle_order_before_trial(p_order_id);
 end if;
end $$;

create function private.record_trial_package() returns trigger
language plpgsql security definer set search_path='' as $$
declare admin_id uuid;
begin
 if new.payment_method='trial' and new.status='paid' then
   admin_id:=private.commerce_admin_id();
   if admin_id is null then raise exception 'Chưa có tài khoản admin nhận phí.'; end if;
   insert into public.trial_financial_entries(source_type,source_id,recipient_id,kind,amount,title,created_at)
   values('package',new.id::text,admin_id,'package',new.price,'Gói dịch vụ · '||new.transaction_code,coalesce(new.completed_at,now())) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.record_trial_package() from public,anon,authenticated;
create trigger record_trial_package after insert or update on public.service_package_payments
for each row execute function private.record_trial_package();

create or replace function public.admin_confirm_order_payment(p_order_id bigint,p_reference text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ quản trị viên được đối soát.'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status='cancelled' or o.needs_payment_review then raise exception 'Đơn không đủ điều kiện duyệt thanh toán.'; end if;
 if o.payment_approved_at is not null then return jsonb_build_object('success',true,'order_id',o.id,'payment_status',o.payment_status); end if;
 if o.status<>'pending' then raise exception 'Đơn không còn chờ duyệt thanh toán.'; end if;
 if o.payment_method='trial' then
   update public.orders set payment_status='paid',paid_at=coalesce(paid_at,now()),captured_amount=total_amount where id=o.id;
 elsif o.payment_method='qr' and o.payment_status<>'paid' then
   perform private.capture_order(o.id,p_reference);
 elsif o.payment_method='cash' then
   if nullif(btrim(p_reference),'') is null then raise exception 'Cần chứng từ xác nhận đã nhận tiền mặt.'; end if;
   update public.orders set payment_status='paid',paid_at=coalesce(paid_at,now()),payment_reference=btrim(p_reference) where id=o.id;
 elsif o.payment_status<>'paid' then raise exception 'Chưa có giao dịch thanh toán hợp lệ.';
 end if;
 update public.orders set payment_approved_at=now(),payment_approved_by=auth.uid(),status='confirmed',updated_at=now() where id=o.id;
 update public.order_notifications set is_read=true where order_id=o.id and event='payment_requested';
 insert into public.order_status_history(order_id,status,changed_by,note)
 values(o.id,'confirmed',auth.uid(),'Admin xác nhận thanh toán; chờ người bán nhận đơn.');
 insert into public.order_notifications(order_id,user_id,event,message)
 select distinct o.id,seller_id,'payment_approved','Đơn '||o.order_code||' đã được admin duyệt thanh toán. Vui lòng xác nhận nhận đơn.'
 from public.order_items where order_id=o.id on conflict do nothing;
 return jsonb_build_object('success',true,'order_id',o.id,'payment_status','paid');
end $$;

create or replace function public.update_order_status(p_order_id bigint,p_new_status text) returns boolean
language plpgsql security definer set search_path='' as $$
declare o public.orders; seller boolean; admin boolean; expected text;
begin
 if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Không tìm thấy đơn hàng.'; end if;
 admin:=private.is_admin();
 seller:=exists(select 1 from public.order_items where order_id=o.id and seller_id=auth.uid())
   and not exists(select 1 from public.order_items where order_id=o.id and seller_id<>auth.uid());
 if p_new_status='confirmed' and admin and o.status='pending' then
   perform public.admin_confirm_order_payment(o.id,null); return true;
 end if;
 if (p_new_status='completed' and not admin) or
    (p_new_status in ('shipping','delivered') and not seller) or
    p_new_status is null or p_new_status not in ('shipping','delivered','completed') then
   raise exception 'Người bán xác nhận nhận/giao hàng; chỉ admin được hoàn tất đơn.';
 end if;
 if o.payment_status<>'paid' or o.payment_approved_at is null or o.needs_payment_review then
   raise exception 'Đơn đang chờ admin xác nhận thanh toán.';
 end if;
 if o.status=p_new_status then return true; end if;
 expected:=case o.status when 'confirmed' then 'shipping' when 'shipping' then 'delivered' when 'delivered' then 'completed' end;
 if expected is null or p_new_status<>expected then raise exception 'Vui lòng xử lý đúng thứ tự: nhận đơn, đã giao, admin hoàn tất.'; end if;
 update public.orders set status=p_new_status,updated_at=now() where id=o.id;
 update public.order_notifications set is_read=true where order_id=o.id
   and event=case p_new_status when 'shipping' then 'payment_approved' when 'completed' then 'delivered' else '' end;
 if p_new_status='completed' then perform private.settle_order(o.id); end if;
 insert into public.order_status_history(order_id,status,changed_by,note)
 values(o.id,p_new_status,auth.uid(),case p_new_status when 'shipping' then 'Người bán xác nhận nhận đơn.'
   when 'delivered' then 'Người bán xác nhận đã giao; chờ admin hoàn tất.' else 'Admin xác nhận hoàn tất; đã ghi nhận tài chính.' end);
 if p_new_status='delivered' then
   insert into public.order_notifications(order_id,user_id,event,message)
   select o.id,user_id,'delivered','Người bán đã giao đơn '||o.order_code||'. Vui lòng kiểm tra và xác nhận hoàn tất.'
   from public.users where lower(role)='admin' on conflict do nothing;
 elsif p_new_status='completed' then
   insert into public.order_notifications(order_id,user_id,event,message)
   values(o.id,o.buyer_id,'completed','Đơn '||o.order_code||' đã hoàn thành. Vui lòng xác nhận bạn đã nhận hàng.') on conflict do nothing;
 end if;
 return true;
end $$;

create function public.confirm_order_received(p_order_id bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.orders;
begin
 select * into o from public.orders where id=p_order_id for update;
 if auth.uid() is null or o.buyer_id is distinct from auth.uid() then raise exception 'Chỉ người mua được xác nhận nhận hàng.'; end if;
 if o.status<>'completed' then raise exception 'Đơn chưa được admin xác nhận hoàn tất.'; end if;
 update public.orders set buyer_confirmed_at=coalesce(buyer_confirmed_at,now()) where id=o.id;
 update public.order_notifications set is_read=true where order_id=o.id and user_id=auth.uid() and event='completed';
 return jsonb_build_object('success',true,'order_id',o.id);
end $$;
revoke all on function public.confirm_order_received(bigint) from public,anon;
grant execute on function public.confirm_order_received(bigint) to authenticated;

alter function public.admin_operation_detail(text,text) rename to admin_operation_detail_before_handoff;
alter function public.admin_operation_detail_before_handoff(text,text) set schema private;
revoke all on function private.admin_operation_detail_before_handoff(text,text) from public,anon,authenticated;
create function public.admin_operation_detail(p_kind text,p_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; o public.orders;
begin
 if not private.is_admin() then raise exception 'Chỉ quản trị viên được truy cập.'; end if;
 result:=private.admin_operation_detail_before_handoff(p_kind,p_id);
 if p_kind='orders' then
   select * into o from public.orders where id=p_id::bigint;
   result:=jsonb_set(result,'{record}',(result->'record')||jsonb_build_object(
     'payment_approved_at',o.payment_approved_at,'buyer_confirmed_at',o.buyer_confirmed_at));
   if o.payment_method='trial' and o.settled_at is not null then
     result:=jsonb_set(result,'{finance,payout_status}','"trial_recorded"'::jsonb);
   end if;
 end if;
 return result;
end $$;
revoke all on function public.admin_operation_detail(text,text) from public,anon;
grant execute on function public.admin_operation_detail(text,text) to authenticated;

create or replace view public.admin_order_financials with (security_invoker=true) as
select o.id order_id,o.total_amount,o.subtotal,o.shipping_fee,
 coalesce(s.net,0) seller_net,o.subtotal-coalesce(s.net,0) platform_fee,
 case when o.order_type='consignment' then 10 else 5 end fee_rate,
 case when o.payment_method='trial' then 'trial' when o.payos_order_code is null then 'wallet' else 'bank' end payout_method,
 case when o.payment_method='trial' then case when o.status='completed' and o.settled_at is not null then 'trial_recorded' else 'not_ready' end
 when o.needs_payment_review then 'review' when o.payment_method='cash' then 'cash'
 when o.payment_status<>'paid' or o.status<>'completed' or o.settled_at is null then 'not_ready'
 when o.payos_order_code is null then 'wallet_credited'
 when exists(select 1 from public.order_bank_payouts p where p.order_id=o.id and p.status='pending') then 'pending' else 'paid' end payout_status,
 coalesce((select sum(amount) from public.order_bank_payouts p where p.order_id=o.id and status='pending'),0) remaining_payout
from public.orders o left join lateral (
 select sum(amount) net from (select round(sum(subtotal)*case when o.order_type='consignment' then 0.9 else 1 end) amount
 from public.order_items where order_id=o.id group by coalesce(consignor_id,seller_id)) x
) s on true where (select private.is_admin());

-- Backfill existing completed trial activity once; never modify real balances.
update public.orders set captured_amount=total_amount where payment_method='trial' and payment_status='paid';
do $$ declare r record; begin
 for r in select id from public.orders where payment_method='trial' and status='completed' and payment_status='paid' loop
   perform private.record_trial_order(r.id);
 end loop;
end $$;
insert into public.trial_financial_entries(source_type,source_id,recipient_id,kind,amount,title,created_at)
select 'package',id::text,private.commerce_admin_id(),'package',price,'Gói dịch vụ · '||transaction_code,coalesce(completed_at,created_at)
from public.service_package_payments where payment_method='trial' and status='paid' on conflict do nothing;

notify pgrst,'reload schema';
