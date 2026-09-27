-- PATCH: security
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


-- PATCH: packages
-- Atomic service-package purchases. Apply through the root migration workflow.
-- Existing packages and history are preserved. The client cannot activate paid privileges.
create schema if not exists private;

create table if not exists public.service_package_payments (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    transaction_code text not null unique,
    plan_type text not null check (plan_type in ('personal', 'group')),
    price integer not null check (price = case when plan_type = 'personal' then 19000 else 29000 end),
    payment_method text not null check (payment_method in ('wallet', 'bank')),
    member_ids uuid[] not null default '{}',
    status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
    package_id uuid references public.service_packages(id) on delete set null,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    approved_by uuid references auth.users(id) on delete set null,
    cancellation_reason text,
    check (cardinality(member_ids) <= 2),
    check (plan_type = 'group' or cardinality(member_ids) = 0)
);
create unique index if not exists service_package_one_pending_payment
    on public.service_package_payments(owner_id) where status = 'pending';
alter table public.service_package_payments enable row level security;
revoke all on public.service_package_payments from anon, authenticated;
grant select on public.service_package_payments to authenticated;
drop policy if exists "Read own package payments" on public.service_package_payments;
create policy "Read own package payments" on public.service_package_payments
for select to authenticated using (owner_id = (select auth.uid()) or (select private.is_admin()));

