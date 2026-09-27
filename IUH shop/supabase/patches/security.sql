-- Public fields are stored separately; private profiles never have public SELECT.
create schema if not exists private;
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
    select auth.uid() is not null and exists (
        select 1 from public.users where user_id = auth.uid() and lower(role) = 'admin'
    );
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

create table if not exists public.public_profiles (
    user_id uuid primary key references public.users(user_id) on delete cascade,
    id bigint not null,
    fullname text, avatar_url text, role text not null default 'user',
    student_verified boolean not null default false,
    faculty text, bio text, is_graduated boolean not null default false,
    created_at timestamp without time zone
);
alter table public.public_profiles enable row level security;
revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated;
drop policy if exists public_profiles_read on public.public_profiles;
create policy public_profiles_read on public.public_profiles for select to anon, authenticated using (true);
insert into public.public_profiles(user_id,id,fullname,avatar_url,role,student_verified,faculty,bio,is_graduated,created_at)
select user_id,id,fullname,avatar_url,role,student_verified,faculty,bio,is_graduated,created_at
from public.users where user_id is not null
on conflict(user_id) do update set id=excluded.id,fullname=excluded.fullname,avatar_url=excluded.avatar_url,
role=excluded.role,student_verified=excluded.student_verified,faculty=excluded.faculty,bio=excluded.bio,
is_graduated=excluded.is_graduated,created_at=excluded.created_at;
create or replace function private.sync_public_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if new.user_id is not null then
        insert into public.public_profiles(user_id,id,fullname,avatar_url,role,student_verified,faculty,bio,is_graduated,created_at)
        values(new.user_id,new.id,new.fullname,new.avatar_url,new.role,new.student_verified,new.faculty,new.bio,new.is_graduated,new.created_at)
        on conflict(user_id) do update set fullname=excluded.fullname,avatar_url=excluded.avatar_url,
        role=excluded.role,student_verified=excluded.student_verified,faculty=excluded.faculty,bio=excluded.bio,
        is_graduated=excluded.is_graduated;
    end if;
    return new;
end;
$$;
revoke all on function private.sync_public_profile() from public, anon, authenticated;
drop trigger if exists sync_public_profile on public.users;
create trigger sync_public_profile after insert or update on public.users for each row execute function private.sync_public_profile();

do $$ declare item record; begin
    for item in select policyname from pg_policies where schemaname='public' and tablename='users' loop
        execute format('drop policy %I on public.users',item.policyname);
    end loop;
end $$;
revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;
grant update(fullname,student_id,faculty,phone,avatar_url,bio,is_graduated,student_card_url,verification_status,terms_accepted,terms_accepted_at,terms_version) on public.users to authenticated;
create policy users_private_read on public.users for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy users_edit_own_profile on public.users for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create or replace function private.guard_profile_update() returns trigger
language plpgsql set search_path = '' as $$
begin
    if current_user in ('postgres','supabase_admin','service_role') then return new; end if;
    if new.user_id is distinct from old.user_id or new.id is distinct from old.id
       or new.role is distinct from old.role or new.email is distinct from old.email
       or new.password_hash is distinct from old.password_hash
       or new.student_verified is distinct from old.student_verified
       or new.verified_at is distinct from old.verified_at or new.verified_by is distinct from old.verified_by
       or new.verification_method is distinct from old.verification_method
    then raise exception 'Bạn không được tự thay đổi quyền hoặc trạng thái xác thực.' using errcode='42501'; end if;
    if new.verification_status is distinct from old.verification_status and new.verification_status <> 'pending' then
        raise exception 'Yêu cầu xác thực phải chờ quản trị viên duyệt.' using errcode='42501';
    end if;
    if new.student_card_url is distinct from old.student_card_url then
        if new.student_card_url is null or split_part(new.student_card_url,'/',1) <> auth.uid()::text
           or new.student_card_url like '%..%' or new.verification_status <> 'pending' then
            raise exception 'Ảnh thẻ phải thuộc tài khoản gửi và ở trạng thái chờ duyệt.' using errcode='42501';
        end if;
    end if;
    return new;
end;
$$;
revoke all on function private.guard_profile_update() from public, anon, authenticated;
drop trigger if exists guard_profile_update on public.users;
create trigger guard_profile_update before update on public.users for each row execute function private.guard_profile_update();

-- Student cards remain private, including URLs that were public before this migration.
update storage.buckets set public=false,file_size_limit=5242880,
allowed_mime_types=array['image/jpeg','image/png','image/webp']
where id in ('student-cards','student-verifications');
do $$ declare item record; begin
    for item in select policyname from pg_policies where schemaname='storage' and tablename='objects'
        and (coalesce(qual,'')||coalesce(with_check,'')) ~ 'student-cards|student-verifications' loop
        execute format('drop policy %I on storage.objects',item.policyname);
    end loop;
end $$;
create policy student_cards_read_private on storage.objects for select to authenticated
using (bucket_id in ('student-cards','student-verifications') and
    ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_admin())));
