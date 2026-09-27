const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../IUH shop');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const flush=()=>new Promise(resolve=>setTimeout(resolve,15));
function fixture(rpc){
 const dom=new JSDOM(read('HTML/taikhoan.html'),{url:'https://shop.invalid/HTML/taikhoan.html',runScripts:'outside-only'});
 const w=dom.window;w.alert=()=>{};w.confirm=()=>true;
 const client={auth:{getUser:async()=>({data:{user:{id:'user-a'}}})},rpc,functions:{invoke:async(name,options)=>{assert.equal(name,'payos-package');return rpc(name,options.body);}}};
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
test('Package modal submits one bank request and never labels pending payment as activated',async()=>{
 let calls=0,release;let pending=false;
 const f=fixture(async(name,args)=>{
  if(name==='get_my_service_package')return {data:{package:null,members:[],pending_requests:pending?[{transaction_code:'pending-bank',price:19000}]:[]}};
  if(name==='payos-package'){assert.equal(args.action,'create');calls++;await new Promise(r=>release=r);pending=true;return {data:{status:'pending',plan_type:'personal',transaction_code:args.transaction,price:19000,payos_status:'pending',checkout_url:'https://pay.payos.vn/web/fixture12345'}};}
  throw Error(name);
 });
 try{
  f.el('openUpgradeModalButton').click();await flush();assert.equal(f.el('confirmUpgradeButton').disabled,false);
  f.w.document.querySelector('[data-method="bank"]').click();f.el('confirmUpgradeButton').click();f.el('confirmUpgradeButton').click();
  await flush();assert.equal(calls,1);assert.equal(f.el('confirmUpgradeButton').disabled,true);
  release();await flush();assert.match(f.el('upgradeSuccessHeading').textContent,/chờ xác nhận/);assert.equal(f.el('upgradeExpiryDate').textContent,'Chưa kích hoạt');
  assert.equal(f.w.localStorage.length,0);
 }finally{f.dom.window.close();}
});
test('A server rejection unlocks package retry without retaining a completed attempt',async()=>{
 const f=fixture(async name=>name==='get_my_service_package'?{data:{package:null,members:[],pending_requests:[]}}:{error:{code:'P0001',message:'Số dư không đủ'}});
 try{f.el('openUpgradeModalButton').click();await flush();f.el('confirmUpgradeButton').click();await flush();assert.equal(f.el('confirmUpgradeButton').disabled,false);assert.match(f.el('upgradePaymentMessage').textContent,/Số dư/);assert.equal(f.w.localStorage.length,0);}finally{f.dom.window.close();}
});
test('A lost payment response preserves its transaction key for a safe retry',async()=>{
 const keys=[];const f=fixture(async(name,args)=>{
  if(name==='get_my_service_package')return {data:{package:null,members:[],pending_requests:[]}};
  keys.push(args.p_transaction_code);return {error:{message:'Connection interrupted'}};
 });
 try{f.el('openUpgradeModalButton').click();await flush();f.el('confirmUpgradeButton').click();await flush();f.el('confirmUpgradeButton').click();await flush();assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert.equal(f.w.localStorage.length,1);}finally{f.dom.window.close();}
});
test('Signup and chat regression scenarios',()=>{
 const {execFileSync}=require('node:child_process');
 for(const file of ['test-social.cjs','test-chat.cjs'])execFileSync(process.execPath,[path.resolve(__dirname,'../audit',file)],{stdio:'pipe'});
});

test('Embedded payOS stays in the modal and only server confirmation activates a package',async()=>{
 let checks=0,paid=false,config,exits=0;
 const receipt={status:'pending',plan_type:'personal',transaction_code:'IUH-embedded-test',price:19000,payos_status:'pending',checkout_url:'https://pay.payos.vn/web/fixture12345'};
 const f=fixture(async(name,args)=>{
  if(name==='get_my_service_package')return {data:{package:null,members:[],pending_requests:[]}};
  if(name==='payos-package'){if(args.action==='status')checks++;return {data:{...receipt,status:paid?'paid':'pending',payos_status:paid?'paid':'pending'}};}
 });
 f.w.PayOSCheckout={usePayOS:value=>{config=value;return {open(){const frame=f.w.document.createElement('iframe');frame.src='about:blank';f.el(value.ELEMENT_ID).append(frame);},exit(){exits++;f.el(value.ELEMENT_ID).replaceChildren();}};}};
 try{
  f.el('openUpgradeModalButton').click();await flush();f.w.document.querySelector('[data-method=bank]').click();f.el('confirmUpgradeButton').click();await flush();
  assert.equal(config.embedded,true);assert.equal(config.RETURN_URL,'https://shop.invalid/HTML/taikhoan.html');assert.equal(f.el('payosEmbeddedCheckout').querySelectorAll('iframe').length,1);
  config.onSuccess({status:'PAID'});await flush();assert.equal(checks,1);assert.match(f.el('upgradeSuccessHeading').textContent,/chờ xác nhận/);assert.equal(f.el('payosEmbeddedCheckout').querySelectorAll('iframe').length,1);
  const stale=config;f.el('finishUpgradeButton').click();assert.equal(f.el('payosEmbeddedCheckout').children.length,0);stale.onSuccess({status:'PAID'});await flush();assert.equal(checks,1);
  f.el('openUpgradeModalButton').click();await flush();f.w.document.querySelector('[data-method=bank]').click();f.el('confirmUpgradeButton').click();await flush();
  paid=true;config.onSuccess({status:'PAID'});await flush();assert.equal(checks,2);assert.match(f.el('upgradeSuccessHeading').textContent,/đã được kích hoạt/);assert.equal(f.el('payosEmbeddedCheckout').children.length,0);assert.equal(f.el('payosPackageActions').hidden,true);assert.ok(exits>=2);
 }finally{f.dom.window.close();}
});

test('Closing while checkout SDK is loading cannot reopen an old payment',async()=>{
 let opened=0;
 const f=fixture(async(name,args)=>name==='get_my_service_package'?{data:{package:null,members:[],pending_requests:[]}}:{data:{status:'pending',plan_type:'personal',transaction_code:args.transaction,price:19000,checkout_url:'https://pay.payos.vn/web/fixture12345'}});
 try{
  f.el('openUpgradeModalButton').click();await flush();f.w.document.querySelector('[data-method=bank]').click();f.el('confirmUpgradeButton').click();await flush();
  const script=f.w.document.querySelector('script[src*="payos-initialize"]');assert.ok(script);
  f.el('finishUpgradeButton').click();f.w.PayOSCheckout={usePayOS:()=>({open(){opened++;},exit(){}})};script.dispatchEvent(new f.w.Event('load'));await flush();
  assert.equal(opened,0);assert.equal(f.el('payosEmbeddedCheckout').children.length,0);
 }finally{f.dom.window.close();}
});

test('Checkout SDK load errors allow retry without creating a second payment',async()=>{
 let purchases=0;
 const f=fixture(async(name,args)=>{if(name==='get_my_service_package')return {data:{package:null,members:[],pending_requests:[]}};purchases++;return {data:{status:'pending',plan_type:'personal',transaction_code:args.transaction,price:19000,checkout_url:'https://pay.payos.vn/web/fixture12345'}};});
 try{
  f.el('openUpgradeModalButton').click();await flush();f.w.document.querySelector('[data-method=bank]').click();f.el('confirmUpgradeButton').click();await flush();
  f.w.document.querySelector('script[src*="payos-initialize"]').dispatchEvent(new f.w.Event('error'));await flush();assert.equal(f.el('payosReloadCheckout').hidden,false);assert.equal(f.el('payosCheckoutLink').hidden,false);
  f.w.PayOSCheckout={usePayOS:config=>({open(){f.el(config.ELEMENT_ID).append(f.w.document.createElement('iframe'));},exit(){f.el(config.ELEMENT_ID).replaceChildren();}})};
  f.el('payosReloadCheckout').click();await flush();assert.equal(purchases,1);assert.equal(f.el('payosEmbeddedCheckout').querySelectorAll('iframe').length,1);
 }finally{f.dom.window.close();}
});
