-- Minimal summaries; private contact/bank information is fetched on demand only.
create view public.admin_operation_summaries with (security_invoker=true) as
select r.*, u.fullname as actor_name from (
 select 'orders'::text kind,id::text id,coalesce(order_code,id::text) code,buyer_id actor_id,total_amount amount,status,payment_status,payment_method,created_at,needs_payment_review,
   (status not in ('completed','cancelled') or payment_status='refund_pending') attention from public.orders
 union all select 'packages',id::text,transaction_code,owner_id,price,status,
   case when status='paid' then 'paid' when status='pending' then 'unpaid' else status end,payment_method,created_at,false,status='pending' from public.service_package_payments
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

create function public.admin_operations_list(p_kind text default 'orders',p_status text default '',p_payment text default '',p_search text default '',p_page integer default 1,p_attention boolean default false)
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
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb),'total',(select count(*) from filtered),
 'counts',(select coalesce(jsonb_object_agg(kind,n),'{}'::jsonb) from (select kind,count(*) n from public.admin_operation_summaries where attention or needs_payment_review group by kind) c)) into result;
 return result;
end $$;

create function public.admin_operation_detail(p_kind text,p_id text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare raw jsonb; record jsonb; people jsonb; items jsonb='[]'; history jsonb='[]'; receipts jsonb='[]'; payouts jsonb='[]'; actor uuid; target uuid;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ quản trị viên được truy cập' using errcode='42501'; end if;
 case p_kind
 when 'orders' then
   select to_jsonb(o),buyer_id into raw,actor from public.orders o where id=p_id::bigint;
   select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'product_id',i.product_id,'product_name',i.product_name,'quantity',i.quantity,'price',i.price,'subtotal',i.subtotal,'seller_id',i.seller_id,'seller_name',u.fullname)),'[]') into items from public.order_items i left join public.users u on u.user_id=i.seller_id where order_id=p_id::bigint;
   select coalesce(jsonb_agg(jsonb_build_object('status',h.status,'note',h.note,'created_at',h.created_at,'changed_by',h.changed_by,'actor_name',u.fullname) order by h.created_at),'[]') into history from public.order_status_history h left join public.users u on u.user_id=h.changed_by where order_id=p_id::bigint;
   select coalesce(jsonb_agg(jsonb_build_object('user_id',p.beneficiary,'fullname',u.fullname,'amount',p.amount)),'[]') into payouts from
     (select coalesce(consignor_id,seller_id) beneficiary,round(sum(subtotal)*case when raw->>'order_type'='consignment' then 0.9 else 1 end) amount from public.order_items where order_id=p_id::bigint group by 1) p
     left join public.users u on u.user_id=p.beneficiary;
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
 'fullname','email','phone','message','reason','description','product_id','reported_user_id','verification_status','student_card_url']);
 select coalesce(jsonb_agg(jsonb_build_object('user_id',u.user_id,'fullname',u.fullname,'role',case when u.user_id=actor then 'Người tạo / người mua' else 'Người được báo cáo' end)),'[]') into people from public.users u where user_id=actor or user_id=target;
 select coalesce(jsonb_agg(jsonb_build_object('reference',b.reference,'created_at',b.created_at,'reviewed_by',u.fullname)),'[]') into receipts from public.bank_receipts b left join public.users u on u.user_id=b.reviewed_by where b.entity_id=p_id and b.kind=case p_kind when 'orders' then 'order' when 'packages' then 'service_package' when 'wallet_requests' then 'wallet_'||(raw->>'kind') when 'bank_refund_requests' then 'bank_refund' when 'donations' then 'donation' else '' end;
 return jsonb_build_object('record',record,'people',people,'items',items,'history',history,'receipts',receipts,'payouts',payouts);
end $$;
revoke all on function public.admin_operations_list(text,text,text,text,integer,boolean) from public,anon;
revoke all on function public.admin_operation_detail(text,text) from public,anon;
grant execute on function public.admin_operations_list(text,text,text,text,integer,boolean) to authenticated;
grant execute on function public.admin_operation_detail(text,text) to authenticated;
