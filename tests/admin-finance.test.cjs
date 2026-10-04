const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('IUH shop/JS/admin.js', 'utf8');
const revenueSource = source.slice(source.indexOf('async function loadAdminRevenue()'), source.indexOf('let revenueChartInstance'));
const financeSource = source.slice(source.indexOf('async function loadFinance()'), source.indexOf('   FILTER EVENTS'));
// Strip the trailing comment opener before evaluating the finance function.
const financeFunction = financeSource.slice(0, financeSource.lastIndexOf('/*'));

function fixture({ many = false, fail = false, boostEntry = false } = {}) {
    const row = (id, wallet_id, type, title, amount) => ({ id, wallet_id, type, title, amount, created_at: '2026-10-04', description: '' });
    const tables = {
        users: [{ user_id: 'a', role: 'admin' }, { user_id: 'b', role: 'admin' }],
        iuh_wallets: [{ id: 1, user_id: 'a' }, { id: 2, user_id: 'b' }],
        wallet_transactions: [row(1, 1, 'fee', 'Gói dịch vụ', 19000),
            row(2, 1, 'sale', 'Phí dịch vụ đã hoàn tất', 1500),
            row(3, 2, 'sale', 'Phí dịch vụ đã hoàn tất', 1000),
            row(4, 1, 'sale', 'Tiền giữ hộ đơn hàng', 31500),
            row(5, 1, 'sale', 'Tiền bán hàng', 30000),
            row(6, 1, 'payment', 'Hoàn tiền đơn hàng', 31500),
            row(7, 1, 'sale', 'Phí đẩy tin', 3000),
            row(8, 1, 'sale', 'Phí đơn COD', 500)],
        orders: [{ id: 41, payment_method: 'trial', status: 'completed', payment_status: 'paid', total_amount: 183750 },
            { id: 42, payment_method: 'trial', status: 'pending', payment_status: 'unpaid', total_amount: 31500 }],
        trial_financial_entries: [{ id: 1, kind: 'platform', amount: 8750, title: 'Phí sàn · Trial order', created_at: '2026-10-04' },
            { id: 2, kind: 'seller', amount: 175000, title: 'Tiền bán hàng', created_at: '2026-10-04' },
            { id: 4, kind: 'donation', amount: 50000, title: 'Donate IUH SHOP', created_at: '2026-10-04' },
            { id: 3, kind: 'package', amount: 19000, title: 'Gói dịch vụ · Trial package', created_at: '2026-10-04' }],
        advertisements: []
    };
    if (many) tables.wallet_transactions.push(...Array.from({ length: 1100 }, (_, i) => row(100 + i, 1, 'fee', 'Thu phí sàn', 1)));
    if (boostEntry) tables.trial_financial_entries.push({ id: 5, kind: 'boost', amount: 3000, title: 'Phí đẩy tin · Sản phẩm #41', created_at: '2026-10-04' });
    const requests = [];
    const db = { from(table) {
        let rows = tables[table].slice();
        const q = {
            select() { return q; },
            eq(key, value) { rows = rows.filter(r => r[key] === value); return q; },
            in(key, values) { rows = rows.filter(r => values.includes(r[key])); return q; },
            or(filter) {
                // Evaluate the exact categories requested by the production query.
                const titles = filter.match(/title\.in\.\(([^)]+)\)/)?.[1].split(',') || [];
                rows = rows.filter(r => (filter.includes('type.eq.fee') && r.type === 'fee') || (r.type === 'sale' && titles.includes(r.title)));
                return q;
            },
            order() { return q; },
            range(start, end) { requests.push({ table, start }); return Promise.resolve({ data: rows.slice(start, end + 1), error: fail ? Error('Offline') : null }); },
            then(resolve) { resolve({ data: rows, error: fail ? Error('Offline') : null }); }
        };
        return q;
    } };
    const nodes = {};
    const context = { supabaseClient: db, console: { error() {} },
        $: id => nodes[id] ||= {}, formatMoney: n => n + 'đ', formatDate: value => value,
        escapeHTML: value => String(value), financeTransactions: [] };
    vm.createContext(context);
    vm.runInContext(revenueSource + '\n' + financeFunction, context);
    return { context, nodes, requests };
}

test('Finance includes settled fees across admin wallets but excludes escrow, seller sales and refunds', async () => {
    const f = fixture();
    const result = await f.context.loadAdminRevenue();
    assert.equal(result.total, 102750);
    assert.equal(result.package, 38000);
    assert.equal(result.platform, 11750);
    assert.equal(result.boost, 3000);
    assert.equal(result.transactions.find(r => r.title === 'Donate IUH SHOP').amount, 50000);
    assert.equal(result.transactions.length, 8);
    await f.context.loadFinance();
    assert.equal(f.nodes.financeTotal.textContent, '102750đ');
    assert.match(f.nodes.financeList.innerHTML, /Phí dịch vụ đã hoàn tất/);
    assert.doesNotMatch(f.nodes.financeList.innerHTML, /Tiền giữ hộ|Tiền bán hàng|Hoàn tiền/);
    assert.match(f.nodes.financeTrialSummary.textContent, /hoàn thành: 1.*183750đ.*đã được cộng vào báo cáo/);
});
test('Finance reads beyond the first 1000 ledger entries without double counting', async () => {
    const f = fixture({ many: true });
    assert.equal((await f.context.loadAdminRevenue()).total, 103850);
    assert.ok(f.requests.some(r => r.table === 'wallet_transactions' && r.start === 1000));
});
test('Finance displays a load error instead of claiming zero revenue', async () => {
    const f = fixture({ fail: true });
    await f.context.loadFinance();
    assert.equal(f.nodes.financeTotal.textContent, '—');
    assert.match(f.nodes.financeList.innerHTML, /Không tải được/);
});

test('Free boost ledger entries appear as boost revenue with no trial tag', async () => {
    const f = fixture({ boostEntry: true });
    const revenue = await f.context.loadAdminRevenue();
    assert.equal(revenue.boost, 6000);
    assert.equal(revenue.total, 105750);
    const entry = revenue.transactions.find(r => r.title.includes('#41'));
    assert.equal(entry.title, 'Phí đẩy tin · Sản phẩm #41');
    await f.context.loadFinance();
    assert.match(f.nodes.financeList.innerHTML, /Phí đẩy tin · Sản phẩm #41/);
});
