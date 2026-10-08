const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const read = name => fs.readFileSync('IUH shop/' + name, 'utf8');
const flush = () => new Promise(resolve => setTimeout(resolve, 10));
function fixture(page = 'dangky', sdk = true) {
    const dom = new JSDOM(read('HTML/' + page + '.html'), { url: 'https://passitt.vercel.app/HTML/' + page + '.html', runScripts: 'outside-only' });
    const w = dom.window;
    let options, resets = 0;
    if (sdk) w.turnstile = { render(node, args) { options = args; return 'widget'; }, reset(id) { assert.equal(id, 'widget'); resets++; } };
    w.eval(read('JS/auth-captcha.js'));
    return { w, d: w.document, options: () => options, resets: () => resets };
}
test('CAPTCHA uses the supplied site key; tokens are one-use and cleared on expiry/error', () => {
    const f = fixture();
    try {
        assert.equal(f.options().sitekey, '0x4AAAAAAFRZdAHQ487-gx99');
        assert.throws(() => f.w.IUHCaptcha.takeToken());
        f.options().callback('proof');
        assert.equal(f.w.IUHCaptcha.takeToken(), 'proof');
        assert.throws(() => f.w.IUHCaptcha.takeToken());
        for (const callback of ['expired-callback', 'timeout-callback', 'error-callback']) {
            f.options().callback('proof'); f.options()[callback]();
            assert.throws(() => f.w.IUHCaptcha.takeToken());
        }
        f.options().callback('proof'); f.w.IUHCaptcha.reset();
        assert.equal(f.resets(), 1); assert.throws(() => f.w.IUHCaptcha.takeToken());
    } finally { f.w.close(); }
});
test('Blocked CAPTCHA script shows retry and never supplies a token', () => {
    const f = fixture('dangky', false);
    try {
        const script = f.d.querySelector('script[src*="challenges.cloudflare.com"]');
        script.onerror();
        const retry = [...f.d.querySelectorAll('button')].find(b => b.textContent === 'Tải lại xác thực');
        assert.equal(retry.hidden, false); assert.throws(() => f.w.IUHCaptcha.takeToken());
        retry.click();
        assert.equal(f.d.querySelectorAll('script[src*="challenges.cloudflare.com"]').length, 1);
        assert.throws(() => f.w.IUHCaptcha.takeToken());
    } finally { f.w.close(); }
});
for (const page of ['dangky', 'dangnhap', 'quenmatkhau']) {
    test(page + ': blocks unsolved CAPTCHA and passes solved token to Supabase, then resets', async () => {
        const f = fixture(page), calls = [];
        try {
            const auth = {
                signUp: async body => { calls.push(body.options.captchaToken); return { data: { user: { id: 'new' }, session: null } }; },
                signInWithPassword: async body => { calls.push(body.options.captchaToken); return { error: { code: 'captcha_failed' } }; },
                resetPasswordForEmail: async (_, options) => { calls.push(options.captchaToken); return {}; }
            };
            f.w.supabase = { createClient: () => ({ auth }) };
            f.w.IUHCore = { getClient: () => ({ auth }) };
            f.w.alert = () => {}; f.w.console.error = () => {};
            f.w.eval(read('JS/' + (page === 'quenmatkhau' ? 'password-recovery' : page) + '.js'));
            const values = page === 'dangky' ? { fullName: 'Test User', studentId: '12345678', email: 'test@example.com', phone: '0901234567', password: 'password123', confirmPassword: 'password123' }
                : page === 'dangnhap' ? { loginAccount: 'test@example.com', loginPassword: 'password123' } : { recoveryEmail: 'test@example.com' };
            for (const [id, value] of Object.entries(values)) f.d.getElementById(id).value = value;
            if (page === 'dangky') { f.d.getElementById('faculty').selectedIndex = 1; f.d.getElementById('agreeTerms').checked = true; }
            const form = f.d.getElementById(page === 'dangky' ? 'registerForm' : page === 'dangnhap' ? 'loginForm' : 'requestResetForm');
            const submit = () => form.dispatchEvent(new f.w.Event('submit', { bubbles: true, cancelable: true }));
            const captcha = f.w.IUHCaptcha;
            delete f.w.IUHCaptcha;
            submit(); await flush(); assert.equal(calls.length, 0);
            f.w.IUHCaptcha = captcha;
            submit(); await flush(); assert.equal(calls.length, 0);
            f.options().callback('proof-for-' + page);
            submit(); submit(); await flush();
            assert.deepEqual(calls, ['proof-for-' + page]);
            assert.throws(() => f.w.IUHCaptcha.takeToken());
            assert.ok(f.resets() >= 1);
        } finally { f.w.close(); }
    });
}
test('Recovery strips callback credentials before loading third-party CAPTCHA', () => {
    const html = read('HTML/quenmatkhau.html');
    assert.ok(html.indexOf('JS/password-recovery.js') < html.indexOf('JS/auth-captcha.js'));
});
