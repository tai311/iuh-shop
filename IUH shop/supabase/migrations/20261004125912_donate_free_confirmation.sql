alter table public.trial_financial_entries drop constraint trial_financial_entries_source_type_check;
alter table public.trial_financial_entries add constraint trial_financial_entries_source_type_check
check(source_type in ('order','package','donation'));
alter table public.trial_financial_entries drop constraint trial_financial_entries_kind_check;
alter table public.trial_financial_entries add constraint trial_financial_entries_kind_check
check(kind in ('seller','platform','shipping','package','donation'));

-- Preserve the bank-reviewed flow when free checkout is disabled.
alter function public.request_donation(numeric,text,text,text,text) rename to request_donation_before_free;
alter function public.request_donation_before_free(numeric,text,text,text,text) set schema private;
revoke all on function private.request_donation_before_free(numeric,text,text,text,text) from public,anon,authenticated;

create function public.request_donation(p_amount numeric,p_donor_name text,p_bank_name text,p_transfer_content text,p_request_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt jsonb; existed boolean; admin_id uuid; donation_id bigint;
begin
 if auth.uid() is null then raise exception 'Vui lòng đăng nhập để Donate.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':donation',0));
 select exists(select 1 from public.donations where transfer_code=p_request_key) into existed;
 receipt:=private.request_donation_before_free(p_amount,p_donor_name,p_bank_name,p_transfer_content,p_request_key);
 -- A retry keeps the original outcome, even if the site mode changed meanwhile.
 if existed or not private.iuh_trial_mode_enabled() then return receipt; end if;
 admin_id:=private.commerce_admin_id();
 if admin_id is null then raise exception 'Chưa thiết lập tài khoản nhận Donate.'; end if;
 donation_id:=(receipt->>'donation_id')::bigint;
 update public.donations set payment_method='free',status='completed',note=null,reviewed_at=now()
 where id=donation_id;
 insert into public.trial_financial_entries(source_type,source_id,recipient_id,kind,amount,title)
 values('donation',donation_id::text,admin_id,'donation',p_amount,'Donate IUH SHOP');
 return receipt||jsonb_build_object('status','completed');
end $$;
revoke all on function public.request_donation(numeric,text,text,text,text) from public,anon;
grant execute on function public.request_donation(numeric,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
