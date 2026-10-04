const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../IUH shop');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const flush=()=>new Promise(resolve=>setTimeout(resolve,15));
function fixture(rpc,payos=async()=>({data:{}})){
 const dom=new JSDOM(read('HTML/taikhoan.html'),{url:'https://shop.invalid/HTML/taikhoan.html',runScripts:'outside-only'});
 const w=dom.window;w.alert=()=>{};w.confirm=()=>true;
 const client={auth:{getUser:async()=>({data:{user:{id:'user-a'}}})},rpc,functions:{invoke:async(name,options)=>{assert.equal(name,'payos-package');return payos(options.body);}}};
 w.supabase={createClient:()=>client};
 w.eval(read('JS/vendor/purify.min.js'));w.eval(read('JS/iuh-core.js'));w.eval(read('JS/service-package.js'));
 w.IUHServicePackage.setupModal(client);
 return {dom,w,client,el:id=>w.document.getElementById(id)};
}
test('Security helpers escape markup and remove active HTML',()=>{
 const f=fixture(async()=>({data:{}}));try{
  assert.equal(f.w.IUHSecurity.safeURL('javascript:alert(1)','fallback'),'fallback');
  const html=f.w.IUHSecurity.sanitizeHTML('<svg onload="evil()"></svg><img src=x onerror="evil()"><a href="javascript:evil()">x</a><iframe src=x></iframe><p><strong>safe</strong></p>');
  assert.doesNotMatch(html,/onerror|onload|javascript:|iframe|<svg/);assert.match(html,/<strong>safe<\/strong>/);
  assert.equal(f.w.IUHSecurity.escapeHTML('<img>'),'&lt;img&gt;');
 }finally{f.dom.window.close();}
});
test('Order checkout has no fake QR confirmation and opens the created PayOS order',()=>{
 const html=read('HTML/dathang.html'),script=read('JS/dathang.js');
 assert.doesNotMatch(html,/confirmPaymentBtn|qrtt\.png/);
 assert.doesNotMatch(html,/value="trial"/);
 assert.match(html,/value="qr"\s+checked/);
 assert.match(script,/get_iuh_trial_mode/);
 assert.match(script,/trialMode && paymentMethod !== "qr"/);
 assert.doesNotMatch(script,/qrPaymentConfirmed|pay_order_to_admin|function updateQR/);
 assert.match(script,/donhang\.html\?payos_order=/);
 assert.match(script,/sessionStorage\.removeItem\(storageKey\)/);
});
test('Package modal creates a PayOS link for the pending package request',async()=>{
 let calls=0,release;
 const f=fixture(async(name,args)=>{
  if(name==='get_iuh_trial_mode')return {data:false};
    if(name==='get_my_service_package')return {data:{package:null,members:[],pending_requests:[]}};
    if(name==='purchase_service_package'){assert.equal(args.p_payment_method,'bank');calls++;await new Promise(r=>release=r);return {data:{status:'pending',plan_type:'personal',transaction_code:args.p_transaction_code,price:19000,payment_method:'bank'}};}
  throw Error(name);
 },async body=>({data:{status:'pending',transaction_code:body.transaction,price:19000,payment_method:'bank',payos_order_code:2609270000001,payos_status:'pending',checkout_url:'https://pay.payos.vn/web/package_fixture_123'}}));
 try{
  f.el('openUpgradeModalButton').click();await flush();assert.equal(f.el('confirmUpgradeButton').disabled,false);
    f.el('confirmUpgradeButton').click();f.el('confirmUpgradeButton').click();
  await flush();assert.equal(calls,1);assert.equal(f.el('confirmUpgradeButton').disabled,true);
    release();await flush();assert.match(f.el('upgradeSuccessHeading').textContent,/hoàn tất thanh toán/i);assert.match(f.el('upgradeSuccessText').textContent,/webhook xác minh/i);
  assert.equal(f.el('upgradePayosCheckoutLink').href,'https://pay.payos.vn/web/package_fixture_123');assert.equal(f.el('checkUpgradePaymentButton').hidden,false);assert.equal(f.el('cancelUpgradePaymentButton').hidden,false);
  assert.equal(f.w.localStorage.length,1);
 }finally{f.dom.window.close();}
});
test('A server rejection unlocks package retry without retaining a completed attempt',async()=>{
 const f=fixture(async(name)=>name==='get_iuh_trial_mode'?{data:false}:name==='get_my_service_package'?{data:{package:null,members:[],pending_requests:[]}}:{error:{code:'P0001',message:'Số dư không đủ'}});
 try{f.el('openUpgradeModalButton').click();await flush();f.el('confirmUpgradeButton').click();await flush();assert.equal(f.el('confirmUpgradeButton').disabled,false);assert.match(f.el('upgradePaymentMessage').textContent,/Số dư/);assert.equal(f.w.localStorage.length,0);}finally{f.dom.window.close();}
});
test('A lost payment response preserves its transaction key for a safe retry',async()=>{
 const keys=[];const f=fixture(async(name,args)=>{
  if(name==='get_iuh_trial_mode')return {data:false};
  if(name==='get_my_service_package')return {data:{package:null,members:[],pending_requests:[]}};
  keys.push(args.p_transaction_code);return {error:{message:'Connection interrupted'}};
 });
 try{f.el('openUpgradeModalButton').click();await flush();f.el('confirmUpgradeButton').click();await flush();f.el('confirmUpgradeButton').click();await flush();assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert.equal(f.w.localStorage.length,1);}finally{f.dom.window.close();}
});
test('Signup and chat regression scenarios',()=>{
 const {execFileSync}=require('node:child_process');
 for(const file of ['test-social.cjs','test-chat.cjs'])execFileSync(process.execPath,[path.resolve(__dirname,'../audit',file)],{stdio:'pipe'});
});

