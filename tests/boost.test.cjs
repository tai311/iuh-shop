const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const { createDatabase } = require('./helpers/database.cjs');

test('Boost publishes for 24 hours and records 3000 once without charging a wallet', async () => {
    const db = await createDatabase();
    const [admin, seller, other] = ['301','302','303'].map(n => '00000000-0000-4000-8000-000000000' + n);
    const q = async (sql, args = []) => (await db.query(sql,args)).rows;
    const scalar = async (sql,args=[]) => Object.values((await q(sql,args))[0])[0];
    const as = async id => { await db.exec('reset role'); await q("select set_config('request.jwt.claim.sub',$1,false)",[id]); await db.exec('set role authenticated'); };
    const create = (key, boost=true, price=10000, owner=seller) => scalar("select public.create_product_with_boost('Book','books',1,$1,'Book description',$2::jsonb,$3,$4)", [price,JSON.stringify(['https://xecxofmogvqysejjpxvl.supabase.co/storage/v1/object/public/products/'+owner+'/test.jpg']),boost,key]);
    try {
        for(const id of [admin,seller,other]) await q('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.invalid']);
        await q("update public.users set terms_accepted=true");
        await q("update public.users set role='admin' where user_id=$1",[admin]);
        await as(seller);
        const first=await create('boost-test-1');
        assert.equal(first.boost_fee,3000);
        assert.equal((await create('boost-test-1')).id,first.id);
        await assert.rejects(create('boost-test-1',true,20000));
        for(const price of ['NaN','Infinity',-1]) await assert.rejects(create('bad-price',true,price));
        await assert.rejects(q('select public.record_boost_qr_payment()'));
        await assert.rejects(q('select public.pay_boost_fee()'));
        await as(other); await assert.rejects(create('stolen-image'));
        await as(admin);
        const rows=await q("select * from public.trial_financial_entries where kind='boost'");
        assert.equal(rows.length,1); assert.equal(Number(rows[0].amount),3000);
        assert.match(rows[0].title,/Phí đẩy tin/);
        const product=(await q('select * from public.products where id=$1',[first.id]))[0];
        assert.equal(product.is_boosted,true);
        assert.equal(new Date(product.boost_expires_at)-new Date(product.boost_started_at),86400000);
        assert.equal(Number(await scalar('select count(*) from public.wallet_transactions')),0);
        await as(seller); const plain=await create('plain-test',false);
        assert.equal(plain.boost_fee,0);
        await as(admin); await q('select public.set_iuh_trial_mode(false)');
        await as(seller); await assert.rejects(create('paid-test'));
        assert.equal((await create('boost-test-1')).id,first.id);
        await db.exec('reset role');
        assert.equal(Number(await scalar("select count(*) from public.trial_financial_entries where kind='boost'")),1);
        assert.equal(Number(await scalar('select count(*) from public.products')),2);
        await q('insert into public.iuh_wallets(user_id,balance) values($1,10000) on conflict(user_id) do update set balance=10000',[seller]);
        await as(seller); await create('paid-test');
        await db.exec('reset role');
        assert.equal(Number(await scalar('select balance from public.iuh_wallets where user_id=$1',[seller])),7000);
        assert.equal(Number(await scalar("select count(*) from public.wallet_transactions where type='sale'")),1);
        assert.equal(Number(await scalar("select count(*) from public.trial_financial_entries where kind='boost'")),1);
    } finally { await db.close(); }
});

test('Posting UI uses the atomic RPC and reuses the uploaded request after a lost response', async () => {
    const dom=new JSDOM(fs.readFileSync('IUH shop/HTML/dangtin.html','utf8'),{runScripts:'outside-only',url:'https://shop.invalid/HTML/dangtin.html'});
    const w=dom.window, d=w.document, calls=[];
    const source=fs.readFileSync('IUH shop/JS/dangtin.js','utf8');
    let uploads=0;
    w.currentUser={id:'seller'};
    w.boostProductEl=d.getElementById('boostProduct'); w.boostProductEl.checked=true;
    d.getElementById('productName').value='Book';
    const category=d.getElementById('productCategory'); category.value=category.options[1].value;
    d.getElementById('productQuantity').value=1;
    w.productPriceInput={value:'10000'}; w.description={value:'Book description'};
    w.selectedFiles=[{}]; w.uploadImages=async()=>{uploads++;return ['https://image.invalid/test.jpg'];};
    w.calculatePlatformFee=()=>500;w.formatVND=String;
    w.supabaseClient={rpc:async(name,args)=>{assert.equal(name,'create_product_with_boost');calls.push({...args});if(calls.length===1)throw Error('Lost response');return {data:{success:true,id:41}};}};
    const fn=source.slice(source.indexOf('async function createProduct()'),source.indexOf('async function submitProductForReal()'));
    // End the comment separating the two declarations.
    w.eval(fn);
    try {
        await assert.rejects(w.createProduct(),/Lost response/);
        assert.equal((await w.createProduct()).id,41);
        assert.equal(uploads,1);assert.equal(JSON.stringify(calls[0]),JSON.stringify(calls[1]));
        assert.equal(calls[0].p_boost,true);assert.equal(w.sessionStorage.length,0);
        assert.doesNotMatch(source,/rpc\("(?:record_boost_qr_payment|pay_boost_fee)"/);
        assert.doesNotMatch(d.getElementById('boostPaymentModal').textContent,/mô phỏng|chạy thử/i);
        assert.equal(d.querySelector('.fake-qr'),null);
    } finally { w.close(); }
});

test('Boost confirmation submits once even when clicked twice', async () => {
    const dom=new JSDOM(fs.readFileSync('IUH shop/HTML/dangtin.html','utf8'),{runScripts:'outside-only',url:'https://shop.invalid/HTML/dangtin.html'});
    const w=dom.window,d=w.document;
    const source=fs.readFileSync('IUH shop/JS/dangtin.js','utf8');
    w.currentUser={id:'seller'};w.submitProduct=d.getElementById('submitProduct');
    w.submitText=null;w.submitLoading=null;w.showToast=()=>{};
    let submissions=0,finish;
    w.createProduct=()=>{submissions++;return new Promise(resolve=>{finish=resolve;});};
    w.supabaseClient={rpc:async()=>({data:true})};
    w.eval(source.slice(source.indexOf('const boostProductEl ='),source.indexOf('async function createProduct()')) + '\n' +
        source.slice(source.indexOf('async function submitProductForReal()'),source.indexOf('function openModal(')));
    try {
        d.getElementById('boostProduct').checked=true;
        await w.processBoostPayment();
        assert.match(d.getElementById('boostPaymentStatus').textContent,/Không cần chuyển khoản/);
        const button=d.getElementById('confirmBoost');button.click();button.click();
        assert.equal(submissions,1);assert.equal(button.disabled,true);
        finish({id:41});await new Promise(resolve=>setTimeout(resolve,0));
    } finally { w.close(); }
});
