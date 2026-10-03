alter table public.service_package_payments
    add column if not exists wallet_reserved boolean not null default false,
    add column if not exists escrow_admin_id uuid references auth.users(id);

update public.iuh_trial_settings set enabled = true where id = true;

create or replace function public.get_iuh_trial_mode()
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
    if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
    return private.iuh_trial_mode_enabled();
end;
$$;
revoke all on function public.get_iuh_trial_mode() from public, anon;
grant execute on function public.get_iuh_trial_mode() to authenticated;

create or replace function private.guard_trial_payment_method()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
    if private.iuh_trial_mode_enabled() then
        if tg_table_name = 'orders' and tg_op = 'INSERT' and new.payment_method <> 'trial' then
            raise exception 'Đang bật chế độ chạy thử miễn phí. Vui lòng chọn Dùng thử miễn phí.';
        end if;
        if tg_table_name = 'service_package_payments' and tg_op = 'INSERT' and new.payment_method <> 'trial' then
            raise exception 'Đang bật chế độ chạy thử miễn phí. Vui lòng chọn Dùng thử miễn phí.';
        end if;
        if tg_table_name = 'orders' and tg_op = 'UPDATE' and old.payos_order_code is null and new.payos_order_code is not null then
            raise exception 'Không tạo link PayOS mới trong chế độ chạy thử miễn phí.';
        end if;
        if tg_table_name = 'service_package_payments' and tg_op = 'UPDATE' and old.payos_order_code is null and new.payos_order_code is not null then
            raise exception 'Không tạo link PayOS mới trong chế độ chạy thử miễn phí.';
        end if;
    end if;
    return new;
end;
$$;
revoke all on function private.guard_trial_payment_method() from public, anon, authenticated;
drop trigger if exists guard_trial_order_payment_method on public.orders;
create trigger guard_trial_order_payment_method
    before insert or update on public.orders
    for each row execute function private.guard_trial_payment_method();
drop trigger if exists guard_trial_package_payment_method on public.service_package_payments;
create trigger guard_trial_package_payment_method
    before insert or update on public.service_package_payments
    for each row execute function private.guard_trial_payment_method();

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
    perform pg_advisory_xact_lock(192837, 1);
    select * into v_payment from public.service_package_payments where id = p_payment_id for update;
    if v_payment.id is null then raise exception 'Không tìm thấy yêu cầu thanh toán.'; end if;
    if v_payment.status = 'paid' then return private.service_package_receipt(v_payment); end if;
    if v_payment.status <> 'pending' then raise exception 'Yêu cầu này đã được hủy.'; end if;
    if v_payment.payment_method = 'trial' and not private.iuh_trial_mode_enabled() then
        raise exception 'Chế độ thanh toán thử nghiệm hiện đã tắt.';
    end if;

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

    if v_payment.payment_method <> 'trial' then
        if v_payment.payment_method = 'wallet' and v_payment.wallet_reserved then
            v_admin := v_payment.escrow_admin_id;
        else
            select user_id into v_admin from public.users where lower(role) = 'admin' order by user_id limit 1;
        end if;
        if v_admin is null then raise exception 'Chưa có tài khoản Admin nhận thanh toán.'; end if;
        insert into public.iuh_wallets(user_id) values(v_admin) on conflict(user_id) do nothing;
        if v_payment.payment_method = 'wallet' and not v_payment.wallet_reserved then
            insert into public.iuh_wallets(user_id) values(v_payment.owner_id) on conflict(user_id) do nothing;
        end if;
        perform 1 from public.iuh_wallets
        where user_id in (v_admin, v_payment.owner_id) order by user_id for update;
        select id into v_admin_wallet from public.iuh_wallets where user_id = v_admin;
        if v_payment.payment_method = 'wallet' and v_payment.wallet_reserved then
            update public.iuh_wallets
            set pending = pending - v_payment.price, balance = balance + v_payment.price, updated_at = now()
            where id = v_admin_wallet and pending >= v_payment.price;
            if not found then raise exception 'Khoản tiền giữ chờ không còn đủ để duyệt.'; end if;
        elsif v_payment.payment_method = 'wallet' then
            select id, balance into v_buyer_wallet, v_balance from public.iuh_wallets where user_id = v_payment.owner_id;
            if v_balance < v_payment.price then raise exception 'Số dư Ví IUH không đủ.'; end if;
            update public.iuh_wallets set balance = balance - v_payment.price, updated_at = now() where id = v_buyer_wallet;
            insert into public.wallet_transactions(wallet_id, user_id, type, title, amount, description)
            values(v_buyer_wallet, v_payment.owner_id, 'payment', 'Thanh toán gói dịch vụ', v_payment.price, v_payment.transaction_code);
            update public.iuh_wallets set balance = balance + v_payment.price, updated_at = now() where id = v_admin_wallet;
        else
            update public.iuh_wallets set balance = balance + v_payment.price, updated_at = now() where id = v_admin_wallet;
        end if;
        insert into public.wallet_transactions(wallet_id, user_id, type, title, amount, description)
        values(v_admin_wallet, v_admin, 'fee', 'Gói dịch vụ', v_payment.price, v_payment.transaction_code || ' / ' || v_payment.payment_method);
    end if;

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
    update public.service_package_payments set status = 'paid', wallet_reserved = false,
        package_id = v_package.id, expires_at = v_expiry, completed_at = now()
    where id = v_payment.id returning * into v_payment;
    return private.service_package_receipt(v_payment);
