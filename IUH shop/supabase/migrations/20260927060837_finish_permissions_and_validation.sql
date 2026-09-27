-- Public views use invoker privileges; deliberately public projections live in private functions.
create or replace function private.published_ads()
returns table(id bigint,ad_name text,placement text,image_url text,title text,description text,button_text text,target_url text,start_date date,end_date date,status text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select a.id,a.ad_name,a.placement,a.image_url,a.title,a.description,a.button_text,a.target_url,a.start_date,a.end_date,a.status,a.created_at
 from public.advertisements a where lower(a.status)='active' and a.start_date<=current_date and a.end_date>=current_date
$$;
revoke all on function private.published_ads() from public;
grant execute on function private.published_ads() to anon,authenticated;
create or replace view public.published_advertisements with(security_invoker=true,security_barrier=true) as select * from private.published_ads();
create or replace function private.public_package_badges()
returns table(user_id uuid,package_id uuid,owner_id uuid,plan_type text,status text,starts_at timestamptz,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
 select m.user_id,p.id,p.owner_id,p.plan_type,p.status,p.starts_at,p.expires_at
 from public.service_packages p join public.service_package_members m on m.package_id=p.id
 where p.status='active' and p.expires_at>now()
$$;
revoke all on function private.public_package_badges() from public;
grant execute on function private.public_package_badges() to anon,authenticated;
create or replace view public.service_package_badges with(security_invoker=true) as select * from private.public_package_badges();
alter view public.service_package_payment_requests set(security_invoker=true);
-- Role helpers expose only the current caller's role; private lookup avoids recursive profile policies.
create or replace function public.is_admin() returns boolean language sql stable security invoker set search_path='' as $$select private.is_admin()$$;
create or replace function public.check_is_admin() returns boolean language sql stable security invoker set search_path='' as $$select private.is_admin()$$;
revoke execute on function public.add_service_package_owner(),public.sync_consignment_on_order_completed(),public.sync_consignment_on_order_item(),
 public.check_is_order_seller(bigint,uuid),public.is_order_buyer(bigint,uuid),public.is_order_seller(bigint,uuid)
 from public,anon,authenticated;
