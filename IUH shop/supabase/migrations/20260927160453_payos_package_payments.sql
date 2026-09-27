-- payOS credentials stay in Edge Function secrets. Only service_role can settle.
create sequence private.payos_order_codes start with 2609270000000 maxvalue 9007199254740991;
alter table public.service_package_payments
 add column payos_order_code bigint unique,
 add column payos_link_id text,
 add column payos_checkout_url text,
 add column payos_status text check(payos_status in ('creating','pending','paid','cancelled','expired','review')),
 add column payos_expires_at timestamptz,
 add column payos_reference text,
 add column payos_received_amount bigint,
 add column payos_note text,
 add column payos_checked_at timestamptz;
grant select on public.service_package_payments to service_role;
alter table public.bank_receipts alter column reviewed_by drop not null;
alter table public.bank_receipts add column source text not null default 'manual' check(source in ('manual','payos'));
alter table public.bank_receipts add constraint bank_receipts_reviewer check(reviewed_by is not null or source='payos');

create function private.guard_payos_payment() returns trigger language plpgsql set search_path='' as $$
begin
 if old.payos_order_code is not null and new.status is distinct from old.status and current_setting('role',true)<>'service_role' then
  raise exception 'Giao dịch payOS phải được kiểm tra qua cổng thanh toán trước khi thay đổi trạng thái.';
 end if;
 return new;
end $$;
revoke all on function private.guard_payos_payment() from public,anon,authenticated;
create trigger guard_payos_payment before update on public.service_package_payments for each row execute function private.guard_payos_payment();

