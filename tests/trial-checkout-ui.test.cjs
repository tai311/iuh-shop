const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
test('Checkout prioritizes the four campus pickup locations',()=>{
 const dom=new JSDOM(fs.readFileSync('tests/fixtures/legacy-checkout.html','utf8'));
 const d=dom.window.document, select=d.querySelector('#recipientAddress');
 assert.equal(d.querySelector('.checkout-form select, .checkout-form input'),select);
 assert.equal(select.required,true);
 assert.deepEqual([...select.options].slice(1).map(o=>o.value),['Cơ sở chính Nguyễn Văn Bảo','Cơ sở Nguyễn Văn Dung','Cơ sở Phạm Văn Chiêu','Sân vận động Đạt Đức']);
 dom.window.close();
});
test('QR is the visible choice and trial checkout records a safe order without opening PayOS',()=>{
 const dom=new JSDOM(fs.readFileSync('tests/fixtures/legacy-checkout.html','utf8'),{runScripts:'outside-only'}),w=dom.window,d=w.document;
 try{
  assert.equal(d.querySelector('input[name="paymentMethod"]:checked').value,'qr');
  assert.equal(d.querySelector('[data-payment-method="qr"]').hidden,false);
  assert.equal(d.querySelector('[data-payment-method="trial"]'),null);
  assert.equal(d.getElementById('trialPaymentBox'),null);
  const listen=d.addEventListener.bind(d);d.addEventListener=(type,...args)=>{if(type!=='DOMContentLoaded')listen(type,...args);};
  w.supabase={createClient:()=>({auth:{onAuthStateChange(){}}})};
  const source=fs.readFileSync('IUH shop/JS/dathang.js','utf8');
  w.eval(source+'\ncurrentUser={id:"buyer"}; initDOM(); window.testOrder=buildOrder(); updatePaymentUI();');
  assert.equal(w.testOrder.payment_method,'trial');
  assert.match(d.getElementById('paymentVerificationStatus').textContent,/Bấm xác nhận thanh toán/);
  assert.match(source,/!trialMode && paymentMethod === "qr" && data.order_id/);
 }finally{w.close();}
});
test('Admin approves trial payment, waits for seller delivery, then completes the order',async()=>{
 const dom=new JSDOM('<aside class="admin-sidebar"><nav></nav></aside><main></main>',{runScripts:'outside-only',url:'http://localhost/HTML/admin.html'}),w=dom.window;
 const row={id:'21',status:'pending',payment_status:'unpaid',payment_method:'trial'},calls=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'admin'}}}),onAuthStateChange(){}},from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{role:'admin'}})}),rpc:async(name,args)=>{
  if(name==='admin_operations_list')return{data:{rows:[{...row,code:'FREE-21'}],total:1,counts:{orders:1}}};
  if(name==='admin_operation_detail')return{data:{record:{...row},people:[],items:[],history:[]}};
  calls.push({name,args});
  if(name==='admin_confirm_order_payment'){row.status='confirmed';row.payment_status='paid';row.payment_approved_at='2026-10-04';}
  else if(name==='update_order_status')row.status=args.p_new_status;
  else throw Error(name);
  return{data:{success:true}};
 }};
 w.IUHCore={getClient:()=>db};w.IUHSecurity={escapeHTML:s=>String(s??'')};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.eval(fs.readFileSync('IUH shop/JS/admin-requests.js','utf8'));
 const tick=()=>new Promise(r=>setTimeout(r,10));
 try{
  await w.IUHAdminRequests.load();w.document.querySelector('[data-detail]').click();await tick();
  assert.equal(w.document.getElementById('opsReference'),null);
  let form=w.document.getElementById('opsAction');assert.match(form.textContent,/người bán/);
  form.querySelector('input[type=checkbox]').checked=true;form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));await tick();
  assert.equal(calls[0].name,'admin_confirm_order_payment');assert.equal(calls[0].args.p_reference,null);
  assert.equal(w.document.getElementById('opsOrderAction'),null);
  row.status='shipping';w.document.querySelector('[data-detail]').click();await tick();
  assert.equal(w.document.getElementById('opsOrderAction'),null);
  row.status='delivered';w.document.querySelector('[data-detail]').click();await tick();
  form=w.document.getElementById('opsOrderAction');assert.equal(form.dataset.next,'completed');assert.match(form.textContent,/Xác nhận đơn hàng hoàn thành/);
  form.querySelector('input[type=checkbox]').checked=true;form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));await tick();
  assert.equal(calls[1].args.p_new_status,'completed');assert.equal(w.document.getElementById('opsOrderAction'),null);
 }finally{w.close();}
});
