const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createDatabase}=require('./helpers/database.cjs');
test('Admin operations: role boundary, private detail, filters and pagination',async()=>{
 const db=await createDatabase(),admin='00000000-0000-4000-8000-000000000011',buyer='00000000-0000-4000-8000-000000000012',seller='00000000-0000-4000-8000-000000000013';
 const q=async(s,a=[])=>(await db.query(s,a)).rows;
 const scalar=async(s,a=[])=>Object.values((await q(s,a))[0])[0];
 const as=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 try{
  for(const [id,role,name] of [[admin,'admin','Admin'],[buyer,'user','An'],[seller,'user','Bình']]){await q('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.invalid']);await q('update public.users set role=$2,fullname=$3 where user_id=$1',[id,role,name]);}
  await q("insert into public.products(id,seller_id,name,category,quantity,price) values(1,$1,'Book','books',30,100000)",[seller]);
    await as(admin);await q('select public.set_iuh_trial_mode(false)');
  await as(buyer);
  for(let i=0;i<23;i++)await q("select public.create_order('Recipient','0901234567','PRIVATE ADDRESS','', 'meet',0,'qr',1,105000,'[{\"product_id\":1,\"quantity\":1,\"price\":1}]','{}',$1)",['ops-order-'+i]);
  await assert.rejects(q('select public.admin_operations_list()'),/quản trị viên/);
  await assert.rejects(q("select public.admin_operation_detail('orders','1')"),/quản trị viên/);
  assert.equal(await scalar('select count(*)::int from public.admin_operation_summaries'),0);
  await as(admin);
  let list=await scalar('select public.admin_operations_list()');assert.equal(list.total,23);assert.equal(list.rows.length,20);assert.equal(list.counts.orders,23);
  assert.ok(!JSON.stringify(list).includes('PRIVATE ADDRESS'));assert.ok(!JSON.stringify(list).includes('recipient_phone'));
  const next=await scalar("select public.admin_operations_list('orders','','','',2)");assert.equal(next.rows.length,3);assert.equal(new Set([...list.rows,...next.rows].map(r=>r.id)).size,23);
  const d=await scalar("select public.admin_operation_detail('orders',$1)",[list.rows[0].id]);assert.equal(d.record.recipient_address,'PRIVATE ADDRESS');assert.equal(d.people[0].fullname,'An');assert.equal(d.items[0].seller_name,'Bình');assert.equal(d.payouts[0].amount,100000);assert.ok(d.history.length);assert.ok(!JSON.stringify(d).includes('password_hash'));
  await q("select public.admin_confirm_order_payment($1,'OPS-BANK-01')",[list.rows[0].id]);
  list=await scalar("select public.admin_operations_list('orders','','paid','An')");assert.equal(list.total,1);
  assert.equal((await scalar("select public.admin_operation_detail('orders',$1)",[list.rows[0].id])).receipts[0].reference,'OPS-BANK-01');
  assert.equal((await scalar("select public.admin_operations_list('orders','','','%')")).total,0);
  await assert.rejects(q("select public.admin_operations_list('bad')"));await assert.rejects(q("select public.admin_operations_list('orders','','','',0)"));
  for(const k of ['packages','wallet_requests','bank_refund_requests','contact_requests','product_reports','user_reports','verification','donations'])assert.ok(Array.isArray((await scalar('select public.admin_operations_list($1)',[k])).rows));
  await db.exec('reset role');await q("update public.users set role='moderator' where user_id=$1",[seller]);await as(seller);await assert.rejects(q('select public.admin_operations_list()'),/quản trị viên/);
  await db.exec('reset role;set role anon');await assert.rejects(q('select public.admin_operations_list()'),/permission denied/);
 }finally{await db.close();}
});

