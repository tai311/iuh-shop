-- Connection-only commerce. Legacy orders remain readable; no buyer money is collected.
create table private.connection_settings (
 id boolean primary key default true check(id), auto_confirm boolean not null default true
);
insert into private.connection_settings values(true,true);
alter table private.connection_settings enable row level security;
revoke all on private.connection_settings from public,anon,authenticated;

create table public.connection_requests (
 id bigint generated always as identity primary key,
 buyer_id uuid not null references public.users(user_id),
 seller_id uuid not null references public.users(user_id),
 recipient_name text not null, recipient_phone text not null, recipient_address text not null, note text not null default '',
 subtotal numeric(16,0) not null check(subtotal>0),
 platform_fee numeric(16,0) not null check(platform_fee>=2000),
 status text not null default 'awaiting_seller' check(status in ('awaiting_seller','connected','expired','cancelled')),
 expires_at timestamptz not null default (now()+interval '24 hours'),
 fee_confirmed_at timestamptz, confirmation_mode text check(confirmation_mode in ('automatic_test','verified')),
 conversation_id uuid references public.conversations(id),
 delivery_method text check(delivery_method in ('direct','passit')),
 delivery_fee numeric(16,0) not null default 0 check(delivery_fee in (0,5000)),
 delivery_confirmed_at timestamptz,
 delivery_status text check(delivery_status in ('requested','arranging','delivered')),
 delivery_note text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(buyer_id<>seller_id),
 check(platform_fee=greatest(2000,round(subtotal*0.05)))
);
create index connection_buyer on public.connection_requests(buyer_id,created_at desc);
create index connection_seller on public.connection_requests(seller_id,created_at desc);
create index connection_expiry on public.connection_requests(expires_at) where status='awaiting_seller';
create index connection_unlocked_pair on public.connection_requests(buyer_id,seller_id) where status='connected';
create table public.connection_items (
 id bigint generated always as identity primary key,
 request_id bigint not null references public.connection_requests(id),
 product_id bigint not null references public.products(id),
 name text not null, image_urls jsonb not null default '[]',
 unit_price numeric(16,0) not null check(unit_price>0), quantity integer not null check(quantity>0),
 unique(request_id,product_id)
);
create table public.connection_fee_entries (
 id bigint generated always as identity primary key,
 request_id bigint not null references public.connection_requests(id),
 payer_id uuid not null references public.users(user_id),
 kind text not null check(kind in ('platform','delivery')),
 amount numeric(16,0) not null check(amount>=2000),
 confirmation_mode text not null check(confirmation_mode in ('automatic_test','verified')),
 created_at timestamptz not null default now(), unique(request_id,kind)
);
create table public.connection_notifications (
 id bigint generated always as identity primary key,
 request_id bigint not null references public.connection_requests(id),
 user_id uuid not null references public.users(user_id), event text not null, message text not null,
 is_read boolean not null default false, created_at timestamptz not null default now(),
 unique(request_id,user_id,event)
);
create index connection_notification_unread on public.connection_notifications(user_id,created_at desc) where not is_read;
create table private.connection_receipts (
 buyer_id uuid not null references public.users(user_id), request_key text not null,
 fingerprint text not null, receipt jsonb not null, primary key(buyer_id,request_key)
);
alter table private.connection_receipts enable row level security;
revoke all on private.connection_receipts from public,anon,authenticated;
alter table public.connection_requests enable row level security;
alter table public.connection_items enable row level security;
alter table public.connection_fee_entries enable row level security;
alter table public.connection_notifications enable row level security;
revoke all on public.connection_requests,public.connection_items,public.connection_fee_entries,public.connection_notifications from public,anon,authenticated;
grant select on public.connection_requests,public.connection_items,public.connection_fee_entries,public.connection_notifications to authenticated;
grant update(is_read) on public.connection_notifications to authenticated;
create function private.can_read_connection(p_id bigint) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.connection_requests r where r.id=p_id
 and (r.buyer_id=auth.uid() or r.seller_id=auth.uid() or private.is_admin()));
$$;
revoke all on function private.can_read_connection(bigint) from public;
grant execute on function private.can_read_connection(bigint) to authenticated;
create policy connection_parties on public.connection_requests for select to authenticated
 using(buyer_id=(select auth.uid()) or seller_id=(select auth.uid()) or (select private.is_admin()));
