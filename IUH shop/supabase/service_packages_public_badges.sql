-- IUH SHOP - Allow active package badges to be visible to signed-in users
-- Run this once after service_packages.sql in Supabase SQL Editor.

drop policy if exists "Users can view their service packages" on public.service_packages;
create policy "Authenticated users can view active service packages"
on public.service_packages
for select
to authenticated
using (
    status = 'active'
    and expires_at > now()
);

drop policy if exists "Users can view their package memberships" on public.service_package_members;
create policy "Authenticated users can view active package memberships"
on public.service_package_members
for select
to authenticated
using (
    exists (
        select 1
        from public.service_packages package
        where package.id = service_package_members.package_id
          and package.status = 'active'
          and package.expires_at > now()
    )
);
