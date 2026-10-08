-- Buyer and seller arrange recipient details after the chat is opened.
create or replace function public.request_connection_orders(p_recipient_name text,p_recipient_phone text,p_recipient_address text,p_note text,
 p_items jsonb,p_expected_subtotal numeric,p_cart_ids bigint[],p_request_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); old private.connection_receipts; fingerprint text; g record; item record;
 product_row public.products; total numeric:=0; amount numeric; req bigint; result jsonb; ids jsonb:='[]'; normalized jsonb;
 name_value text:=coalesce(nullif(btrim(p_recipient_name),''),'');
 phone_value text:=coalesce(nullif(btrim(p_recipient_phone),''),'');
 address_value text:=coalesce(nullif(btrim(p_recipient_address),''),'');
begin
 if uid is null then raise exception 'Vui lòng đăng nhập.'; end if;
 if nullif(btrim(p_request_key),'') is null or length(p_request_key)>100 then raise exception 'Mã yêu cầu không hợp lệ.'; end if;
 if (name_value<>'' and length(name_value)>120)
 or (phone_value<>'' and phone_value !~ '^0[0-9]{9}$')
 or (address_value<>'' and length(address_value)>300)
 or length(coalesce(p_note,''))>2000 then raise exception 'Thông tin liên hệ không hợp lệ.'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Giỏ hàng không hợp lệ.'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) i where coalesce(i->>'product_id','') !~ '^[0-9]{1,18}$'
 or coalesce(i->>'quantity','') !~ '^[1-9][0-9]{0,5}$') then raise exception 'Số lượng không hợp lệ.'; end if;
 select jsonb_agg(jsonb_build_object('product_id',id,'quantity',qty) order by id) into normalized
 from (select (i->>'product_id')::bigint id,sum((i->>'quantity')::integer) qty from jsonb_array_elements(p_items) i group by 1) x;
 fingerprint:=md5(jsonb_build_array(name_value,phone_value,address_value,p_note,normalized,p_expected_subtotal,p_cart_ids)::text);
 perform pg_advisory_xact_lock(hashtextextended('connection:'||uid::text||p_request_key,0));
 select * into old from private.connection_receipts where buyer_id=uid and request_key=p_request_key;
 if found then
  if old.fingerprint<>fingerprint then raise exception 'Nội dung yêu cầu đã thay đổi. Vui lòng tạo yêu cầu mới.'; end if;
  return old.receipt;
 end if;
 perform private.expire_connections(null);
 perform id from public.products where id in(select (i->>'product_id')::bigint from jsonb_array_elements(normalized) i) order by id for update;
 for item in select * from jsonb_to_recordset(normalized) as x(product_id bigint,quantity integer) loop
  select * into product_row from public.products where id=item.product_id;
  if not found or product_row.status<>'active' or product_row.quantity<item.quantity or product_row.seller_id=uid or product_row.seller_id is null
    or product_row.price<=0 or product_row.price::text in ('NaN','Infinity','-Infinity') then raise exception 'Sản phẩm không còn đủ hàng hoặc không thể đặt mua.'; end if;
  total:=total+round(product_row.price)*item.quantity;
 end loop;
 if p_expected_subtotal is distinct from total then raise exception 'Giá sản phẩm đã thay đổi. Vui lòng tải lại để kiểm tra.'; end if;
 for g in select p.seller_id,sum(round(p.price)*(i->>'quantity')::integer) subtotal
 from jsonb_array_elements(normalized) i join public.products p on p.id=(i->>'product_id')::bigint group by p.seller_id order by p.seller_id loop
  amount:=greatest(2000,round(g.subtotal*0.05));
  insert into public.connection_requests(buyer_id,seller_id,recipient_name,recipient_phone,recipient_address,note,subtotal,platform_fee)
  values(uid,g.seller_id,name_value,phone_value,address_value,coalesce(p_note,''),g.subtotal,amount) returning id into req;
  insert into public.connection_items(request_id,product_id,name,image_urls,unit_price,quantity)
  select req,p.id,p.name,coalesce(p.image_urls,'[]'::jsonb),round(p.price),(i->>'quantity')::integer
  from jsonb_array_elements(normalized) i join public.products p on p.id=(i->>'product_id')::bigint where p.seller_id=g.seller_id;
  update public.products p set quantity=p.quantity-i.quantity from public.connection_items i where i.request_id=req and p.id=i.product_id;
  insert into public.connection_notifications(request_id,user_id,event,message) values
   (req,g.seller_id,'seller_fee_due','Bạn có một giao dịch đang chờ xác nhận. Phí sàn là '||amount||'đ. Vui lòng thanh toán để tiếp tục giao dịch trong 24 giờ.'),
   (req,uid,'request_created','Yêu cầu #'||req||' đã gửi đến người bán. Chat sẽ mở sau khi người bán xác nhận phí sàn.');
  ids:=ids||jsonb_build_array(req);
 end loop;
 delete from public.cart_items c where c.user_id=uid and c.id=any(coalesce(p_cart_ids,'{}'))
 and exists(select 1 from jsonb_array_elements(normalized) i where (i->>'product_id')::bigint=c.product_id and (i->>'quantity')::integer=c.quantity);
 result:=jsonb_build_object('success',true,'request_ids',ids,'subtotal',total);
 insert into private.connection_receipts values(uid,p_request_key,fingerprint,result);
 return result;
end $$;