create or replace function private.can_read_service_package(p_package_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
    select auth.uid() is not null and (
        private.is_admin()
        or exists(select 1 from public.service_packages p where p.id = p_package_id and p.owner_id = auth.uid())
        or exists(select 1 from public.service_package_members m where m.package_id = p_package_id and m.user_id = auth.uid())
    );
$$;
revoke all on function private.can_read_service_package(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.can_read_service_package(uuid) to authenticated;

-- Remove old client-write policies and all transaction fields from public badge reads.
do $$ declare r record; begin
    for r in select tablename, policyname from pg_policies
        where schemaname = 'public' and tablename in ('service_packages', 'service_package_members')
    loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;
revoke all on public.service_packages, public.service_package_members from anon, authenticated;
grant select on public.service_packages, public.service_package_members to authenticated;
create policy "Read own service packages" on public.service_packages for select to authenticated
using (private.can_read_service_package(id));
create policy "Read own package members" on public.service_package_members for select to authenticated
using (private.can_read_service_package(package_id));

-- Deliberately public, sanitized view. Its definer bypasses RLS only for the fields below.
create or replace view public.service_package_badges as
select m.user_id, p.id as package_id, p.owner_id, p.plan_type, p.status, p.starts_at, p.expires_at
from public.service_packages p join public.service_package_members m on m.package_id = p.id
where p.status = 'active' and p.expires_at > now();
revoke all on public.service_package_badges from public, anon, authenticated;
grant select on public.service_package_badges to anon, authenticated;

create or replace view public.service_package_payment_requests as
select t.id, t.owner_id, u.fullname as owner_name, t.transaction_code, t.plan_type,
       t.price, t.price as amount, t.payment_method, t.status, t.member_ids,
       t.created_at, t.completed_at, t.cancellation_reason
from public.service_package_payments t
left join public.users u on u.user_id = t.owner_id
where private.is_admin();
revoke all on public.service_package_payment_requests from public, anon, authenticated;
grant select on public.service_package_payment_requests to authenticated;

create or replace function private.service_package_receipt(p_payment public.service_package_payments)
returns jsonb language sql immutable set search_path = '' as $$
    select jsonb_build_object('success', true, 'status', p_payment.status,
        'transaction_code', p_payment.transaction_code, 'package_id', p_payment.package_id,
        'plan_type', p_payment.plan_type, 'price', p_payment.price,
        'payment_method', p_payment.payment_method, 'expires_at', p_payment.expires_at);
$$;
revoke all on function private.service_package_receipt(public.service_package_payments) from public;

create or replace function private.fulfill_service_package_payment(p_payment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    v_payment public.service_package_payments%rowtype;
    v_package public.service_packages%rowtype;
    v_admin uuid;
    v_admin_wallet bigint;
    v_buyer_wallet bigint;
    v_balance numeric;
    v_expiry timestamptz;
begin
    -- Package changes share one transaction lock: group limits/overlapping membership remain atomic.
    perform pg_advisory_xact_lock(192837, 1);
    select * into v_payment from public.service_package_payments where id = p_payment_id for update;
    if v_payment.id is null then raise exception 'Không tìm thấy yêu cầu thanh toán.'; end if;
    if v_payment.status = 'paid' then return private.service_package_receipt(v_payment); end if;
    if v_payment.status <> 'pending' then raise exception 'Yêu cầu này đã được hủy.'; end if;

    select * into v_package from public.service_packages
    where owner_id = v_payment.owner_id and status in ('pending', 'active')
    order by created_at desc limit 1 for update;
    if v_package.status = 'active' and v_package.expires_at > now()
       and v_package.plan_type <> v_payment.plan_type then
        raise exception 'Gói hiện tại còn hạn. Chỉ có thể gia hạn cùng gói; đổi loại gói sau khi hết hạn.';
    end if;
    if cardinality(v_payment.member_ids) > 2
       or (v_payment.plan_type = 'personal' and cardinality(v_payment.member_ids) <> 0)
       or v_payment.owner_id = any(v_payment.member_ids)
       or array_position(v_payment.member_ids, null) is not null
       or (select count(distinct x) from unnest(v_payment.member_ids) x) <> cardinality(v_payment.member_ids) then
        raise exception 'Danh sách thành viên không hợp lệ. Nhóm tối đa 3 tài khoản gồm chủ gói.';
    end if;
    if (select count(*) from public.users where user_id = any(v_payment.member_ids)) <> cardinality(v_payment.member_ids) then
        raise exception 'Một thành viên không còn tài khoản hợp lệ.';
    end if;
    if exists (
        select 1 from public.service_packages p
        left join public.service_package_members m on m.package_id = p.id
        where p.status = 'active' and p.expires_at > now()
          and p.id is distinct from v_package.id
          and (p.owner_id = any(array_append(v_payment.member_ids, v_payment.owner_id))
               or m.user_id = any(array_append(v_payment.member_ids, v_payment.owner_id)))
    ) then raise exception 'Bạn hoặc một thành viên đang dùng gói khác. Vui lòng chờ gói đó hết hạn.'; end if;

    select user_id into v_admin from public.users where lower(role) = 'admin' order by user_id limit 1;
    if v_admin is null then raise exception 'Chưa có tài khoản Admin nhận thanh toán.'; end if;
    insert into public.iuh_wallets(user_id) values(v_admin) on conflict(user_id) do nothing;
    if v_payment.payment_method = 'wallet' then
        insert into public.iuh_wallets(user_id) values(v_payment.owner_id) on conflict(user_id) do nothing;
    end if;
    -- Deterministic wallet lock order also cooperates with other payment functions.
    perform 1 from public.iuh_wallets
    where user_id in (v_admin, v_payment.owner_id) order by id for update;
    select id into v_admin_wallet from public.iuh_wallets where user_id = v_admin;
    if v_payment.payment_method = 'wallet' then
        select id, balance into v_buyer_wallet, v_balance from public.iuh_wallets where user_id = v_payment.owner_id;
        if v_balance < v_payment.price then raise exception 'Số dư Ví IUH không đủ.'; end if;
        update public.iuh_wallets set balance = balance - v_payment.price, updated_at = now() where id = v_buyer_wallet;
        insert into public.wallet_transactions(wallet_id, user_id, type, title, amount, description)
        values(v_buyer_wallet, v_payment.owner_id, 'payment', 'Thanh toán gói dịch vụ', v_payment.price, v_payment.transaction_code);
    end if;
    update public.iuh_wallets set balance = balance + v_payment.price, updated_at = now() where id = v_admin_wallet;
    insert into public.wallet_transactions(wallet_id, user_id, type, title, amount, description)
    values(v_admin_wallet, v_admin, 'fee', 'Gói dịch vụ', v_payment.price, v_payment.transaction_code || ' / ' || v_payment.payment_method);

    v_expiry := greatest(now(), case when v_package.status = 'active' then v_package.expires_at else now() end) + interval '30 days';
    if v_package.id is null then
        insert into public.service_packages(owner_id, plan_type, price, payment_method, transaction_code, status, starts_at, expires_at)
        values(v_payment.owner_id, v_payment.plan_type, v_payment.price, v_payment.payment_method,
            v_payment.transaction_code, 'active', now(), v_expiry) returning * into v_package;
    else
        update public.service_packages set plan_type = v_payment.plan_type, price = v_payment.price,
            payment_method = v_payment.payment_method, transaction_code = v_payment.transaction_code,
            status = 'active', starts_at = case when expires_at > now() and status = 'active' then starts_at else now() end,
            expires_at = v_expiry where id = v_package.id returning * into v_package;
    end if;
    delete from public.service_package_members where package_id = v_package.id and member_role = 'member';
    insert into public.service_package_members(package_id, user_id, member_role)
    values(v_package.id, v_payment.owner_id, 'owner') on conflict(package_id, user_id) do update set member_role = 'owner';
    insert into public.service_package_members(package_id, user_id, member_role)
    select v_package.id, id, 'member' from unnest(v_payment.member_ids) id;
    update public.service_package_payments set status = 'paid', package_id = v_package.id,
        expires_at = v_expiry, completed_at = now() where id = v_payment.id returning * into v_payment;
    return private.service_package_receipt(v_payment);
end;
$$;
revoke all on function private.fulfill_service_package_payment(uuid) from public, anon, authenticated;

create or replace function public.purchase_service_package(
    p_plan_type text, p_payment_method text, p_transaction_code text, p_member_ids uuid[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_payment public.service_package_payments%rowtype; v_members uuid[];
begin
    if v_user is null then raise exception 'Vui lòng đăng nhập.'; end if;
    if p_plan_type is null or p_plan_type not in ('personal', 'group')
       or p_payment_method is null or p_payment_method not in ('wallet', 'bank') then raise exception 'Gói hoặc phương thức không hợp lệ.'; end if;
    if p_transaction_code is null or p_transaction_code !~ '^[A-Za-z0-9_-]{12,80}$' then raise exception 'Mã giao dịch không hợp lệ.'; end if;
    select coalesce(array_agg(x order by x), '{}'::uuid[]) into v_members from unnest(coalesce(p_member_ids, '{}'::uuid[])) x;
    if cardinality(v_members) > 2 or (p_plan_type = 'personal' and cardinality(v_members) > 0)
       or v_user = any(v_members) or array_position(v_members, null) is not null
       or (select count(distinct x) from unnest(v_members) x) <> cardinality(v_members) then
        raise exception 'Danh sách thành viên không hợp lệ.';
    end if;
    perform pg_advisory_xact_lock(192837, 1);
    select * into v_payment from public.service_package_payments where transaction_code = p_transaction_code for update;
    if v_payment.id is not null then
        if v_payment.owner_id <> v_user or v_payment.plan_type <> p_plan_type
           or v_payment.payment_method <> p_payment_method or v_payment.member_ids <> v_members then
            raise exception 'Mã giao dịch đã được dùng cho yêu cầu khác.';
        end if;
        if v_payment.status = 'cancelled' then raise exception 'Yêu cầu này đã được hủy. Vui lòng tạo yêu cầu mới.'; end if;
        return private.service_package_receipt(v_payment);
    end if;
    if exists(select 1 from public.service_package_payments where owner_id = v_user and status = 'pending') then
        raise exception 'Bạn đang có yêu cầu chuyển khoản chờ xác nhận. Hãy xử lý hoặc hủy yêu cầu đó trước.';
    end if;
    if exists(select 1 from public.service_packages where owner_id = v_user and status = 'active'
       and expires_at > now() and plan_type <> p_plan_type) then
        raise exception 'Gói hiện tại còn hạn. Chỉ có thể gia hạn cùng gói; đổi loại gói sau khi hết hạn.';
    end if;
    insert into public.service_package_payments(owner_id, transaction_code, plan_type, price, payment_method, member_ids)
    values(v_user, p_transaction_code, p_plan_type, case when p_plan_type = 'personal' then 19000 else 29000 end,
        p_payment_method, v_members) returning * into v_payment;
    if p_payment_method = 'bank' then return private.service_package_receipt(v_payment); end if;
    return private.fulfill_service_package_payment(v_payment.id);
end;
$$;

create or replace function public.approve_service_package_payment(p_transaction_code text,p_bank_reference text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_payment public.service_package_payments%rowtype;
begin
    if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ Admin được xác nhận chuyển khoản.'; end if;
    perform pg_advisory_xact_lock(192837, 1);
    select * into v_payment from public.service_package_payments where transaction_code = p_transaction_code for update;
    if v_payment.id is null or v_payment.payment_method <> 'bank' then raise exception 'Không tìm thấy yêu cầu chuyển khoản.'; end if;
    if v_payment.status = 'paid' then return private.service_package_receipt(v_payment); end if;
    perform private.register_bank_receipt(p_bank_reference,'service_package',v_payment.id::text);
    update public.service_package_payments set approved_by = auth.uid() where id = v_payment.id;
    return private.fulfill_service_package_payment(v_payment.id);
end;
$$;

create or replace function public.cancel_service_package_payment(p_transaction_code text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_payment public.service_package_payments%rowtype;
begin
    if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
    perform pg_advisory_xact_lock(192837, 1);
    select * into v_payment from public.service_package_payments where transaction_code = p_transaction_code for update;
    if v_payment.id is null or (v_payment.owner_id <> auth.uid() and not private.is_admin()) then raise exception 'Không tìm thấy yêu cầu của bạn.'; end if;
    if v_payment.status = 'paid' then raise exception 'Giao dịch đã hoàn tất, không thể hủy yêu cầu.'; end if;
    update public.service_package_payments set status = 'cancelled', completed_at = now(),
        cancellation_reason = left(coalesce(p_reason, 'Đã hủy yêu cầu'), 500) where id = v_payment.id returning * into v_payment;
    return private.service_package_receipt(v_payment);
end;
$$;

create or replace function public.reject_service_package_payment(p_transaction_code text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
    if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ Admin được từ chối yêu cầu.'; end if;
    return public.cancel_service_package_payment(p_transaction_code, p_reason);
end;
$$;

create or replace function public.get_my_service_package()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_package public.service_packages%rowtype; v_members jsonb; v_pending jsonb; v_recent jsonb;
begin
    if v_user is null then raise exception 'Vui lòng đăng nhập.'; end if;
    select p.* into v_package from public.service_packages p
    where p.status = 'active' and p.expires_at > now()
      and (p.owner_id = v_user or exists(select 1 from public.service_package_members m where m.package_id = p.id and m.user_id = v_user))
    order by (p.owner_id = v_user) desc, p.expires_at desc limit 1;
    select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'member_role', m.member_role,
        'fullname', u.fullname, 'avatar_url', u.avatar_url) order by m.member_role desc, m.joined_at), '[]'::jsonb)
    into v_members from public.service_package_members m left join public.users u on u.user_id = m.user_id where m.package_id = v_package.id;
    select coalesce(jsonb_agg(private.service_package_receipt(t) || jsonb_build_object('created_at', t.created_at)), '[]'::jsonb)
    into v_pending from public.service_package_payments t where owner_id = v_user and status = 'pending';
    select coalesce(jsonb_agg(private.service_package_receipt(t)), '[]'::jsonb) into v_recent
    from (select * from public.service_package_payments where owner_id = v_user order by created_at desc limit 20) t;
    return jsonb_build_object('package', case when v_package.id is null then null else to_jsonb(v_package) end,
        'members', v_members, 'pending_requests', v_pending, 'recent_transactions', v_recent);
end;
$$;

create or replace function public.find_service_package_member(p_email text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
    if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
    if p_email is null or length(trim(p_email)) > 254 or position('@' in p_email) = 0 then raise exception 'Email không hợp lệ.'; end if;
    select jsonb_build_object('user_id', user_id, 'fullname', fullname, 'avatar_url', avatar_url)
    into v_result from public.users where lower(email) = lower(trim(p_email)) and user_id <> auth.uid() limit 1;
    if v_result is null then raise exception 'Không tìm thấy tài khoản khác phù hợp với email này.'; end if;
    return v_result;
end;
$$;

revoke all on function public.purchase_service_package(text,text,text,uuid[]) from public, anon;
revoke all on function public.approve_service_package_payment(text,text) from public, anon;
revoke all on function public.cancel_service_package_payment(text,text) from public, anon;
revoke all on function public.reject_service_package_payment(text,text) from public, anon;
revoke all on function public.get_my_service_package() from public, anon;
revoke all on function public.find_service_package_member(text) from public, anon;
grant execute on function public.purchase_service_package(text,text,text,uuid[]),
    public.approve_service_package_payment(text,text), public.cancel_service_package_payment(text,text),
    public.reject_service_package_payment(text,text), public.get_my_service_package(),
    public.find_service_package_member(text) to authenticated;

-- The old two-step charging endpoint cannot remain callable after clients migrate.
revoke execute on function public.pay_service_package(text,numeric,text) from public, anon, authenticated;


-- PATCH: commerce
-- Commerce repair. Applied by the root migration after profile/role hardening.
create schema if not exists private;

-- All money and order writes go through authenticated, atomic entrypoints.
revoke all on public.orders,public.order_items,public.order_status_history,public.iuh_wallets,public.wallet_transactions from public,anon,authenticated;
grant select on public.orders,public.order_items,public.order_status_history,public.iuh_wallets,public.wallet_transactions to authenticated;
grant execute on function public.ensure_iuh_wallet() to authenticated;
create or replace function private.can_read_order(p_id bigint) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_admin() or exists(select 1 from public.orders where id=p_id and buyer_id=auth.uid())
   or exists(select 1 from public.order_items where order_id=p_id and seller_id=auth.uid()))
$$;
revoke all on function private.can_read_order(bigint) from public,anon;
grant execute on function private.can_read_order(bigint) to authenticated;
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('orders','order_items','order_status_history','iuh_wallets','wallet_transactions') loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
create policy orders_read on public.orders for select to authenticated using(private.can_read_order(id));
create policy order_items_read on public.order_items for select to authenticated using(private.can_read_order(order_id));
create policy order_history_read on public.order_status_history for select to authenticated using(private.can_read_order(order_id));
create policy wallets_read on public.iuh_wallets for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy wallet_transactions_read on public.wallet_transactions for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));

alter table public.orders add column if not exists idempotency_key text;
alter table public.orders add column if not exists request_hash text;
alter table public.orders add column if not exists escrow_admin_id uuid references public.users(user_id);
alter table public.orders add column if not exists captured_amount numeric(14,2) not null default 0;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists needs_payment_review boolean not null default false;
alter table public.orders add column if not exists platform_fee_paid_at timestamptz;
alter table public.order_items add column if not exists consignor_id uuid references public.users(user_id);
alter table public.products add column if not exists creation_key text;
alter table public.products add column if not exists creation_hash text;
create unique index if not exists orders_buyer_request_key on public.orders(buyer_id,idempotency_key) where idempotency_key is not null;
create unique index if not exists orders_bank_reference on public.orders(payment_reference) where payment_reference is not null;
create unique index if not exists products_seller_creation_key on public.products(seller_id,creation_key) where creation_key is not null;

-- Existing financial inconsistencies require review, never another automatic debit.
update public.orders set needs_payment_review=true
where idempotency_key is null and payment_method in ('iuh_wallet','qr') and settled_at is null
  and status <> 'cancelled';

create table public.bank_refund_requests (
 id uuid primary key default gen_random_uuid(),
 order_id bigint not null unique references public.orders(id),
 user_id uuid not null references public.users(user_id),
 escrow_admin_id uuid not null references public.users(user_id),
 amount numeric(14,2) not null check(amount>0),
 status text not null default 'pending' check(status in ('pending','completed')),
 bank_reference text,completed_by uuid references auth.users(id),completed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.bank_refund_requests enable row level security;
revoke all on public.bank_refund_requests from public,anon,authenticated;
grant select on public.bank_refund_requests to authenticated;
create policy bank_refunds_read on public.bank_refund_requests for select to authenticated
using(user_id=(select auth.uid()) or (select private.is_admin()));

create or replace function private.commerce_admin_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select u.user_id from public.users u where lower(u.role)='admin' order by u.user_id limit 1
$$;
revoke all on function private.commerce_admin_id() from public,anon,authenticated;

create or replace function private.capture_order(p_order_id bigint,p_bank_reference text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders; a uuid; bw public.iuh_wallets; aw public.iuh_wallets;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found or o.status='cancelled' then raise exception 'Đơn không hợp lệ.'; end if;
  if o.payment_status='paid' then return; end if;
  if o.needs_payment_review then raise exception 'Đơn cũ cần đối soát thủ công, không được thu tiền lại.'; end if;
  if o.payment_method not in ('iuh_wallet','qr') then raise exception 'Đơn không thanh toán online.'; end if;
  if o.total_amount<=0 then raise exception 'Tổng tiền không hợp lệ.'; end if;
  a:=private.commerce_admin_id();
  if a is null then raise exception 'Chưa thiết lập tài khoản nhận tiền.'; end if;
  insert into public.iuh_wallets(user_id) values(a),(o.buyer_id) on conflict(user_id) do nothing;
  perform 1 from public.iuh_wallets where user_id in(a,o.buyer_id) order by user_id for update;
  select * into aw from public.iuh_wallets where user_id=a;
  select * into bw from public.iuh_wallets where user_id=o.buyer_id;
  if o.payment_method='iuh_wallet' then
    if bw.balance<o.total_amount then raise exception 'Số dư Ví IUH không đủ.'; end if;
    update public.iuh_wallets set balance=balance-o.total_amount,updated_at=now() where id=bw.id;
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description)
      values(bw.id,o.buyer_id,'payment','Thanh toán đơn hàng',o.total_amount,'Đơn '||o.order_code);
  elsif nullif(btrim(p_bank_reference),'') is null then
    raise exception 'Cần mã giao dịch ngân hàng đã đối soát.';
  end if;
  if o.payment_method='qr' then perform private.register_bank_receipt(p_bank_reference,'order',o.id::text); end if;
  update public.iuh_wallets set pending=pending+o.total_amount,updated_at=now() where id=aw.id;
  insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description)
    values(aw.id,a,'sale','Tiền giữ hộ đơn hàng',o.total_amount,'Đơn '||o.order_code);
  update public.orders set payment_status='paid',paid_at=now(),captured_amount=total_amount,
    escrow_admin_id=a,payment_reference=nullif(btrim(p_bank_reference),''),updated_at=now() where id=o.id;
end $$;
revoke all on function private.capture_order(bigint,text) from public,anon,authenticated;

drop function if exists public.create_order(text,text,text,text,text,numeric,text,numeric,numeric,jsonb,bigint[]);
create or replace function public.create_order(
  p_recipient_name text,p_recipient_phone text,p_recipient_address text,p_note text,
  p_shipping_method text,p_shipping_fee numeric,p_payment_method text,p_subtotal numeric,
  p_total_amount numeric,p_items jsonb,p_cart_ids bigint[],p_idempotency_key text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); h text; o public.orders; p public.products; r record;
  subtotal numeric:=0; shipping numeric; total numeric; cons boolean; seller uuid;
  consignor uuid; authoritative jsonb:='[]'::jsonb; product_image text;
begin
  if uid is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  if nullif(btrim(p_idempotency_key),'') is null or length(p_idempotency_key)>100 then raise exception 'Vui lòng tải lại trang đặt hàng.'; end if;
  if nullif(btrim(p_recipient_name),'') is null or nullif(btrim(p_recipient_address),'') is null
     or p_recipient_phone !~ '^[+0-9 ().-]{8,20}$' then raise exception 'Thông tin nhận hàng không hợp lệ.'; end if;
  if p_payment_method is null or p_payment_method not in ('cash','qr','iuh_wallet') then raise exception 'Phương thức thanh toán không hợp lệ.'; end if;
  if p_shipping_method is null or p_shipping_method not in ('meet','mid') then raise exception 'Phương thức giao hàng không hợp lệ.'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Giỏ hàng không hợp lệ.'; end if;
  h:=md5(jsonb_build_object('name',p_recipient_name,'phone',p_recipient_phone,'address',p_recipient_address,
    'note',p_note,'shipping',p_shipping_method,'payment',p_payment_method,'items',p_items,'cart',p_cart_ids)::text);
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_idempotency_key,0));
  select * into o from public.orders where buyer_id=uid and idempotency_key=p_idempotency_key;
  if found then
    if o.request_hash<>h then raise exception 'Yêu cầu đã được dùng cho một đơn khác. Hãy tải lại trang.'; end if;
    return json_build_object('success',true,'order_id',o.id,'order_code',o.order_code,'payment_status',o.payment_status,'total_amount',o.total_amount,'already_created',true);
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) i where
    coalesce(i->>'product_id','') !~ '^[0-9]+$' or coalesce(i->>'quantity','') !~ '^[1-9][0-9]{0,5}$') then raise exception 'Số lượng không hợp lệ.'; end if;
  for r in select (i->>'product_id')::bigint id,sum((i->>'quantity')::integer)::integer qty
    from jsonb_array_elements(p_items) i group by 1 order by 1 loop
    select * into p from public.products where id=r.id for update;
    if not found or p.status<>'active' or p.quantity<r.qty then raise exception 'Sản phẩm không còn bán hoặc không đủ tồn kho.'; end if;
    if p.seller_id=uid then raise exception 'Bạn không thể mua sản phẩm của chính mình.'; end if;
    if p.price<=0 then raise exception 'Sản phẩm chưa có giá bán hợp lệ.'; end if;
    if cons is not null and cons<>p.is_consignment then raise exception 'Vui lòng đặt sản phẩm thường và ký gửi thành hai đơn.'; end if;
    if seller is not null and seller<>p.seller_id then raise exception 'Vui lòng đặt riêng sản phẩm của từng người bán.'; end if;
    cons:=p.is_consignment; seller:=p.seller_id; consignor:=null;
    if cons then
      select user_id into consignor from public.consignment_requests where id=p.consignment_request_id;
      if consignor is null then raise exception 'Thiếu thông tin chủ ký gửi.'; end if;
    end if;
    subtotal:=subtotal+round(p.price*case when cons then 1 else 1.05 end)*r.qty;
    product_image:=p.image_urls->>0;
    authoritative:=authoritative||jsonb_build_array(jsonb_build_object('id',p.id,'seller',p.seller_id,
      'consignor',consignor,'name',p.name,'image',product_image,'price',p.price,'qty',r.qty));
  end loop;
  shipping:=case when p_shipping_method='mid' then 5000 else 0 end; total:=subtotal+shipping;
  if p_total_amount is distinct from total then raise exception 'Giá sản phẩm đã thay đổi. Vui lòng tải lại để kiểm tra tổng tiền.'; end if;
  insert into public.orders(order_code,buyer_id,recipient_name,recipient_phone,recipient_address,note,
    shipping_method,shipping_fee,payment_method,subtotal,total_amount,order_type,status,payment_status,idempotency_key,request_hash)
  values('IUH'||replace(gen_random_uuid()::text,'-',''),uid,btrim(p_recipient_name),btrim(p_recipient_phone),btrim(p_recipient_address),p_note,
    p_shipping_method,shipping,p_payment_method,subtotal,total,case when cons then 'consignment' else 'normal' end,'pending','unpaid',p_idempotency_key,h)
  returning * into o;
  for r in select * from jsonb_to_recordset(authoritative) as x(id bigint,seller uuid,consignor uuid,name text,image text,price numeric,qty integer) loop
    insert into public.order_items(order_id,product_id,seller_id,consignor_id,product_name,product_image,price,quantity,subtotal)
    values(o.id,r.id,r.seller,r.consignor,r.name,r.image,r.price,r.qty,r.price*r.qty);
    update public.products set quantity=quantity-r.qty,status=case when quantity-r.qty=0 then 'deleted' else status end,updated_at=now() where id=r.id;
  end loop;
  if p_payment_method='iuh_wallet' then perform private.capture_order(o.id); end if;
  delete from public.cart_items where user_id=uid and id=any(coalesce(p_cart_ids,'{}'::bigint[]))
    and product_id in(select (i->>'id')::bigint from jsonb_array_elements(authoritative) i);
  insert into public.order_status_history(order_id,status,changed_by,note) values(o.id,'pending',uid,'Đơn được tạo; thanh toán được xử lý nguyên tử.');
  return json_build_object('success',true,'order_id',o.id,'order_code',o.order_code,'payment_status',case when p_payment_method='iuh_wallet' then 'paid' else 'unpaid' end,'total_amount',total);
