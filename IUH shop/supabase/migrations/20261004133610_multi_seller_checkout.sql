create table private.checkout_receipts (
 buyer_id uuid not null references public.users(user_id),
 request_key text not null,
 request_hash text not null,
 receipt jsonb not null,
 primary key(buyer_id,request_key)
);
alter table private.checkout_receipts enable row level security;
revoke all on private.checkout_receipts from public,anon,authenticated;

create function public.create_checkout_orders(
 p_recipient_name text,p_recipient_phone text,p_recipient_address text,p_note text,
 p_shipping_method text,p_shipping_fee numeric,p_payment_method text,p_subtotal numeric,
 p_total_amount numeric,p_items jsonb,p_cart_ids bigint[],p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); fingerprint text; previous private.checkout_receipts;
 group_row record; child jsonb; children jsonb:='[]'; total numeric:=0; subtotal numeric:=0;
 shipping numeric:=0; child_shipping numeric; result jsonb;
begin
 if uid is null then raise exception 'Bạn chưa đăng nhập.'; end if;
 if nullif(btrim(p_idempotency_key),'') is null or length(p_idempotency_key)>100 then raise exception 'Yêu cầu đặt hàng không hợp lệ.'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Giỏ hàng không hợp lệ.'; end if;
 if p_shipping_method is null or p_shipping_method not in ('meet','mid','iuh_shop') then raise exception 'Phương thức giao hàng không hợp lệ.'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) i where coalesce(i->>'product_id','') !~ '^[0-9]{1,18}$' or coalesce(i->>'quantity','') !~ '^[1-9][0-9]{0,5}$') then raise exception 'Số lượng không hợp lệ.'; end if;
 fingerprint:=md5(jsonb_build_array(p_recipient_name,p_recipient_phone,p_recipient_address,p_note,p_shipping_method,p_shipping_fee,p_payment_method,p_subtotal,p_total_amount,p_items,p_cart_ids)::text);
 perform pg_advisory_xact_lock(hashtextextended('checkout:'||uid::text||p_idempotency_key,0));
 select * into previous from private.checkout_receipts where buyer_id=uid and request_key=p_idempotency_key;
 if found then
  if previous.request_hash<>fingerprint then raise exception 'Yêu cầu đặt hàng đã thay đổi. Vui lòng tải lại trang.'; end if;
  return previous.receipt||jsonb_build_object('already_created',true);
 end if;
 -- Lock the entire cart in product order before creating any child orders.
 perform p.id from public.products p where p.id in (select (i->>'product_id')::bigint from jsonb_array_elements(p_items) i) order by p.id for update;
 if exists(select 1 from jsonb_array_elements(p_items) i left join public.products p on p.id=(i->>'product_id')::bigint where p.id is null) then raise exception 'Sản phẩm không còn tồn tại.'; end if;
 if p_shipping_method='iuh_shop' and exists(select 1 from public.products p join jsonb_array_elements(p_items) i on p.id=(i->>'product_id')::bigint where not coalesce(p.is_consignment,false)) then raise exception 'Vui lòng chọn giao hàng cho sản phẩm thường.'; end if;
 for group_row in
  select p.seller_id,coalesce(p.is_consignment,false) cons,
   jsonb_agg(i order by p.id) items,
   sum(round(p.price*case when p.is_consignment then 1 else 1.05 end)*(i->>'quantity')::integer) amount
  from jsonb_array_elements(p_items) i join public.products p on p.id=(i->>'product_id')::bigint
  group by p.seller_id,coalesce(p.is_consignment,false) order by p.seller_id,coalesce(p.is_consignment,false)
 loop
  child_shipping:=case when p_shipping_method='mid' and not group_row.cons then 5000 else 0 end;
  child:=public.create_order(p_recipient_name,p_recipient_phone,p_recipient_address,p_note,
   case when group_row.cons then 'meet' else p_shipping_method end,child_shipping,p_payment_method,
   group_row.amount,group_row.amount+child_shipping,group_row.items,p_cart_ids,
   'checkout:'||md5(uid::text||p_idempotency_key||group_row.seller_id::text||group_row.cons::text))::jsonb;
  children:=children||jsonb_build_array(child);
  subtotal:=subtotal+group_row.amount; shipping:=shipping+child_shipping;
 end loop;
 total:=subtotal+shipping;
 if p_total_amount is distinct from total or p_subtotal is distinct from subtotal or p_shipping_fee is distinct from shipping then
  raise exception 'Giá hoặc phí giao hàng đã thay đổi. Vui lòng tải lại để kiểm tra tổng tiền.';
 end if;
 result:=jsonb_build_object('success',true,'orders',children,'order_count',jsonb_array_length(children),
  'order_id',case when jsonb_array_length(children)=1 then children->0->'order_id' else null end,
  'subtotal',subtotal,'shipping_fee',shipping,'total_amount',total);
 insert into private.checkout_receipts values(uid,p_idempotency_key,fingerprint,result);
 return result;
end $$;
revoke all on function public.create_checkout_orders(text,text,text,text,text,numeric,text,numeric,numeric,jsonb,bigint[],text) from public,anon;
grant execute on function public.create_checkout_orders(text,text,text,text,text,numeric,text,numeric,numeric,jsonb,bigint[],text) to authenticated;
notify pgrst,'reload schema';
