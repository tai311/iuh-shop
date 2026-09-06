-- IUH SHOP - Service packages and group membership
-- Run this file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.service_packages (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    plan_type text not null check (plan_type in ('personal', 'group')),
    price integer not null check (price > 0),
    payment_method text not null default 'wallet'
        check (payment_method in ('wallet', 'bank')),
    transaction_code text not null unique,
    status text not null default 'active'
        check (status in ('pending', 'active', 'expired', 'cancelled')),
    starts_at timestamptz not null default now(),
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    check (expires_at > starts_at)
);

create table if not exists public.service_package_members (
    id uuid primary key default gen_random_uuid(),
    package_id uuid not null references public.service_packages(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    member_role text not null default 'member'
        check (member_role in ('owner', 'member')),
    joined_at timestamptz not null default now(),
    unique (package_id, user_id)
);

create index if not exists service_packages_owner_id_idx
    on public.service_packages(owner_id);

create index if not exists service_packages_active_expiry_idx
    on public.service_packages(status, expires_at);

create index if not exists service_package_members_user_id_idx
    on public.service_package_members(user_id);

create unique index if not exists one_active_package_per_owner_idx
    on public.service_packages(owner_id)
    where status in ('pending', 'active');

alter table public.service_packages enable row level security;
alter table public.service_package_members enable row level security;

-- A user can view packages they own or belong to.
create policy "Users can view their service packages"
on public.service_packages
for select
to authenticated
using (
    owner_id = auth.uid()
    or exists (
        select 1
        from public.service_package_members member
        where member.package_id = service_packages.id
          and member.user_id = auth.uid()
    )
);

-- Only the package owner can create a package for themselves.
create policy "Users can create their own service packages"
on public.service_packages
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Owners can update their service packages"
on public.service_packages
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Owners can delete their service packages"
on public.service_packages
for delete
to authenticated
using (owner_id = auth.uid());

-- Members can view their membership rows. Owners can manage members of their packages.
create policy "Users can view their package memberships"
on public.service_package_members
for select
to authenticated
using (
    user_id = auth.uid()
    or exists (
        select 1
        from public.service_packages package
        where package.id = service_package_members.package_id
          and package.owner_id = auth.uid()
    )
);

create policy "Owners can add package members"
on public.service_package_members
for insert
to authenticated
with check (
    exists (
        select 1
        from public.service_packages package
        where package.id = service_package_members.package_id
          and package.owner_id = auth.uid()
          and package.plan_type = 'group'
    )
    and member_role = 'member'
    and (
        select count(*)
        from public.service_package_members existing_member
        where existing_member.package_id = service_package_members.package_id
    ) < 3
);

create policy "Owners can remove package members"
on public.service_package_members
for delete
to authenticated
using (
    exists (
        select 1
        from public.service_packages package
        where package.id = service_package_members.package_id
          and package.owner_id = auth.uid()
    )
    and member_role = 'member'
);

-- Keep package status correct when it is read after its expiry date.
create or replace function public.expire_service_packages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.status = 'active' and new.expires_at <= now() then
        new.status = 'expired';
    end if;
    return new;
end;
$$;

drop trigger if exists service_packages_expiry_trigger on public.service_packages;
create trigger service_packages_expiry_trigger
before insert or update on public.service_packages
for each row execute function public.expire_service_packages();

-- Add the package owner as a member automatically for every new package.
create or replace function public.add_service_package_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.service_package_members (package_id, user_id, member_role)
    values (new.id, new.owner_id, 'owner')
    on conflict (package_id, user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists service_packages_owner_trigger on public.service_packages;
create trigger service_packages_owner_trigger
after insert on public.service_packages
for each row execute function public.add_service_package_owner();