test('Package QR choice sends a pending admin request without a free option or PayOS call',async()=>{
 let invoked=0,payosCalls=0;
 const f=fixture(async(name,args)=>{
  if(name==='get_iuh_trial_mode')return {data:true};
  if(name==='get_my_service_package')return {data:{package:null,members:[],pending_requests:[]}};
  invoked++;assert.equal(args.p_payment_method,'trial');return {data:{status:'pending',plan_type:'personal',transaction_code:args.p_transaction_code,price:19000,payment_method:'trial',expires_at:null}};
 },async()=>{payosCalls++;throw Error('PayOS must not run in trial mode');});
 try{
  f.el('openUpgradeModalButton').click();await flush();
  const methods=[...f.w.document.querySelectorAll('.payment-method')];
  assert.equal(methods.filter(button=>!button.hidden).length,1);
  assert.equal(methods.find(button=>button.dataset.method==='trial'),undefined);
  assert.equal(methods.find(button=>button.dataset.method==='wallet').hidden,true);
  assert.equal(methods.find(button=>button.dataset.method==='bank').hidden,false);
  assert.equal(methods.find(button=>button.dataset.method==='bank').getAttribute('aria-checked'),'true');
  assert.match(f.el('confirmUpgradeButton').textContent,/Xác nhận thanh toán/i);
  assert.match(f.el('upgradeTotal').textContent,/19\.000đ/);
  assert.match(f.el('upgradeConfirmAmount').textContent,/19\.000đ/);
  assert.match(f.w.document.querySelector('.service-plan-grid').textContent,/19\.000đ|29\.000đ/);
  f.el('confirmUpgradeButton').click();await flush();assert.equal(invoked,1);assert.equal(payosCalls,0);
  assert.match(f.el('upgradeSuccessHeading').textContent,/Yêu cầu đã được gửi/i);
  assert.match(f.el('upgradeSuccessText').textContent,/chờ admin duyệt/i);
  assert.equal(f.el('upgradeExpiryDate').textContent,'Chưa kích hoạt');
  assert.equal(f.el('upgradePayosCheckoutLink').hidden,true);
  assert.equal(f.w.localStorage.length,0);
 }finally{f.dom.window.close();}
});
