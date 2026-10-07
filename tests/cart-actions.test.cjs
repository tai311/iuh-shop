const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../IUH shop/JS/cart-actions.js'), 'utf8');
function fixture(options = {}) {
    const state = { product: { id: 7, seller_id: 'seller', status: 'active', quantity: 3 }, item: null, writes: [], queries: [], ...options };
    const client = { auth: { getUser: async () => ({ data: { user: state.guest ? null : { id: 'buyer' } }, error: state.authError }) }, from(table) {
        let action = 'read', values, filters = {};
        const q = { select() { return q; }, eq(k,v) { filters[k] = v; return q; }, update(v) { action='update'; values=v; return q; }, insert(v) { action='insert'; values=v; return q; }, async maybeSingle() {
            state.queries.push({ table, action, filters: {...filters} });
            if (table === 'products') return { data: state.product, error: state.productError };
            if (action === 'read') return { data: state.item && {...state.item}, error: state.readError };
            state.writes.push({ action, values, filters });
            if (state.writeError) return { error: state.writeError };
            if (state.conflictOnce) { state.conflictOnce = false; state.item = { id: 9, quantity: 1 }; return action === 'insert' ? { error: { code: '23505' } } : { data: null }; }
            if (state.noRows) return { data: null };
            state.item = { id: 9, ...values };
            return { data: state.item };
        }};
        return q;
    }};
    const window = { navigator: {}, dispatchEvent() {} };
    vm.runInNewContext(source, { window, CustomEvent: class {}, Map, Date, Error });
    return { state, add: () => window.PassitCart.add(client, 7) };
}
test('new cart row belongs to current user and has quantity 1', async () => {
    const f=fixture(); assert.equal((await f.add()).quantity,1);
    assert.equal(f.state.item.user_id,'buyer'); assert.equal(f.state.item.product_id,7); assert.equal(f.state.item.selected,true);
});
test('existing row increments and compares the previous quantity', async () => {
    const f=fixture({item:{id:9,quantity:1}}); assert.equal((await f.add()).quantity,2);
    assert.equal(f.state.writes[0].filters.user_id,'buyer'); assert.equal(f.state.writes[0].filters.quantity,1);
});
test('rapid repeated calls share one write', async () => {
    const f=fixture(); await Promise.all([f.add(),f.add(),f.add()]); assert.equal(f.state.writes.length,1);
});
for (const [name, options, code] of [
    ['guest',{guest:true},'LOGIN_REQUIRED'],
    ['missing session',{guest:true,authError:{name:'AuthSessionMissingError'}},'LOGIN_REQUIRED'],
    ['auth failure',{guest:true,authError:{name:'NetworkError'}},'AUTH_ERROR'],
    ['stock limit',{item:{id:9,quantity:3}},'STOCK_LIMIT'],
    ['sold out',{product:{id:7,status:'active',quantity:0,seller_id:'seller'}},'UNAVAILABLE'],
    ['inactive',{product:{id:7,status:'hidden',quantity:3,seller_id:'seller'}},'UNAVAILABLE'],
    ['removed',{product:null},'UNAVAILABLE'],
    ['own product',{product:{id:7,status:'active',quantity:3,seller_id:'buyer'}},'OWN_PRODUCT']
]) test(name+' does not write',async()=>{const f=fixture(options);await assert.rejects(f.add(),e=>e.code===code);assert.equal(f.state.writes.length,0)});
test('insert conflict rereads and increments the existing row',async()=>{const f=fixture({conflictOnce:true});assert.equal((await f.add()).quantity,2);assert.equal(f.state.writes.length,2)});
test('empty update result is never reported as success',async()=>{const f=fixture({item:{id:9,quantity:1},noRows:true});await assert.rejects(f.add(),e=>e.code==='CONFLICT')});
test('failed save unlocks the product for retry',async()=>{const f=fixture({writeError:{code:'NETWORK'}});await assert.rejects(f.add());f.state.writeError=null;assert.equal((await f.add()).quantity,1)});
test('listing renders cart action without description or chat redirect',()=>{
    const s=fs.readFileSync(path.join(__dirname,'../IUH shop/JS/sanpham.js'),'utf8');
    const context={esc:String,isBoostActive:()=>false,formatCurrency:String,getBuyerPrice:Number};
    vm.createContext(context); vm.runInContext(s.slice(s.indexOf('function renderProductCard('),s.indexOf('function renderProducts(')),context);
    const html=context.renderProductCard({id:7,name:'Book',price:100,quantity:2,status:'active',description:'DETAIL_ONLY'});
    assert.match(html,/data-add-cart-id="7"/);assert.match(html,/Thêm vào giỏ hàng/);assert.doesNotMatch(html,/product-description|DETAIL_ONLY|data-chat-id/);
    assert.match(context.renderProductCard({id:7,quantity:0,status:'active'}),/disabled/);
});
test('both pages load the cart service before page handlers',()=>{
    for(const name of ['sanpham','chitietsanpham']){const html=fs.readFileSync(path.join(__dirname,'../IUH shop/HTML',name+'.html'),'utf8');assert.ok(html.indexOf('JS/cart-actions.js')>0);assert.ok(html.indexOf('JS/cart-actions.js')<html.indexOf('JS/'+name+'.js'));}
});
