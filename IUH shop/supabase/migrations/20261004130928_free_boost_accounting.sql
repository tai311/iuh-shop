alter table public.trial_financial_entries drop constraint trial_financial_entries_source_type_check;
alter table public.trial_financial_entries add constraint trial_financial_entries_source_type_check check(source_type in ('order','package','donation','boost'));
alter table public.trial_financial_entries drop constraint trial_financial_entries_kind_check;
alter table public.trial_financial_entries add constraint trial_financial_entries_kind_check check(kind in ('seller','platform','shipping','package','donation','boost'));

create or replace function public.create_product_with_boost(p_name text,p_category text,p_quantity integer,p_price numeric,
  p_description text,p_image_urls jsonb,p_boost boolean,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); pid bigint; h text; oldhash text; freeboost boolean; fee numeric:=0; trial boolean:=private.iuh_trial_mode_enabled();
  a uuid; w public.iuh_wallets; aw public.iuh_wallets;
begin
  if uid is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  if nullif(btrim(p_idempotency_key),'') is null or length(p_idempotency_key)>100 then raise exception 'Yêu cầu không hợp lệ.'; end if;
  if nullif(btrim(p_name),'') is null or length(p_name)>200 or nullif(btrim(p_category),'') is null
    or p_quantity is null or p_quantity<1 or p_price is null or p_price<1000 or p_price<>round(p_price) or p_price::text in ('NaN','Infinity','-Infinity') or p_price>100000000000
    or nullif(btrim(p_description),'') is null or length(p_description)>2000 then raise exception 'Thông tin sản phẩm không hợp lệ.'; end if;
  if jsonb_typeof(p_image_urls) is distinct from 'array' or jsonb_array_length(p_image_urls) not between 1 and 5 then raise exception 'Cần từ 1 đến 5 ảnh.'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_image_urls) u where u not like
    'https://xecxofmogvqysejjpxvl.supabase.co/storage/v1/object/public/products/'||uid::text||'/%') then raise exception 'Ảnh phải thuộc tài khoản đăng tin.'; end if;
  if not exists(select 1 from public.users where user_id=uid and (terms_accepted=true or lower(role) in('admin','moderator'))) then raise exception 'Vui lòng đồng ý điều khoản đăng tin.'; end if;
  h:=md5(jsonb_build_array(p_name,p_category,p_quantity,p_price,p_description,p_image_urls,p_boost)::text);
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_idempotency_key,0));
  select id,creation_hash into pid,oldhash from public.products where seller_id=uid and creation_key=p_idempotency_key;
  if found then
    if oldhash<>h then raise exception 'Yêu cầu đăng tin đã thay đổi. Vui lòng tải lại trang.'; end if;
    return jsonb_build_object('success',true,'id',pid,'already_created',true);
  end if;
  select exists(select 1 from public.service_package_members m join public.service_packages s on s.id=m.package_id
    where m.user_id=uid and s.status='active' and s.expires_at>now()) into freeboost;
  if coalesce(p_boost,false) and not freeboost then
    fee:=3000; a:=private.commerce_admin_id();
    if a is null then raise exception 'Chưa thiết lập ví nhận phí.'; end if;
    if not trial then
    insert into public.iuh_wallets(user_id) values(uid),(a) on conflict(user_id) do nothing;
    perform 1 from public.iuh_wallets where user_id in(uid,a) order by user_id for update;
    select * into w from public.iuh_wallets where user_id=uid;
    select * into aw from public.iuh_wallets where user_id=a;
    if w.balance<fee then raise exception 'Cần 3.000đ trong ví hoặc gói dịch vụ còn hạn để đẩy tin.'; end if;
    update public.iuh_wallets set balance=balance-fee,updated_at=now() where id=w.id;
    update public.iuh_wallets set balance=balance+fee,updated_at=now() where id=aw.id;
    end if;
  end if;
  insert into public.products(seller_id,name,category,quantity,price,description,image_urls,status,
    is_boosted,boost_started_at,boost_expires_at,creation_key,creation_hash)
  values(uid,btrim(p_name),p_category,p_quantity,p_price,btrim(p_description),p_image_urls,'active',coalesce(p_boost,false),
    case when p_boost then now() end,case when p_boost then now()+interval '24 hours' end,p_idempotency_key,h) returning id into pid;
  if fee>0 and trial then
    insert into public.trial_financial_entries(source_type,source_id,recipient_id,kind,amount,title)
    values('boost',pid::text,a,'boost',fee,'Phí đẩy tin · Sản phẩm #'||pid);
  elsif fee>0 then
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description) values
      (w.id,uid,'payment','Phí đẩy tin',fee,'Sản phẩm #'||pid),
      (aw.id,a,'sale','Phí đẩy tin',fee,'Sản phẩm #'||pid);
  end if;
  return jsonb_build_object('success',true,'id',pid,'boost_fee',fee,'package_benefit',freeboost and coalesce(p_boost,false));
end $$;
notify pgrst,'reload schema';
