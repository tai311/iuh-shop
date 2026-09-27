import {response,body,secret,database,payos,sync} from '../_shared/runtime.ts';
import {verify} from '../_shared/payos.mjs';
import {syncOrder} from '../_shared/order-payment.ts';
Deno.serve(async req=>{
 if(req.method!=='POST')return response({error:'Method not allowed'},405);
 try{
  const value=await body(req);
  if(!await verify(value.data,value.signature,secret('PAYOS_CHECKSUM_KEY')))return response({error:'Invalid signature'},401);
  const d=value.data;
  if(!Number.isSafeInteger(d.orderCode)||d.currency!=='VND')return response({error:'Invalid payment'},400);
  let rows=await database('service_package_payments?select=*&payos_order_code=eq.'+d.orderCode);
  const isOrder=!rows.length;
  if(isOrder)rows=await database('orders?select=*&payos_order_code=eq.'+d.orderCode);
  // payOS sends a signed sample while confirming this endpoint. Unknown orders never activate anything.
  if(!rows.length)return response({received:true,matched:false});
  if(value.success!==true||value.code!=='00'||d.code!=='00')return response({received:true});
  const p=rows[0],info=await payos('/v2/payment-requests/'+d.orderCode);
  if(info.id!==d.paymentLinkId)return response({error:'Payment link mismatch'},400);
  if(isOrder)await syncOrder(p,info);else await sync(p,info);
  return response({received:true});
 }catch(error){
  console.error(JSON.stringify({event:'payos_webhook_failed',errorType:error instanceof Error?error.name:'UnknownError'}));
  return response({error:'Webhook processing temporarily unavailable'},500);
 }
});
