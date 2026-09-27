const {test}=require('node:test'),assert=require('node:assert/strict');
const {createDatabase}=require('./helpers/database.cjs');
test('payOS orders separate 5% fee, shipping and bank payouts without crediting seller wallets twice',async()=>{
 const db=await createDatabase(),admin='00000000-0000-4000-8000-000000000041',buyer='00000000-0000-4000-8000-000000000042',seller='00000000-0000-4000-8000-000000000043',other='00000000-0000-4000-8000-000000000044';
 const q=async(s,a=[])=>(await db.query(s,a)).rows,scalar=async(s,a=[])=>Object.values((await q(s,a))[0])[0];
 const as=async(id,role='authenticated')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);};
 const order=async(key,ship='meet')=>{await as(buyer);return scalar("select public.create_order('An','0901234567','IUH','',$1,0,'qr',1,$2,'[{\"product_id\":1,\"quantity\":1}]','{}',$3)",[ship,ship==='mid'?110000:105000,key]);};
 const prepare=async id=>{await as(null,'service_role');const o=await scalar('select public.payos_prepare_order($1,$2)',[id,buyer]);await q('select public.payos_bind_order($1,$2,$3)',[o.payos_order_code,'order_link_'+id,'https://pay.payos.vn/web/order_link_'+id]);return o;};
 const sync=(o,state='PAID',received=Number(o.total_amount),ref='ORDER-BANK-'+o.id)=>scalar('select public.payos_sync_order($1,$2,$3,$4,$5,$6)',[o.payos_order_code,'order_link_'+o.id,state,o.total_amount,received,ref]);
 try{
  for(const [id,role] of [[admin,'admin'],[buyer,'user'],[seller,'user'],[other,'user']]){await q('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.invalid']);await q('update public.users set role=$2 where user_id=$1',[id,role]);}
  await q("insert into public.products(id,seller_id,name,category,quantity,price) values(1,$1,'Book','books',10,100000)",[seller]);
  const created=await order('payos-order-one','mid');
  await assert.rejects(q('select public.payos_prepare_order($1,$2)',[created.order_id,buyer]),/permission denied/);
  const o=await prepare(created.order_id);
  await q('select public.payos_save_order_qr($1,$2,$3)',[o.payos_order_code,'order_link_'+o.id,'000201PROVIDER-ORDER-QR']);
  await q('select public.payos_save_order_qr($1,$2,$3)',[o.payos_order_code,'order_link_'+o.id,'000201PROVIDER-ORDER-QR']);
  await assert.rejects(q('select public.payos_save_order_qr($1,$2,$3)',[o.payos_order_code,'wrong_link','000201FORGED-ORDER-QR']),/khớp/);
  await assert.rejects(q('select public.payos_save_order_qr($1,$2,$3)',[o.payos_order_code,'order_link_'+o.id,'000201DIFFERENT-ORDER-QR']),/khớp/);
  await as(buyer);await assert.rejects(q('select public.payos_save_order_qr($1,$2,$3)',[o.payos_order_code,'order_link_'+o.id,'000201PROVIDER-ORDER-QR']),/permission denied/);
  await as(admin);await assert.rejects(q("select public.admin_confirm_order_payment($1,'MANUAL-FAIL')",[o.id]),/payOS/);
  await as(buyer);await assert.rejects(q('select public.cancel_order($1)',[o.id]),/payOS/);
  await as(null,'service_role');let result=await sync(o);assert.equal(result.payment_status,'paid');assert.equal(result.payos_status,'paid');
  await sync(o);await sync(o,'PENDING',0);assert.equal(await scalar('select payment_status from public.orders where id=$1',[o.id]),'paid');
  await as(admin);assert.equal(Number(await scalar('select pending from public.iuh_wallets where user_id=$1',[admin])),110000);
  let detail=await scalar("select public.admin_operation_detail('orders',$1)",[String(o.id)]);
  assert.equal(detail.finance.platform_fee,5000);assert.equal(detail.finance.shipping_fee,5000);assert.equal(detail.finance.seller_net,100000);assert.equal(detail.finance.payout_status,'not_ready');
  await as(seller);for(const status of ['confirmed','shipping','delivered'])await q('select public.update_order_status($1,$2)',[o.id,status]);
  await assert.rejects(q("select public.update_order_status($1,'completed')",[o.id]));
  await as(buyer);await q("select public.update_order_status($1,'completed')",[o.id]);await q('select public.settle_online_order($1)',[o.id]);
  await as(admin);detail=await scalar("select public.admin_operation_detail('orders',$1)",[String(o.id)]);
  assert.equal(detail.finance.payout_status,'pending');assert.equal(detail.finance.remaining_payout,100000);assert.equal(detail.payouts.length,1);assert.ok(detail.payouts[0].payout_id);
  assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[admin])),10000);assert.equal(Number(await scalar('select pending from public.iuh_wallets where user_id=$1',[admin])),100000);
  assert.equal(Number(await scalar('select coalesce(sum(balance),0) from public.iuh_wallets where user_id=$1',[seller])),0);
  const payout=detail.payouts[0].payout_id;
  const list=await scalar("select public.admin_operations_list('orders','','','',1,true)");assert.equal(list.total,1);assert.equal(list.rows[0].finance.platform_fee,5000);
  await as(seller);assert.equal((await q('select * from public.order_bank_payouts')).length,1);await assert.rejects(q('select public.admin_complete_order_payout($1,$2)',[payout,'OUT-1']),/quản trị viên/);
  await as(other);assert.equal((await q('select * from public.order_bank_payouts')).length,0);assert.equal((await q('select * from public.admin_order_financials')).length,0);
  await as(admin);await assert.rejects(q('select public.admin_complete_order_payout($1,$2)',[payout,'ORDER-BANK-'+o.id]),/sử dụng/);
  await q('select public.admin_complete_order_payout($1,$2)',[payout,'SELLER-TRANSFER-1']);await q('select public.admin_complete_order_payout($1,$2)',[payout,'SELLER-TRANSFER-1']);
  assert.equal(Number(await scalar('select pending from public.iuh_wallets where user_id=$1',[admin])),0);
  assert.equal((await scalar("select public.admin_operation_detail('orders',$1)",[String(o.id)])).finance.payout_status,'paid');
  // A paid cancellation reserves a bank refund; it never creates a seller payable.
  const second=await prepare((await order('payos-order-cancel')).order_id);await sync(second);
  await as(buyer);assert.equal((await scalar('select public.cancel_order($1)',[second.id])).refund_pending,true);
  await as(null,'service_role');await sync(second);await as(admin);
  assert.equal(await scalar('select payment_status from public.orders where id=$1',[second.id]),'refund_pending');assert.equal(Number(await scalar('select count(*) from public.order_bank_payouts where order_id=$1',[second.id])),0);
  // Overpayment, late payment after cancellation, duplicate reference and wrong link fail closed.
  const third=await prepare((await order('payos-order-overpay')).order_id);result=await sync(third,'PAID',106000);assert.equal(result.payos_status,'review');assert.equal(result.payment_status,'unpaid');
  const fourth=await prepare((await order('payos-order-expired')).order_id);await sync(fourth,'EXPIRED',0);await as(buyer);await q('select public.cancel_order($1)',[fourth.id]);await as(null,'service_role');assert.equal((await sync(fourth)).payos_status,'review');
  const fifth=await prepare((await order('payos-order-duplicate')).order_id);assert.equal((await sync(fifth,'PAID',105000,'ORDER-BANK-'+o.id)).payos_status,'review');
  await assert.rejects(q("select public.payos_sync_order($1,'wrong-link','PAID',105000,105000,'WRONG-1')",[fifth.payos_order_code]),/khớp/);
 }finally{await db.close();}
});
