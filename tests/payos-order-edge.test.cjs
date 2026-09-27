const {test}=require('node:test'),assert=require('node:assert/strict');
test('Order gateway enforces ownership, server amount and verified webhook routing',async()=>{
 const originalFetch=global.fetch,originalDeno=global.Deno;let handler,providerCalls=0,settlements=0,exists=false,created;
 const o={id:12,buyer_id:'buyer',order_code:'IUH-TEST',payment_method:'qr',payment_status:'unpaid',status:'pending',total_amount:105000,payos_order_code:2609270000042,payos_status:'creating',payos_expires_at:new Date(Date.now()+1800000).toISOString()};
 const link='order_fixture_123';let state='PENDING';
 global.Deno={env:{get:name=>({SUPABASE_URL:'https://order-db.test',SUPABASE_SERVICE_ROLE_KEY:'eyJ.fixture',SUPABASE_ANON_KEY:'public-fixture',PAYOS_CLIENT_ID:'client-fixture',PAYOS_API_KEY:'api-fixture',PAYOS_CHECKSUM_KEY:'checksum-fixture'})[name]},serve:fn=>{handler=fn;}};
 global.fetch=async(url,options={})=>{
  url=String(url);const value=options.body?JSON.parse(options.body):null;
  if(url.endsWith('/auth/v1/user')){const id=options.headers.Authorization?.slice(7);return Response.json({id},{status:id==='bad'?401:200});}
  if(url.includes('api-merchant.payos.vn')){
   providerCalls++;if(url.endsWith('/confirm-webhook'))return Response.json({code:'00',data:{}});
   if(url.endsWith('/v2/payment-requests')){created=value;exists=true;return Response.json({code:'00',data:{orderCode:o.payos_order_code,amount:105000,paymentLinkId:link,checkoutUrl:'https://pay.payos.vn/web/'+link,qrCode:'000201PAYOS-QR-TEST-DATA'}});}
   if(!exists)return Response.json({code:'NOT_FOUND'});
   if(url.endsWith('/cancel'))state='CANCELLED';
   return Response.json({code:'00',data:{id:link,orderCode:o.payos_order_code,amount:105000,amountPaid:state==='PAID'?105000:0,status:state,transactions:[{reference:'ORDER-BANK-1'}]}});
  }
  if(url.includes('/rest/v1/users?'))return Response.json([{role:url.includes('eq.admin')?'admin':'user'}]);
  if(url.includes('/rest/v1/orders?'))return Response.json([{...o}]);
  if(url.includes('/rest/v1/service_package_payments?'))return Response.json([]);
  if(url.endsWith('/rpc/payos_prepare_order')){assert.equal(value.p_buyer_id,'buyer');return Response.json({...o});}
  if(url.endsWith('/rpc/payos_claim_order_check'))return Response.json(true);
  if(url.endsWith('/rpc/payos_bind_order')){o.payos_link_id=value.p_link_id;o.payos_checkout_url=value.p_checkout_url;o.payos_status='pending';return new Response(null,{status:204});}
  if(url.endsWith('/rpc/payos_save_order_qr')){assert.equal(value.p_link_id,link);o.payos_qr_code=value.p_qr_code;return new Response(null,{status:204});}
  if(url.endsWith('/rpc/payos_sync_order')){settlements++;assert.equal(value.p_amount,105000);return Response.json({...o,payment_status:state==='PAID'?'paid':'unpaid',payos_status:state.toLowerCase()});}
  throw new Error('Unexpected fetch '+url);
 };
 try{
  await import('../IUH shop/supabase/functions/payos-order/index.ts');const gateway=handler;
  const call=(body,id='buyer')=>gateway(new Request('https://edge.test',{method:'POST',headers:{Authorization:'Bearer '+id,Origin:'https://iuh-shop.vercel.app'},body:JSON.stringify(body)}));
  assert.equal((await call({action:'create',orderId:12},'bad')).status,401);
  assert.equal((await call({action:'create',orderId:12},'other')).status,400);assert.equal(providerCalls,0);
  const createdResponse=await call({action:'create',orderId:12,amount:1});assert.equal(createdResponse.status,200);assert.equal((await createdResponse.json()).qr_code,'000201PAYOS-QR-TEST-DATA');assert.equal(created.amount,105000);assert.equal(created.orderCode,o.payos_order_code);
  assert.equal((await(await call({action:'create',orderId:12})).json()).qr_code,o.payos_qr_code);
  assert.equal((await call({action:'cancel',orderId:12},'admin')).status,400);
  state='PAID';const result=await (await call({action:'status',orderId:12},'admin')).json();assert.equal(result.payment_status,'paid');assert.equal(settlements,1);
  await import('../IUH shop/supabase/functions/payos-webhook/index.ts');const webhook=handler;
  const {sign}=await import('../IUH shop/supabase/functions/_shared/payos.mjs');const data={orderCode:o.payos_order_code,paymentLinkId:link,currency:'VND',code:'00',amount:105000};
  const send=signature=>webhook(new Request('https://edge.test',{method:'POST',body:JSON.stringify({success:true,code:'00',data,signature})}));
  assert.equal((await send('bad')).status,401);assert.equal(settlements,1);
  assert.equal((await send(await sign(data,'checksum-fixture'))).status,200);assert.equal(settlements,2);
 }finally{global.fetch=originalFetch;global.Deno=originalDeno;}
});
