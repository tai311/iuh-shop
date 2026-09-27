import {sign,checkoutURL,providerReference} from './payos.mjs';
export const site='https://iuh-shop.vercel.app';
export const base=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
const anonKey=Deno.env.get('SUPABASE_ANON_KEY')||JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default;
export function secret(name:string){const value=Deno.env.get(name);if(!value)throw new Error('Cấu hình thanh toán chưa đầy đủ.');return value;}
export function response(data:unknown,status=200,origin=site){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}});}
export async function body(req:Request){
 const text=await req.text();if(text.length>20000)throw new Error('Yêu cầu quá lớn.');return JSON.parse(text);
}
export async function database(path:string,options:RequestInit={},token?:string){
 const key=token?anonKey:serviceKey;
 const headers:Record<string,string>={apikey:key,'Content-Type':'application/json'};
 if(token||key?.startsWith('eyJ'))headers.Authorization='Bearer '+(token||key);
 const res=await fetch(base+'/rest/v1/'+path,{...options,headers,signal:AbortSignal.timeout(15000)});
 // PostgREST returns HTTP 204 with no body for RPCs declared RETURNS void.
 // Parsing that successful response as JSON aborts settlement after binding the link.
 const text=await res.text();
 let value:any=null;
 if(text.trim()){
  try{value=JSON.parse(text);}catch{
   console.error(JSON.stringify({event:'payos_database_invalid_response',status:res.status}));
   throw new Error('Phản hồi dữ liệu không hợp lệ. Vui lòng kiểm tra lại giao dịch.');
  }
 }
 if(!res.ok){
  console.error(JSON.stringify({event:'payos_database_error',status:res.status,code:value?.code}));
  throw new Error(value?.message||'Không truy cập được dữ liệu.');
 }
 return value;
}
export const rpc=(name:string,args:unknown,token?:string)=>database('rpc/'+name,{method:'POST',body:JSON.stringify(args)},token);
export async function user(req:Request){
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /i,'');
 if(!token)throw new Error('AUTH_REQUIRED');
 const res=await fetch(base+'/auth/v1/user',{headers:{apikey:anonKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
 const value=await res.json();if(!res.ok||!value.id)throw new Error('AUTH_REQUIRED');return {id:value.id,token};
}
export async function payos(path:string,method='GET',data?:unknown){
 const res=await fetch('https://api-merchant.payos.vn'+path,{method,headers:{'Content-Type':'application/json','x-client-id':secret('PAYOS_CLIENT_ID'),'x-api-key':secret('PAYOS_API_KEY')},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(20000)});
 const value=await res.json();if(!res.ok||value.code!=='00')throw new Error('payOS chưa xử lý được yêu cầu. Hãy kiểm tra lại cùng giao dịch.');return value.data;
}
export async function sync(p:any,info:any){
 if(Number(info.orderCode)!==Number(p.payos_order_code)||Number(info.amount)!==p.price)throw new Error('Thông tin thanh toán không khớp.');
 const url=checkoutURL(info.id);
 await rpc('payos_bind_package',{p_order_code:p.payos_order_code,p_link_id:info.id,p_checkout_url:url});
 return rpc('payos_sync_package',{p_order_code:p.payos_order_code,p_link_id:info.id,p_state:info.status,p_amount:info.amount,p_received:info.amountPaid,p_reference:providerReference(info)});
}
export async function createLink(p:any){
 const returnUrl=site+'/HTML/taikhoan.html?payos_return=1';
 const cancelUrl=site+'/HTML/taikhoan.html?payos_return=1';
 const description='IUH GOI';
 const data={orderCode:Number(p.payos_order_code),amount:p.price,description,returnUrl,cancelUrl};
 const result=await payos('/v2/payment-requests','POST',{...data,expiredAt:Math.floor(Math.max(new Date(p.payos_expires_at).getTime(),Date.now()+1800000)/1000),signature:await sign(data,secret('PAYOS_CHECKSUM_KEY'))});
 if(Number(result.orderCode)!==Number(p.payos_order_code)||result.amount!==p.price)throw new Error('Thông tin QR không khớp.');
 const url=checkoutURL(result.paymentLinkId);
 if(result.checkoutUrl!==url)throw new Error('Địa chỉ payOS không hợp lệ.');
 await rpc('payos_bind_package',{p_order_code:p.payos_order_code,p_link_id:result.paymentLinkId,p_checkout_url:url});
 return {...p,payos_link_id:result.paymentLinkId,payos_checkout_url:url,payos_status:'pending'};
}
