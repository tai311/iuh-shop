import {site,response,body,user,database,rpc,payos} from '../_shared/runtime.ts';
import {orderReceipt,ensureWebhook,syncOrder,createOrderLink} from '../_shared/order-payment.ts';
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||site;
 if(origin!==site&&!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))return response({error:'Origin không hợp lệ'},403);
 if(req.method==='OPTIONS')return response({},200,origin);
 if(req.method!=='POST')return response({error:'Method not allowed'},405,origin);
 try{
  const auth=await user(req),input=await body(req),id=Number(input.orderId);
  if(!['create','status','cancel'].includes(input.action)||!Number.isSafeInteger(id)||id<=0)throw new Error('Yêu cầu không hợp lệ.');
  const rows=await database('orders?select=*&id=eq.'+id);let o=rows[0];
  if(!o)throw new Error('Không tìm thấy đơn hàng.');
  if(o.buyer_id!==auth.id){
   const admins=await database('users?select=role&user_id=eq.'+auth.id);
    if(!['status','cancel'].includes(input.action)||admins[0]?.role!=='admin')throw new Error('Không có quyền kiểm tra đơn hàng.');
  }
  if(o.payment_method!=='qr')throw new Error('Đơn không thanh toán chuyển khoản.');
  if(o.payment_status!=='unpaid'||o.status==='cancelled'||o.needs_payment_review)return response(orderReceipt(o),200,origin);
  if(o.buyer_id!==auth.id&&!o.payos_order_code)throw new Error('Đơn chưa có yêu cầu payOS.');
  o=await rpc('payos_prepare_order',{p_order_id:id,p_buyer_id:o.buyer_id});
  if(['review','cancelled','expired'].includes(o.payos_status))return response(orderReceipt(o),200,origin);
  if(input.action==='status'&&o.payos_status==='pending'&&!await rpc('payos_claim_order_check',{p_order_code:o.payos_order_code}))return response(orderReceipt(o),200,origin);
  await ensureWebhook();let info;
  if(o.payos_status==='creating'){
   try{info=await payos('/v2/payment-requests/'+o.payos_order_code);}catch{/* Recover a lost create response using the same order code. */}
   if(!info){try{o=await createOrderLink(o);}catch(error){info=await payos('/v2/payment-requests/'+o.payos_order_code);if(!info)throw error;}}
  }
  if(input.action==='cancel')info=await payos('/v2/payment-requests/'+o.payos_order_code+'/cancel','POST',{cancellationReason:'Khách hủy đơn chưa thanh toán'});
  else if(!info&&input.action==='status')info=await payos('/v2/payment-requests/'+o.payos_order_code);
  if(info)o=await syncOrder(o,info);
  return response(orderReceipt(o),200,origin);
 }catch(error){const message=error instanceof Error?error.message:'Không xử lý được thanh toán.';return response({error:message==='AUTH_REQUIRED'?'Vui lòng đăng nhập lại.':message},message==='AUTH_REQUIRED'?401:400,origin);}
});
