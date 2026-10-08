const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const read=p=>fs.readFileSync('IUH shop/'+p,'utf8');
const tick=()=>new Promise(r=>setTimeout(r,15));

test('Admin orders route displays new requests and delivery actions outside the hidden legacy page',async()=>{
 const dom=new JSDOM(read('HTML/admin.html'),{url:'https://shop.invalid/HTML/admin.html#orders',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,calls=[];
 const rows=['awaiting_seller','connected','expired'].map((status,i)=>({id:i+1,buyer_id:'buyer',seller_id:'seller',status,subtotal:10000,platform_fee:2000,items:[],expires_at:new Date(Date.now()+86400000).toISOString(),delivery_method:i===1?'passit':null,delivery_status:i===1?'requested':null,buyer_contact:{fullname:'Buyer'},seller_contact:{fullname:'Seller'}}));
 const db={auth:{getUser:async()=>({data:{user:{id:'admin'}}}),onAuthStateChange(){}},from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{role:'admin'}})}),rpc:async(name,args)=>{
  calls.push([name,args]);
  if(name==='get_connection_requests')return {data:{requests:rows,auto_confirm:true,server_time:new Date().toISOString()}};
  if(name==='admin_update_connection_delivery'){rows[1].delivery_status=args.p_status;return {data:true};}
  return {data:{rows:[],total:0,counts:{}}};
 }};
 w.IUH_SUPABASE=db;w.IUHCore={getClient:()=>db};
 w.IUHSecurity={escapeHTML:s=>String(s??'').replaceAll('<','&lt;').replaceAll('>','&gt;')};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 try{
  w.eval(read('JS/admin-requests.js'));w.eval(read('JS/connection-commerce.js'));w.eval(read('JS/connection-orders.js'));
  w.IUHAdminRequests.openOrders();await tick();
  const panel=d.getElementById('connectionRequests');
  assert.equal(panel.closest('.admin-page').id,'page-requests');
  assert.equal(panel.hidden,false);assert.equal(panel.querySelectorAll('[data-request]').length,3);
  assert.match(d.getElementById('opsTitle').textContent,/Lịch sử/);
  panel.querySelector('[data-action="arranging"]').click();panel.querySelector('[data-confirm]').click();await tick();
  assert.ok(calls.some(([name,args])=>name==='admin_update_connection_delivery'&&args.p_request_id===2&&args.p_status==='arranging'));
  w.IUHAdminRequests.openPackages();await tick();assert.equal(panel.hidden,true);
  w.IUHAdminRequests.openOrders();await tick();assert.equal(panel.hidden,false);
 }finally{w.close();}
});
