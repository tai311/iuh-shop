const {test}=require('node:test'),assert=require('node:assert/strict');
const {createDatabase}=require('./helpers/database.cjs');
test('payOS signature rejects altered payloads and unsafe redirects',async()=>{
 const {sign,verify,checkoutURL}=await import('../IUH shop/supabase/functions/_shared/payos.mjs');
 const d={orderCode:123,amount:19000,currency:'VND',reference:'BANK-1',code:'00'};
 const signature=await sign(d,'test-only-key');assert.equal(await verify(d,signature,'test-only-key'),true);
 assert.equal(await verify({...d,amount:1},signature,'test-only-key'),false);assert.equal(await verify(d,signature,'wrong'),false);assert.equal(await verify(d,'','test-only-key'),false);
 assert.equal(await sign({a:null,b:'null'},'key'),await sign({b:'',a:''},'key'));
 assert.throws(()=>checkoutURL('../../evil'));assert.equal(checkoutURL('valid_link_123'),'https://pay.payos.vn/web/valid_link_123');
});
test('payOS settlement is service-only, exact-amount, atomic and replay safe',async()=>{
 const db=await createDatabase(),admin='00000000-0000-4000-8000-000000000031',buyer='00000000-0000-4000-8000-000000000032';
 const q=async(s,a=[])=>(await db.query(s,a)).rows,scalar=async(s,a=[])=>Object.values((await q(s,a))[0])[0];
 const as=async(id,role='authenticated')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);};
 const purchase=async key=>{await as(buyer);return scalar("select public.purchase_service_package('personal','bank',$1)",[key]);};
 const prepare=async key=>{await as(null,'service_role');const p=await scalar('select public.payos_prepare_package($1,$2)',[key,buyer]);await q('select public.payos_bind_package($1,$2,$3)',[p.payos_order_code,'link_'+p.payos_order_code,'https://pay.payos.vn/web/link_'+p.payos_order_code]);return p;};
 const sync=(p,state='PAID',amount=19000,received=19000,ref='PAYOS-BANK-001')=>scalar('select public.payos_sync_package($1,$2,$3,$4,$5,$6)',[p.payos_order_code,'link_'+p.payos_order_code,state,amount,received,ref]);
 try{
  for(const [id,role] of [[admin,'admin'],[buyer,'user']]){await q('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.invalid']);await q('update public.users set role=$2 where user_id=$1',[id,role]);}
    await as(admin);await q('select public.set_iuh_trial_mode(false)');
  await purchase('payos-test-00001');
  await assert.rejects(q('select public.payos_prepare_package($1,$2)',['payos-test-00001',buyer]),/permission denied/);
  const p=await prepare('payos-test-00001');const duplicate=await scalar('select public.payos_prepare_package($1,$2)',['payos-test-00001',buyer]);assert.equal(p.payos_order_code,duplicate.payos_order_code);
  await as(buyer);await assert.rejects(q("select public.cancel_service_package_payment('payos-test-00001')"),/payOS/);
  await as(admin);await assert.rejects(q("select public.approve_service_package_payment('payos-test-00001','FAKE-BANK-001')"),/payOS/);
  await as(null,'service_role');await assert.rejects(sync(p,'PAID',1,1),/Số tiền/);
  let result=await sync(p);assert.equal(result.status,'paid');assert.equal(result.payos_status,'paid');const expiry=result.expires_at;
  result=await sync(p);assert.equal(result.expires_at,expiry);
  await as(admin);assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[admin])),19000);
  await as(buyer);assert.equal((await scalar('select public.get_my_service_package()')).recent_transactions[0].payos_status,'paid');
  await purchase('payos-test-00002');const second=await prepare('payos-test-00002');result=await sync(second,'EXPIRED',19000,0);assert.equal(result.status,'cancelled');
  result=await sync(second,'PAID',19000,19000,'LATE-PAY-002');assert.equal(result.payos_status,'review');assert.equal(result.status,'cancelled');
  await purchase('payos-test-00003');const third=await prepare('payos-test-00003');result=await sync(third,'PAID',19000,20000,'OVERPAY-003');assert.equal(result.payos_status,'review');assert.equal(result.status,'pending');
  await as(admin);assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[admin])),19000);
  await db.exec('reset role;set role anon');await assert.rejects(q('select public.payos_prepare_package($1,$2)',['payos-test-00003',buyer]),/permission denied/);
 }finally{await db.close();}
});