end $$;

create or replace function public.admin_confirm_order_payment(p_order_id bigint,p_reference text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ quản trị viên được đối soát.'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found or o.payment_method<>'qr' then raise exception 'Đơn không phải chuyển khoản chờ đối soát.'; end if;
  perform private.capture_order(o.id,p_reference);
  return jsonb_build_object('success',true,'order_id',o.id,'payment_status','paid');
end $$;

create or replace function private.settle_order(p_order_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders; r record; aw public.iuh_wallets; rw public.iuh_wallets; payout numeric:=0;
begin
  select * into o from public.orders where id=p_order_id for update;
  if o.status<>'completed' then raise exception 'Đơn hàng chưa hoàn tất.'; end if;
  if o.settled_at is not null or o.payment_method='cash' then return; end if;
  if o.needs_payment_review or o.payment_status<>'paid' or o.captured_amount<>o.total_amount or o.escrow_admin_id is null then raise exception 'Đơn chưa được đối soát thanh toán.'; end if;
  if exists(select 1 from public.order_items where order_id=o.id and o.order_type='consignment' and consignor_id is null) then raise exception 'Đơn cũ cần xác minh chủ ký gửi.'; end if;
  insert into public.iuh_wallets(user_id)
    select distinct coalesce(consignor_id,seller_id) from public.order_items where order_id=o.id on conflict(user_id) do nothing;
  perform 1 from public.iuh_wallets where user_id=o.escrow_admin_id or user_id in
    (select coalesce(consignor_id,seller_id) from public.order_items where order_id=o.id) order by user_id for update;
  select * into aw from public.iuh_wallets where user_id=o.escrow_admin_id;
  for r in select coalesce(consignor_id,seller_id) beneficiary,
      round(sum(subtotal)*case when o.order_type='consignment' then 0.9 else 1 end) amount
      from public.order_items where order_id=o.id group by 1 loop
    payout:=payout+r.amount;
    if r.amount<=0 then raise exception 'Giá trị giải ngân không hợp lệ.'; end if;
    select * into rw from public.iuh_wallets where user_id=r.beneficiary;
    update public.iuh_wallets set balance=balance+r.amount,total_received=total_received+r.amount,updated_at=now() where id=rw.id;
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description) values
      (aw.id,aw.user_id,'payment','Giải ngân đơn hàng',r.amount,'Đơn '||o.order_code),
      (rw.id,rw.user_id,'sale','Tiền bán hàng',r.amount,'Đơn '||o.order_code);
  end loop;
  if payout>o.captured_amount then raise exception 'Tổng giải ngân vượt tiền đã thu.'; end if;
  update public.iuh_wallets set pending=pending-o.captured_amount,balance=balance+o.captured_amount-payout,updated_at=now() where id=aw.id;
  if o.captured_amount>payout then
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description)
      values(aw.id,aw.user_id,'sale','Phí dịch vụ đã hoàn tất',o.captured_amount-payout,'Đơn '||o.order_code);
  end if;
  update public.orders set settled_at=now(),updated_at=now() where id=o.id;
  update public.consignment_requests c set status='completed',payout_status='available',paid_at=null,updated_at=now()
    where exists(select 1 from public.products p join public.order_items i on i.product_id=p.id where i.order_id=o.id and p.consignment_request_id=c.id);
