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
