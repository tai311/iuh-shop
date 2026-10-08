const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const read = file => fs.readFileSync('IUH shop/' + file, 'utf8');
function fixture() {
    const dom = new JSDOM(read('HTML/donhang.html'), { url: 'https://shop.invalid/HTML/donhang.html', runScripts: 'outside-only' });
    const w = dom.window, calls = [];
    const listen = w.document.addEventListener.bind(w.document);
    w.document.addEventListener = (type, ...args) => { if (type !== 'DOMContentLoaded') listen(type, ...args); };
    w.alert = () => {}; w.confirm = () => true;
    w.supabase = { createClient: () => ({ auth: { onAuthStateChange() {} }, rpc: async (name, args) => {
        calls.push({ name, args }); return { data: { success: true } };
    } }) };
    w.eval(read('JS/iuh-core.js'));
    w.eval(read('JS/donhang.js') + `
        refreshPageData = async () => {};
        window.setSellerFixture = () => { currentUser={id:'seller'}; allOrders=[normalizeOrder(window.rawOrder)]; classifyOrders(); renderSaleOrders(); };
        window.setBuyerFixture = () => { currentUser={id:'buyer'}; };
        window.setAcknowledged = () => { allOrders[0].buyer_confirmed_at='2026-10-04'; };
    `);
    w.rawOrder = { id: 7, order_code: 'TEST', buyer_id: 'buyer', payment_method: 'trial', payment_status: 'paid',
        payment_approved_at: '2026-10-04', status: 'confirmed', total_amount: 105000,
        order_items: [{ seller_id: 'seller', product_name: 'Book', price: 100000, quantity: 1, subtotal: 100000 }] };
    const set = status => {
        w.rawOrder.status = status;
        w.setSellerFixture();
    };
    return { dom, w, calls, set };
}
test('Seller gets only accept and delivered actions; completed orders require no seller action', async () => {
    const f = fixture();
    try {
        f.set('confirmed');
        assert.equal(f.w.document.querySelector('#status-7').value, 'shipping');
        assert.match(f.w.document.querySelector('#saleTab').textContent, /Xác nhận nhận đơn/);
        await f.w.updateOrderStatus('7');
        assert.equal(f.calls[0].args.p_new_status, 'shipping');
        f.set('shipping');
        assert.equal(f.w.document.querySelector('#status-7').value, 'delivered');
        await f.w.updateOrderStatus('7');
        assert.equal(f.calls[1].args.p_new_status, 'delivered');
        f.set('delivered');
        assert.equal(f.w.document.querySelector('.seller-status-select'), null);
        assert.match(f.w.document.querySelector('#saleTab').textContent, /Chờ admin hoàn tất/);
        f.set('completed');
        assert.equal(f.w.document.querySelector('.seller-status-select'), null);
    } finally { f.dom.window.close(); }
});
test('Buyer acknowledgement calls the server, persists across sessions and does not settle money again', async () => {
    const f = fixture();
    try {
        f.set('completed');
        f.w.setBuyerFixture();
        await f.w.confirmReceivedOrder('7');
        assert.equal(f.calls[0].name, 'confirm_order_received');
        assert.equal(f.w.localStorage.length, 0);
        f.w.setAcknowledged();
        await f.w.confirmReceivedOrder('7');
        assert.equal(f.calls.length, 1);
    } finally { f.dom.window.close(); }
});
test('Persisted notification renders safely and can be marked read by its owner', async () => {
    const dom = new JSDOM('<html><head></head><body></body></html>', { url: 'https://shop.invalid/HTML/donhang.html', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window, changes = [];
    w.IUHCore = { getClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'buyer' } } }), onAuthStateChange() {} }, from: table => {
        const query = { select() { return query; }, eq() { return query; }, order() { return query; },
            update(value) { changes.push(value); return query; },
            limit: async () => ({ data: table === 'connection_notifications' ? [] : [{ id: 1, event: 'completed', order_id: 7, message: '<img onerror=alert(1)> Đơn đã hoàn thành' }] }),
            then(resolve) { resolve({ error: null }); } };
        return query;
    } }) };
    try {
        w.IUHCore.getUser = () => w.IUHCore.getClient().auth.getUser();
        w.eval(read('JS/order-notifications.js'));
        await new Promise(r => setTimeout(r, 10));
        const panel = w.document.querySelector('.order-notification-panel');
        assert.ok(panel); assert.equal(panel.querySelector('img'), null);
        assert.match(panel.textContent, /Đơn đã hoàn thành/);
        panel.querySelector('button').click();
        await new Promise(r => setTimeout(r, 10));
        assert.equal(changes[0].is_read, true);
        assert.equal(w.document.querySelector('.order-notification-panel'), null);
    } finally { w.close(); }
});
