const {test}=require('node:test'),assert=require('node:assert/strict');
const {createDatabase}=require('./helpers/database.cjs');
test('Migration builds against the captured schema and policies',async()=>{
 const db=await createDatabase();
 try{const {rows}=await db.query("select has_function_privilege('anon','public.purchase_service_package(text,text,text,uuid[])','execute') as anonymous_purchase");assert.equal(rows[0].anonymous_purchase,false);}
 finally{await db.close();}
});
test('Payments, packages, orders and permissions preserve money and ownership',async t=>{
 const db=await createDatabase();
 const admin='00000000-0000-4000-8000-000000000001',buyer='00000000-0000-4000-8000-000000000002',seller='00000000-0000-4000-8000-000000000003',poor='00000000-0000-4000-8000-000000000004';
 const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const as=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const scalar=async(sql,args=[])=>Object.values((await q(sql,args))[0])[0];
 const buy=(plan,method,key,members=[])=>scalar('select public.purchase_service_package($1,$2,$3,$4::uuid[])',[plan,method,key,members]);
 const order=(method,key,total=105000)=>scalar("select public.create_order('Buyer','0901234567','IUH','', 'meet',0,$1,1,$2,'[{\"product_id\":1,\"quantity\":1,\"price\":1}]','{}',$3)",[method,total,key]);
 try {
  for(const [id,role] of [[admin,'admin'],[buyer,'user'],[seller,'user'],[poor,'user']]){
   await q('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.invalid']);
   await q("insert into public.users(user_id,role,fullname) values($1,$2,'Fixture') on conflict(user_id) do update set role=excluded.role",[id,role]);
  }
  await db.exec(`insert into public.iuh_wallets(user_id,balance) values('${buyer}',500000),('${seller}',0),('${poor}',0),('${admin}',0) on conflict(user_id) do update set balance=excluded.balance;
   insert into public.products(id,seller_id,name,category,quantity,price) values(1,'${seller}','Book','books',10,100000)`);
  await t.test('private profiles and privileged fields cannot be accessed by another user',async()=>{
   await as(buyer);assert.equal((await q('select user_id from public.users')).length,1);
   await assert.rejects(q("update public.users set role='admin' where user_id=$1",[buyer]));
   await assert.rejects(q('update public.iuh_wallets set balance=999999 where user_id=$1',[buyer]));
  });
  await t.test('wallet package charges once; renewal extends expiry; insufficient balance rolls back',async()=>{
   await as(buyer);const a=await buy('personal','wallet','pkg-wallet-00001');assert.equal(a.status,'paid');
   const expiry=await scalar('select expires_at from public.service_packages where owner_id=$1',[buyer]);
   await buy('personal','wallet','pkg-wallet-00001');assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[buyer])),481000);
   await buy('personal','wallet','pkg-wallet-00002');const renewed=await scalar('select expires_at from public.service_packages where owner_id=$1',[buyer]);assert.equal(new Date(renewed)-new Date(expiry),30*86400000);
   await assert.rejects(buy('group','wallet','pkg-change-00001'));
   await as(poor);await assert.rejects(buy('personal','wallet','pkg-poor-000001'));
   assert.equal(Number(await scalar('select count(*) from public.service_package_payments')),0);
  });
  await t.test('bank package remains pending until admin confirms and duplicate bank receipt is rejected',async()=>{
   await as(poor);const a=await buy('group','bank','pkg-bank-000001',[seller]);assert.equal(a.status,'pending');
   assert.equal(Number(await scalar('select count(*) from public.service_packages')),0);
   await assert.rejects(q("select public.approve_service_package_payment('pkg-bank-000001','BANK-0001')"));
   await as(admin);await q("select public.approve_service_package_payment('pkg-bank-000001','BANK-0001')");await q("select public.approve_service_package_payment('pkg-bank-000001','BANK-0001')");
   assert.equal(Number(await scalar('select count(*) from public.service_package_members where user_id=$1',[seller])),1);
  });
  await t.test('server prices prevent tampering and retried checkout deducts stock only once',async()=>{
   await as(buyer);await assert.rejects(order('qr','order-price',1));
   const a=await order('qr','order-bank');const b=await order('qr','order-bank');assert.equal(a.order_id,b.order_id);
   assert.equal(Number(await scalar('select quantity from public.products where id=1')),9);
   await as(seller);await assert.rejects(q("select public.update_order_status($1,'confirmed')",[a.order_id]));
   await as(admin);await assert.rejects(q("select public.admin_confirm_order_payment($1,'BANK-0001')",[a.order_id]));
   await q("select public.admin_confirm_order_payment($1,'BANK-ORDER-01')",[a.order_id]);
   await as(buyer);const cancelled=await scalar('select public.cancel_order($1)',[a.order_id]);assert.equal(cancelled.refund_pending,true);
   assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[buyer])),462000);
   const refund=await scalar('select id from public.bank_refund_requests where order_id=$1',[a.order_id]);
   await as(admin);await q("select public.complete_bank_refund($1,'BANK-REFUND-01')",[refund]);await q("select public.complete_bank_refund($1,'BANK-REFUND-01')",[refund]);
   assert.equal(await scalar('select payment_status from public.orders where id=$1',[a.order_id]),'refunded');
   assert.equal(Number(await scalar('select pending from public.iuh_wallets where user_id=$1',[admin])),0);
  });
  await t.test('buyer completion releases 100k to seller and 5k fee exactly once',async()=>{
   await as(buyer);const a=await order('iuh_wallet','order-wallet');
   await as(seller);for(const status of ['confirmed','shipping','delivered'])await q('select public.update_order_status($1,$2)',[a.order_id,status]);
   await assert.rejects(q("select public.update_order_status($1,'completed')",[a.order_id]));
   await as(buyer);await q("select public.update_order_status($1,'completed')",[a.order_id]);await q('select public.settle_online_order($1)',[a.order_id]);
   await as(seller);assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[seller])),100000);
   await as(admin);assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[admin])),72000);assert.equal(Number(await scalar('select pending from public.iuh_wallets where user_id=$1',[admin])),0);
  });
  await t.test('withdrawal reserves money once and rejection releases reservation once',async()=>{
   await as(seller);const args=[50000,'TEST BANK','123456789','withdraw-0001'];const a=await scalar('select public.request_wallet_withdrawal($1,$2,$3,$4)',args);await scalar('select public.request_wallet_withdrawal($1,$2,$3,$4)',args);
   assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[seller])),50000);
   await as(admin);await q('select public.review_wallet_request($1,false)',[a.request_id]);await q('select public.review_wallet_request($1,false)',[a.request_id]);
   assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[seller])),100000);
  });
  await t.test('legacy simulated money entrypoints and non-finite prices are blocked',async()=>{
   await as(seller);await assert.rejects(q("select public.deposit_iuh_wallet(100000,'bank')"));
   await assert.rejects(q("update public.products set price='NaN' where id=1"));
   await assert.rejects(q("update public.products set is_boosted=true where id=1"));
   assert.equal(Number(await scalar('select price from public.products where id=1')),100000);
  });
  await t.test('chat creation is idempotent and a third person cannot join or read',async()=>{
   await as(buyer);const a=await scalar('select public.get_or_create_direct_conversation($1)',[seller]);const b=await scalar('select public.get_or_create_direct_conversation($1)',[seller]);assert.equal(a.id,b.id);
   await q("insert into public.messages(conversation_id,sender_id,content) values($1,$2,'Private')",[a.id,buyer]);
   await as(poor);assert.equal(Number(await scalar('select count(*) from public.messages')),0);
   await assert.rejects(q('insert into public.conversation_members(conversation_id,user_id) values($1,$2)',[a.id,poor]));
   await assert.rejects(q('select public.mark_conversation_read($1)',[a.id]));
   await as(seller);assert.equal(await scalar('select public.mark_conversation_read($1)',[a.id]),1);
   const edited=await q("update public.messages set content='Forged' where conversation_id=$1 returning id",[a.id]);assert.equal(edited.length,0);
   assert.equal(await scalar('select content from public.messages where conversation_id=$1',[a.id]),'Private');
  });
  await t.test('public projections work without exposing private tables',async()=>{
   await db.exec('reset role');await q("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');
   assert.equal((await q('select user_id from public.public_profiles')).length,4);
   assert.equal((await q('select * from public.service_package_badges')).length,3);
   await q('select * from public.published_advertisements');
   await assert.rejects(q('select email from public.users'));
   await assert.rejects(q('select * from public.service_package_payments'));
  });
    await t.test('free trial activates packages and orders without real money movement',async()=>{
    await as(admin);
     const buyerBalance=Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[buyer]));
     const sellerBalance=Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[seller]));
     const adminBalance=Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[admin]));
     const transactionCount=Number(await scalar('select count(*) from public.wallet_transactions'));
     await as(buyer);
     const packageReceipt=await buy('personal','trial','pkg-trial-000001');
     assert.equal(packageReceipt.status,'paid');assert.equal(packageReceipt.payment_method,'trial');
     const trialOrder=await order('trial','order-trial-000001');
     assert.equal(trialOrder.payment_status,'paid');
     const orderId=trialOrder.order_id;
     const orderRow=await q('select payment_method,payment_status,captured_amount,escrow_admin_id from public.orders where id=$1',[orderId]);
    assert.deepEqual({...orderRow[0],captured_amount:Number(orderRow[0].captured_amount)},{payment_method:'trial',payment_status:'paid',captured_amount:0,escrow_admin_id:null});
     await as(seller);for(const status of ['confirmed','shipping','delivered'])await q('select public.update_order_status($1,$2)',[orderId,status]);
     await as(buyer);await q("select public.update_order_status($1,'completed')",[orderId]);
     const finance=await (async()=>{await as(admin);return (await q('select * from public.admin_order_financials where order_id=$1',[orderId]))[0];})();
     assert.equal(finance.payout_method,'trial');assert.equal(finance.payout_status,'trial');
     assert.equal(Number(await scalar('select count(*) from public.order_bank_payouts where order_id=$1',[orderId])),0);
     assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[buyer])),buyerBalance);
     assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[seller])),sellerBalance);
     assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[admin])),adminBalance);
     assert.equal(Number(await scalar('select count(*) from public.wallet_transactions')),transactionCount);
     await as(buyer);await assert.rejects(q('select public.set_iuh_trial_mode(false)'),/Admin/);
     await as(admin);await q('select public.set_iuh_trial_mode(false)');
     await as(buyer);await assert.rejects(buy('personal','trial','pkg-trial-disabled'));
     await as(admin);await q('select public.set_iuh_trial_mode(true)');
    });
 }finally{await db.close();}
});
