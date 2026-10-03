const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
test('Order QR renders provider payload directly and only backend can confirm payment',async()=>{
 const dom=new JSDOM('<body></body>',{url:'https://iuh-shop.vercel.app/HTML/donhang.html',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const qrCode='00020101021238570010A000000727012700069704220113113366668888020899998888530370454061000005802VN62230819THANH TOAN DON HANG6304BE36';
 let state='unpaid',calls=[],refreshes=0,encoded=[],deferred;
 const receipt=()=>({order_id:1,order_code:'IUH-1',status:'pending',payment_status:state,total_amount:105000,payos_status:state==='paid'?'paid':'pending',checkout_url:'https://pay.payos.vn/web/order_fixture123',qr_code:state==='paid'?null:qrCode});
 w.IUHCore={getClient:()=>({auth:{onAuthStateChange(){}},rpc:async()=>({data:false}),functions:{invoke:async(name,args)=>{calls.push(args.body);return deferred?new Promise(resolve=>{deferred=resolve;}):{data:receipt()};}}})};
 w.refreshPageData=()=>{refreshes++;};w.eval(fs.readFileSync('IUH shop/JS/vendor/qrcode.js','utf8'));
 const generator=w.qrcode;w.qrcode=(...args)=>{const qr=generator(...args),add=qr.addData;qr.addData=(data,mode)=>{encoded.push(data);add(data,mode);};return qr;};
 const tick=()=>new Promise(r=>setTimeout(r,0));
 try{
  w.eval(fs.readFileSync('IUH shop/JS/payos-orders.js','utf8'));w.IUHPayosOrders.open(1);await tick();
  const img=w.document.querySelector('#payosOrderFrame img');assert.ok(img);assert.match(img.src,/^data:image\/gif;base64,/);assert.equal(encoded[0],qrCode);assert.equal(w.document.querySelectorAll('iframe').length,0);assert.equal(calls[0].orderId,1);
  w.dispatchEvent(new w.MessageEvent('message',{origin:'https://pay.payos.vn',data:JSON.stringify({status:'PAID'})}));await tick();assert.equal(refreshes,0);
  state='paid';w.document.querySelector('[data-check]').click();await tick();assert.equal(refreshes,1);assert.match(w.document.querySelector('[data-status]').textContent,/Đã xác nhận/);assert.equal(w.document.querySelectorAll('#payosOrderFrame img').length,0);assert.equal(w.document.querySelector('[data-download]').hidden,true);
  w.document.querySelector('[data-close]').click();state='unpaid';deferred=true;w.IUHPayosOrders.open(2);await tick();w.document.querySelector('[data-close]').click();deferred({data:receipt()});await tick();assert.equal(w.document.querySelectorAll('#payosOrderFrame img').length,0);assert.equal(w.document.querySelector('dialog').open,false);
 }finally{w.close();}
});

test('Trial mode blocks PayOS order dialog before any Edge Function call',async()=>{
 const dom=new JSDOM('<body></body>',{url:'https://iuh-shop.vercel.app/HTML/donhang.html',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 let calls=0;
 w.IUHCore={getClient:()=>({auth:{onAuthStateChange(){}},rpc:async()=>({data:true}),functions:{invoke:async()=>{calls++;return{data:{}};}}})};
 try{
  w.eval(fs.readFileSync('IUH shop/JS/payos-orders.js','utf8'));w.IUHPayosOrders.open(42);await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(calls,0);assert.match(w.document.querySelector('[data-status]').textContent,/tắt trong chế độ chạy thử/i);assert.equal(w.document.querySelector('[data-check]').hidden,true);
 }finally{w.close();}
});
