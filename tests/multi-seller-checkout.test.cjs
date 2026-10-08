const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const {createDatabase}=require('./helpers/database.cjs');

test('One checkout splits sellers atomically and each order follows its own handoff and accounting',async()=>{
 const db=await createDatabase({ legacyCommerce: true });
 const [admin,buyer,a,b]=['501','502','503','504'].map(n=>'00000000-0000-4000-8000-000000000'+n);
 const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const scalar=async(sql,args=[])=>Object.values((await q(sql,args))[0])[0];
 const as=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const items=[{product_id:950,quantity:1},{product_id:951,quantity:1},{product_id:952,quantity:1}];
 const place=(key,{cart=items,total=63000,shipping=0,method='meet',payment='trial'}={})=>scalar("select public.create_checkout_orders('Buyer','0901234567','Cơ sở chính Nguyễn Văn Bảo','',$1,$2,$3,63000,$4,$5::jsonb,'{}',$6)",[method,shipping,payment,total,JSON.stringify(cart),key]);
 try {
  for(const id of [admin,buyer,a,b])await q('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.invalid']);
  await q("update public.users set role='admin' where user_id=$1",[admin]);
  await q("insert into public.products(id,seller_id,name,category,quantity,price) values(950,$1,'Book A','books',10,10000),(951,$1,'Book B','books',10,20000),(952,$2,'Book C','books',10,30000)",[a,b]);
  await as(buyer);const checkout=await place('multi-1');
  assert.equal(checkout.order_count,2);assert.equal(checkout.order_id,null);assert.equal(checkout.total_amount,63000);
  assert.deepEqual((await place('multi-1')).orders,checkout.orders);
  await assert.rejects(place('multi-1',{method:'mid',shipping:10000,total:73000}));
  await db.exec('reset role');
  assert.equal(Number(await scalar('select count(*) from public.orders')),2);
  assert.deepEqual((await q('select quantity from public.products order by id')).map(r=>r.quantity),[9,9,9]);
  const orderA=await scalar('select order_id from public.order_items where seller_id=$1 limit 1',[a]);
  const orderB=await scalar('select order_id from public.order_items where seller_id=$1 limit 1',[b]);
  assert.equal(Number(await scalar('select count(*) from public.order_items where order_id=$1',[orderA])),2);
  await as(a);assert.equal((await scalar('select public.get_my_orders()')).length,0);
  await as(admin);await q('select public.admin_confirm_order_payment($1,null)',[orderA]);
  await as(a);assert.equal((await scalar('select public.get_my_orders()')).length,1);
  await assert.rejects(q("select public.update_order_status($1,'shipping')",[orderB]));
  await q("select public.update_order_status($1,'shipping')",[orderA]);await q("select public.update_order_status($1,'delivered')",[orderA]);
  await as(admin);await q("select public.update_order_status($1,'completed')",[orderA]);
  assert.equal(await scalar('select status from public.orders where id=$1',[orderB]),'pending');
  await q('select public.admin_confirm_order_payment($1,null)',[orderB]);
  await as(b);await q("select public.update_order_status($1,'shipping')",[orderB]);await q("select public.update_order_status($1,'delivered')",[orderB]);
  await as(admin);await q("select public.update_order_status($1,'completed')",[orderB]);
  assert.equal(Number(await scalar("select sum(amount) from public.trial_financial_entries where kind='platform'")),3000);
  await as(buyer);assert.equal((await scalar('select public.get_my_orders()')).length,2);
  assert.equal(Number(await scalar("select count(*) from public.order_notifications where event='completed'")),2);
  // An error in a later child order must undo earlier stock reservations and orders.
  await assert.rejects(place('sold-out',{cart:[items[0],items[1],{product_id:952,quantity:99}]}));
  await assert.rejects(place('wrong-total',{total:1}));
  await db.exec('reset role');assert.equal(Number(await scalar('select count(*) from public.orders')),2);
  assert.deepEqual((await q('select quantity from public.products order by id')).map(r=>r.quantity),[9,9,9]);
  await as(buyer);const shipped=await place('multi-shipping',{method:'mid',shipping:10000,total:73000});
  assert.equal(shipped.shipping_fee,10000);assert.equal(shipped.orders.reduce((n,o)=>n+o.total_amount,0),73000);
  await db.exec('reset role');
  await q('insert into public.iuh_wallets(user_id,balance) values($1,40000) on conflict(user_id) do update set balance=40000',[buyer]);
  await as(buyer);await assert.rejects(place('wallet-short',{payment:'iuh_wallet'}));
  await db.exec('reset role');assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[buyer])),40000);
  assert.equal(Number(await scalar('select count(*) from public.orders')),4);
  assert.equal(await scalar("select has_function_privilege('anon','public.create_checkout_orders(text,text,text,text,text,numeric,text,numeric,numeric,jsonb,bigint[],text)','execute')"),false);
 }finally{await db.close();}
});

test('Checkout summary counts seller shipments and uses server-compatible item rounding',()=>{
 const dom=new JSDOM(fs.readFileSync('tests/fixtures/legacy-checkout.html','utf8'),{runScripts:'outside-only'}),w=dom.window,d=w.document;
 try{
  const listen=d.addEventListener.bind(d);d.addEventListener=(type,...args)=>{if(type!=='DOMContentLoaded')listen(type,...args);};
  w.supabase={createClient:()=>({auth:{onAuthStateChange(){}}})};
  w.eval(fs.readFileSync('IUH shop/JS/iuh-core.js','utf8'));
  const source=fs.readFileSync('IUH shop/JS/dathang.js','utf8');
  w.eval(source+`\ninitDOM();checkoutItems=[{id:1,seller_id:'a',price:10010,quantityInCart:2},{id:2,seller_id:'a',price:10000,quantityInCart:1},{id:3,seller_id:'b',price:20000,quantityInCart:1}];`);
  d.querySelector('input[name="shippingMethod"][value="mid"]').checked=true;
  assert.equal(w.getShippingFee(),10000);assert.equal(w.getBuyerSubtotal(),52522);
  w.updateSummary();assert.match(d.getElementById('checkoutSplitNote').textContent,/2 đơn/);
  d.querySelector('input[name="shippingMethod"][value="meet"]').checked=true;
  assert.equal(w.getShippingFee(),0);
  assert.match(source,/"create_checkout_orders"/);
 }finally{w.close();}
});
