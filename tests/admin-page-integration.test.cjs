const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
test('Real admin page loads approval module and routes orders/packages without leaking advertisements',async()=>{
 const html=fs.readFileSync('IUH shop/HTML/admin.html','utf8');
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/HTML/admin.html'}),w=dom.window,d=w.document;
 const calls=[];
 const db={auth:{onAuthStateChange(){},getUser:async()=>({data:{user:{id:'admin'}}})},from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{role:'admin'}})}),rpc:async(name,args)=>{calls.push({name,args});return {data:{rows:[],total:0,counts:{}}};}};
 w.supabase={createClient:()=>db};
 // Suppress page startup requests; exercise the actual navigation and approval scripts.
 const listen=d.addEventListener.bind(d);d.addEventListener=(type,...args)=>{if(type!=='DOMContentLoaded')listen(type,...args);};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 try{
  for(const script of d.querySelectorAll('script[src]')){
   const src=script.getAttribute('src');if(!src.startsWith('../JS/') || src.includes('vendor/supabase.min.js'))continue;
   w.eval(fs.readFileSync(path.resolve('IUH shop/HTML',src.split('?')[0]),'utf8'));
  }
  assert.ok(w.IUHAdminRequests,'HTML must load the approval module');
  assert.ok(d.querySelector('link[href*="admin-operations.css"]'));
  assert.equal(d.querySelector('.advertising-overview').closest('.admin-page').id,'page-advertising');
  assert.equal(d.querySelector('#advertisingList').closest('.admin-page').id,'page-advertising');
  for(const [kind,title] of [['orders','Đơn hàng'],['packages','Gói dịch vụ']]){
   d.querySelector(`.admin-nav-item[data-page="${kind}"]`).click();
   await new Promise(r=>setTimeout(r,10));
   assert.equal(d.querySelectorAll('.admin-page.active').length,1);
   assert.equal(d.querySelector('.admin-page.active').id,'page-requests');
   assert.equal(d.querySelector('.admin-nav-item.active').dataset.page,kind);
   assert.equal(d.querySelector('#pageTitle').textContent,title);
   assert.equal(calls.at(-1).args.p_kind,kind);
   assert.equal(d.querySelector('#page-advertising').classList.contains('active'),false);
  }
 }finally{w.close();}
});
