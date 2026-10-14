-- Product bargaining requests with a database-enforced 60% floor.
create table public.price_offers (
 id bigint generated always as identity primary key,
 buyer_id uuid not null references public.users(user_id),
 seller_id uuid not null references public.users(user_id),
 product_id bigint not null references public.products(id),
 product_name text not null,
 listed_price numeric(16,0) not null check(listed_price>0),
 offer_price numeric(16,0) not null check(offer_price>0),
 status text not null default 'pending' check(status in ('pending','accepted','countered','rejected','cancelled')),
 counter_price numeric(16,0) check(counter_price>0),
 constraint price_offer_counter_floor check(counter_price is null or counter_price>=ceil(listed_price*0.60)),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(buyer_id<>seller_id),
 check(offer_price>=ceil(listed_price*0.60))
);
create index price_offers_buyer on public.price_offers(buyer_id,created_at desc);
create index price_offers_seller on public.price_offers(seller_id,status,created_at desc);
alter table public.price_offers enable row level security;
revoke all on public.price_offers from public,anon,authenticated;
grant select on public.price_offers to authenticated;
create policy price_offers_parties_select on public.price_offers for select to authenticated using(buyer_id=(select auth.uid()) or seller_id=(select auth.uid()) or (select private.is_admin()));

create table public.price_offer_notifications (
 id bigint generated always as identity primary key,
 offer_id bigint not null references public.price_offers(id) on delete cascade,
 user_id uuid not null references public.users(user_id),
 event text not null,
 message text not null,
 is_read boolean not null default false,
 created_at timestamptz not null default now(),
 unique(offer_id,user_id,event)
);
alter table public.price_offer_notifications enable row level security;
revoke all on public.price_offer_notifications from public,anon,authenticated;
grant select,update(is_read) on public.price_offer_notifications to authenticated;
create policy price_offer_notifications_owner on public.price_offer_notifications for select to authenticated using(user_id=(select auth.uid()));
create policy price_offer_notifications_read on public.price_offer_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create function public.submit_price_offer(p_product_id bigint,p_offer_price numeric) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.products; offer_id bigint; floor_price numeric;
begin
 if uid is null then raise exception 'Vui lòng đăng nhập để trả giá.'; end if;
 if p_offer_price is null or p_offer_price::text in ('NaN','Infinity','-Infinity') or p_offer_price<=0 then raise exception 'Mức giá đề xuất không hợp lệ.'; end if;
 select * into p from public.products where id=p_product_id for update;
 if not found or p.status<>'active' or p.quantity<1 then raise exception 'Sản phẩm không còn khả dụng.'; end if;
 if p.seller_id=uid then raise exception 'Bạn không thể trả giá sản phẩm của mình.'; end if;
 if p.price is null or p.price<=0 then raise exception 'Giá sản phẩm không hợp lệ.'; end if;
 floor_price:=ceil(round(p.price)*0.60);
 if p_offer_price<>round(p_offer_price) or p_offer_price<floor_price or p_offer_price>round(p.price) then
  raise exception 'Giá trả phải từ %đ đến %đ (tối thiểu 60%% giá niêm yết).',floor_price,round(p.price);
 end if;
 insert into public.price_offers(buyer_id,seller_id,product_id,product_name,listed_price,offer_price)
 values(uid,p.seller_id,p.id,p.name,round(p.price),p_offer_price) returning id into offer_id;
 insert into public.price_offer_notifications(offer_id,user_id,event,message) values(offer_id,p.seller_id,'offer_received','Bạn có đề nghị trả giá mới cho '||p.name||': '||p_offer_price||'đ.');
 return jsonb_build_object('success',true,'offer_id',offer_id,'listed_price',round(p.price),'offer_price',p_offer_price,'minimum_price',floor_price);
end $$;
revoke all on function public.submit_price_offer(bigint,numeric) from public,anon;
grant execute on function public.submit_price_offer(bigint,numeric) to authenticated;