create policy connection_item_parties on public.connection_items for select to authenticated using(private.can_read_connection(request_id));
create policy connection_fee_parties on public.connection_fee_entries for select to authenticated using(private.can_read_connection(request_id));
create policy connection_notification_owner on public.connection_notifications for select to authenticated using(user_id=(select auth.uid()));
create policy connection_notification_read on public.connection_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Row lock + status transition ensure each reservation is released exactly once.
create function private.close_connection(p_id bigint,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare r public.connection_requests; item record;
begin
 select * into r from public.connection_requests where id=p_id for update;
 if not found or r.status<>'awaiting_seller' then return; end if;
 if p_status not in ('expired','cancelled') then raise exception 'Trạng thái không hợp lệ.'; end if;
 for item in select product_id,quantity from public.connection_items where request_id=r.id order by product_id loop
  update public.products set quantity=quantity+item.quantity where id=item.product_id;
 end loop;
 update public.connection_requests set status=p_status,updated_at=now() where id=r.id;
 update public.connection_notifications set is_read=true where request_id=r.id and event in ('seller_fee_due','request_created');
 insert into public.connection_notifications(request_id,user_id,event,message)
 select r.id,u,p_status,'Yêu cầu #'||r.id||case when p_status='expired' then ' đã hết hạn 24 giờ. Sản phẩm đã được trả lại tồn kho.' else ' đã được hủy. Sản phẩm đã được trả lại tồn kho.' end
 from unnest(array[r.buyer_id,r.seller_id]) u on conflict do nothing;
end $$;
revoke all on function private.close_connection(bigint,text) from public,anon,authenticated;
create function private.expire_connections(p_user_id uuid default null) returns integer language plpgsql security definer set search_path='' as $$
declare r record; n integer:=0;
begin
 for r in select id from public.connection_requests where status='awaiting_seller' and expires_at<=now()
 and (p_user_id is null or buyer_id=p_user_id or seller_id=p_user_id) order by id for update skip locked loop
  perform private.close_connection(r.id,'expired'); n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function private.expire_connections(uuid) from public,anon,authenticated;
create function public.expire_connection_requests() returns integer language plpgsql security definer set search_path='' as $$
begin
 if current_setting('request.jwt.claim.role',true)='service_role' then
  return private.expire_connections(null);
 end if;
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
 return private.expire_connections(auth.uid());
end $$;
-- Public wrapper always scopes browser calls; service scheduling uses the private function.
revoke all on function public.expire_connection_requests() from public,anon;
grant execute on function public.expire_connection_requests() to authenticated,service_role;

create function public.request_connection_orders(p_recipient_name text,p_recipient_phone text,p_recipient_address text,p_note text,
 p_items jsonb,p_expected_subtotal numeric,p_cart_ids bigint[],p_request_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); old private.connection_receipts; fingerprint text; g record; item record;
 product_row public.products; total numeric:=0; amount numeric; req bigint; result jsonb; ids jsonb:='[]'; normalized jsonb;
begin
 if uid is null then raise exception 'Vui lòng đăng nhập.'; end if;
 if nullif(btrim(p_request_key),'') is null or length(p_request_key)>100 then raise exception 'Mã yêu cầu không hợp lệ.'; end if;
 if nullif(btrim(p_recipient_name),'') is null or length(p_recipient_name)>120
 or coalesce(p_recipient_phone,'') !~ '^0[0-9]{9}$' or nullif(btrim(p_recipient_address),'') is null
 or length(p_recipient_address)>300 or length(coalesce(p_note,''))>2000 then raise exception 'Vui lòng điền đầy đủ thông tin người nhận hợp lệ.'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Giỏ hàng không hợp lệ.'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) i where coalesce(i->>'product_id','') !~ '^[0-9]{1,18}$'
 or coalesce(i->>'quantity','') !~ '^[1-9][0-9]{0,5}$') then raise exception 'Số lượng không hợp lệ.'; end if;
 select jsonb_agg(jsonb_build_object('product_id',id,'quantity',qty) order by id) into normalized
 from (select (i->>'product_id')::bigint id,sum((i->>'quantity')::integer) qty from jsonb_array_elements(p_items) i group by 1) x;
 fingerprint:=md5(jsonb_build_array(p_recipient_name,p_recipient_phone,p_recipient_address,p_note,normalized,p_expected_subtotal,p_cart_ids)::text);
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
  values(uid,g.seller_id,btrim(p_recipient_name),p_recipient_phone,btrim(p_recipient_address),coalesce(p_note,''),g.subtotal,amount) returning id into req;
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
revoke all on function public.request_connection_orders(text,text,text,text,jsonb,numeric,bigint[],text) from public,anon;
grant execute on function public.request_connection_orders(text,text,text,text,jsonb,numeric,bigint[],text) to authenticated;

