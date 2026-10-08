const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const read = name => fs.readFileSync('IUH shop/'+name,'utf8');
const flush = () => new Promise(r=>setTimeout(r,15));

test('New checkout retries the same request, prevents double submit, and restores pending receipt', async () => {
 const dom = new JSDOM(read('HTML/dathang.html'),{runScripts:'outside-only',url:'https://shop.invalid/HTML/dathang.html?buyNow=true&product=960&quantity=2',pretendToBeVisual:true});
 const w=dom.window,d=w.document,calls=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'buyer'}}})},from(table){
  const query={select(){return query;},eq(){return query;},maybeSingle:async()=>({data:{fullname:'Buyer',phone:'0901234567'}}),
   in:async()=>({data:table==='products'?[{id:960,seller_id:'seller',price:10000,quantity:5,status:'active',name:'<img src=x onerror=alert(1)>',image_urls:[]}]:[]})};return query;
 },async rpc(name,args){
  if(name==='get_connection_requests')return {data:{requests:[{id:71,status:'awaiting_seller'}]}};
  calls.push(args);if(calls.length===1)throw Error('Mất kết nối');
  return {data:{success:true,request_ids:[71],subtotal:20000}};
 }};
 w.IUH_SUPABASE=db;
 try {
  w.eval(read('JS/connection-commerce.js'));w.eval(read('JS/connection-checkout.js'));await flush();
  assert.match(d.getElementById('connectionSubtotal').textContent,/20.000/);
  assert.equal(d.querySelector('#connectionCheckoutItems img[onerror]'),null);
  assert.deepEqual([...d.getElementById('recipientAddress').options].slice(1).map(o=>o.value),['Cơ sở chính Nguyễn Văn Bảo','Cơ sở Nguyễn Văn Dung','Cơ sở Phạm Văn Chiêu','Sân vận động Đạt Đức']);
  d.getElementById('recipientAddress').selectedIndex=1;
  const submit=()=>d.getElementById('connectionCheckoutForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  submit();await flush();assert.match(d.getElementById('connectionCheckoutStatus').textContent,/Mất kết nối/);
  submit();submit();await flush();
  assert.equal(calls.length,2);assert.equal(calls[0].p_request_key,calls[1].p_request_key);
  assert.equal(calls[1].p_expected_subtotal,20000);
  assert.equal(calls[1].p_payment_method,undefined);assert.equal(calls[1].p_shipping_method,undefined);
  assert.equal(d.getElementById('connectionCheckoutForm').hidden,true);
  assert.equal(d.getElementById('connectionWaiting').hidden,false);
  assert.equal(w.location.search,'?waiting=true');
  assert.match(d.getElementById('connectionWaitingList').textContent,/Chờ người bán/);
  assert.deepEqual(JSON.parse(w.sessionStorage.getItem('passitConnectionWaiting:buyer')).request_ids,[71]);
  submit();await flush();assert.equal(calls.length,2);
 }finally{w.close();}
});

for(const mode of ['orders','chat'])test('Seller sees fee/delivery controls in '+mode+' with safe rendering and single confirmation',async()=>{
 const dom=new JSDOM(`<div id="connectionRequests" data-mode="${mode}"></div>`,{runScripts:'outside-only',url:'https://shop.invalid/HTML/donhang.html#sale',pretendToBeVisual:true});
 const w=dom.window,d=w.document,calls=[];
 let row={id:1,buyer_id:'buyer',seller_id:'seller',subtotal:10000,platform_fee:2000,recipient_name:'<script>bad()</script>',recipient_phone:'0901234567',recipient_address:'Campus',status:mode==='chat'?'connected':'awaiting_seller',conversation_id:mode==='chat'?'chat-1':null,expires_at:new Date(Date.now()+86400000).toISOString(),items:[{name:'Book',image_urls:[],quantity:1,unit_price:10000}]};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.IUH_SUPABASE={auth:{getUser:async()=>({data:{user:{id:'seller'}}})},rpc:async(name,args)=>{
  if(name==='get_connection_requests')return {data:{requests:[row],auto_confirm:true,server_time:new Date().toISOString()}};
  calls.push([name,args]);await flush();if(name==='choose_connection_delivery')row={...row,delivery_method:args.p_method,delivery_status:'requested',delivery_note:args.p_note};
  return {data:{success:true}};
 }};
 try{
  w.eval(read('JS/connection-commerce.js'));w.eval(read('JS/connection-orders.js'));await flush();
  if(mode==='chat'){d.dispatchEvent(new w.CustomEvent('passit:conversation-open',{detail:{conversationId:'chat-1'}}));assert.equal(d.getElementById('connectionRequests').hidden,false);}
  assert.equal(d.querySelector('script'),null);
  assert.match(d.body.textContent,/Không cần chuyển tiền thật/);
  const action=mode==='chat'?'passit':'fee';
  if(mode==='chat')d.querySelector('textarea').value='Cổng trường 15:00';
  d.querySelector(`[data-action="${action}"]`).click();
  assert.equal(d.querySelector('dialog').open,true);
  d.querySelector('[data-confirm]').click();d.querySelector('[data-confirm]').click();await flush();await flush();
  assert.equal(calls.length,1);assert.equal(calls[0][0],mode==='chat'?'choose_connection_delivery':'confirm_connection_fee');
  if(mode==='chat'){assert.equal(calls[0][1].p_note,'Cổng trường 15:00');assert.match(d.body.textContent,/PASSIT giao hộ/);}
 }finally{w.close();}
});

test('Reload after lost checkout response recovers receipt before querying exhausted stock',async()=>{
 const url='https://shop.invalid/HTML/dathang.html?buyNow=true&product=960';
 const dom=new JSDOM(read('HTML/dathang.html'),{runScripts:'outside-only',url,pretendToBeVisual:true});
 const w=dom.window,calls=[];
 w.sessionStorage.setItem('passitConnectionAttempt:buyer',JSON.stringify({key:'retry-key',route:w.location.search,signature:'saved'}));
 w.IUH_SUPABASE={auth:{getUser:async()=>({data:{user:{id:'buyer'}}})},from(table){
  assert.equal(table,'users','Recovery does not reload cart or reserved product stock');
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{}})};return q;
 },rpc:async(name,args)=>{
  calls.push(name);
  if(name==='get_connection_receipt'){assert.equal(args.p_request_key,'retry-key');return {data:{success:true,request_ids:[71]}};}
  assert.equal(name,'get_connection_requests');return {data:{requests:[{id:71,status:'awaiting_seller'}]}};
 }};
 try{
  w.eval(read('JS/connection-commerce.js'));w.eval(read('JS/connection-checkout.js'));await flush();
  assert.equal(w.document.getElementById('connectionWaiting').hidden,false);
  assert.deepEqual(calls,['get_connection_receipt','get_connection_requests']);
 }finally{w.close();}
});
