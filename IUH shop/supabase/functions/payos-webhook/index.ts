import {response,body,secret,database,payos,sync} from '../_shared/runtime.ts';
import {verify} from '../_shared/payos.mjs';
Deno.serve(async req=>{
 if(req.method!=='POST')return response({error:'Method not allowed'},405);
 try{
  const value=await body(req);
  if(!await verify(value.data,value.signature,secret('PAYOS_CHECKSUM_KEY')))return response({error:'Invalid signature'},401);
  const d=value.data;
  if(!Number.isSafeInteger(d.orderCode)||d.currency!=='VND')return response({error:'Invalid payment'},400);
  const rows=await database('service_package_payments?select=*&payos_order_code=eq.'+d.orderCode);
  // payOS sends a signed sample while confirming this endpoint. Unknown orders never activate anything.
  if(!rows.length)return response({received:true,matched:false});
  if(value.success!==true||value.code!=='00'||d.code!=='00')return response({received:true});
  const p=rows[0],info=await payos('/v2/payment-requests/'+d.orderCode);
  if(info.id!==d.paymentLinkId)return response({error:'Payment link mismatch'},400);
  await sync(p,info);
  return response({received:true});
 }catch{return response({error:'Webhook processing temporarily unavailable'},500);}
});
