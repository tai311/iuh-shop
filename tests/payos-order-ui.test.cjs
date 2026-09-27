const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
test('Order QR embeds safely, only backend confirms payment, stale SDK cannot reopen a closed dialog',async()=>{
 const dom=new JSDOM('<body></body>',{url:'https://iuh-shop.vercel.app/HTML/donhang.html',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let state='unpaid',calls=[],config,refreshes=0;
 const receipt=()=>({order_id:1,order_code:'IUH-1',status:'pending',payment_status:state,total_amount:105000,payos_status:state==='paid'?'paid':'pending',checkout_url:'https://pay.payos.vn/web/order_fixture123'});
 w.IUHCore={getClient:()=>({auth:{onAuthStateChange(){}},functions:{invoke:async(name,args)=>{calls.push(args.body);return {data:receipt()};}}})};
 w.refreshPageData=()=>{refreshes++;};
 const sdk=()=>({usePayOS:c=>{config=c;return {open(){w.document.getElementById(c.ELEMENT_ID).append(w.document.createElement('iframe'));},exit(){w.document.querySelector('iframe')?.remove();}};}});
 const tick=()=>new Promise(r=>setTimeout(r,0));
 try{
  w.PayOSCheckout=sdk();w.eval(fs.readFileSync('IUH shop/JS/payos-orders.js','utf8'));w.IUHPayosOrders.open(1);await tick();
  assert.equal(w.document.querySelectorAll('iframe').length,1);assert.equal(config.embedded,true);assert.equal(calls[0].orderId,1);
  config.onSuccess({status:'PAID'});await tick();assert.equal(refreshes,0);assert.equal(w.document.querySelectorAll('iframe').length,1);
  state='paid';w.document.querySelector('[data-check]').click();await tick();assert.equal(refreshes,1);assert.match(w.document.querySelector('[data-status]').textContent,/Đã xác nhận/);assert.equal(w.document.querySelectorAll('iframe').length,0);
  w.document.querySelector('[data-close]').click();state='unpaid';delete w.PayOSCheckout;w.IUHPayosOrders.open(2);await tick();
  const script=w.document.querySelector('script');assert.ok(script);w.document.querySelector('[data-close]').click();w.PayOSCheckout=sdk();script.onload();await tick();assert.equal(w.document.querySelectorAll('iframe').length,0);assert.equal(w.document.querySelector('dialog').open,false);
 }finally{w.close();}
});