end $$;
revoke all on function private.settle_order(bigint) from public,anon,authenticated;

create or replace function public.settle_online_order(p_order_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (private.is_admin() or exists(select 1 from public.orders where id=p_order_id and buyer_id=auth.uid())
    or exists(select 1 from public.order_items where order_id=p_order_id and (seller_id=auth.uid() or consignor_id=auth.uid()))) then raise exception 'Không có quyền xử lý đơn.'; end if;
  perform private.settle_order(p_order_id);
  return jsonb_build_object('success',true,'settled',true,'order_id',p_order_id);
end $$;

create or replace function public.update_order_status(p_order_id bigint,p_new_status text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare o public.orders; allowed boolean; states text[]:=array['pending','confirmed','shipping','delivered','completed'];
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng.'; end if;
  allowed:=private.is_admin() or (exists(select 1 from public.order_items where order_id=o.id and seller_id=auth.uid())
    and not exists(select 1 from public.order_items where order_id=o.id and seller_id<>auth.uid()))
    or (p_new_status='completed' and o.buyer_id=auth.uid());
  if not allowed then raise exception 'Không có quyền cập nhật đơn.'; end if;
  if p_new_status='completed' and o.buyer_id<>auth.uid() and not private.is_admin() then
    raise exception 'Chỉ người mua hoặc quản trị viên được xác nhận đã nhận hàng.';
  end if;
  if o.status='cancelled' or p_new_status is null or not(p_new_status=any(states)) then raise exception 'Trạng thái không hợp lệ.'; end if;
  if o.status=p_new_status then
    if p_new_status='completed' then perform private.settle_order(o.id); end if;
    return true;
  end if;
  if array_position(states,p_new_status)<>array_position(states,o.status)+1 then raise exception 'Vui lòng cập nhật lần lượt từng trạng thái.'; end if;
  if o.payment_method<>'cash' and (o.payment_status<>'paid' or o.needs_payment_review) then raise exception 'Đơn đang chờ đối soát thanh toán.'; end if;
  update public.orders set status=p_new_status,updated_at=now() where id=o.id;
  if p_new_status='completed' then perform private.settle_order(o.id); end if;
  insert into public.order_status_history(order_id,status,changed_by,note) values(o.id,p_new_status,auth.uid(),'Cập nhật trạng thái và giải ngân nguyên tử.');
  return true;
end $$;

create or replace function public.cancel_order(p_order_id bigint) returns json
language plpgsql security definer set search_path = '' as $$
declare o public.orders; b public.iuh_wallets; a public.iuh_wallets; r record; refund numeric:=0;
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found or not(o.buyer_id=auth.uid() or private.is_admin()) then raise exception 'Không có quyền hủy đơn.'; end if;
  if o.status='cancelled' then return json_build_object('success',true,'already_cancelled',true,'refunded',false); end if;
  if o.status not in ('pending','confirmed') or o.settled_at is not null then raise exception 'Đơn hiện không thể hủy.'; end if;
  if o.needs_payment_review then raise exception 'Đơn cũ cần quản trị viên đối soát trước khi hủy/hoàn tiền.'; end if;
  if o.payment_status='paid' then
    if o.captured_amount<>o.total_amount or o.escrow_admin_id is null then raise exception 'Thiếu chứng từ giữ hộ, cần đối soát.'; end if;
    insert into public.iuh_wallets(user_id) values(o.buyer_id) on conflict(user_id) do nothing;
    perform 1 from public.iuh_wallets where user_id in(o.buyer_id,o.escrow_admin_id) order by user_id for update;
    select * into b from public.iuh_wallets where user_id=o.buyer_id;
    select * into a from public.iuh_wallets where user_id=o.escrow_admin_id;
    refund:=o.captured_amount;
    if o.payment_method='qr' then
      insert into public.bank_refund_requests(order_id,user_id,escrow_admin_id,amount)
      values(o.id,o.buyer_id,o.escrow_admin_id,refund);
    else
    update public.iuh_wallets set pending=pending-refund,updated_at=now() where id=a.id;
    update public.iuh_wallets set balance=balance+refund,updated_at=now() where id=b.id;
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description) values
      (a.id,a.user_id,'payment','Hoàn tiền đơn hàng',refund,'Đơn '||o.order_code),
      (b.id,b.user_id,'deposit','Hoàn tiền đơn hàng',refund,'Đơn '||o.order_code);
    end if;
  end if;
  for r in select product_id,sum(quantity)::integer qty from public.order_items where order_id=o.id group by product_id order by product_id loop
    update public.products set quantity=quantity+r.qty,status=case when status='deleted' and quantity=0 then 'active' else status end,updated_at=now() where id=r.product_id;
  end loop;
  update public.orders set status='cancelled',payment_status=case when refund>0 and o.payment_method='qr' then 'refund_pending' when refund>0 then 'refunded' else 'unpaid' end,updated_at=now() where id=o.id;
  update public.consignment_requests c set status='selling',updated_at=now() where status='sold' and exists
    (select 1 from public.products p join public.order_items i on i.product_id=p.id where i.order_id=o.id and p.consignment_request_id=c.id);
  insert into public.order_status_history(order_id,status,changed_by,note) values(o.id,'cancelled',auth.uid(),case when refund>0 and o.payment_method='qr' then 'Hủy đơn; chờ hoàn tiền ngân hàng.' else 'Hủy đơn; đã xử lý số dư nội bộ nếu có.' end);
  return json_build_object('success',true,'refunded',refund>0 and o.payment_method<>'qr','refund_pending',refund>0 and o.payment_method='qr','refund_amount',refund,'order_id',o.id);
end $$;

-- Old two-step checkout must never debit again.
create or replace function public.pay_order_to_admin(p_order_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  select * into o from public.orders where id=p_order_id;
  if not found or o.buyer_id<>auth.uid() then raise exception 'Không có quyền xem thanh toán.'; end if;
  if o.payment_status<>'paid' then raise exception 'Đơn chưa thanh toán; vui lòng dùng luồng đặt hàng mới hoặc chờ đối soát.'; end if;
  return jsonb_build_object('success',true,'already_paid',true,'order_id',o.id);
end $$;

create or replace function public.create_product_with_boost(p_name text,p_category text,p_quantity integer,p_price numeric,
  p_description text,p_image_urls jsonb,p_boost boolean,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); pid bigint; h text; oldhash text; freeboost boolean; fee numeric:=0;
  a uuid; w public.iuh_wallets; aw public.iuh_wallets;
begin
  if uid is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  if nullif(btrim(p_idempotency_key),'') is null or length(p_idempotency_key)>100 then raise exception 'Yêu cầu không hợp lệ.'; end if;
  if nullif(btrim(p_name),'') is null or length(p_name)>200 or nullif(btrim(p_category),'') is null
    or p_quantity is null or p_quantity<1 or p_price is null or p_price<1000 or p_price<>round(p_price)
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
    insert into public.iuh_wallets(user_id) values(uid),(a) on conflict(user_id) do nothing;
    perform 1 from public.iuh_wallets where user_id in(uid,a) order by user_id for update;
    select * into w from public.iuh_wallets where user_id=uid;
    select * into aw from public.iuh_wallets where user_id=a;
    if w.balance<fee then raise exception 'Cần 3.000đ trong ví hoặc gói dịch vụ còn hạn để đẩy tin.'; end if;
    update public.iuh_wallets set balance=balance-fee,updated_at=now() where id=w.id;
    update public.iuh_wallets set balance=balance+fee,updated_at=now() where id=aw.id;
  end if;
  insert into public.products(seller_id,name,category,quantity,price,description,image_urls,status,
    is_boosted,boost_started_at,boost_expires_at,creation_key,creation_hash)
  values(uid,btrim(p_name),p_category,p_quantity,p_price,btrim(p_description),p_image_urls,'active',coalesce(p_boost,false),
    case when p_boost then now() end,case when p_boost then now()+interval '24 hours' end,p_idempotency_key,h) returning id into pid;
  if fee>0 then
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description) values
      (w.id,uid,'payment','Phí đẩy tin',fee,'Sản phẩm #'||pid),
      (aw.id,a,'sale','Phí đẩy tin',fee,'Sản phẩm #'||pid);
  end if;
  return jsonb_build_object('success',true,'id',pid,'boost_fee',fee,'package_benefit',freeboost and coalesce(p_boost,false));
end $$;

create or replace function public.set_product_status(p_product_id bigint,p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.products;
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  select * into p from public.products where id=p_product_id for update;
  if not found or not(p.seller_id=auth.uid() or private.is_admin()) then raise exception 'Không có quyền cập nhật tin.'; end if;
  if p_status is null or p_status not in('active','hidden','deleted') then raise exception 'Trạng thái không hợp lệ.'; end if;
  if p_status='active' and p.quantity<=0 then raise exception 'Tin hết hàng không thể khôi phục.'; end if;
  update public.products set status=p_status,updated_at=now() where id=p.id;
  return jsonb_build_object('success',true,'id',p.id,'status',p_status);
end $$;

create or replace function public.pay_order_platform_fee(p_order_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders; uid uuid:=auth.uid(); a uuid; w public.iuh_wallets; aw public.iuh_wallets; fee numeric;
begin
  if uid is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found or o.payment_method<>'cash' or o.order_type<>'normal' or o.status<>'completed' then raise exception 'Đơn chưa có phí COD cần thanh toán.'; end if;
  if not exists(select 1 from public.order_items where order_id=o.id and seller_id=uid)
    or exists(select 1 from public.order_items where order_id=o.id and seller_id<>uid) then raise exception 'Bạn không phải người bán của toàn đơn.'; end if;
  if o.platform_fee_paid_at is not null then return jsonb_build_object('success',true,'already_paid',true,'order_id',o.id); end if;
  select o.total_amount-coalesce(sum(subtotal),0) into fee from public.order_items where order_id=o.id;
  if fee<0 then raise exception 'Đơn cũ có số liệu phí không hợp lệ, cần đối soát.'; end if;
  if fee>0 then
    a:=private.commerce_admin_id();
    if a is null then raise exception 'Chưa thiết lập ví thu phí.'; end if;
    insert into public.iuh_wallets(user_id) values(uid),(a) on conflict(user_id) do nothing;
    perform 1 from public.iuh_wallets where user_id in(uid,a) order by user_id for update;
    select * into w from public.iuh_wallets where user_id=uid;
    select * into aw from public.iuh_wallets where user_id=a;
    if w.balance<fee then raise exception 'Số dư ví không đủ để thanh toán phí.'; end if;
    update public.iuh_wallets set balance=balance-fee,updated_at=now() where id=w.id;
    update public.iuh_wallets set balance=balance+fee,updated_at=now() where id=aw.id;
    insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description) values
      (w.id,uid,'payment','Phí đơn COD',fee,'Đơn '||o.order_code),
      (aw.id,a,'sale','Phí đơn COD',fee,'Đơn '||o.order_code);
  end if;
  update public.orders set platform_fee_paid_at=now(),updated_at=now() where id=o.id;
  return jsonb_build_object('success',true,'order_id',o.id,'fee_amount',fee);
end $$;

-- Direct ordinary edits cannot assign paid entitlements or consignment ownership.
-- SECURITY INVOKER retains current_user, so audited definer RPCs can set these fields.
create or replace function private.guard_product_fields() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres','service_role','supabase_admin') or private.is_admin() then return new; end if;
  if tg_op='INSERT' then
    if new.is_boosted or new.boost_started_at is not null or new.boost_expires_at is not null
      or new.is_consignment or new.consignment_request_id is not null or new.creation_key is not null or new.creation_hash is not null then
      raise exception 'Các quyền đẩy tin và ký gửi phải do hệ thống xác nhận.';
    end if;
  elsif row(new.is_boosted,new.boost_started_at,new.boost_expires_at,new.is_consignment,new.consignment_request_id,new.creation_key,new.creation_hash,new.seller_id)
    is distinct from row(old.is_boosted,old.boost_started_at,old.boost_expires_at,old.is_consignment,old.consignment_request_id,old.creation_key,old.creation_hash,old.seller_id) then
    raise exception 'Không được sửa quyền đẩy tin, ký gửi hoặc chủ tin.';
  end if;
  return new;
end $$;
drop trigger if exists guard_product_fields on public.products;
create trigger guard_product_fields before insert or update on public.products for each row execute function private.guard_product_fields();

create or replace function public.get_my_orders() returns setof jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  return query select to_jsonb(o)||jsonb_build_object('order_items',coalesce(
    (select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb))
  from public.orders o where o.buyer_id=auth.uid() or exists(select 1 from public.order_items i
    where i.order_id=o.id and (i.seller_id=auth.uid() or i.consignor_id=auth.uid())) order by o.created_at desc;
end $$;
revoke all on function public.get_my_orders() from public,anon;
grant execute on function public.get_my_orders() to authenticated;
revoke all on function public.pay_boost_fee(),public.record_boost_qr_payment() from public,anon,authenticated;
revoke all on function public.create_order(text,text,text,text,text,numeric,text,numeric,numeric,jsonb,bigint[],text),
 public.admin_confirm_order_payment(bigint,text),public.settle_online_order(bigint),public.update_order_status(bigint,text),
 public.cancel_order(bigint),public.pay_order_to_admin(bigint),
 public.create_product_with_boost(text,text,integer,numeric,text,jsonb,boolean,text),public.set_product_status(bigint,text),public.pay_order_platform_fee(bigint)
 from public,anon;
grant execute on function public.create_order(text,text,text,text,text,numeric,text,numeric,numeric,jsonb,bigint[],text),
 public.admin_confirm_order_payment(bigint,text),public.settle_online_order(bigint),public.update_order_status(bigint,text),
 public.cancel_order(bigint),public.pay_order_to_admin(bigint),
 public.create_product_with_boost(text,text,integer,numeric,text,jsonb,boolean,text),public.set_product_status(bigint,text),public.pay_order_platform_fee(bigint)
 to authenticated;


-- PATCH: social
-- Social permissions and atomic direct conversations. Apply in the root migration.
create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_id uuid; v_admin boolean;
begin
  if v_me is null or p_other_user_id is null or p_other_user_id = v_me then
    raise exception 'Cuộc trò chuyện không hợp lệ.';
  end if;
  if not exists(select 1 from public.users where user_id = p_other_user_id) then
    raise exception 'Không tìm thấy người nhận.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(least(v_me::text,p_other_user_id::text)||':'||greatest(v_me::text,p_other_user_id::text), 0));
  select c.id, c.is_admin_chat into v_id,v_admin
  from public.conversations c
  where exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=v_me)
    and exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=p_other_user_id)
    and (select count(*) from public.conversation_members m where m.conversation_id=c.id)=2
  order by c.created_at,c.id limit 1;
  if v_id is null then
    v_id := gen_random_uuid();
    select exists(select 1 from public.users where user_id in(v_me,p_other_user_id) and role='admin') into v_admin;
    insert into public.conversations(id,is_admin_chat) values(v_id,v_admin);
    insert into public.conversation_members(conversation_id,user_id) values(v_id,v_me),(v_id,p_other_user_id);
  end if;
  return jsonb_build_object('id',v_id,'is_admin_chat',v_admin);
end $$;
revoke all on function public.get_or_create_direct_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

-- Memberships can only be created by the checked RPC; a user cannot join arbitrary chats.
revoke insert,update,delete on public.conversation_members from anon,authenticated;
revoke insert,delete on public.conversations from anon,authenticated;
drop policy if exists "Users can insert conversation members" on public.conversation_members;
drop policy if exists chat_members_insert on public.conversation_members;
drop policy if exists chat_members_update on public.conversation_members;
drop policy if exists chat_conversations_insert on public.conversations;

create or replace function private.guard_conversation_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') and
    (new.id is distinct from old.id or new.created_at is distinct from old.created_at
      or new.is_admin_chat is distinct from old.is_admin_chat) then
    raise exception 'Không được thay đổi thông tin định danh cuộc trò chuyện.';
  end if;
  return new;
end $$;
drop trigger if exists guard_conversation_update on public.conversations;
create trigger guard_conversation_update before update on public.conversations
for each row execute function private.guard_conversation_update();

drop policy if exists chat_reactions_update on public.message_reactions;
create policy chat_reactions_update on public.message_reactions for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(
 select 1 from public.messages m where m.id=message_id and public.is_chat_member(m.conversation_id,auth.uid())
));

