-- Complete direct and PASSIT delivery with seller/buyer confirmations.
alter table public.connection_requests
 drop constraint if exists connection_requests_delivery_status_check;
alter table public.connection_requests
 add constraint connection_requests_delivery_status_check
 check(delivery_status is null or delivery_status in ('requested','arranging','delivered','seller_delivered','completed'));

create or replace function private.close_connection(p_id bigint,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.connection_requests; item record;
begin
 select * into r from public.connection_requests where id=p_id for update;
 if not found or r.status<>'awaiting_seller' then return; end if;
 if p_status not in ('expired','cancelled') then raise exception 'Trạng thái không hợp lệ.'; end if;
 for item in select product_id,quantity from public.connection_items where request_id=r.id order by product_id loop
  update public.products
  set quantity=quantity+item.quantity,
      status=case when status='deleted' and quantity=0 then 'active' else status end
  where id=item.product_id;
 end loop;
 update public.connection_requests set status=p_status,updated_at=now() where id=r.id;
 update public.connection_notifications set is_read=true where request_id=r.id and event in ('seller_fee_due','request_created');
 insert into public.connection_notifications(request_id,user_id,event,message)
 select r.id,u,p_status,'Yêu cầu #'||r.id||case when p_status='expired' then ' đã hết hạn 24 giờ. Sản phẩm đã được trả lại tồn kho.' else ' đã được hủy. Sản phẩm đã được trả lại tồn kho.' end
 from unnest(array[r.buyer_id,r.seller_id]) u on conflict do nothing;
end $$;
revoke all on function private.close_connection(bigint,text) from public,anon,authenticated;

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
  update public.products p
  set quantity=p.quantity-i.quantity,
      status=case when p.quantity-i.quantity=0 then 'deleted' else p.status end,
      updated_at=now()
  from public.connection_items i where i.request_id=req and p.id=i.product_id;
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
revoke all on function public.request_connection_orders(text,text,text,text,jsonb,numeric,bigint[],text) from public,anon;
grant execute on function public.request_connection_orders(text,text,text,text,jsonb,numeric,bigint[],text) to authenticated;

create or replace function public.choose_connection_delivery(p_request_id bigint,p_method text,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.connection_requests; fee numeric;
begin
 select * into r from public.connection_requests where id=p_request_id for update;
 if not found or auth.uid() is null or r.seller_id<>auth.uid() then raise exception 'Chỉ người bán được chọn cách giao hàng.'; end if;
 if r.status<>'connected' then raise exception 'Vui lòng xác nhận phí sàn trước.'; end if;
 if p_method is null or p_method not in ('direct','passit') or length(coalesce(p_note,''))>2000 then raise exception 'Thông tin giao hàng không hợp lệ.'; end if;
 if r.delivery_method is not null then
  if r.delivery_method<>p_method then raise exception 'Đã xác nhận phương thức giao hàng. Vui lòng liên hệ hỗ trợ để thay đổi.'; end if;
  return jsonb_build_object('success',true,'delivery_fee',r.delivery_fee,'delivery_status',r.delivery_status);
 end if;
 fee:=case when p_method='passit' then 5000 else 0 end;
 if fee>0 and not (select auto_confirm from private.connection_settings where id) then raise exception 'Chưa có xác nhận phí giao hộ từ cổng thanh toán.'; end if;
 update public.connection_requests set delivery_method=p_method,delivery_fee=fee,delivery_confirmed_at=now(),delivery_note=coalesce(p_note,''),
 delivery_status=case when p_method='passit' then 'requested' end,updated_at=now() where id=r.id;
 if fee>0 then
  insert into public.connection_fee_entries(request_id,payer_id,kind,amount,confirmation_mode) values(r.id,r.seller_id,'delivery',5000,'automatic_test') on conflict do nothing;
  insert into public.connection_notifications(request_id,user_id,event,message)
  select r.id,user_id,'delivery_requested','Yêu cầu giao hộ PASSIT #'||r.id||': phí 5.000đ chỉ được ghi nhận ở chế độ mô phỏng, chưa thu tiền thật. Admin sẽ liên hệ với bạn để sắp xếp giao hàng.'
  from public.users where role='admin' on conflict do nothing;
 end if;
 insert into public.connection_notifications(request_id,user_id,event,message)
 values(r.id,r.buyer_id,'delivery_chosen',case when p_method='passit' then 'Đã ghi nhận mô phỏng phí PASSIT giao hộ 5.000đ (chưa thu tiền thật). Admin sẽ liên hệ với bạn; vui lòng chờ.' else 'Người bán đã chọn giao trực tiếp. Sau khi người bán xác nhận đã giao, bạn hãy xác nhận đã nhận hàng trong Đơn hàng.' end) on conflict do nothing;
 insert into public.connection_notifications(request_id,user_id,event,message)
 values(r.id,r.seller_id,'delivery_chosen',case when p_method='passit' then 'Đã ghi nhận mô phỏng phí PASSIT giao hộ 5.000đ (chưa thu tiền thật). Admin sẽ liên hệ với bạn; vui lòng chờ.' else 'Người bán trực tiếp giao hàng. Sau khi giao, bấm Xác nhận đã giao; người mua sẽ xác nhận đã nhận.' end) on conflict do nothing;
 return jsonb_build_object('success',true,'delivery_fee',fee,'confirmation_mode','automatic_test');
end $$;
revoke all on function public.choose_connection_delivery(bigint,text,text) from public,anon;
grant execute on function public.choose_connection_delivery(bigint,text,text) to authenticated;

create or replace function public.admin_update_connection_delivery(p_request_id bigint,p_status text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.connection_requests;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ admin được cập nhật giao hộ.'; end if;
 select * into r from public.connection_requests where id=p_request_id for update;
 if not found or r.delivery_method is distinct from 'passit' or r.delivery_confirmed_at is null then raise exception 'Đơn chưa đăng ký giao hộ.'; end if;
 if r.delivery_status=p_status then return true; end if;
 if not ((r.delivery_status='requested' and p_status='arranging') or (r.delivery_status='arranging' and p_status='delivered')) then raise exception 'Trạng thái giao hộ không hợp lệ.'; end if;
 update public.connection_requests set delivery_status=p_status,updated_at=now() where id=r.id;
 update public.connection_notifications set is_read=true where request_id=r.id and event='delivery_requested' and user_id=auth.uid();
 insert into public.connection_notifications(request_id,user_id,event,message)
 select r.id,u,'delivery_'||p_status,
 case when p_status='arranging' then 'Admin đã liên hệ và đang sắp xếp giao hộ cho yêu cầu #' else 'PASSIT đã giao hộ yêu cầu #' end||r.id||
 case when p_status='delivered' then '. Người mua vui lòng xác nhận đã nhận hàng trong mục Đơn hàng.' else '.' end
 from unnest(array[r.buyer_id,r.seller_id]) u on conflict do nothing;
 return true;
end $$;
revoke all on function public.admin_update_connection_delivery(bigint,text) from public,anon;
grant execute on function public.admin_update_connection_delivery(bigint,text) to authenticated;

create function public.seller_mark_connection_delivered(p_request_id bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.connection_requests;
begin
 select * into r from public.connection_requests where id=p_request_id for update;
 if not found or auth.uid() is null or r.seller_id<>auth.uid() then raise exception 'Chỉ người bán của yêu cầu này được xác nhận đã giao.'; end if;
 if r.status<>'connected' or r.delivery_method is distinct from 'direct' then raise exception 'Yêu cầu này không được giao trực tiếp.'; end if;
 if r.delivery_status='seller_delivered' or r.delivery_status='completed' then return true; end if;
 if r.delivery_status is not null then raise exception 'Trạng thái giao hàng không hợp lệ.'; end if;
 update public.connection_requests set delivery_status='seller_delivered',updated_at=now() where id=r.id;
 insert into public.connection_notifications(request_id,user_id,event,message)
 select r.id,u,'seller_delivered','Người bán đã xác nhận giao trực tiếp yêu cầu #'||r.id||'. Nếu đã nhận hàng, vui lòng xác nhận hoàn tất trong mục Đơn hàng.'
 from unnest(array[r.buyer_id,r.seller_id]) u on conflict do nothing;
 return true;
end $$;
revoke all on function public.seller_mark_connection_delivered(bigint) from public,anon;
grant execute on function public.seller_mark_connection_delivered(bigint) to authenticated;

create function public.buyer_confirm_connection_received(p_request_id bigint) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.connection_requests;
begin
 select * into r from public.connection_requests where id=p_request_id for update;
 if not found or auth.uid() is null or r.buyer_id<>auth.uid() then raise exception 'Chỉ người mua của yêu cầu này được xác nhận đã nhận.'; end if;
 if r.status<>'connected' then raise exception 'Yêu cầu chưa được kết nối.'; end if;
 if r.delivery_status='completed' then return true; end if;
 if not ((r.delivery_method='direct' and r.delivery_status='seller_delivered') or (r.delivery_method='passit' and r.delivery_status='delivered')) then
  raise exception 'Chỉ xác nhận sau khi người bán hoặc PASSIT đã báo giao hàng.';
 end if;
 update public.connection_requests set delivery_status='completed',updated_at=now() where id=r.id;
 insert into public.connection_notifications(request_id,user_id,event,message)
 select r.id,u,'delivery_completed','Người mua đã xác nhận nhận hàng cho yêu cầu #'||r.id||'. Giao dịch đã hoàn tất.'
 from unnest(array[r.buyer_id,r.seller_id]) u on conflict do nothing;
 return true;
end $$;
revoke all on function public.buyer_confirm_connection_received(bigint) from public,anon;
grant execute on function public.buyer_confirm_connection_received(bigint) to authenticated;

create or replace function public.get_connection_requests() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; admin_user boolean:=private.is_admin();
begin
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
 perform private.expire_connections(case when admin_user then null else auth.uid() end);
 select coalesce(jsonb_agg(
  to_jsonb(r)||jsonb_build_object(
   'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.connection_items i where i.request_id=r.id),'[]'::jsonb),
   'buyer_contact',case when admin_user then (select jsonb_build_object('fullname',u.fullname,'email',u.email,'phone',u.phone) from public.users u where u.user_id=r.buyer_id) else null end,
   'seller_contact',case when admin_user then (select jsonb_build_object('fullname',u.fullname,'email',u.email,'phone',u.phone) from public.users u where u.user_id=r.seller_id) else null end
  ) order by r.created_at desc),'[]'::jsonb)
 into result from public.connection_requests r where r.buyer_id=auth.uid() or r.seller_id=auth.uid() or admin_user;
 return jsonb_build_object('requests',result,'auto_confirm',(select auto_confirm from private.connection_settings where id),'server_time',now());
end $$;
revoke all on function public.get_connection_requests() from public,anon;
grant execute on function public.get_connection_requests() to authenticated;

notify pgrst,'reload schema';
