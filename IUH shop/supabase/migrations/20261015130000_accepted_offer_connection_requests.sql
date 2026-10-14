-- Turn an accepted bargaining offer into the existing seller-confirmed transaction flow.
alter table public.price_offers
 add column connection_request_id bigint references public.connection_requests(id);

create unique index price_offers_connection_request_unique
 on public.price_offers(connection_request_id) where connection_request_id is not null;

create function private.create_accepted_offer_connection(p_offer_id bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 o public.price_offers;
 p public.products;
 req bigint;
 amount numeric;
begin
 select * into o from public.price_offers where id=p_offer_id for update;
 if not found or o.status<>'accepted' then raise exception 'Äá» nghá»‹ chÆ°a Ä‘Æ°á»£c cháº¥p nháº­n.'; end if;
 if o.connection_request_id is not null then
  select platform_fee into amount from public.connection_requests where id=o.connection_request_id;
  return jsonb_build_object('success',true,'request_id',o.connection_request_id,'subtotal',o.offer_price,'platform_fee',amount,'already_created',true);
 end if;

 select * into p from public.products where id=o.product_id for update;
 if not found or p.seller_id<>o.seller_id or p.status<>'active' or p.quantity<1 then
  raise exception 'Sáº£n pháº©m khÃ´ng cÃ²n kháº£ dá»¥ng; thá»a thuáº­n giÃ¡ chÆ°a thá»ƒ chuyá»ƒn thÃ nh yÃªu cáº§u giao dá»‹ch.';
 end if;
 amount:=greatest(2000,round(o.offer_price*0.05));
 insert into public.connection_requests(buyer_id,seller_id,recipient_name,recipient_phone,recipient_address,note,subtotal,platform_fee)
 values(o.buyer_id,o.seller_id,'','','','Thá»a thuáº­n tráº£ giÃ¡ #'||o.id,round(o.offer_price),amount)
 returning id into req;

 insert into public.connection_items(request_id,product_id,name,image_urls,unit_price,quantity)
 values(req,p.id,p.name,coalesce(p.image_urls,'[]'::jsonb),round(o.offer_price),1);
 update public.products set quantity=quantity-1,
  status=case when quantity-1=0 then 'deleted' else status end,updated_at=now()
 where id=p.id;
 update public.price_offers set connection_request_id=req,updated_at=now() where id=o.id;

 insert into public.connection_notifications(request_id,user_id,event,message) values
  (req,o.seller_id,'seller_fee_due','Thá»a thuáº­n tráº£ giÃ¡ #'||o.id||' Ä‘Ã£ thÃ nh yÃªu cáº§u giao dá»‹ch #'||req||'. PhÃ­ sÃ n 5% lÃ  '||amount||'Ä‘. XÃ¡c nháº­n phÃ­ Ä‘á»ƒ tiáº¿p tá»¥c trong 24 giá».'),
  (req,o.buyer_id,'request_created','NgÆ°á»i bÃ¡n Ä‘Ã£ cháº¥p nháº­n giÃ¡ '||round(o.offer_price)||'Ä‘. YÃªu cáº§u #'||req||' Ä‘Ã£ gá»­i; chat sáº½ má»Ÿ sau khi ngÆ°á»i bÃ¡n xÃ¡c nháº­n phÃ­ sÃ n.');
 return jsonb_build_object('success',true,'request_id',req,'subtotal',round(o.offer_price),'platform_fee',amount,'status','awaiting_seller');
end $$;
revoke all on function private.create_accepted_offer_connection(bigint) from public,anon,authenticated;

create or replace function public.respond_price_offer(p_offer_id bigint,p_action text,p_counter_price numeric default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); o public.price_offers; result jsonb;
begin
 if uid is null then raise exception 'Vui lÃ²ng Ä‘Äƒng nháº­p.'; end if;
 select * into o from public.price_offers where id=p_offer_id for update;
 if not found or o.seller_id<>uid then raise exception 'Chá»‰ ngÆ°á»i bÃ¡n cá»§a sáº£n pháº©m Ä‘Æ°á»£c pháº£n há»“i.'; end if;
 if o.status<>'pending' then raise exception 'Äá» nghá»‹ nÃ y Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½.'; end if;
 if p_action not in ('accept','reject','counter') then raise exception 'Pháº£n há»“i khÃ´ng há»£p lá»‡.'; end if;
 if p_action='counter' then
  if p_counter_price is null or p_counter_price::text in ('NaN','Infinity','-Infinity') or p_counter_price<>round(p_counter_price) or p_counter_price<ceil(o.listed_price*0.60) or p_counter_price>o.listed_price then
   raise exception 'GiÃ¡ Ä‘á» xuáº¥t láº¡i pháº£i tá»« %Ä‘ Ä‘áº¿n %Ä‘.',ceil(o.listed_price*0.60),o.listed_price;
  end if;
  update public.price_offers set status='countered',counter_price=p_counter_price,updated_at=now() where id=o.id;
  insert into public.price_offer_notifications(offer_id,user_id,event,message) values(o.id,o.buyer_id,'offer_countered','NgÆ°á»i bÃ¡n Ä‘Ã£ Ä‘á» xuáº¥t láº¡i '||p_counter_price||'Ä‘ cho '||o.product_name||'.');
 elsif p_action='accept' then
  update public.price_offers set status='accepted',updated_at=now() where id=o.id;
  result:=private.create_accepted_offer_connection(o.id);
  insert into public.price_offer_notifications(offer_id,user_id,event,message) values(o.id,o.buyer_id,'offer_accepted','NgÆ°á»i bÃ¡n Ä‘Ã£ cháº¥p nháº­n giÃ¡ '||o.offer_price||'Ä‘ cho '||o.product_name||'. YÃªu cáº§u giao dá»‹ch #'||(result->>'request_id')||' Ä‘ang chá» ngÆ°á»i bÃ¡n xÃ¡c nháº­n phÃ­ sÃ n.');
 else
  update public.price_offers set status='rejected',updated_at=now() where id=o.id;
  insert into public.price_offer_notifications(offer_id,user_id,event,message) values(o.id,o.buyer_id,'offer_rejected','NgÆ°á»i bÃ¡n Ä‘Ã£ tá»« chá»‘i Ä‘á» nghá»‹ cho '||o.product_name||'.');
 end if;
 insert into public.price_offer_notifications(offer_id,user_id,event,message)
 select o.id,o.buyer_id,'response_saved','NgÆ°á»i bÃ¡n Ä‘Ã£ pháº£n há»“i Ä‘á» nghá»‹ tráº£ giÃ¡ cho '||o.product_name||'.' where o.buyer_id<>uid;
 if p_action='accept' then return result||jsonb_build_object('status','accepted'); end if;
 return jsonb_build_object('success',true,'status',p_action||'ed');
end $$;
revoke all on function public.respond_price_offer(bigint,text,numeric) from public,anon;
grant execute on function public.respond_price_offer(bigint,text,numeric) to authenticated;

create or replace function public.accept_counter_price_offer(p_offer_id bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); o public.price_offers; result jsonb;
begin
 if uid is null then raise exception 'Vui lÃ²ng Ä‘Äƒng nháº­p.'; end if;
 select * into o from public.price_offers where id=p_offer_id for update;
 if not found or o.buyer_id<>uid then raise exception 'Chá»‰ ngÆ°á»i mua Ä‘Æ°á»£c cháº¥p nháº­n giÃ¡ Ä‘á» xuáº¥t.'; end if;
 if o.status<>'countered' or o.counter_price is null then raise exception 'KhÃ´ng cÃ³ giÃ¡ Ä‘á» xuáº¥t Ä‘ang chá» xÃ¡c nháº­n.'; end if;
 update public.price_offers set status='accepted',offer_price=o.counter_price,updated_at=now() where id=o.id;
 result:=private.create_accepted_offer_connection(o.id);
 insert into public.price_offer_notifications(offer_id,user_id,event,message) values(o.id,o.seller_id,'counter_accepted','NgÆ°á»i mua Ä‘Ã£ cháº¥p nháº­n má»©c giÃ¡ '||o.counter_price||'Ä‘ cho '||o.product_name||'. YÃªu cáº§u giao dá»‹ch #'||(result->>'request_id')||' Ä‘ang chá» báº¡n xÃ¡c nháº­n phÃ­ sÃ n.');
 return result||jsonb_build_object('status','accepted','agreed_price',o.counter_price);
end $$;
revoke all on function public.accept_counter_price_offer(bigint) from public,anon;
grant execute on function public.accept_counter_price_offer(bigint) to authenticated;