create or replace function private.guard_message_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and current_user in ('anon','authenticated') then
    if old.sender_id <> auth.uid() then raise exception 'Chỉ người gửi được sửa hoặc thu hồi tin nhắn.'; end if;
    if new.id is distinct from old.id or new.sender_id is distinct from old.sender_id
      or new.conversation_id is distinct from old.conversation_id
      or new.created_at is distinct from old.created_at or new.product_id is distinct from old.product_id
      or new.is_read is distinct from old.is_read then
      raise exception 'Không được thay đổi thông tin định danh của tin nhắn.';
    end if;
    if old.recalled_at is not null then raise exception 'Tin nhắn đã được thu hồi.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_message_update on public.messages;
create trigger guard_message_update before update on public.messages for each row execute function private.guard_message_update();
drop policy if exists "Users can mark messages as read" on public.messages;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null or not public.is_chat_member(p_conversation_id,auth.uid()) then
    raise exception 'Bạn không thuộc cuộc trò chuyện này.';
  end if;
  update public.messages set is_read=true
  where conversation_id=p_conversation_id and sender_id<>auth.uid() and is_read=false;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.mark_conversation_read(uuid) from public,anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function private.can_publish_articles()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.users where user_id=auth.uid() and role in ('admin','moderator'));
$$;
revoke all on function private.can_publish_articles() from public;
grant usage on schema private to authenticated;
grant execute on function private.can_publish_articles() to authenticated;
drop policy if exists "Users can create own forum articles" on public.forum_articles;
drop policy if exists "Users can update own forum articles" on public.forum_articles;
drop policy if exists "Users can delete own forum articles" on public.forum_articles;
create policy "Staff create official articles" on public.forum_articles for insert to authenticated
  with check (author_id=auth.uid() and private.can_publish_articles());
