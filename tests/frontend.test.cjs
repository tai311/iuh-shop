const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../IUH shop');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const flush=()=>new Promise(resolve=>setTimeout(resolve,15));
function fixture(rpc){
 const dom=new JSDOM(read('HTML/taikhoan.html'),{url:'https://shop.invalid/HTML/taikhoan.html',runScripts:'outside-only'});
 const w=dom.window;w.alert=()=>{};w.confirm=()=>true;
 const client={auth:{getUser:async()=>({data:{user:{id:'user-a'}}})},rpc};
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
  if(name==='purchase_service_package'){calls++;await new Promise(r=>release=r);pending=true;return {data:{status:'pending',plan_type:'personal',transaction_code:args.p_transaction_code,price:19000}};}
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