test('Admin UI rejects ordinary users, escapes content and discards stale responses',async()=>{
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<aside class="admin-sidebar"><nav></nav></aside><main></main>',{runScripts:'outside-only',url:'http://localhost/HTML/admin.html'}),w=dom.window;
 let role='user',onAuth,detailCalls=0,pending=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'admin'}}}),onAuthStateChange:cb=>{onAuth=cb;}},from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{role}})}),rpc:(name,args)=>name==='admin_operations_list'?new Promise(resolve=>pending.push({resolve,args})):(detailCalls++,Promise.resolve({data:{record:{id:'1',status:'pending',payment_status:'unpaid',payment_method:'qr',recipient_name:'Recipient',recipient_address:'PRIVATE ADDRESS'},people:[],items:[],history:[]}}))};
 w.IUHCore={getClient:()=>db};w.IUHSecurity={escapeHTML:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.eval(fs.readFileSync('IUH shop/JS/admin-requests.js','utf8'));
 const tick=()=>new Promise(r=>setTimeout(r,0)),$=id=>w.document.getElementById(id);
 const result=code=>({data:{rows:[{id:'1',code,actor_name:'<img src=x onerror=alert(1)>',status:'pending',payment_status:'unpaid',payment_method:'qr',amount:105000}],total:1,counts:{orders:1}}});
 try{
  await w.IUHAdminRequests.load();assert.equal(pending.length,0);assert.match($('opsStatus').textContent,/Chỉ tài khoản admin/);
  role='admin';const first=w.IUHAdminRequests.load();await tick();const second=w.IUHAdminRequests.load();await tick();pending[1].resolve(result('NEW'));await second;pending[0].resolve(result('OLD'));await first;assert.match($('opsList').textContent,/NEW/);assert.ok(!$('opsList').textContent.includes('OLD'));assert.equal($('opsList').querySelectorAll('img').length,0);assert.equal(detailCalls,0);
  $('opsList').querySelector('button').click();await tick();assert.equal(detailCalls,1);assert.match($('opsDetail').textContent,/PRIVATE ADDRESS/);
  assert.equal($('opsOrderAction'),null);$('opsAction').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.match($('opsActionStatus').textContent,/Nhập mã giao dịch/);assert.equal(detailCalls,1);
  $('opsClose').click();assert.equal($('opsDetail').textContent,'');
  const third=w.IUHAdminRequests.load();await tick();onAuth('SIGNED_OUT');pending[2].resolve(result('STALE'));await third;assert.equal($('opsList').textContent,'');assert.equal($('opsDetail').textContent,'');
 }finally{w.close();}
});

test('Admin UI can revoke an active package and cancel an eligible order with reasons',async()=>{
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<aside class="admin-sidebar"><nav></nav></aside><main></main>',{runScripts:'outside-only',url:'http://localhost/HTML/admin.html'}),w=dom.window;
 let kind='orders',revoked=false,cancelled=false;
 const orderRow={id:'21',order_code:'IUH-21',status:'pending',payment_status:'unpaid',payment_method:'qr',total_amount:105000,needs_payment_review:false};
 const packageRow={id:'31',transaction_code:'pkg-admin-review-001',status:'paid',payment_status:'paid',payment_method:'bank',package_id:'package-31',price:19000};
 const db={
  auth:{getUser:async()=>({data:{user:{id:'admin'}}}),onAuthStateChange:()=>{}},
  from(table){let value;return{select(){return this;},eq(column){value=column==='id'?'package-31':value;return this;},single:async()=>({data:table==='users'?{role:'admin'}:table==='service_package_payments'?{}:{status:revoked?'cancelled':'active'}}),order:async()=>({data:revoked?[{action:'revoked',reason:'Đối soát phát hiện vi phạm',actor_id:'admin',created_at:new Date().toISOString()}]:[],error:null})};},
  rpc:async(name,args)=>{
   if(name==='admin_operations_list')return{data:{rows:[kind==='packages'?{id:'31',code:'pkg-admin-review-001',status:'paid',payment_status:'paid',payment_method:'bank',amount:19000}:{id:'21',code:'IUH-21',status:'pending',payment_status:'unpaid',payment_method:'qr',amount:105000}],total:1,counts:{}}};
   if(name==='admin_operation_detail')return{data:{record:args.p_kind==='packages'?{...packageRow}:{...orderRow},people:[],items:[],history:[]}};
   if(name==='admin_revoke_service_package'){revoked=true;return{data:{success:true}};}
   if(name==='admin_cancel_order'){cancelled=true;return{data:{success:true}};}
   throw Error(name);
  }
 };
 w.IUHCore={getClient:()=>db};w.IUHSecurity={escapeHTML:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.eval(fs.readFileSync('IUH shop/JS/admin-requests.js','utf8'));
 const tick=()=>new Promise(resolve=>setTimeout(resolve,5)),page=w.document.getElementById('page-requests');
 try{
  page.querySelector('[data-kind="packages"]').click();await tick();page.querySelector('[data-detail]').click();await tick();await tick();
  const revoke= w.document.getElementById('opsRevokePackageForm');assert.ok(revoke);revoke.querySelector('textarea').value='Đối soát phát hiện vi phạm';revoke.querySelector('input[type=checkbox]').checked=true;revoke.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();assert.equal(revoked,true);
  w.document.getElementById('opsClose').click();kind='orders';page.querySelector('[data-kind="orders"]').click();await tick();page.querySelector('[data-detail]').click();await tick();await tick();
  const cancel=w.document.getElementById('opsCancelOrderForm');assert.ok(cancel);cancel.querySelector('textarea').value='Đơn bị tạo trùng';cancel.querySelector('input[type=checkbox]').checked=true;cancel.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();assert.equal(cancelled,true);
 }finally{w.close();}
});