create policy student_cards_upload_own on storage.objects for insert to authenticated
with check (bucket_id in ('student-cards','student-verifications') and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy student_cards_delete_own on storage.objects for delete to authenticated
using (bucket_id in ('student-cards','student-verifications') and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Publishing state is enforced at the database, including direct API requests.
do $$ declare item record; begin
    for item in select policyname from pg_policies where schemaname='public' and tablename='products' and cmd='SELECT' loop
        execute format('drop policy %I on public.products',item.policyname);
    end loop;
end $$;
create policy products_public_or_owner on public.products for select to anon, authenticated
using (status='active' or seller_id=(select auth.uid()) or (select private.is_admin()));

-- Renderable ads are a deliberately narrow projection, with publication predicates.
create or replace view public.published_advertisements with (security_barrier=true) as
select id,ad_name,placement,image_url,title,description,button_text,target_url,start_date,end_date,status,created_at
from public.advertisements where lower(status)='active' and start_date <= current_date and end_date >= current_date;
revoke all on public.published_advertisements from public,anon,authenticated;
grant select on public.published_advertisements to anon,authenticated;

-- Every exposed definer requires an explicitly granted caller. Internal trigger helpers
-- stay uncallable. Safe business entrypoints below / later patches grant authenticated.
do $$ declare item record; begin
    for item in select p.oid::regprocedure as signature from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop
        execute format('revoke execute on function %s from public, anon',item.signature);
    end loop;
end $$;
grant execute on function public.is_admin() to anon,authenticated;
grant execute on function public.check_is_admin() to anon,authenticated;
grant execute on function public.admin_set_student_verified(uuid,boolean) to authenticated;
grant execute on function public.ensure_iuh_wallet() to authenticated;
grant execute on function public.get_my_orders() to authenticated;

-- Reports can be submitted, read by their reporter, and triaged by an administrator.
grant select,insert on public.product_reports to authenticated;
grant update(status,admin_note,updated_at) on public.product_reports to authenticated;
grant usage,select on sequence public.product_reports_id_seq to authenticated;
create policy product_reports_submit on public.product_reports for insert to authenticated
with check (reporter_id=(select auth.uid()) and status='pending' and admin_note is null
    and length(btrim(reason)) between 1 and 200 and length(coalesce(description,'')) <= 2000);
create policy product_reports_read on public.product_reports for select to authenticated
using (reporter_id=(select auth.uid()) or (select private.is_admin()));
create policy product_reports_triage on public.product_reports for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create table if not exists public.user_reports (
    id bigint generated always as identity primary key,
    reporter_id uuid not null references auth.users(id),
    reported_user_id uuid not null references auth.users(id),
    reason text not null check(length(btrim(reason)) between 1 and 200),
    description text check(length(description)<=2000),
    status text not null default 'pending' check(status in ('pending','reviewing','resolved','rejected')),
    admin_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    check (reporter_id<>reported_user_id)
);
alter table public.user_reports enable row level security;
revoke all on public.user_reports from public,anon,authenticated;
grant select,insert on public.user_reports to authenticated;
grant update(status,admin_note,updated_at) on public.user_reports to authenticated;
grant usage,select on sequence public.user_reports_id_seq to authenticated;
create policy user_reports_submit on public.user_reports for insert to authenticated
with check (reporter_id=(select auth.uid()) and status='pending' and admin_note is null);
create policy user_reports_read on public.user_reports for select to authenticated
using (reporter_id=(select auth.uid()) or (select private.is_admin()));
create policy user_reports_triage on public.user_reports for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create index if not exists user_reports_reporter_idx on public.user_reports(reporter_id);
create index if not exists user_reports_target_idx on public.user_reports(reported_user_id);
create index if not exists product_reports_reporter_idx on public.product_reports(reporter_id);

-- One real bank transaction can fund only one operation across all payment flows.
create table public.bank_receipts (
    reference text primary key,
    kind text not null,
    entity_id text not null,
    reviewed_by uuid not null references auth.users(id),
    created_at timestamptz not null default now(),
    unique(kind,entity_id)
);
alter table public.bank_receipts enable row level security;
revoke all on public.bank_receipts from public,anon,authenticated;
grant select on public.bank_receipts to authenticated;
create policy bank_receipts_admin_read on public.bank_receipts for select to authenticated using ((select private.is_admin()));
create or replace function private.register_bank_receipt(p_reference text,p_kind text,p_entity_id text)
returns void language plpgsql security definer set search_path='' as $$
declare v_reference text:=upper(btrim(p_reference)); v_receipt public.bank_receipts%rowtype;
begin
    if not private.is_admin() then raise exception 'Chỉ quản trị viên được đối soát ngân hàng.' using errcode='42501'; end if;
    if length(coalesce(v_reference,'')) not between 4 and 200 then raise exception 'Mã giao dịch ngân hàng không hợp lệ.'; end if;
    insert into public.bank_receipts(reference,kind,entity_id,reviewed_by)
    values(v_reference,p_kind,p_entity_id,auth.uid()) on conflict(reference) do nothing;
    select * into v_receipt from public.bank_receipts where reference=v_reference;
    if v_receipt.kind<>p_kind or v_receipt.entity_id<>p_entity_id then
        raise exception 'Mã ngân hàng này đã được sử dụng cho giao dịch khác.';
    end if;
end;
$$;
revoke all on function private.register_bank_receipt(text,text,text) from public,anon,authenticated;
