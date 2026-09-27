import {site,base,rpc,payos,secret} from './runtime.ts';
import {sign,checkoutURL,providerReference} from './payos.mjs';
export function orderReceipt(o:any){return {
 success:true,order_id:o.id,order_code:o.order_code,status:o.status,payment_status:o.payment_status,
 total_amount:o.total_amount,payos_status:o.payos_status,payos_order_code:o.payos_order_code,
 needs_payment_review:o.needs_payment_review,
 checkout_url:o.payment_status==='unpaid'&&o.status!=='cancelled'&&o.payos_status==='pending'?o.payos_checkout_url:null,
 qr_code:o.payment_status==='unpaid'&&o.status!=='cancelled'&&o.payos_status==='pending'?o.payos_qr_code:null
};}
let webhookReady:Promise<unknown>|null=null;
export async function ensureWebhook(){
 if(!webhookReady)webhookReady=payos('/confirm-webhook','POST',{webhookUrl:base+'/functions/v1/payos-webhook'}).catch(error=>{webhookReady=null;throw error;});
 await webhookReady;
}
export async function syncOrder(o:any,info:any){
 if(Number(info.orderCode)!==Number(o.payos_order_code)||Number(info.amount)!==Number(o.total_amount))throw new Error('Thông tin thanh toán không khớp đơn hàng.');
 await rpc('payos_bind_order',{p_order_code:o.payos_order_code,p_link_id:info.id,p_checkout_url:checkoutURL(info.id)});
 return rpc('payos_sync_order',{p_order_code:o.payos_order_code,p_link_id:info.id,p_state:info.status,p_amount:info.amount,p_received:info.amountPaid,p_reference:providerReference(info)});
}
export async function createOrderLink(o:any){
 const returnUrl=site+'/HTML/donhang.html?payos_order='+o.id;
 const data={orderCode:Number(o.payos_order_code),amount:Number(o.total_amount),description:'IUH DON',returnUrl,cancelUrl:returnUrl};
 const result=await payos('/v2/payment-requests','POST',{...data,expiredAt:Math.floor(Math.max(new Date(o.payos_expires_at).getTime(),Date.now()+1800000)/1000),signature:await sign(data,secret('PAYOS_CHECKSUM_KEY'))});
 if(Number(result.orderCode)!==data.orderCode||Number(result.amount)!==data.amount||result.checkoutUrl!==checkoutURL(result.paymentLinkId))throw new Error('Thông tin QR không khớp đơn hàng.');
 await rpc('payos_bind_order',{p_order_code:o.payos_order_code,p_link_id:result.paymentLinkId,p_checkout_url:result.checkoutUrl});
 if(typeof result.qrCode!=='string'||!result.qrCode.startsWith('000201')||result.qrCode.length<20||result.qrCode.length>4096)throw new Error('payOS chưa trả dữ liệu QR hợp lệ. Kiểm tra lại cùng giao dịch.');
 await rpc('payos_save_order_qr',{p_order_code:o.payos_order_code,p_link_id:result.paymentLinkId,p_qr_code:result.qrCode});
 return {...o,payos_link_id:result.paymentLinkId,payos_checkout_url:result.checkoutUrl,payos_status:'pending',payos_qr_code:result.qrCode};
}
