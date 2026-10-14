const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDatabase}=require('./helpers/database.cjs');

test('price offers enforce 60 percent, seller responses and counteroffer confirmation',async()=>{
 const db=await createDatabase();
 const [buyer,seller,outsider]=[901,902,903].map(n=>'00000000-0000-4000-8000-000000000'+n);
 const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const as=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
 try{
  for(const id of [buyer,seller,outsider])await q('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.invalid']);
  await q("insert into public.products(id,seller_id,name,category,quantity,price,status) values(9901,$1,'Sách cũ','books',3,35000,'active')",[seller]);
  await as(buyer);
  const offer=await q('select public.submit_price_offer(9901,21000) result');
  assert.equal(offer[0].result.minimum_price,21000);
  await assert.rejects(q('select public.submit_price_offer(9901,20999)'));
  await db.exec('reset role');
  await as(outsider);await assert.rejects(q("select public.respond_price_offer(1,'accept',null)"));
  await as(seller);
  assert.equal(Number((await q("select count(*) from public.price_offer_notifications where user_id=$1 and event='offer_received'",[seller]))[0].count),1);
  await q("select public.respond_price_offer(1,'counter',24000)");
  await assert.rejects(q("select public.respond_price_offer(1,'accept',null)"));
  await db.exec('reset role');
  await as(buyer);await q('select public.accept_counter_price_offer(1)');
  assert.equal(Number((await q('select offer_price from public.price_offers where id=1'))[0].offer_price),24000);
  await db.exec('reset role');
  await as(buyer);await q('select public.submit_price_offer(9901,21000)');
  await db.exec('reset role');
  await as(seller);await q("select public.respond_price_offer(2,'counter',24000)");
  await db.exec('reset role');
  await as(buyer);await q('select public.reject_counter_price_offer(2)');
  assert.equal((await q('select status from public.price_offers where id=2'))[0].status,'rejected');
  await db.exec('reset role');
  assert.equal((await q("select has_function_privilege('anon','public.submit_price_offer(bigint,numeric)','execute')"))[0].has_function_privilege,false);
 }finally{await db.close()}
});
