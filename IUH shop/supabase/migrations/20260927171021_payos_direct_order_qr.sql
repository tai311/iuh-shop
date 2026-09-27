alter table public.orders add column payos_qr_code text check(payos_qr_code is null or length(payos_qr_code) between 20 and 4096);
create function public.payos_save_order_qr(p_order_code bigint,p_link_id text,p_qr_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_qr_code is null or length(p_qr_code) not between 20 and 4096 or left(p_qr_code,6)<>'000201' then raise exception 'Dữ liệu QR không hợp lệ.'; end if;
 update public.orders set payos_qr_code=p_qr_code where payos_order_code=p_order_code and payos_link_id=p_link_id
 and (payos_qr_code is null or payos_qr_code=p_qr_code);
 if not found then raise exception 'Không khớp QR của đơn hàng.'; end if;
end $$;
revoke all on function public.payos_save_order_qr(bigint,text,text) from public,anon,authenticated;
grant execute on function public.payos_save_order_qr(bigint,text,text) to service_role;
