const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(context, file, name) {
    const source = fs.readFileSync('IUH shop/JS/' + file, 'utf8');
    const start = source.search(new RegExp('(?:async )?function ' + name + '\\('));
    assert.ok(start >= 0, name);
    const next = source.slice(start + 1).search(/\n(?:async )?function /);
    vm.runInContext(source.slice(start, next < 0 ? undefined : start + 1 + next), context);
}

function fixture(badgeError = false) {
    const before = new Date(Date.now() - 60000).toISOString();
    const after = new Date(Date.now() + 60000).toISOString();
    const products = [
        { id: 1, seller_id: 'seller', name: 'Package book', status: 'active' },
        { id: 2, seller_id: 'other', name: 'Boost book', status: 'active', is_boosted: true, boost_started_at: before, boost_expires_at: after },
        { id: 3, seller_id: 'expired', name: 'Expired book', status: 'active', is_boosted: true, boost_started_at: before, boost_expires_at: before }
    ];
    const tables = {
        products: [...products.map(p => ({ ...p, quantity: 1 })),
            { id: 4, seller_id: 'seller', name: 'Sold out package', status: 'active', quantity: 0 },
            { id: 5, seller_id: 'other', name: 'Sold out boost', status: 'active', quantity: 0, is_boosted: true, boost_started_at: before, boost_expires_at: after }],
        public_profiles: [{ user_id: 'seller', fullname: 'Public Seller' }],
        service_package_badges: [
            { user_id: 'seller', status: 'active', starts_at: before, expires_at: after },
            { user_id: 'expired', status: 'active', starts_at: before, expires_at: before }
        ]
    };
    const requests = [];
    const client = { from(table) {
        requests.push(table);
        assert.ok(table in tables, 'Public discovery must not read private table ' + table);
        let rows = tables[table];
        const q = {
            gt(column, value) { rows = rows.filter(row => row[column] > value); return q; },
            select() { return q; }, eq() { return q; }, in() { return q; },
            ilike() { return q; }, order() { return q; }, limit() { return q; },
            then(resolve) { resolve({ data: rows, error: badgeError && table === 'service_package_badges' ? Error('Unavailable') : null }); }
        };
        return q;
    } };
    const nodes = {};
    const context = vm.createContext({
        supabaseClient: client, console: { error() {} },
        document: { getElementById(id) { return nodes[id] ||= { style: {}, innerHTML: '' }; } },
        recommendedProducts: [], featuredProducts: [],
        renderRecommendedProducts() {}, renderFeaturedProducts() {},
        renderRecommendedCard(p) { return p.name; },
        createProductSearchHTML(p) { return p.name; }, bindProductSearchEvents() {}
    });
    return { context, nodes, requests };
}

for (const badgeError of [false, true]) {
    test('Homepage recommendations preserve public packages and boosts; badge error=' + badgeError, async () => {
        const { context, nodes } = fixture(badgeError);
        for (const name of ['isRecommendedBoostActive', 'isRecommendedPackageActive', 'loadRecommendedProducts']) load(context, 'ok.js', name);
        await context.loadRecommendedProducts();
        assert.deepEqual(Array.from(context.recommendedProducts, p => p.id), badgeError ? [2] : [2, 1]);
        if (!badgeError) assert.equal(context.recommendedProducts[1].seller.fullname, 'Public Seller');
        assert.notEqual(nodes.recommendedSection?.style.display, 'none');
    });

    test('Search suggestions preserve public packages and boosts; badge error=' + badgeError, async () => {
        const { context, nodes } = fixture(badgeError);
        for (const name of ['isSearchBoostActive', 'isSearchPackageActive', 'loadFeaturedSearchProducts']) load(context, 'iuh-chat-notification.js', name);
        await context.loadFeaturedSearchProducts();
        assert.match(nodes.globalFeaturedProducts.innerHTML, /Boost book/);
        assert.equal(nodes.globalFeaturedProducts.innerHTML.includes('Package book'), !badgeError);
        assert.doesNotMatch(nodes.globalFeaturedProducts.innerHTML, /Expired book/);
        assert.doesNotMatch(nodes.globalFeaturedProducts.innerHTML, /Sold out/);
    });
}

test('Homepage seller names and global user search use public profiles', async () => {
    const { context, requests } = fixture();
    load(context, 'ok.js', 'loadFeaturedProducts');
    await context.loadFeaturedProducts();
    assert.equal(context.featuredProducts[0].seller.fullname, 'Public Seller');
    assert.deepEqual(Array.from(context.featuredProducts, p => p.id), [1, 2, 3]);
    load(context, 'iuh-chat-notification.js', 'searchProducts');
    assert.deepEqual(Array.from(await context.searchProducts('book'), p => p.id), [1, 2, 3]);
    load(context, 'iuh-chat-notification.js', 'searchUsers');
    assert.equal((await context.searchUsers('Public'))[0].fullname, 'Public Seller');
    assert.equal(requests.filter(t => t === 'public_profiles').length, 2);
});
