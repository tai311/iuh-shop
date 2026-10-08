const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../IUH shop');
const source = fs.readFileSync(path.join(root, 'JS/iuh-core.js'), 'utf8');
function fixture(auth = {}) {
    const dom = new JSDOM('', { url: 'https://shop.invalid', runScripts: 'outside-only' });
    let creations = 0;
    const client = { auth };
    dom.window.supabase = { createClient() { creations++; return client; } };
    dom.window.eval(source);
    return { w: dom.window, client, creations: () => creations };
}
test('Shared runtime survives repeated script loads and creates only one normal client', () => {
    const f = fixture();
    try {
        const first = f.w.IUHCore;
        assert.equal(first.getClient(), f.client);
        f.w.eval(source);
        assert.equal(f.w.IUHCore, first);
        assert.equal(f.w.IUHCore.getClient(), f.w.IUH_SUPABASE);
        assert.equal(f.creations(), 1);
    } finally { f.w.close(); }
});
test('Guest header does not call getUser or produce a missing-session error', async () => {
    const f = fixture({ getSession: async () => ({ data: { session: null } }), getUser() { assert.fail('guest network request'); } });
    try { const result = await f.w.IUHCore.getUser(); assert.equal(result.data.user, null); assert.equal(result.error, null); }
    finally { f.w.close(); }
});
test('Concurrent identity reads verify Auth once; signout during a request discards stale identity', async () => {
    let session = { user: { id: 'buyer' } }, calls = 0, finish;
    const f = fixture({ getSession: async () => ({ data: { session } }), getUser: () => {
        calls++; return new Promise(resolve => finish = resolve);
    } });
    try {
        const first = f.w.IUHCore.getUser(), second = f.w.IUHCore.getUser();
        assert.equal(first, second);
        await new Promise(resolve => setImmediate(resolve));
        finish({ data: { user: { id: 'buyer' } }, error: null });
        assert.equal((await first).data.user.id, 'buyer');
        assert.equal(calls, 1);
        const next = f.w.IUHCore.getUser();
        await new Promise(resolve => setImmediate(resolve)); session = null;
        finish({ data: { user: { id: 'buyer' } }, error: null });
        assert.equal((await next).data.user, null);
    } finally { f.w.close(); }
});
test('Auth failures remain visible and a later attempt can retry', async () => {
    const error = { message: 'Network unavailable' };
    let fail = true;
    const f = fixture({ getSession: async () => fail ? { error } : { data: { session: null } } });
    try {
        assert.equal((await f.w.IUHCore.getUser()).error, error);
        fail = false;
        assert.equal((await f.w.IUHCore.getUser()).error, null);
    } finally { f.w.close(); }
});
test('UI auth callbacks run outside the SDK lock and unsubscribe cancels queued work', async () => {
    let listener, locked = false, count = 0, removed = false;
    const f = fixture({ onAuthStateChange(callback) {
        listener = callback; return { data: { subscription: { unsubscribe() { removed = true; } } } };
    } });
    try {
        const { data } = f.w.IUHCore.onAuthStateChange(async () => { assert.equal(locked, false); count++; });
        locked = true; listener('SIGNED_IN', {}); assert.equal(count, 0); locked = false;
        await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(count, 1);
        listener('SIGNED_OUT', null); data.subscription.unsubscribe();
        await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(count, 1); assert.equal(removed, true);
    } finally { f.w.close(); }
});
test('Pages load shared runtime first; normal scripts cannot create additional auth clients or dump data', () => {
    for (const file of fs.readdirSync(path.join(root, 'JS')).filter(x => x.endsWith('.js'))) {
        const code = fs.readFileSync(path.join(root, 'JS', file), 'utf8');
        if (!['iuh-core.js', 'password-recovery.js'].includes(file)) assert.doesNotMatch(code, /\.createClient\s*\(/, file);
        assert.doesNotMatch(code, /console\.(log|table|debug)\s*\(/, file);
        assert.doesNotMatch(code, /sb_secret_[A-Za-z0-9]+/, file);
        for (const token of code.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
            assert.notEqual(payload.role, 'service_role', file);
        }
    }
    for (const file of fs.readdirSync(path.join(root, 'HTML')).filter(x => x.endsWith('.html'))) {
        const dom = new JSDOM(fs.readFileSync(path.join(root, 'HTML', file), 'utf8'));
        try {
            const scripts = [...dom.window.document.querySelectorAll('script[src]')].map(n => n.getAttribute('src'));
            const sdk = scripts.findIndex(x => x.includes('supabase'));
            if (sdk < 0) continue;
            const core = scripts.findIndex(x => x.includes('iuh-core.js'));
            assert.ok(core > sdk, file);
            for (let i = 0; i < scripts.length; i++) {
                if (/\/JS\/[^/]+\.js/.test(scripts[i]) && !/iuh-core|vendor/.test(scripts[i])) {
                    const code = fs.readFileSync(path.resolve(root, 'HTML', scripts[i].split('?')[0]), 'utf8');
                    if (code.includes('IUHCore')) assert.ok(i > core, file + ': ' + scripts[i]);
                }
            }
        } finally { dom.window.close(); }
    }
});
