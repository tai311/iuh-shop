const {test}=require('node:test'),assert=require('node:assert/strict');
test('Edge handlers authenticate callers, ignore client price and verify webhooks before settlement',async()=>{
 const originalFetch=global.fetch,originalDeno=global.Deno;let handler,providerCalls=0,settlements=0,createdBody;
 const p={id:'fixture',owner_id:'buyer',transaction_code:'IUH-test-123456',plan_type:'personal',payment_method:'bank',price:19000,status:'pending',payos_order_code:2609270000001,payos_status:'creating',payos_expires_at:new Date(Date.now()+1800000).toISOString()};
 let exists=false,providerState='PENDING';const link='fixture_link_123';
 const info=()=>({id:link,orderCode:p.payos_order_code,amount:19000,amountPaid:providerState==='PAID'?19000:0,status:providerState,transactions:providerState==='PAID'?[{reference:'BANK-REF-TEST'}]:[]});
 global.Deno={env:{get:name=>({SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'eyJ.fixture',SUPABASE_ANON_KEY:'public-fixture',PAYOS_CLIENT_ID:'client-fixture',PAYOS_API_KEY:'api-fixture',PAYOS_CHECKSUM_KEY:'checksum-fixture'})[name]},serve:fn=>{handler=fn;}};
 global.fetch=async(url,options={})=>{
  url=String(url);const value=options.body?JSON.parse(options.body):null;
  if(url.endsWith('/auth/v1/user'))return Response.json(options.headers.Authorization==='Bearer valid-user'?{id:'buyer'}:{error:'invalid'},{status:options.headers.Authorization==='Bearer valid-user'?200:401});
  if(url.includes('api-merchant.payos.vn')){
   providerCalls++;
   if(url.endsWith('/confirm-webhook'))return Response.json({code:'00',data:{}});
   if(url.endsWith('/v2/payment-requests')){createdBody=value;exists=true;return Response.json({code:'00',data:{orderCode:p.payos_order_code,amount:19000,paymentLinkId:link,checkoutUrl:'https://pay.payos.vn/web/'+link}});}
   if(!exists)return Response.json({code:'NOT_FOUND'});
   return Response.json({code:'00',data:info()});
  }
  if(url.includes('/rest/v1/service_package_payments'))return Response.json(url.includes('owner_id=eq.other')?[]:[{...p}]);
  if(url.endsWith('/rpc/purchase_service_package')){assert.equal(value.p_payment_method,'bank');return Response.json({status:'pending'});}
  if(url.endsWith('/rpc/payos_prepare_package')){assert.equal(value.p_owner_id,'buyer');return Response.json({...p});}
  if(url.endsWith('/rpc/payos_claim_check'))return Response.json(true);
  if(url.endsWith('/rpc/payos_bind_package')){p.payos_link_id=value.p_link_id;p.payos_checkout_url=value.p_checkout_url;p.payos_status='pending';return Response.json(null);}
  if(url.endsWith('/rpc/payos_sync_package')){settlements++;assert.equal(value.p_amount,19000);assert.equal(value.p_received,providerState==='PAID'?19000:0);return Response.json({...p,status:providerState==='PAID'?'paid':'pending',payos_status:providerState==='PAID'?'paid':'pending'});}
  throw new Error('Unexpected fetch '+url);
 };
 try{
  await import('../IUH shop/supabase/functions/payos-package/index.ts');const gateway=handler;
  const call=(body,token='valid-user')=>gateway(new Request('https://edge.test',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://iuh-shop.vercel.app','Content-Type':'application/json'},body:JSON.stringify(body)}));
  assert.equal((await call({action:'create',transaction:p.transaction_code,plan:'personal'},'bad')).status,401);assert.equal(providerCalls,0);
  const created=await (await call({action:'create',transaction:p.transaction_code,plan:'personal',amount:1,status:'paid'})).json();assert.equal(created.status,'pending');assert.equal(createdBody.amount,19000);assert.equal(created.checkout_url,'https://pay.payos.vn/web/'+link);assert.ok(!JSON.stringify(created).includes('fixture-key'));
  providerState='PAID';const checked=await (await call({action:'status',transaction:p.transaction_code})).json();assert.equal(checked.status,'paid');assert.equal(settlements,1);
  await import('../IUH shop/supabase/functions/payos-webhook/index.ts');const webhook=handler;
  const send=value=>webhook(new Request('https://edge.test',{method:'POST',body:JSON.stringify(value)}));
  assert.equal((await send({data:{orderCode:p.payos_order_code},signature:'bad'})).status,401);assert.equal(settlements,1);
  const {sign}=await import('../IUH shop/supabase/functions/_shared/payos.mjs');const data={orderCode:p.payos_order_code,currency:'VND',amount:19000,paymentLinkId:link,reference:'BANK-REF-TEST',code:'00'};
  assert.equal((await send({code:'00',success:true,data,signature:await sign(data,'checksum-fixture')})).status,200);assert.equal(settlements,2);
 }finally{global.fetch=originalFetch;global.Deno=originalDeno;}
});
