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