create policy "Staff edit own official articles" on public.forum_articles for update to authenticated
  using(author_id=auth.uid() and private.can_publish_articles())
  with check(author_id=auth.uid() and private.can_publish_articles());
create policy "Staff delete own official articles" on public.forum_articles for delete to authenticated
  using(author_id=auth.uid() and private.can_publish_articles());

drop policy if exists forum_posts_select on public.forum_posts;
create policy forum_posts_select on public.forum_posts for select to anon,authenticated
  using(moderation_status='active');
create policy "Members view own moderated posts" on public.forum_posts for select to authenticated
  using(author_id=auth.uid() or private.is_admin());
create policy "Admin moderate forum posts" on public.forum_posts for update to authenticated
  using(private.is_admin()) with check(private.is_admin());
create or replace function private.guard_forum_post_moderation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_admin() then
    if tg_op='INSERT' and coalesce(new.moderation_status,'active')<>'active' then
      raise exception 'Trạng thái bài viết không hợp lệ.';
    elsif tg_op='UPDATE' and new.moderation_status is distinct from old.moderation_status then
      raise exception 'Chỉ quản trị viên được thay đổi trạng thái kiểm duyệt.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_forum_post_moderation on public.forum_posts;
create trigger guard_forum_post_moderation before insert or update on public.forum_posts
for each row execute function private.guard_forum_post_moderation();