-- Recover a committed checkout after a lost response, without reserving stock again.
create function public.get_connection_receipt(p_request_key text) returns jsonb
language sql stable security definer set search_path='' as $$
 select receipt from private.connection_receipts where buyer_id=auth.uid() and request_key=p_request_key;
$$;
revoke all on function public.get_connection_receipt(text) from public,anon;
grant execute on function public.get_connection_receipt(text) to authenticated;

create function private.can_connect(p_me uuid,p_other uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_me is not null and p_other is not null and p_me<>p_other and (
 exists(select 1 from public.users where user_id in(p_me,p_other) and role='admin') or
 exists(select 1 from public.connection_requests r where r.status='connected' and r.fee_confirmed_at is not null and
 ((r.buyer_id=p_me and r.seller_id=p_other) or (r.buyer_id=p_other and r.seller_id=p_me))) or
 -- Historical fee payments also qualify; an old unpaid/pending order does not.
 exists(select 1 from public.orders o join public.order_items i on i.order_id=o.id
 where o.status='completed' and (o.platform_fee_paid_at is not null or
 (o.payment_method<>'cash' and o.payment_status='paid' and o.settled_at is not null))
 and ((o.buyer_id=p_me and i.seller_id=p_other) or (o.buyer_id=p_other and i.seller_id=p_me))));
$$;
revoke all on function private.can_connect(uuid,uuid) from public,anon,authenticated;
create function public.can_contact_seller(p_other_user_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.can_connect(auth.uid(),p_other_user_id);
$$;
revoke all on function public.can_contact_seller(uuid) from public,anon;
grant execute on function public.can_contact_seller(uuid) to authenticated;

create or replace function public.is_chat_member(p_conversation_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user_id=auth.uid() and exists(select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=p_user_id)
 and not exists(select 1 from public.conversation_members m where m.conversation_id=p_conversation_id and m.user_id<>p_user_id
 and not private.can_connect(p_user_id,m.user_id));
$$;
create or replace function public.is_conversation_member(p_conversation_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_chat_member(p_conversation_id,auth.uid());
$$;
revoke all on function public.is_chat_member(uuid,uuid),public.is_conversation_member(uuid) from public,anon;
grant execute on function public.is_chat_member(uuid,uuid),public.is_conversation_member(uuid) to authenticated;
drop policy if exists chat_members_select on public.conversation_members;
create policy chat_members_select on public.conversation_members for select to authenticated using(public.is_chat_member(conversation_id,auth.uid()));

create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; admin_chat boolean;
begin
 if not private.can_connect(uid,p_other_user_id) then raise exception 'Chat đang khóa. Hãy đặt hàng và chờ người bán xác nhận phí sàn.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(uid::text,p_other_user_id::text)||':'||greatest(uid::text,p_other_user_id::text),0));
 select c.id,c.is_admin_chat into cid,admin_chat from public.conversations c
 where exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=uid)
 and exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=p_other_user_id)
 and (select count(*) from public.conversation_members m where m.conversation_id=c.id)=2 order by c.created_at,c.id limit 1;
 if cid is null then
  cid:=gen_random_uuid(); select exists(select 1 from public.users where user_id in(uid,p_other_user_id) and role='admin') into admin_chat;
  insert into public.conversations(id,is_admin_chat) values(cid,admin_chat);
  insert into public.conversation_members(conversation_id,user_id) values(cid,uid),(cid,p_other_user_id);
 end if;
 return jsonb_build_object('id',cid,'is_admin_chat',admin_chat);
end $$;

create function public.confirm_connection_fee(p_request_id bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.connection_requests; c jsonb;
begin
 select * into r from public.connection_requests where id=p_request_id for update;
 if not found or auth.uid() is null or r.seller_id<>auth.uid() then raise exception 'Chỉ người bán của đơn được xác nhận phí.'; end if;
 if r.status='connected' then return jsonb_build_object('success',true,'conversation_id',r.conversation_id); end if;
 if r.status<>'awaiting_seller' then raise exception 'Yêu cầu không còn chờ xác nhận.'; end if;
 if r.expires_at<=now() then
  perform private.close_connection(r.id,'expired'); return jsonb_build_object('success',false,'expired',true,'message','Yêu cầu đã hết hạn 24 giờ.');
 end if;
 if not (select auto_confirm from private.connection_settings where id) then raise exception 'Xác nhận tự động đã tắt. Chưa có xác nhận từ cổng thanh toán.'; end if;
 update public.connection_requests set status='connected',fee_confirmed_at=now(),confirmation_mode='automatic_test',updated_at=now() where id=r.id;
 insert into public.connection_fee_entries(request_id,payer_id,kind,amount,confirmation_mode)
 values(r.id,r.seller_id,'platform',r.platform_fee,'automatic_test') on conflict do nothing;
 c:=public.get_or_create_direct_conversation(r.buyer_id);
 update public.connection_requests set conversation_id=(c->>'id')::uuid where id=r.id;
 update public.connection_notifications set is_read=true where request_id=r.id and event in ('seller_fee_due','request_created');
 insert into public.connection_notifications(request_id,user_id,event,message)
 select r.id,u,'chat_unlocked','Người bán đã xác nhận phí sàn cho yêu cầu #'||r.id||'. Chat đã mở để hai bên thỏa thuận giao dịch.'
 from unnest(array[r.buyer_id,r.seller_id]) u on conflict do nothing;
 return jsonb_build_object('success',true,'conversation_id',c->>'id','confirmation_mode','automatic_test');
end $$;
revoke all on function public.confirm_connection_fee(bigint) from public,anon;
grant execute on function public.confirm_connection_fee(bigint) to authenticated;

create function public.cancel_connection_request(p_request_id bigint) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.connection_requests;
begin
 select * into r from public.connection_requests where id=p_request_id for update;
 if not found or auth.uid() is null or auth.uid() not in(r.buyer_id,r.seller_id) then raise exception 'Bạn không có quyền hủy yêu cầu này.'; end if;
 if r.status in ('expired','cancelled') then return true; end if;
 if r.status<>'awaiting_seller' then raise exception 'Hai bên đã được kết nối. Vui lòng trao đổi trong chat.'; end if;
 perform private.close_connection(r.id,case when r.expires_at<=now() then 'expired' else 'cancelled' end);
 return true;
end $$;
revoke all on function public.cancel_connection_request(bigint) from public,anon;
grant execute on function public.cancel_connection_request(bigint) to authenticated;

create function public.choose_connection_delivery(p_request_id bigint,p_method text,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.connection_requests; fee numeric;
begin
 select * into r from public.connection_requests where id=p_request_id for update;
 if not found or auth.uid() is null or r.seller_id<>auth.uid() then raise exception 'Chỉ người bán được chọn cách giao hàng.'; end if;
 if r.status<>'connected' then raise exception 'Vui lòng xác nhận phí sàn trước.'; end if;
 if p_method is null or p_method not in ('direct','passit') or length(coalesce(p_note,''))>2000 then raise exception 'Thông tin giao hàng không hợp lệ.'; end if;
 if r.delivery_method is not null then
  if r.delivery_method<>p_method then raise exception 'Đã xác nhận phương thức giao hàng. Vui lòng liên hệ hỗ trợ để thay đổi.'; end if;
  return jsonb_build_object('success',true,'delivery_fee',r.delivery_fee);
 end if;
 fee:=case when p_method='passit' then 5000 else 0 end;
 if fee>0 and not (select auto_confirm from private.connection_settings where id) then raise exception 'Chưa có xác nhận phí giao hộ từ cổng thanh toán.'; end if;
 update public.connection_requests set delivery_method=p_method,delivery_fee=fee,delivery_confirmed_at=now(),delivery_note=coalesce(p_note,''),
 delivery_status=case when p_method='passit' then 'requested' end,updated_at=now() where id=r.id;
 if fee>0 then
  insert into public.connection_fee_entries(request_id,payer_id,kind,amount,confirmation_mode) values(r.id,r.seller_id,'delivery',5000,'automatic_test') on conflict do nothing;
  insert into public.connection_notifications(request_id,user_id,event,message)
  select r.id,user_id,'delivery_requested','Yêu cầu giao hộ PASSIT #'||r.id||': người bán đã xác nhận phí 5.000đ. Vui lòng liên hệ sắp xếp giao hàng.'
  from public.users where role='admin' on conflict do nothing;
 end if;
 insert into public.connection_notifications(request_id,user_id,event,message)
 values(r.id,r.buyer_id,'delivery_chosen',case when p_method='passit' then 'Người bán đã chọn PASSIT giao hộ và chịu phí 5.000đ.' else 'Người bán đã chọn giao trực tiếp. Hai bên thống nhất thời gian và địa điểm trong chat.' end) on conflict do nothing;
 return jsonb_build_object('success',true,'delivery_fee',fee,'confirmation_mode','automatic_test');
end $$;
revoke all on function public.choose_connection_delivery(bigint,text,text) from public,anon;
grant execute on function public.choose_connection_delivery(bigint,text,text) to authenticated;

create function public.admin_update_connection_delivery(p_request_id bigint,p_status text) returns boolean
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
 select r.id,u,'delivery_'||p_status,case when p_status='arranging' then 'PASSIT đang sắp xếp giao hộ cho yêu cầu #' else 'PASSIT đã cập nhật hoàn tất giao hộ cho yêu cầu #' end||r.id
 from unnest(array[r.buyer_id,r.seller_id]) u on conflict do nothing;
 return true;
end $$;
revoke all on function public.admin_update_connection_delivery(bigint,text) from public,anon;
grant execute on function public.admin_update_connection_delivery(bigint,text) to authenticated;

create function public.get_connection_requests() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
 perform private.expire_connections(case when private.is_admin() then null else auth.uid() end);
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.connection_items i where i.request_id=r.id),'[]'::jsonb)) order by r.created_at desc),'[]'::jsonb)
 into result from public.connection_requests r where r.buyer_id=auth.uid() or r.seller_id=auth.uid() or private.is_admin();
 return jsonb_build_object('requests',result,'auto_confirm',(select auto_confirm from private.connection_settings where id),'server_time',now());
