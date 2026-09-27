export function canonical(data) {
 return Object.keys(data).sort().map(key=>{
  let value=data[key];
  if(value==null||value==='null'||value==='undefined')value='';
  else if(Array.isArray(value))value=JSON.stringify(value.map(item=>Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b)))));
  return `${key}=${value}`;
 }).join('&');
}
export async function sign(data,secret) {
 const encoder=new TextEncoder();
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(canonical(data))))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function verify(data,signature,secret) {
 if(!data||typeof data!=='object'||Array.isArray(data)||typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature))return false;
 const expected=await sign(data,secret);let difference=0;
 for(let i=0;i<64;i++)difference|=expected.charCodeAt(i)^signature.toLowerCase().charCodeAt(i);
 return difference===0;
}
export function checkoutURL(linkId){
 if(typeof linkId!=='string'||!/^[A-Za-z0-9_-]{10,100}$/.test(linkId))throw new Error('Mã link payOS không hợp lệ.');
 return 'https://pay.payos.vn/web/'+linkId;
}
export function publicReceipt(p){return {success:true,status:p.status,transaction_code:p.transaction_code,plan_type:p.plan_type,price:p.price,payment_method:p.payment_method,expires_at:p.expires_at,payos_order_code:p.payos_order_code,payos_status:p.payos_status,checkout_url:p.payos_status==='pending'?p.payos_checkout_url:null};}
export function providerReference(info){
 const transactions=Array.isArray(info.transactions)?info.transactions:[];
 return transactions.length===1&&transactions[0].reference?String(transactions[0].reference):'PAYOS-'+info.id;
}
