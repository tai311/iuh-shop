const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createDatabase } = require('./helpers/database.cjs');

test('Guest and ordinary buyer can read seller names while private profiles stay restricted', async () => {
    const db=await createDatabase();
    const ids=['401','402'].map(n=>'00000000-0000-4000-8000-000000000'+n);
    try {
        for(const id of ids) await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@test.invalid']);
        await db.query("update public.users set fullname='Seller Name' where user_id=$1",[ids[0]]);
        await db.exec('set role anon');
        assert.equal((await db.query('select fullname from public.public_profiles where user_id=$1',[ids[0]])).rows[0].fullname,'Seller Name');
        await db.exec('reset role');
        await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[1]]);
        await db.exec('set role authenticated');
        assert.equal((await db.query('select fullname from public.public_profiles where user_id=$1',[ids[0]])).rows[0].fullname,'Seller Name');
        assert.equal((await db.query('select * from public.users where user_id=$1',[ids[0]])).rows.length,0);
        await assert.rejects(db.query('select email from public.public_profiles'));
    } finally { await db.close(); }
});

test('Product list, detail and linked profile use public seller data for an ordinary viewer', async () => {
    const seller={user_id:'seller',fullname:'Người bán sách',avatar_url:'seller.png',role:'user',student_verified:true,bio:'Books'};
    const requests=[];
    const client={from(table){requests.push(table);let rows=table==='products'?[{id:1,seller_id:'seller',quantity:1},{id:2,seller_id:'seller',quantity:0}]:table==='public_profiles'?[seller]:[];
        const q={gt(column,value){rows=rows.filter(row=>row[column]>value);return q;},select(columns){if(table==='public_profiles')assert.doesNotMatch(columns,/\bemail\b|\bstudent_id\b/);return q;},eq(){return q;},in(){return q;},order(){return q;},maybeSingle:async()=>({data:rows[0]}),then(resolve){resolve({data:rows});}};return q;}};
    const nodes={};const node=id=>nodes[id]||=( {style:{},setAttribute(){}} );
    const context={supabaseClient:client,console:{log(){},warn(){},error(...args){throw Error(JSON.stringify(args));}},products:[],renderProducts(){},
        sellerName:node('sellerName'),sellerAvatar:node('sellerAvatar'),sellerVerifiedBadge:node('badge'),sellerProfileLink:node('link'),
        document:{getElementById:node},DEFAULT_PROFILE_AVATAR:'default.svg',resetSeller(){throw Error('Seller reset unexpectedly');}};
    vm.createContext(context);
    const evaluate=(file,start,end)=>{const s=fs.readFileSync('IUH shop/JS/'+file,'utf8');vm.runInContext(s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start))),context);};
    evaluate('sanpham.js','async function loadProducts()','async function updateHeaderAccount()');
    await context.loadProducts();assert.equal(context.products[0].users.fullname,seller.fullname);
    assert.deepEqual(Array.from(context.products,p=>p.id),[1]);
    evaluate('chitietsanpham.js','async function loadSeller(','async function loadProduct(');
    await context.loadSeller('seller');assert.equal(nodes.sellerName.textContent,seller.fullname);assert.equal(nodes.sellerAvatar.src,'seller.png');
    evaluate('trangcanhan.js','async function loadProfileUser(','function setupProfileOwnerUI(');
    await context.loadProfileUser('seller');assert.equal(nodes.profileName.textContent,seller.fullname);
    assert.equal(requests.filter(t=>t==='public_profiles').length,3);assert.ok(!requests.includes('users'));
});