end $$;
revoke all on function public.get_connection_requests() from public,anon;
grant execute on function public.get_connection_requests() to authenticated;

-- Disable new buyer-payment checkouts; keep historical order management untouched.
alter table public.products add column if not exists item_condition text, add column if not exists pickup_area text;
create function public.create_free_product(p_name text,p_category text,p_quantity integer,p_price numeric,p_description text,
 p_image_urls jsonb,p_condition text,p_pickup_area text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; full_description text;
begin
 if p_condition is null or p_condition not in ('Mới','Đã sử dụng - tốt','Đã sử dụng - có hao mòn')
 or p_pickup_area is null or p_pickup_area not in ('Cơ sở chính Nguyễn Văn Bảo','Cơ sở Nguyễn Văn Dung','Cơ sở Phạm Văn Chiêu','Sân vận động Đạt Đức')
 or length(btrim(coalesce(p_description,'')))<10 or length(p_description)>1800 then raise exception 'Vui lòng điền tình trạng, khu vực và mô tả sản phẩm từ 10 đến 1.800 ký tự.'; end if;
 full_description:='Tình trạng: '||p_condition||E'\nKhu vực: '||p_pickup_area||E'\n\n'||p_description;
 result:=public.create_product_with_boost(p_name,p_category,p_quantity,p_price,full_description,p_image_urls,false,p_idempotency_key);
 update public.products set item_condition=p_condition,pickup_area=p_pickup_area where id=(result->>'id')::bigint and seller_id=auth.uid();
 return result||jsonb_build_object('listing_fee',0);
end $$;
revoke all on function public.create_free_product(text,text,integer,numeric,text,jsonb,text,text,text) from public,anon;
grant execute on function public.create_free_product(text,text,integer,numeric,text,jsonb,text,text,text) to authenticated;
revoke execute on function public.create_product_with_boost(text,text,integer,numeric,text,jsonb,boolean,text) from authenticated,anon,public;
revoke execute on function public.create_checkout_orders(text,text,text,text,text,numeric,text,numeric,numeric,jsonb,bigint[],text) from authenticated,anon,public;
revoke execute on function public.create_order(text,text,text,text,text,numeric,text,numeric,numeric,jsonb,bigint[],text) from authenticated,anon,public;

-- PostgreSQL cron in production; PGlite/local setups use expiry-on-read for tests.
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') and not exists(select 1 from pg_extension where extname='pg_cron') then
  execute 'create extension pg_cron';
 end if;
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('passit-expire-connections','* * * * *','select private.expire_connections(null);');
 end if;
end $$;
notify pgrst,'reload schema';
