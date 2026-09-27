-- NOT VALID preserves historical rows for review but enforces all subsequent writes.
alter table public.products add constraint products_finite_price check(price::text not in ('NaN','Infinity','-Infinity') and price>=0) not valid;
alter table public.iuh_wallets add constraint wallets_finite_nonnegative check(balance::text not in ('NaN','Infinity','-Infinity') and pending::text not in ('NaN','Infinity','-Infinity') and balance>=0 and pending>=0) not valid;
alter table public.orders add constraint orders_finite_totals check(total_amount::text not in ('NaN','Infinity','-Infinity') and subtotal::text not in ('NaN','Infinity','-Infinity') and shipping_fee::text not in ('NaN','Infinity','-Infinity') and total_amount>0 and subtotal>=0 and shipping_fee>=0) not valid;
alter table public.orders add constraint orders_recipient_phone check(recipient_phone is not null and recipient_phone ~ '^[+0-9 ().-]{8,20}$') not valid;
alter table public.wallet_transactions add constraint wallet_transactions_finite_amount check(amount::text not in ('NaN','Infinity','-Infinity')) not valid;