-- Avoid exposing private student cards. Root installs owner/admin policies.
update storage.buckets set public=false where id in ('student-cards','chat-images');
update storage.buckets set file_size_limit=10485760,
allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif']
where id in ('avatars','forum-images','chat-images');
drop policy if exists "Users can delete avatars" on storage.objects;
drop policy if exists "Users can update avatars" on storage.objects;
drop policy if exists "Users can upload avatars" on storage.objects;
drop policy if exists forum_images_insert on storage.objects;
drop policy if exists forum_images_update on storage.objects;
drop policy if exists forum_images_delete on storage.objects;
create policy "Own public images insert" on storage.objects for insert to authenticated
with check(bucket_id in ('avatars','forum-images') and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Own public images update" on storage.objects for update to authenticated
using(bucket_id in ('avatars','forum-images') and owner_id=auth.uid()::text)
with check(bucket_id in ('avatars','forum-images') and owner_id=auth.uid()::text and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Own public images delete" on storage.objects for delete to authenticated
using(bucket_id in ('avatars','forum-images') and (owner_id=auth.uid()::text or private.is_admin()));

grant execute on function public.is_chat_member(uuid,uuid) to authenticated;
create or replace function private.can_access_chat_image(p_path text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_conversation uuid;
begin
  if auth.uid() is null then return false; end if;
  begin v_conversation := split_part(p_path,'/',2)::uuid;
  exception when invalid_text_representation then
    return exists(select 1 from public.messages m where
      (m.image_url=p_path or m.image_url='https://xecxofmogvqysejjpxvl.supabase.co/storage/v1/object/public/chat-images/'||p_path)
      and public.is_chat_member(m.conversation_id,auth.uid()));
  end;
  return public.is_chat_member(v_conversation,auth.uid());
end $$;
revoke all on function private.can_access_chat_image(text) from public;
grant execute on function private.can_access_chat_image(text) to authenticated;
create policy "Chat members upload images" on storage.objects for insert to authenticated
with check(bucket_id='chat-images' and (storage.foldername(name))[1]=auth.uid()::text and private.can_access_chat_image(name));
create policy "Chat members read images" on storage.objects for select to authenticated
using(bucket_id='chat-images' and private.can_access_chat_image(name));
create policy "Chat image owner delete" on storage.objects for delete to authenticated
using(bucket_id='chat-images' and owner_id=auth.uid()::text);

-- Account metadata never sets authorization or verified flags.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users(user_id,fullname,student_id,faculty,email,phone,is_graduated,created_at)
  values(new.id,new.raw_user_meta_data->>'fullname',new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'faculty',new.email,new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->'is_graduated'='true'::jsonb,false),now());
  return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated;

create or replace function public.admin_set_student_verified(target_user_id uuid, verified boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare v_user public.users%rowtype; v_path text; v_bucket text := 'student-cards'; v_match text[];
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Bạn không có quyền xác thực tài khoản.' using errcode='42501';
  end if;
  if verified is null then raise exception 'Trạng thái xác thực không hợp lệ.'; end if;
  select * into v_user from public.users where user_id=target_user_id for update;
  if not found then raise exception 'Không tìm thấy tài khoản.'; end if;
  if verified then
    v_path := v_user.student_card_url;
    if v_path ~ '^https?://' then
      v_match := regexp_match(v_path,
        '^https://xecxofmogvqysejjpxvl\.supabase\.co/storage/v1/object/(public|sign|authenticated)/(student-cards|student-verifications)/([^?#]+)');
      if v_match is null then raise exception 'Đường dẫn thẻ sinh viên không hợp lệ.'; end if;
      v_bucket := v_match[2];
      v_path := v_match[3];
    end if;
    if v_path is null or split_part(v_path,'/',1)<>target_user_id::text
      or v_path like '%..%' or v_path like '%\%%' escape '\' then
      raise exception 'Ảnh thẻ phải thuộc tài khoản được xác thực.';
    end if;
    if not exists(select 1 from storage.objects where bucket_id=v_bucket and name=v_path
      and owner_id=target_user_id::text) then
      raise exception 'Chưa có ảnh thẻ hợp lệ. Vui lòng yêu cầu người dùng tải lại ảnh thẻ.';
    end if;
  end if;
  update public.users set student_verified=verified,
    verification_status=case when verified then 'approved' else 'none' end,
    verification_method=case when verified then 'admin_grant' else 'none' end,
    verified_by=case when verified then auth.uid() else null end,
    verified_at=case when verified then now() else null end
  where user_id=target_user_id;
  return json_build_object('success',true,'verified',verified,'target_user_id',target_user_id);
end $$;
revoke all on function public.admin_set_student_verified(uuid,boolean) from public,anon;
grant execute on function public.admin_set_student_verified(uuid,boolean) to authenticated;


-- PATCH: support
-- Auditable requests. Browser actions never simulate bank transfers into real balances.
revoke execute on function public.deposit_iuh_wallet(numeric,text),public.withdraw_iuh_wallet(numeric,text,text),
 public.pay_iuh_wallet(numeric,text),public.pay_platform_fee(numeric,text),public.expire_service_packages()
 from public,anon,authenticated;
create table if not exists public.wallet_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    kind text not null check(kind in ('deposit','withdraw')),
    amount numeric(14,2) not null check(amount >= 1000 and amount <= 100000000 and amount=trunc(amount)),
    bank text not null check(length(bank) between 1 and 100),
    account text, customer_reference text,
    request_key text not null check(length(request_key) between 8 and 100),
    status text not null default 'pending' check(status in ('pending','approved','rejected')),
    bank_reference text, admin_note text, reviewed_by uuid references auth.users(id),
    reviewed_at timestamptz, created_at timestamptz not null default now(),
    unique(user_id,request_key), unique(bank_reference)
);
alter table public.wallet_requests enable row level security;
revoke all on public.wallet_requests from public,anon,authenticated;
grant select on public.wallet_requests to authenticated;
create policy wallet_requests_read on public.wallet_requests for select to authenticated
using (user_id=(select auth.uid()) or (select private.is_admin()));
create index if not exists wallet_requests_pending_idx on public.wallet_requests(status,created_at);

create or replace function private.request_wallet_movement(
    p_kind text,p_amount numeric,p_bank text,p_account text,p_reference text,p_request_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_existing public.wallet_requests%rowtype;
        v_id uuid; v_balance numeric; v_key text:=btrim(p_request_key);
begin
    if v_user is null then raise exception 'Vui lòng đăng nhập.' using errcode='42501'; end if;
    if p_kind not in ('deposit','withdraw') or p_amount is null or p_amount < 1000 or p_amount>100000000
       or p_amount<>trunc(p_amount) or p_amount::text in ('NaN','Infinity','-Infinity')
       or length(coalesce(btrim(p_bank),'')) not between 1 and 100
       or length(coalesce(v_key,'')) not between 8 and 100 then raise exception 'Thông tin yêu cầu không hợp lệ.'; end if;
    if p_kind='withdraw' and length(coalesce(btrim(p_account),'')) not between 5 and 100 then
        raise exception 'Vui lòng nhập tài khoản nhận tiền hợp lệ.';
    end if;
    if length(coalesce(p_reference,''))>200 then raise exception 'Nội dung chuyển khoản quá dài.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_user::text||':wallet-request',0));
    select * into v_existing from public.wallet_requests where user_id=v_user and request_key=v_key;
    if found then
        if v_existing.kind<>p_kind or v_existing.amount<>p_amount or v_existing.bank<>btrim(p_bank)
            or v_existing.account is distinct from nullif(btrim(p_account),'')
            or v_existing.customer_reference is distinct from nullif(btrim(p_reference),'') then
            raise exception 'Mã yêu cầu đã được dùng cho giao dịch khác.';
        end if;
        return jsonb_build_object('success',true,'status',v_existing.status,'request_id',v_existing.id,'already_submitted',true,
                                  'message','Yêu cầu đã được tiếp nhận.');
    end if;
    if exists(select 1 from public.wallet_requests where user_id=v_user and kind=p_kind and status='pending') then
        raise exception 'Bạn đã có yêu cầu cùng loại đang chờ xử lý.';
    end if;
    insert into public.iuh_wallets(user_id) values(v_user) on conflict(user_id) do nothing;
    select balance into v_balance from public.iuh_wallets where user_id=v_user for update;
    if p_kind='withdraw' then
        if v_balance<p_amount then raise exception 'Số dư khả dụng không đủ.'; end if;
        update public.iuh_wallets set balance=balance-p_amount,pending=pending+p_amount,updated_at=now() where user_id=v_user;
    end if;
    insert into public.wallet_requests(user_id,kind,amount,bank,account,customer_reference,request_key)
    values(v_user,p_kind,p_amount,btrim(p_bank),nullif(btrim(p_account),''),nullif(btrim(p_reference),''),v_key) returning id into v_id;
    return jsonb_build_object('success',true,'status','pending','request_id',v_id,
        'message',case when p_kind='withdraw' then 'Đã giữ số tiền yêu cầu. Quản trị viên sẽ xử lý chuyển khoản.'
        else 'Yêu cầu nạp tiền đang chờ đối soát chuyển khoản. Số dư chưa thay đổi.' end);
end;
$$;
revoke all on function private.request_wallet_movement(text,numeric,text,text,text,text) from public,anon,authenticated;
create or replace function public.request_wallet_deposit(p_amount numeric,p_bank text,p_reference text,p_request_key text)
returns jsonb language sql security definer set search_path='' as $$
    select private.request_wallet_movement('deposit',p_amount,p_bank,null,p_reference,p_request_key);
$$;
create or replace function public.request_wallet_withdrawal(p_amount numeric,p_bank text,p_account text,p_request_key text)
returns jsonb language sql security definer set search_path='' as $$
    select private.request_wallet_movement('withdraw',p_amount,p_bank,p_account,null,p_request_key);
$$;
revoke all on function public.request_wallet_deposit(numeric,text,text,text) from public,anon;
revoke all on function public.request_wallet_withdrawal(numeric,text,text,text) from public,anon;
grant execute on function public.request_wallet_deposit(numeric,text,text,text) to authenticated;
grant execute on function public.request_wallet_withdrawal(numeric,text,text,text) to authenticated;

create or replace function public.review_wallet_request(p_request_id uuid,p_approve boolean,p_bank_reference text default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_request public.wallet_requests%rowtype; v_wallet_id bigint; v_reference text:=nullif(btrim(p_bank_reference),'');
begin
    if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ quản trị viên được xử lý.' using errcode='42501'; end if;
    if p_approve is null then raise exception 'Chưa chọn kết quả xử lý.'; end if;
    select * into v_request from public.wallet_requests where id=p_request_id for update;
    if not found then raise exception 'Không tìm thấy yêu cầu.'; end if;
    if v_request.status<>'pending' then
        return jsonb_build_object('success',true,'status',v_request.status,'already_processed',true);
    end if;
    if p_approve and (v_reference is null or length(v_reference) not between 4 and 200) then
        raise exception 'Cần mã giao dịch ngân hàng đã đối soát.';
    end if;
    if p_approve then perform private.register_bank_receipt(v_reference,'wallet_'||v_request.kind,p_request_id::text); end if;
    select id into v_wallet_id from public.iuh_wallets where user_id=v_request.user_id for update;
    if v_wallet_id is null then raise exception 'Ví không tồn tại.'; end if;
    if v_request.kind='withdraw' then
        update public.iuh_wallets set pending=pending-v_request.amount,
            balance=balance+case when p_approve then 0 else v_request.amount end,updated_at=now()
        where id=v_wallet_id and pending>=v_request.amount;
        if not found then raise exception 'Số tiền đang giữ không khớp; cần kiểm tra trước khi xử lý.'; end if;
    elsif p_approve then
        update public.iuh_wallets set balance=balance+v_request.amount,updated_at=now() where id=v_wallet_id;
    end if;
    if p_approve then
        insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description,bank,account)
        values(v_wallet_id,v_request.user_id,v_request.kind,
            case when v_request.kind='deposit' then 'Nạp tiền đã đối soát' else 'Rút tiền đã chuyển khoản' end,
            v_request.amount,'Mã ngân hàng: '||v_reference,v_request.bank,v_request.account);
    end if;
    update public.wallet_requests set status=case when p_approve then 'approved' else 'rejected' end,
        bank_reference=case when p_approve then v_reference else null end,admin_note=left(p_note,2000),
        reviewed_by=auth.uid(),reviewed_at=now() where id=p_request_id;
    return jsonb_build_object('success',true,'status',case when p_approve then 'approved' else 'rejected' end);
end;
$$;
revoke all on function public.review_wallet_request(uuid,boolean,text,text) from public,anon;
grant execute on function public.review_wallet_request(uuid,boolean,text,text) to authenticated;

create table if not exists public.contact_requests (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id),
    fullname text not null check(length(fullname) between 1 and 150),
    email text not null check(length(email) between 3 and 254), phone text,
    message text not null check(length(message) between 10 and 4000),
    status text not null default 'pending' check(status in ('pending','reviewing','resolved','rejected')),
    admin_note text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from public,anon,authenticated;
grant select on public.contact_requests to authenticated;
grant update(status,admin_note,updated_at) on public.contact_requests to authenticated;
create policy contact_requests_read on public.contact_requests for select to authenticated
using (user_id=(select auth.uid()) or (select private.is_admin()));
create policy contact_requests_triage on public.contact_requests for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create index if not exists contact_requests_user_idx on public.contact_requests(user_id,created_at);
create or replace function public.submit_contact_request(p_fullname text,p_email text,p_phone text,p_message text)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_id bigint; begin
    if auth.uid() is null then raise exception 'Vui lòng đăng nhập để gửi yêu cầu hỗ trợ.' using errcode='42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':contact',0));
    if exists(select 1 from public.contact_requests where user_id=auth.uid() and created_at>now()-interval '1 minute') then
        raise exception 'Bạn vừa gửi yêu cầu. Vui lòng chờ một phút trước khi gửi tiếp.';
    end if;
    if p_email is null or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       or length(coalesce(p_phone,''))>30 then raise exception 'Thông tin liên hệ không hợp lệ.'; end if;
    insert into public.contact_requests(user_id,fullname,email,phone,message)
    values(auth.uid(),btrim(p_fullname),btrim(p_email),nullif(btrim(p_phone),''),btrim(p_message)) returning id into v_id;
    return v_id;
end;
$$;
revoke all on function public.submit_contact_request(text,text,text,text) from public,anon;
grant execute on function public.submit_contact_request(text,text,text,text) to authenticated;

-- Donations enter a pending queue; only verified receipts credit the platform wallet.
alter table public.donations add column if not exists bank_reference text;
alter table public.donations add column if not exists reviewed_by uuid references auth.users(id);
alter table public.donations add column if not exists reviewed_at timestamptz;
alter table public.donations alter column status set default 'pending';
alter table public.donations alter column payment_method set default 'bank_transfer';
revoke insert,update,delete on public.donations from anon,authenticated;
create or replace function public.request_donation(p_amount numeric,p_donor_name text,p_bank_name text,p_transfer_content text,p_request_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id bigint; v_existing public.donations%rowtype; begin
    if auth.uid() is null then raise exception 'Vui lòng đăng nhập để gửi yêu cầu Donate.' using errcode='42501'; end if;
    if p_amount is null or p_amount<1000 or p_amount>100000000 or p_amount<>trunc(p_amount) or p_amount::text in ('NaN','Infinity','-Infinity')
        or length(coalesce(btrim(p_donor_name),'')) not between 1 and 150
        or length(coalesce(btrim(p_bank_name),'')) not between 1 and 100
        or length(coalesce(p_transfer_content,'')) not between 1 and 200
        or length(coalesce(p_request_key,'')) not between 8 and 100 then raise exception 'Thông tin Donate không hợp lệ.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':donation',0));
    select * into v_existing from public.donations where transfer_code=p_request_key;
    if found then
        if v_existing.donor_id<>auth.uid() or v_existing.amount<>p_amount
           or v_existing.donor_name<>btrim(p_donor_name) or v_existing.bank_name<>btrim(p_bank_name)
           or v_existing.transfer_content<>btrim(p_transfer_content) then raise exception 'Mã yêu cầu đã được sử dụng.'; end if;
        return jsonb_build_object('success',true,'status',v_existing.status,'donation_id',v_existing.id,'transfer_code',p_request_key);
    end if;
    if exists(select 1 from public.donations where donor_id=auth.uid() and status='pending') then raise exception 'Bạn đã có yêu cầu Donate đang chờ đối soát.'; end if;
    insert into public.donations(donor_id,donor_name,amount,payment_method,transfer_code,status,bank_name,transfer_content,note)
    values(auth.uid(),btrim(p_donor_name),p_amount,'bank_transfer',p_request_key,'pending',btrim(p_bank_name),btrim(p_transfer_content),'Chờ đối soát ngân hàng') returning id into v_id;
    return jsonb_build_object('success',true,'status','pending','donation_id',v_id,'transfer_code',p_request_key);
end;
$$;
revoke all on function public.request_donation(numeric,text,text,text,text) from public,anon;
grant execute on function public.request_donation(numeric,text,text,text,text) to authenticated;
create or replace function public.review_donation(p_donation_id bigint,p_approve boolean,p_bank_reference text default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.donations%rowtype; w bigint; a uuid; begin
    if not private.is_admin() then raise exception 'Chỉ quản trị viên được đối soát.' using errcode='42501'; end if;
    if p_approve is null then raise exception 'Chưa chọn kết quả.'; end if;
    select * into d from public.donations where id=p_donation_id for update;
    if not found then raise exception 'Không tìm thấy Donate.'; end if;
    if d.status<>'pending' then return jsonb_build_object('success',true,'status',d.status,'already_processed',true); end if;
    if p_approve then
        perform private.register_bank_receipt(p_bank_reference,'donation',d.id::text);
        a:=private.commerce_admin_id();
        if a is null then raise exception 'Chưa thiết lập tài khoản nhận tiền.'; end if;
        insert into public.iuh_wallets(user_id) values(a) on conflict(user_id) do nothing;
        select id into w from public.iuh_wallets where user_id=a for update;
        update public.iuh_wallets set balance=balance+d.amount,updated_at=now() where id=w;
        insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description)
        values(w,a,'fee','Donate đã đối soát',d.amount,'Donate #'||d.id||' — '||btrim(p_bank_reference));
    end if;
    update public.donations set status=case when p_approve then 'completed' else 'rejected' end,
        bank_reference=case when p_approve then upper(btrim(p_bank_reference)) else null end,
        note=left(p_note,2000),reviewed_by=auth.uid(),reviewed_at=now() where id=d.id;
    return jsonb_build_object('success',true,'status',case when p_approve then 'completed' else 'rejected' end);
end;
$$;
revoke all on function public.review_donation(bigint,boolean,text,text) from public,anon;
grant execute on function public.review_donation(bigint,boolean,text,text) to authenticated;
revoke all on function public.create_simulated_donation(numeric,text,text,text) from public,anon,authenticated;

-- Consignment approval and listing creation always commit together.
create or replace function public.admin_process_consignment(p_request_id bigint,p_status text,p_note text default null)
returns json language plpgsql security definer set search_path='' as $$
declare r public.consignment_requests%rowtype; v_product bigint; begin
    if not private.is_admin() then raise exception 'Chỉ quản trị viên được xử lý ký gửi.' using errcode='42501'; end if;
    select * into r from public.consignment_requests where id=p_request_id for update;
    if not found then raise exception 'Không tìm thấy yêu cầu ký gửi.'; end if;
    if p_status='approved' then
        if r.product_id is not null and r.status in ('approved','selling') then
            return json_build_object('success',true,'status',r.status,'product_id',r.product_id,'already_processed',true);
        end if;
        if r.status<>'pending' or r.product_id is not null then raise exception 'Yêu cầu không còn chờ duyệt.'; end if;
        if r.selling_price<=0 then raise exception 'Giá ký gửi phải lớn hơn 0.'; end if;
        insert into public.products(seller_id,name,category,quantity,price,description,image_urls,status,is_consignment,consignment_request_id)
        values(auth.uid(),r.product_name,r.category,1,r.selling_price,r.description,to_jsonb(coalesce(r.image_names,'{}'::text[])),'active',true,r.id)
        returning id into v_product;
        update public.consignment_requests set status='selling',product_id=v_product,
            service_fee=round(selling_price*0.10),seller_receive=selling_price-round(selling_price*0.10),
            reviewed_by=auth.uid(),reviewed_at=now(),processed_by=auth.uid(),updated_at=now(),admin_note=left(p_note,2000) where id=r.id;
    elsif p_status='rejected' then
        if r.status<>'pending' then raise exception 'Chỉ từ chối yêu cầu đang chờ duyệt.'; end if;
        update public.consignment_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now(),admin_note=left(p_note,2000) where id=r.id;
    elsif p_status='cancelled' then
        if r.status not in ('pending','approved','selling','rejected') then raise exception 'Yêu cầu này đã có giao dịch, không thể hủy.'; end if;
        if exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id where i.product_id=r.product_id and o.status<>'cancelled') then
            raise exception 'Sản phẩm có đơn hàng đang xử lý hoặc đã hoàn thành.';
        end if;
        update public.products set status='deleted',updated_at=now() where id=r.product_id;
        update public.consignment_requests set status='cancelled',updated_at=now(),admin_note=left(p_note,2000) where id=r.id;
    else raise exception 'Trạng thái không hợp lệ. Việc bán và chi trả được thực hiện qua đơn hàng.';
    end if;
    return json_build_object('success',true,'status',case when p_status='approved' then 'selling' else p_status end,'product_id',v_product);
end;
$$;
revoke all on function public.admin_process_consignment(bigint,text,text) from public,anon;
grant execute on function public.admin_process_consignment(bigint,text,text) to authenticated;
revoke all on function public.admin_pay_consignment(bigint) from public,anon,authenticated;
revoke all on function public.admin_record_consignment_sale(bigint) from public,anon,authenticated;
revoke update,delete on public.consignment_requests from anon,authenticated;

create or replace function public.complete_bank_refund(p_request_id uuid,p_bank_reference text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.bank_refund_requests%rowtype; w bigint;
begin
 if not private.is_admin() then raise exception 'Chỉ quản trị viên được đối soát hoàn tiền.' using errcode='42501'; end if;
 select * into r from public.bank_refund_requests where id=p_request_id for update;
 if not found then raise exception 'Không tìm thấy yêu cầu hoàn tiền.'; end if;
 if r.status='completed' then return jsonb_build_object('success',true,'already_processed',true); end if;
 perform private.register_bank_receipt(p_bank_reference,'bank_refund',r.id::text);
 update public.iuh_wallets set pending=pending-r.amount,updated_at=now()
 where user_id=r.escrow_admin_id and pending>=r.amount returning id into w;
 if w is null then raise exception 'Số tiền giữ hộ không khớp; cần đối soát.'; end if;
 insert into public.wallet_transactions(wallet_id,user_id,type,title,amount,description)
 values(w,r.escrow_admin_id,'payment','Hoàn tiền ngân hàng',r.amount,'Đơn #'||r.order_id||' — '||p_bank_reference);
 update public.bank_refund_requests set status='completed',bank_reference=upper(btrim(p_bank_reference)),completed_by=auth.uid(),completed_at=now() where id=r.id;
 update public.orders set payment_status='refunded',updated_at=now() where id=r.order_id;
 return jsonb_build_object('success',true,'status','completed');
end;
$$;
revoke all on function public.complete_bank_refund(uuid,text) from public,anon;
grant execute on function public.complete_bank_refund(uuid,text) to authenticated;
