const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const { createDatabase } = require('./helpers/database.cjs');

test('Free Donate completes once, records its nominal amount and cannot bypass bank review after launch', async () => {
    const db = await createDatabase();
    const [admin, donor, other] = ['201', '202', '203'].map(n => '00000000-0000-4000-8000-000000000' + n);
    const q = async (sql, args = []) => (await db.query(sql, args)).rows;
    const scalar = async (sql, args = []) => Object.values((await q(sql, args))[0])[0];
    const as = async id => { await db.exec('reset role'); await q("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec('set role authenticated'); };
    const donate = (key = 'donate-test-0001', amount = 50000) => scalar("select public.request_donation($1,'Donor','BIDV','DONATE IUH SHOP',$2)", [amount, key]);
    try {
        for (const id of [admin, donor, other]) await q('insert into auth.users(id,email) values($1,$2)', [id, id + '@test.invalid']);
        await q("update public.users set role='admin' where user_id=$1", [admin]);
        await as(donor);
        const first = await donate();
        assert.equal(first.status, 'completed');
        assert.equal((await donate()).donation_id, first.donation_id);
        await assert.rejects(donate('donate-test-0001', 10000));
        for (const amount of [-1, 999, 1000.5, 100000001, 'NaN', 'Infinity']) await assert.rejects(donate('donate-invalid-01', amount));
        await assert.rejects(q("select public.create_simulated_donation(10000,'Donor','BIDV','DONATE')"));
        await as(other); await assert.rejects(donate());
        await as(admin);
        const entry = (await q("select kind,amount,title from public.trial_financial_entries where source_type='donation'"))[0];
        assert.equal(entry.kind, 'donation'); assert.equal(Number(entry.amount), 50000);
        assert.equal(entry.title, 'Donate IUH SHOP');
        assert.equal(Number(await scalar("select count(*) from public.trial_financial_entries where source_type='donation'")), 1);
        assert.equal(await scalar('select payment_method from public.donations where id=$1', [first.donation_id]), 'free');
        await q('select public.review_donation($1,true,null,null)', [first.donation_id]);
        assert.equal(Number(await scalar('select count(*) from public.wallet_transactions')), 0);
        await q('select public.set_iuh_trial_mode(false)');
        await as(donor);
        assert.equal((await donate()).status, 'completed');
        const live = await donate('donate-live-0001');
        assert.equal(live.status, 'pending');
        await as(admin); await q('select public.set_iuh_trial_mode(true)');
        await as(donor); assert.equal((await donate('donate-live-0001')).status, 'pending');
        await as(admin);
        assert.equal(Number(await scalar("select count(*) from public.trial_financial_entries where source_type='donation'")), 1);
        assert.equal(await scalar("select has_function_privilege('anon','public.request_donation(numeric,text,text,text,text)','execute')"), false);
    } finally { await db.close(); }
});

function fixture({ pending = false, lostResponse = false } = {}) {
    const dom = new JSDOM(fs.readFileSync('IUH shop/HTML/trangchu.html', 'utf8'), { runScripts: 'outside-only', url: 'https://shop.invalid/HTML/trangchu.html' });
    const w = dom.window, d = w.document, calls = [];
    w.IUHCore = { getClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'donor' } } }) }, rpc: async (name, args) => {
        if (name === 'get_iuh_trial_mode') return { data: !pending };
        assert.equal(name, 'request_donation'); calls.push({ ...args });
        if (lostResponse && calls.length === 1) throw Error('Connection interrupted');
        return { data: { success: true, status: pending ? 'pending' : 'completed', transfer_code: args.p_request_key } };
    } }) };
    w.eval(fs.readFileSync('IUH shop/JS/donate.js', 'utf8'));
    d.dispatchEvent(new w.Event('DOMContentLoaded'));
    const tick = () => new Promise(r => setTimeout(r, 10));
    const start = async () => {
        d.getElementById('donateFloatingButton').click(); await tick();
        d.getElementById('donateDonorName').value = 'Donor';
        d.getElementById('donateBankName').value = 'BIDV';
        d.getElementById('donateAmount').value = '50000';
        d.getElementById('startDonateTransfer').click();
    };
    return { dom, d, w, calls, tick, start };
}
test('Donate UI confirms free payment with the entered amount and no simulation tag or external QR', async () => {
    const f = fixture();
    try {
        await f.start();
        assert.equal(f.d.getElementById('donateTransferView').hidden, false);
        assert.equal(f.d.getElementById('donateTransferAmount').textContent, '50.000đ');
        assert.match(f.d.getElementById('donateTransferContent').textContent, /DONATE IUH SHOP/);
        f.d.getElementById('confirmDonateTransfer').click(); f.d.getElementById('confirmDonateTransfer').click();
        await f.tick();
        assert.equal(f.calls.length, 1);
        assert.equal(f.d.getElementById('donateSuccessView').hidden, false);
        assert.equal(f.d.getElementById('donateSuccessAmount').textContent, '50.000đ');
        assert.doesNotMatch(f.d.getElementById('donateModal').textContent, /chạy thử|mô phỏng/i);
        assert.equal(f.d.querySelector('#donateModal img[src*="qrserver"]'), null);
        assert.equal(f.w.sessionStorage.length, 0);
    } finally { f.w.close(); }
});
test('Donate retries a lost response with the same receipt key, including after reopening the modal', async () => {
    const f = fixture({ lostResponse: true });
    try {
        await f.start(); f.d.getElementById('confirmDonateTransfer').click(); await f.tick();
        assert.equal(f.w.sessionStorage.length, 1);
        f.d.getElementById('closeDonateModal').click();
        f.d.getElementById('donateFloatingButton').click(); await f.tick();
        assert.equal(f.d.getElementById('donateTransferView').hidden, false);
        f.d.getElementById('confirmDonateTransfer').click(); await f.tick();
        assert.equal(f.calls[0].p_request_key, f.calls[1].p_request_key);
        assert.equal(f.w.sessionStorage.length, 0);
    } finally { f.w.close(); }
});
test('Donate UI displays pending bank review when the server does not return completed', async () => {
    const f = fixture({ pending: true });
    try {
        await f.start(); f.d.getElementById('confirmDonateTransfer').click(); await f.tick();
        assert.match(f.d.getElementById('donateSuccessView').textContent, /chờ quản trị viên đối soát/);
        assert.doesNotMatch(f.d.getElementById('donateSuccessView').textContent, /DONATE THÀNH CÔNG/);
    } finally { f.w.close(); }
});