end;
$$;
revoke all on function private.fulfill_service_package_payment(uuid) from public, anon, authenticated;

create or replace function public.purchase_service_package(
    p_plan_type text, p_payment_method text, p_transaction_code text, p_member_ids uuid[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    v_user uuid := auth.uid();
    v_payment public.service_package_payments%rowtype;
    v_members uuid[];
    v_admin uuid;
    v_admin_wallet bigint;
    v_buyer_wallet bigint;
    v_balance numeric;
begin
    if v_user is null then raise exception 'Vui lòng đăng nhập.'; end if;
    if p_plan_type is null or p_plan_type not in ('personal', 'group')
       or p_payment_method is null or p_payment_method not in ('wallet', 'bank', 'trial') then raise exception 'Gói hoặc phương thức không hợp lệ.'; end if;
    if private.iuh_trial_mode_enabled() and p_payment_method <> 'trial' then
        raise exception 'Đang bật chế độ chạy thử miễn phí. Vui lòng chọn Dùng thử miễn phí.';
    end if;
    if p_payment_method = 'trial' and not private.iuh_trial_mode_enabled() then raise exception 'Chế độ thanh toán thử nghiệm hiện đã tắt.'; end if;
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
        raise exception 'Bạn đang có yêu cầu gói chờ Admin duyệt. Hãy xử lý yêu cầu đó trước.';
    end if;
    if exists(select 1 from public.service_packages where owner_id = v_user and status = 'active'
       and expires_at > now() and plan_type <> p_plan_type) then
        raise exception 'Gói hiện tại còn hạn. Chỉ có thể gia hạn cùng gói; đổi loại gói sau khi hết hạn.';
    end if;
    insert into public.service_package_payments(owner_id, transaction_code, plan_type, price, payment_method, member_ids)
    values(v_user, p_transaction_code, p_plan_type, case when p_plan_type = 'personal' then 19000 else 29000 end,
        p_payment_method, v_members) returning * into v_payment;
    if p_payment_method = 'bank' then return private.service_package_receipt(v_payment); end if;
    if p_payment_method = 'trial' then return private.service_package_receipt(v_payment); end if;

    select user_id into v_admin from public.users where lower(role) = 'admin' order by user_id limit 1;
    if v_admin is null then raise exception 'Chưa có tài khoản Admin nhận thanh toán.'; end if;
    insert into public.iuh_wallets(user_id) values(v_admin), (v_user) on conflict(user_id) do nothing;
    perform 1 from public.iuh_wallets where user_id in (v_admin, v_user) order by user_id for update;
    select id into v_admin_wallet from public.iuh_wallets where user_id = v_admin;
    select id, balance into v_buyer_wallet, v_balance from public.iuh_wallets where user_id = v_user;
    if v_balance < v_payment.price then raise exception 'Số dư Ví IUH không đủ.'; end if;
    update public.iuh_wallets set balance = balance - v_payment.price, updated_at = now() where id = v_buyer_wallet;
    update public.iuh_wallets set pending = pending + v_payment.price, updated_at = now() where id = v_admin_wallet;
    insert into public.wallet_transactions(wallet_id, user_id, type, title, amount, description) values
        (v_buyer_wallet, v_user, 'payment', 'Giữ tiền mua gói dịch vụ', v_payment.price, v_payment.transaction_code),
        (v_admin_wallet, v_admin, 'sale', 'Tiền giữ hộ yêu cầu gói', v_payment.price, v_payment.transaction_code);
    update public.service_package_payments set wallet_reserved = true, escrow_admin_id = v_admin
    where id = v_payment.id returning * into v_payment;
    return private.service_package_receipt(v_payment);
end;
$$;

create or replace function public.approve_service_package_payment(p_transaction_code text, p_bank_reference text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_payment public.service_package_payments%rowtype;
begin
    if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ Admin được duyệt yêu cầu gói.'; end if;
    perform pg_advisory_xact_lock(192837, 1);
    select * into v_payment from public.service_package_payments where transaction_code = p_transaction_code for update;
    if v_payment.id is null or v_payment.payment_method not in ('bank', 'wallet', 'trial') then raise exception 'Không tìm thấy yêu cầu thanh toán.'; end if;
    if v_payment.status = 'paid' then return private.service_package_receipt(v_payment); end if;
    if v_payment.status <> 'pending' then raise exception 'Yêu cầu này đã bị hủy.'; end if;
    if v_payment.payment_method = 'bank' then
        perform private.register_bank_receipt(p_bank_reference, 'service_package', v_payment.id::text);
    elsif v_payment.payment_method = 'wallet' and (not v_payment.wallet_reserved or v_payment.escrow_admin_id is null) then
        raise exception 'Khoản thanh toán Ví IUH chưa được giữ chờ duyệt.';
    end if;
    update public.service_package_payments set approved_by = auth.uid() where id = v_payment.id;
    return private.fulfill_service_package_payment(v_payment.id);
end;
$$;

create or replace function public.cancel_service_package_payment(p_transaction_code text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    v_payment public.service_package_payments%rowtype;
    v_admin_wallet bigint;
    v_buyer_wallet bigint;
begin
    if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
    perform pg_advisory_xact_lock(192837, 1);
    select * into v_payment from public.service_package_payments where transaction_code = p_transaction_code for update;
    if v_payment.id is null or (v_payment.owner_id <> auth.uid() and not private.is_admin()) then raise exception 'Không tìm thấy yêu cầu của bạn.'; end if;
    if v_payment.status = 'paid' then raise exception 'Giao dịch đã hoàn tất, không thể hủy yêu cầu.'; end if;
    if v_payment.payos_order_code is not null and current_setting('role', true) <> 'service_role' then
        raise exception 'Yêu cầu payOS phải được hủy qua cổng thanh toán.';
    end if;
    if v_payment.status = 'cancelled' then return private.service_package_receipt(v_payment); end if;
    if v_payment.wallet_reserved then
        select id into v_admin_wallet from public.iuh_wallets where user_id = v_payment.escrow_admin_id for update;
        select id into v_buyer_wallet from public.iuh_wallets where user_id = v_payment.owner_id for update;
        update public.iuh_wallets set pending = pending - v_payment.price, updated_at = now()
        where id = v_admin_wallet and pending >= v_payment.price;
        if not found then raise exception 'Khoản tiền giữ chờ không còn đủ để hoàn.'; end if;
        update public.iuh_wallets set balance = balance + v_payment.price, updated_at = now() where id = v_buyer_wallet;
        insert into public.wallet_transactions(wallet_id, user_id, type, title, amount, description) values
            (v_admin_wallet, v_payment.escrow_admin_id, 'payment', 'Hoàn khoản giữ gói', v_payment.price, v_payment.transaction_code),
            (v_buyer_wallet, v_payment.owner_id, 'deposit', 'Hoàn tiền gói bị từ chối', v_payment.price, v_payment.transaction_code);
    end if;
    update public.service_package_payments set status = 'cancelled', wallet_reserved = false, completed_at = now(),
        cancellation_reason = left(coalesce(nullif(btrim(p_reason), ''), 'Đã hủy yêu cầu'), 500)
    where id = v_payment.id returning * into v_payment;
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

revoke all on function public.purchase_service_package(text, text, text, uuid[]),
    public.approve_service_package_payment(text, text),
    public.cancel_service_package_payment(text, text),
    public.reject_service_package_payment(text, text)
from public, anon;
grant execute on function public.purchase_service_package(text, text, text, uuid[]),
    public.approve_service_package_payment(text, text),
    public.cancel_service_package_payment(text, text),
    public.reject_service_package_payment(text, text)
to authenticated;

create table if not exists public.service_package_admin_actions (
    id uuid primary key default gen_random_uuid(),
    package_id uuid not null references public.service_packages(id) on delete cascade,
    payment_id uuid references public.service_package_payments(id) on delete set null,
    actor_id uuid not null references auth.users(id),
    action text not null check (action in ('revoked')),
    reason text not null check (length(btrim(reason)) between 5 and 500),
    created_at timestamptz not null default now()
);
create index if not exists service_package_admin_actions_package_idx
    on public.service_package_admin_actions(package_id, created_at desc);
alter table public.service_package_admin_actions enable row level security;
revoke all on public.service_package_admin_actions from public, anon, authenticated;
grant select on public.service_package_admin_actions to authenticated;
create policy service_package_admin_actions_admin_read on public.service_package_admin_actions
    for select to authenticated using ((select private.is_admin()));

create or replace function public.admin_revoke_service_package(p_package_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    v_package public.service_packages%rowtype;
    v_payment uuid;
begin
    if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ Admin được thu hồi gói.'; end if;
    if p_package_id is null or length(btrim(coalesce(p_reason, ''))) not between 5 and 500 then
        raise exception 'Vui lòng nhập lý do thu hồi từ 5 đến 500 ký tự.';
    end if;
    select * into v_package from public.service_packages where id = p_package_id for update;
    if v_package.id is null or v_package.status <> 'active' or v_package.expires_at <= now() then
        raise exception 'Không tìm thấy gói đang hoạt động để thu hồi.';
    end if;
    select id into v_payment from public.service_package_payments
    where package_id = v_package.id and status = 'paid'
    order by completed_at desc limit 1;
    if v_payment is null then raise exception 'Không tìm thấy giao dịch đã duyệt của gói.'; end if;
    insert into public.service_package_admin_actions(package_id, payment_id, actor_id, action, reason)
    values(v_package.id, v_payment, auth.uid(), 'revoked', btrim(p_reason));
    update public.service_packages set status = 'cancelled' where id = v_package.id;
    return jsonb_build_object('success', true, 'package_id', v_package.id, 'status', 'cancelled', 'reason', btrim(p_reason));
end;
$$;
revoke all on function public.admin_revoke_service_package(uuid, text) from public, anon;
grant execute on function public.admin_revoke_service_package(uuid, text) to authenticated;

create or replace function public.admin_cancel_order(p_order_id bigint, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    v_order public.orders%rowtype;
    v_result json;
begin
    if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ Admin được hủy đơn.'; end if;
    if p_order_id is null or length(btrim(coalesce(p_reason, ''))) not between 5 and 500 then
        raise exception 'Vui lòng nhập lý do hủy đơn từ 5 đến 500 ký tự.';
    end if;
    select * into v_order from public.orders where id = p_order_id for update;
    if v_order.id is null then raise exception 'Không tìm thấy đơn hàng.'; end if;
    if v_order.status <> 'cancelled' and v_order.payos_order_code is not null
       and v_order.payment_status = 'unpaid' and v_order.payos_status not in ('cancelled', 'expired') then
        raise exception 'Cần hủy link payOS và đối soát trạng thái trước khi hủy đơn.';
    end if;
    v_result := public.cancel_order(p_order_id);
    if coalesce((v_result->>'already_cancelled')::boolean, false) then return v_result::jsonb; end if;
    update public.order_status_history set note = left('Admin hủy đơn: ' || btrim(p_reason), 1000)
    where order_id = p_order_id and status = 'cancelled' and changed_by = auth.uid()
      and created_at = (select max(created_at) from public.order_status_history
          where order_id = p_order_id and status = 'cancelled' and changed_by = auth.uid());
    return v_result::jsonb || jsonb_build_object('admin_cancelled', true);
end;
$$;
revoke all on function public.admin_cancel_order(bigint, text) from public, anon;
grant execute on function public.admin_cancel_order(bigint, text) to authenticated;

-- Trial orders: admin payment approval, automatic shipping, admin completion.
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
  if p_payment_method is null or p_payment_method not in ('cash','qr','iuh_wallet','trial') then raise exception 'Phương thức thanh toán không hợp lệ.'; end if;
  if p_payment_method = 'trial' and btrim(p_recipient_address) not in ('Cơ sở chính Nguyễn Văn Bảo', 'Cơ sở Nguyễn Văn Dung', 'Cơ sở Phạm Văn Chiêu', 'Sân vận động Đạt Đức') then raise exception 'Vui lòng chọn địa điểm nhận hàng của IUH.'; end if;
  if p_payment_method = 'trial' and not private.iuh_trial_mode_enabled() then raise exception 'Chế độ thanh toán thử nghiệm hiện đã tắt.'; end if;
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
    shipping_method,shipping_fee,payment_method,subtotal,total_amount,order_type,status,payment_status,
    captured_amount,paid_at,idempotency_key,request_hash)
  values('IUH'||replace(gen_random_uuid()::text,'-',''),uid,btrim(p_recipient_name),btrim(p_recipient_phone),btrim(p_recipient_address),p_note,
    p_shipping_method,shipping,p_payment_method,subtotal,total,case when cons then 'consignment' else 'normal' end,'pending',
    'unpaid',
    0,
    null,p_idempotency_key,h)
  returning * into o;
  for r in select * from jsonb_to_recordset(authoritative) as x(id bigint,seller uuid,consignor uuid,name text,image text,price numeric,qty integer) loop
    insert into public.order_items(order_id,product_id,seller_id,consignor_id,product_name,product_image,price,quantity,subtotal)
    values(o.id,r.id,r.seller,r.consignor,r.name,r.image,r.price,r.qty,r.price*r.qty);
    update public.products set quantity=quantity-r.qty,status=case when quantity-r.qty=0 then 'deleted' else status end,updated_at=now() where id=r.id;
  end loop;
  if p_payment_method='iuh_wallet' then perform private.capture_order(o.id); end if;
  delete from public.cart_items where user_id=uid and id=any(coalesce(p_cart_ids,'{}'::bigint[]))
    and product_id in(select (i->>'id')::bigint from jsonb_array_elements(authoritative) i);
  insert into public.order_status_history(order_id,status,changed_by,note)
  values(o.id,'pending',uid,case when p_payment_method='trial' then 'Đơn được tạo ở chế độ dùng thử miễn phí.' else 'Đơn được tạo; thanh toán được xử lý nguyên tử.' end);
  return json_build_object('success',true,'order_id',o.id,'order_code',o.order_code,
    'payment_status',case when p_payment_method = 'iuh_wallet' then 'paid' else 'unpaid' end,'total_amount',total);
end $$;


create or replace function public.admin_confirm_order_payment(p_order_id bigint,p_reference text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Chỉ quản trị viên được đối soát.'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if found and o.payment_method='trial' then
    if o.status in ('shipping','completed') and o.payment_status='paid' then
      return jsonb_build_object('success',true,'order_id',o.id,'payment_status','paid');
    end if;
    if o.status <> 'pending' or o.needs_payment_review then raise exception 'Đơn không còn chờ duyệt thanh toán.'; end if;
    update public.orders set payment_status='paid', paid_at=now(), status='shipping', updated_at=now() where id=o.id;
    insert into public.order_status_history(order_id,status,changed_by,note)
    values(o.id,'shipping',auth.uid(),'Admin xác nhận thanh toán miễn phí; đơn tự chuyển sang đang giao.');
    return jsonb_build_object('success',true,'order_id',o.id,'payment_status','paid');
  end if;
  if not found or o.payment_method<>'qr' then raise exception 'Đơn không phải chuyển khoản chờ đối soát.'; end if;
  perform private.capture_order(o.id,p_reference);
  return jsonb_build_object('success',true,'order_id',o.id,'payment_status','paid');
end $$;


create or replace function public.update_order_status(p_order_id bigint,p_new_status text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare o public.orders; allowed boolean; states text[]:=array['pending','confirmed','shipping','delivered','completed'];
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng.'; end if;
  if o.payment_method='trial' then
    if not private.is_admin() then raise exception 'Chỉ Admin được xác nhận đơn chạy thử.'; end if;
    if p_new_status='confirmed' and o.status='pending' then
      perform public.admin_confirm_order_payment(o.id,null);
      return true;
    end if;
    if p_new_status='completed' and o.status='completed' then return true; end if;
    if p_new_status is distinct from 'completed' or o.status not in ('shipping','delivered') or o.payment_status<>'paid' or o.needs_payment_review then
      raise exception 'Đơn phải được duyệt thanh toán và đang giao trước khi xác nhận giao thành công.';
    end if;
    update public.orders set status='completed', updated_at=now() where id=o.id;
    perform private.settle_order(o.id);
    insert into public.order_status_history(order_id,status,changed_by,note)
    values(o.id,'completed',auth.uid(),'Admin xác nhận giao hàng thành công; hoàn tất đơn miễn phí.');
    return true;
  end if;
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
