import {base,site,response,body,user,rpc,payos,sync,createLink,database} from '../_shared/runtime.ts';
import {publicReceipt} from '../_shared/payos.mjs';
let webhookReady:Promise<unknown>|null=null;
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||site;
 if(origin!==site&&!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))return response({error:'Origin không hợp lệ'},403);
 if(req.method==='OPTIONS')return response({},200,origin);
 if(req.method!=='POST')return response({error:'Method not allowed'},405,origin);
 try{
  const auth=await user(req),input=await body(req);
  if(!['create','status','cancel'].includes(input.action))throw new Error('Thao tác không hợp lệ.');
  const transaction=input.transaction;
  if(typeof transaction!=='string'||!/^[-A-Za-z0-9_]{12,80}$/.test(transaction))throw new Error('Mã yêu cầu không hợp lệ.');
  if(input.action==='create'){
   await rpc('purchase_service_package',{p_plan_type:input.plan,p_payment_method:'bank',p_transaction_code:transaction,p_member_ids:input.memberIds||[]},auth.token);
  }
  const rows=await database('service_package_payments?select=*&owner_id=eq.'+auth.id+'&transaction_code=eq.'+encodeURIComponent(transaction));
  if(!rows.length)throw new Error('Không tìm thấy giao dịch của bạn.');
  let p=rows[0];
  if(p.status==='paid'||p.status==='cancelled'&&p.payos_status!=='review')return response(publicReceipt(p),200,origin);
  if(p.payment_method!=='bank')throw new Error('Giao dịch không phải chuyển khoản.');
  if(input.action==='cancel'&&!p.payos_order_code){const r=await rpc('cancel_service_package_payment',{p_transaction_code:transaction},auth.token);return response(r,200,origin);}
  p=await rpc('payos_prepare_package',{p_transaction_code:transaction,p_owner_id:auth.id});
  if(p.payos_status==='review')return response(publicReceipt(p),200,origin);
  if(input.action==='status'&&p.payos_status==='pending'&&!await rpc('payos_claim_check',{p_order_code:p.payos_order_code}))return response(publicReceipt(p),200,origin);
  // Register the signed webhook before issuing any QR. A failed setup fails closed.
  if(!webhookReady)webhookReady=payos('/confirm-webhook','POST',{webhookUrl:base+'/functions/v1/payos-webhook'}).catch(err=>{webhookReady=null;throw err;});
  await webhookReady;
  let info;
  if(p.payos_status==='creating'){
   // Recover an earlier successful provider call whose response was lost.
   try{info=await payos('/v2/payment-requests/'+p.payos_order_code);}catch{/* POST uses the SAME order code, never a new charge. */}
   if(!info){
    try{p=await createLink(p);}catch(err){info=await payos('/v2/payment-requests/'+p.payos_order_code);if(!info)throw err;}
   }
  }
  if(input.action==='cancel')info=await payos('/v2/payment-requests/'+p.payos_order_code+'/cancel','POST',{cancellationReason:'Khách hủy yêu cầu chưa thanh toán'});
  else if(!info&&input.action==='status')info=await payos('/v2/payment-requests/'+p.payos_order_code);
  if(info)p=await sync(p,info);
  return response(publicReceipt(p),200,origin);
 }catch(err){const message=err instanceof Error?err.message:'Không xử lý được thanh toán.';return response({error:message==='AUTH_REQUIRED'?'Vui lòng đăng nhập lại.':message},message==='AUTH_REQUIRED'?401:400,origin);}
});