create function public.respond_price_offer(p_offer_id bigint,p_action text,p_counter_price numeric default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); o public.price_offers;
begin
 if uid is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into o from public.price_offers where id=p_offer_id for update;
 if not found or o.seller_id<>uid then raise exception 'Chỉ người bán của sản phẩm được phản hồi.'; end if;
 if o.status<>'pending' then raise exception 'Đề nghị này đã được xử lý.'; end if;
 if p_action not in ('accept','reject','counter') then raise exception 'Phản hồi không hợp lệ.'; end if;
 if p_action='counter' then
  if p_counter_price is null or p_counter_price::text in ('NaN','Infinity','-Infinity') or p_counter_price<>round(p_counter_price) or p_counter_price<ceil(o.listed_price*0.60) or p_counter_price>o.listed_price then
   raise exception 'Giá đề xuất lại phải từ %đ đến %đ.',ceil(o.listed_price*0.60),o.listed_price;
  end if;
  update public.price_offers set status='countered',counter_price=p_counter_price,updated_at=now() where id=o.id;
  insert into public.price_offer_notifications(offer_id,user_id,event,message) values(o.id,o.buyer_id,'offer_countered','Người bán đã đề xuất lại '||p_counter_price||'đ cho '||o.product_name||'.');
 elsif p_action='accept' then
  update public.price_offers set status='accepted',updated_at=now() where id=o.id;
  insert into public.price_offer_notifications(offer_id,user_id,event,message) values(o.id,o.buyer_id,'offer_accepted','Người bán đã chấp nhận giá '||o.offer_price||'đ cho '||o.product_name||'. Giá đã được xác nhận; hãy tạo đơn hàng để tiếp tục.');
 else
  update public.price_offers set status='rejected',updated_at=now() where id=o.id;
  insert into public.price_offer_notifications(offer_id,user_id,event,message) values(o.id,o.buyer_id,'offer_rejected','Người bán đã từ chối đề nghị cho '||o.product_name||'.');
 end if;
 insert into public.price_offer_notifications(offer_id,user_id,event,message)
 select o.id,o.buyer_id,'response_saved','Người bán đã phản hồi đề nghị trả giá cho '||o.product_name||'.'
 where o.buyer_id<>uid;

 return jsonb_build_object('success',true,'status',case when p_action='counter' then 'countered' else case when p_action='accept' then 'accepted' else 'rejected' end end);
end $$;
revoke all on function public.respond_price_offer(bigint,text,numeric) from public,anon;
grant execute on function public.respond_price_offer(bigint,text,numeric) to authenticated;


create function public.accept_counter_price_offer(p_offer_id bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); o public.price_offers;
begin
 if uid is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into o from public.price_offers where id=p_offer_id for update;
 if not found or o.buyer_id<>uid then raise exception 'Chỉ người mua được chấp nhận giá đề xuất.'; end if;
 if o.status<>'countered' or o.counter_price is null then raise exception 'Không có giá đề xuất đang chờ xác nhận.'; end if;
 update public.price_offers set status='accepted',offer_price=o.counter_price,updated_at=now() where id=o.id;
 insert into public.price_offer_notifications(offer_id,user_id,event,message) values(o.id,o.seller_id,'counter_accepted','Người mua đã chấp nhận mức giá '||o.counter_price||'đ cho '||o.product_name||'.');
 return jsonb_build_object('success',true,'agreed_price',o.counter_price,'status','accepted');
end $$;
revoke all on function public.accept_counter_price_offer(bigint) from public,anon;
grant execute on function public.accept_counter_price_offer(bigint) to authenticated;

create function public.reject_counter_price_offer(p_offer_id bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); o public.price_offers;
begin
 if uid is null then raise exception 'Vui lòng đăng nhập.'; end if;
 select * into o from public.price_offers where id=p_offer_id for update;
 if not found or o.buyer_id<>uid then raise exception 'Chỉ người mua được phản hồi giá đề xuất.'; end if;
 if o.status<>'countered' then raise exception 'Không có giá đề xuất đang chờ phản hồi.'; end if;
 update public.price_offers set status='rejected',updated_at=now() where id=o.id;
 insert into public.price_offer_notifications(offer_id,user_id,event,message) values(o.id,o.seller_id,'counter_rejected','Người mua đã từ chối giá đề xuất cho '||o.product_name||'.');
 return jsonb_build_object('success',true,'status','rejected');
end $$;
revoke all on function public.reject_counter_price_offer(bigint) from public,anon;
grant execute on function public.reject_counter_price_offer(bigint) to authenticated;