create function public.payos_prepare_package(p_transaction_code text,p_owner_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.service_package_payments;
begin
 perform pg_advisory_xact_lock(192837,1);
 select * into p from public.service_package_payments where transaction_code=p_transaction_code and owner_id=p_owner_id for update;
 if p.id is null or p.payment_method<>'bank' then raise exception 'Không tìm thấy yêu cầu chuyển khoản của bạn.'; end if;
 if p.status<>'pending' then return to_jsonb(p); end if;
 if p.payos_order_code is null then
  if (select count(*) from public.service_package_payments where owner_id=p_owner_id and payos_order_code is not null and created_at>now()-interval '1 hour')>=5 then raise exception 'Bạn đã tạo nhiều yêu cầu. Vui lòng thử lại sau.'; end if;
  update public.service_package_payments set payos_order_code=nextval('private.payos_order_codes'),payos_status='creating',payos_expires_at=now()+interval '30 minutes' where id=p.id returning * into p;
 end if;
 return to_jsonb(p);
end $$;

create function public.payos_bind_package(p_order_code bigint,p_link_id text,p_checkout_url text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_link_id is null or p_link_id!~'^[A-Za-z0-9_-]{10,100}$' or p_checkout_url<>('https://pay.payos.vn/web/'||p_link_id) then raise exception 'Link thanh toán không hợp lệ.'; end if;
 update public.service_package_payments set payos_link_id=p_link_id,payos_checkout_url=p_checkout_url,
 payos_status=case when payos_status='creating' then 'pending' else payos_status end
 where payos_order_code=p_order_code and (payos_link_id is null or payos_link_id=p_link_id);
 if not found then raise exception 'Không khớp mã thanh toán.'; end if;
end $$;

create function public.payos_sync_package(p_order_code bigint,p_link_id text,p_state text,p_amount bigint,p_received bigint,p_reference text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.service_package_payments; receipt public.bank_receipts; ref text:=upper(btrim(p_reference)); failure text;
begin
 perform pg_advisory_xact_lock(192837,1);
 select * into p from public.service_package_payments where payos_order_code=p_order_code for update;
 if p.id is null then raise exception 'Không tìm thấy mã thanh toán.'; end if;
 if p.payos_link_id is distinct from p_link_id then raise exception 'Không khớp link thanh toán.'; end if;
 if p.status='paid' or p.status='cancelled' and p_state in ('PENDING','PROCESSING','CANCELLED','EXPIRED') and p_received=0 then return to_jsonb(p); end if;
 if p_amount is distinct from p.price or p_received is null or p_received<0 then raise exception 'Số tiền không hợp lệ.'; end if;
 update public.service_package_payments set payos_checked_at=now(),payos_received_amount=p_received where id=p.id;
 if p.payos_status='review' then return to_jsonb(p); end if;
 if p_state='PAID' or p_received>0 and p_state in ('CANCELLED','EXPIRED') then
  if p_state<>'PAID' or p_received<>p.price or p.status<>'pending' or length(coalesce(ref,'')) not between 4 and 200 then
   update public.service_package_payments set payos_status='review',payos_reference=ref,payos_note='Đã có tiền nhưng cần đối soát số tiền/trạng thái; chưa tự kích hoạt.' where id=p.id returning * into p;
   return to_jsonb(p);
  end if;
  -- A subtransaction preserves the payment evidence even if fulfillment fails.
  begin
   insert into public.bank_receipts(reference,kind,entity_id,source) values(ref,'service_package',p.id::text,'payos') on conflict(reference) do nothing;
   select * into receipt from public.bank_receipts where reference=ref;
   if receipt.kind<>'service_package' or receipt.entity_id<>p.id::text then raise exception 'Chứng từ đã được dùng cho giao dịch khác.'; end if;
   perform private.fulfill_service_package_payment(p.id);
   update public.service_package_payments set payos_status='paid',payos_reference=ref,payos_note=null where id=p.id returning * into p;
  exception when others then
   get stacked diagnostics failure=MESSAGE_TEXT;
   update public.service_package_payments set payos_status='review',payos_reference=ref,payos_note=left(failure,500) where id=p.id returning * into p;
  end;
 elsif p_state in ('CANCELLED','EXPIRED') then
  update public.service_package_payments set status='cancelled',payos_status=lower(p_state),completed_at=now(),cancellation_reason='Link payOS đã hủy hoặc hết hạn' where id=p.id returning * into p;
 elsif p_state in ('PENDING','PROCESSING') then
  update public.service_package_payments set payos_status='pending' where id=p.id and status='pending' returning * into p;
 else raise exception 'Trạng thái payOS không hợp lệ';
 end if;
 return to_jsonb(p);
end $$;
revoke all on function public.payos_prepare_package(text,uuid),public.payos_bind_package(bigint,text,text),public.payos_sync_package(bigint,text,text,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.payos_prepare_package(text,uuid),public.payos_bind_package(bigint,text,text),public.payos_sync_package(bigint,text,text,bigint,bigint,text) to service_role;

-- Include provider information in existing receipts, pending list and recent history.
create or replace function private.service_package_receipt(p_payment public.service_package_payments)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('success',true,'status',p_payment.status,'transaction_code',p_payment.transaction_code,'package_id',p_payment.package_id,
 'plan_type',p_payment.plan_type,'price',p_payment.price,'payment_method',p_payment.payment_method,'expires_at',p_payment.expires_at,
 'payos_order_code',p_payment.payos_order_code,'payos_status',p_payment.payos_status,'checkout_url',p_payment.payos_checkout_url);
$$;

create function public.payos_claim_check(p_order_code bigint) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.service_package_payments set payos_checked_at=now() where payos_order_code=p_order_code and (payos_checked_at is null or payos_checked_at<now()-interval '5 seconds');
 return found;
end $$;
revoke all on function public.payos_claim_check(bigint) from public,anon,authenticated;
grant execute on function public.payos_claim_check(bigint) to service_role;
create or replace view public.admin_operation_summaries with (security_invoker=true) as
select r.*, u.fullname as actor_name from (
 select 'orders'::text kind,id::text id,coalesce(order_code,id::text) code,buyer_id actor_id,total_amount amount,status,payment_status,payment_method,created_at,needs_payment_review,
   (status not in ('completed','cancelled') or payment_status='refund_pending') attention from public.orders
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


