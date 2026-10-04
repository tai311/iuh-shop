const {test}=require('node:test'),assert=require('node:assert/strict');
const {createDatabase}=require('./helpers/database.cjs');
test('Migration builds against the captured schema and policies',async()=>{
 const db=await createDatabase();
 try{const {rows}=await db.query("select has_function_privilege('anon','public.purchase_service_package(text,text,text,uuid[])','execute') as anonymous_purchase,has_function_privilege('anon','public.get_iuh_trial_mode()','execute') as anonymous_trial_mode,enabled from public.iuh_trial_settings where id=true");assert.equal(rows[0].anonymous_purchase,false);assert.equal(rows[0].anonymous_trial_mode,false);assert.equal(rows[0].enabled,true);}
 finally{await db.close();}
});
test('Payments, packages, orders and permissions preserve money and ownership',async t=>{
 const db=await createDatabase();
 const admin='00000000-0000-4000-8000-000000000001',buyer='00000000-0000-4000-8000-000000000002',seller='00000000-0000-4000-8000-000000000003',poor='00000000-0000-4000-8000-000000000004';
 const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const as=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const scalar=async(sql,args=[])=>Object.values((await q(sql,args))[0])[0];
 const buy=(plan,method,key,members=[])=>scalar('select public.purchase_service_package($1,$2,$3,$4::uuid[])',[plan,method,key,members]);
 const order=(method,key,total=105000)=>scalar("select public.create_order('Buyer','0901234567','Cơ sở chính Nguyễn Văn Bảo','', 'meet',0,$1,1,$2,'[{\"product_id\":1,\"quantity\":1,\"price\":1}]','{}',$3)",[method,total,key]);
 try {
  for(const [id,role] of [[admin,'admin'],[buyer,'user'],[seller,'user'],[poor,'user']]){
   await q('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.invalid']);
   await q("insert into public.users(user_id,role,fullname) values($1,$2,'Fixture') on conflict(user_id) do update set role=excluded.role",[id,role]);
  }
  await db.exec(`insert into public.iuh_wallets(user_id,balance) values('${buyer}',500000),('${seller}',0),('${poor}',0),('${admin}',0) on conflict(user_id) do update set balance=excluded.balance;
   insert into public.products(id,seller_id,name,category,quantity,price) values(1,'${seller}','Book','books',10,100000)`);
  await as(admin);await q('select public.set_iuh_trial_mode(false)');
  await t.test('private profiles and privileged fields cannot be accessed by another user',async()=>{
   await as(buyer);assert.equal((await q('select user_id from public.users')).length,1);
   await assert.rejects(q("update public.users set role='admin' where user_id=$1",[buyer]));
   await assert.rejects(q('update public.iuh_wallets set balance=999999 where user_id=$1',[buyer]));
  });
  await t.test('wallet package reserves funds until approval and refunds on rejection',async()=>{
   const initial=Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[buyer]));
   await as(buyer);const rejected=await buy('personal','wallet','pkg-wallet-reject-01');assert.equal(rejected.status,'pending');
   assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[buyer])),initial-19000);
  await as(admin);assert.equal(Number(await scalar('select pending from public.iuh_wallets where user_id=$1',[admin])),19000);
  await q("select public.reject_service_package_payment('pkg-wallet-reject-01','Không xác minh được giao dịch')");
  await as(buyer);
   assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[buyer])),initial);
  await as(admin);
   assert.equal(Number(await scalar('select pending from public.iuh_wallets where user_id=$1',[admin])),0);
   await as(buyer);const a=await buy('personal','wallet','pkg-wallet-approve-01');assert.equal(a.status,'pending');
   const held=Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[buyer]));
   await as(admin);const approved=await scalar("select public.approve_service_package_payment('pkg-wallet-approve-01',null)");assert.equal(approved.status,'paid');
   const expiry=await scalar('select expires_at from public.service_packages where owner_id=$1',[buyer]);
   assert.equal(Number(await scalar('select pending from public.iuh_wallets where user_id=$1',[admin])),0);
  await as(buyer);assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[buyer])),held);
  const renewal=await buy('personal','wallet','pkg-wallet-renew-01');assert.equal(renewal.status,'pending');
   await as(admin);await q("select public.approve_service_package_payment('pkg-wallet-renew-01',null)");
   const renewed=await scalar('select expires_at from public.service_packages where owner_id=$1',[buyer]);assert.equal(new Date(renewed)-new Date(expiry),30*86400000);
  await as(buyer);await assert.rejects(buy('group','wallet','pkg-change-00001'));
  await as(admin);
  const packageId=await scalar("select id from public.service_packages where owner_id=$1 and status='active'",[buyer]);
  await as(seller);await assert.rejects(q('select public.admin_revoke_service_package($1,$2)',[packageId,'Không có quyền']));
  await as(admin);const revocation=await scalar('select public.admin_revoke_service_package($1,$2)',[packageId,'Vi phạm quy định bán hàng']);assert.equal(revocation.status,'cancelled');
  assert.equal(await scalar('select status from public.service_packages where id=$1',[packageId]),'cancelled');
  assert.equal(await scalar('select reason from public.service_package_admin_actions where package_id=$1',[packageId]),'Vi phạm quy định bán hàng');
   await as(poor);await assert.rejects(buy('personal','wallet','pkg-poor-000001'));
   assert.equal(Number(await scalar("select count(*) from public.service_package_payments where owner_id=$1 and status='pending'",[poor])),0);
  });
  await t.test('bank package remains pending until admin confirms and duplicate bank receipt is rejected',async()=>{
   await as(poor);const a=await buy('group','bank','pkg-bank-000001',[seller]);assert.equal(a.status,'pending');
  assert.equal(Number(await scalar('select count(*) from public.service_packages where owner_id=$1',[poor])),0);
   await assert.rejects(q("select public.approve_service_package_payment('pkg-bank-000001','BANK-0001')"));
   await as(admin);await q("select public.approve_service_package_payment('pkg-bank-000001','BANK-0001')");await q("select public.approve_service_package_payment('pkg-bank-000001','BANK-0001')");
   assert.equal(Number(await scalar('select count(*) from public.service_package_members where user_id=$1',[seller])),1);
  });
  await t.test('server prices prevent tampering and retried checkout deducts stock only once',async()=>{
   await as(buyer);await assert.rejects(order('qr','order-price',1));
    const adminCancel=await order('cash','order-admin-cancel');
    await as(seller);await assert.rejects(q('select public.admin_cancel_order($1,$2)',[adminCancel.order_id,'Không có quyền']));
    await as(admin);const cancelResult=await scalar('select public.admin_cancel_order($1,$2)',[adminCancel.order_id,'Trùng đơn do kiểm tra']);assert.equal(cancelResult.success,true);
    assert.equal(await scalar('select status from public.orders where id=$1',[adminCancel.order_id]),'cancelled');
    await assert.rejects(q('select public.admin_cancel_order($1,$2)',[adminCancel.order_id,'x']));
    assert.equal(Number(await scalar('select quantity from public.products where id=1')),10);
    await as(buyer);
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
  await t.test('admin completion releases 100k to seller and 5k fee exactly once',async()=>{
   await as(buyer);const a=await order('iuh_wallet','order-wallet');
   await as(admin);await q('select public.admin_confirm_order_payment($1,null)',[a.order_id]);await as(seller);for(const status of ['shipping','delivered'])await q('select public.update_order_status($1,$2)',[a.order_id,status]);
   await assert.rejects(q("select public.update_order_status($1,'completed')",[a.order_id]));
   await as(admin);await q("select public.update_order_status($1,'completed')",[a.order_id]);await q('select public.settle_online_order($1)',[a.order_id]);
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
  assert.equal((await q('select * from public.service_package_badges')).length,2);
   await q('select * from public.published_advertisements');
   await assert.rejects(q('select email from public.users'));
   await assert.rejects(q('select * from public.service_package_payments'));
  });
    await t.test('free trial activates packages and orders without real money movement',async()=>{
    await as(admin);
       await q('select public.set_iuh_trial_mode(true)');
     const buyerBalance=Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[buyer]));
     const sellerBalance=Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[seller]));
     const adminBalance=Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[admin]));
     const transactionCount=Number(await scalar('select count(*) from public.wallet_transactions'));
     await as(buyer);
    assert.equal(await scalar('select public.get_iuh_trial_mode()'),true);
    await assert.rejects(buy('personal','bank','pkg-no-real-bank-001'),/chạy thử miễn phí/);
    await assert.rejects(order('qr','order-no-real-payos-01'),/chạy thử miễn phí/);
     const packageReceipt=await buy('personal','trial','pkg-trial-000001');
     assert.equal(packageReceipt.status,'pending');assert.equal(packageReceipt.payment_method,'trial');
     await assert.rejects(q("select public.approve_service_package_payment('pkg-trial-000001',null)"));
     await as(admin);
     assert.ok((await scalar("select public.admin_operations_list('packages','pending')")).rows.some(r=>r.code==='pkg-trial-000001'));
     const approvedTrial=await scalar("select public.approve_service_package_payment('pkg-trial-000001',null)");
     assert.equal(approvedTrial.status,'paid');
     await q("select public.approve_service_package_payment('pkg-trial-000001',null)");
     await as(buyer);
     const rejectedTrial=await buy('personal','trial','pkg-trial-reject-001');assert.equal(rejectedTrial.status,'pending');
     await as(admin);await q("select public.reject_service_package_payment('pkg-trial-reject-001','Admin hủy yêu cầu thử')");
     await assert.rejects(q("select public.approve_service_package_payment('pkg-trial-reject-001',null)"));
     await as(buyer);
     const trialOrder=await order('trial','order-trial-000001');
     assert.equal(trialOrder.payment_status,'unpaid');
     const orderId=trialOrder.order_id;
    await assert.rejects(q('select public.admin_confirm_order_payment($1,null)',[orderId]));
    await assert.rejects(q("select public.update_order_status($1,'confirmed')",[orderId]));
    await as(admin);await assert.rejects(q("select public.update_order_status($1,'completed')",[orderId]));
    await as(buyer);
     const orderRow=await q('select payment_method,payment_status,captured_amount,escrow_admin_id from public.orders where id=$1',[orderId]);
    assert.deepEqual({...orderRow[0],captured_amount:Number(orderRow[0].captured_amount)},{payment_method:'trial',payment_status:'unpaid',captured_amount:0,escrow_admin_id:null});
    await as(admin);const adminOrder=await scalar("select public.admin_operation_detail('orders',$1)",[orderId]);assert.equal(adminOrder.record.status,'pending');assert.equal(adminOrder.record.payment_method,'trial');await q("select public.update_order_status($1,'confirmed')",[orderId]);
    assert.equal(await scalar('select status from public.orders where id=$1',[orderId]),'confirmed');
    await q('select public.admin_confirm_order_payment($1,null)',[orderId]);
    await as(seller);await assert.rejects(q("select public.update_order_status($1,'completed')",[orderId]));
    await as(buyer);await assert.rejects(q("select public.update_order_status($1,'completed')",[orderId]));
    await as(seller);await q("select public.update_order_status($1,'shipping')",[orderId]);await q("select public.update_order_status($1,'delivered')",[orderId]);await as(admin);await q("select public.update_order_status($1,'completed')",[orderId]);
    await q("select public.update_order_status($1,'completed')",[orderId]);
     const finance=await (async()=>{await as(admin);return (await q('select * from public.admin_order_financials where order_id=$1',[orderId]))[0];})();
     assert.equal(finance.payout_method,'trial');assert.equal(finance.payout_status,'trial_recorded');
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
