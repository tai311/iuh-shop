const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createDatabase } = require('./helpers/database.cjs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../IUH shop/JS/dangky.js'), 'utf8');

test('Account recovery page includes the verification form and its runtime', () => {
    const html = fs.readFileSync(require('node:path').join(__dirname, '../IUH shop/HTML/taikhoan.html'), 'utf8');
    for (const id of ['Panel', 'Form', 'File', 'Submit', 'Status', 'Message', 'Preview', 'Reload']) {
        assert.ok(html.includes(`id="accountVerification${id}"`));
    }
    assert.ok(html.indexOf('JS/iuh-core.js') < html.indexOf('JS/account-verification.js'));
    assert.ok(html.includes('JS/account-verification.js'));
});

async function scenario(options = {}) {
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(fs.readFileSync('IUH shop/HTML/dangky.html', 'utf8'), { url: 'https://shop.invalid/HTML/dangky.html', runScripts: 'outside-only' });
    const w = dom.window, d = w.document, calls = [];
    let submit, redirectDelay;
    const form = d.getElementById('registerForm');
    const listen = form.addEventListener.bind(form);
    form.addEventListener = (event, callback, ...rest) => event === 'submit' ? submit = callback : listen(event, callback, ...rest);
    w.setTimeout = (_, delay) => { redirectDelay = delay; };
    w.console.error = () => {};
    w.IUHCore = { getClient: () => ({ auth: { signUp: async body => {
        calls.push(body);
        if (options.network) throw Error('Network interrupted');
        if (options.rejected) return { error: { message: 'Signup rejected' } };
        return { data: { user: options.emptyUser ? null : { id: 'user-1' }, session: options.confirmEmail ? null : {} } };
    } }, storage: { from() { assert.fail('Signup must not upload a card'); } }, from() { assert.fail('Profile is created by the database'); } }) };
    w.eval(source);
    for (const [id, value] of Object.entries({ fullName: 'Test User', studentId: '12345678', email: 'a@example.com', phone: '0901234567', password: 'password123', confirmPassword: 'password123' })) d.getElementById(id).value = value;
    d.getElementById('faculty').selectedIndex = 1;
    d.getElementById('agreeTerms').checked = true;
    const send = () => submit({ preventDefault() {} });
    await Promise.all([send(), send()]);
    return { w, d, calls, send, redirectDelay, button: form.querySelector('button[type="submit"]') };
}
test('Signup sends validated metadata once, without a role or client profile write', async () => {
    const f = await scenario();
    try {
        assert.equal(f.calls.length, 1);
        assert.equal(f.calls[0].options.data.role, undefined);
        assert.equal(f.redirectDelay, 800);
        await f.send(); assert.equal(f.calls.length, 1);
    } finally { f.w.close(); }
});
test('Email confirmation keeps the new account locked against duplicate signup', async () => {
    const f = await scenario({ confirmEmail: true });
    try {
        assert.equal(f.redirectDelay, undefined);
        assert.match(f.d.getElementById('formMessage').textContent, /email/);
        assert.equal(f.button.disabled, true);
        await f.send(); assert.equal(f.calls.length, 1);
    } finally { f.w.close(); }
});
for (const failure of ['network', 'rejected', 'emptyUser']) {
    test(`Signup ${failure} displays an error and permits retry`, async () => {
        const f = await scenario({ [failure]: true });
        try {
            assert.equal(f.button.disabled, false);
            assert.ok(f.d.getElementById('formMessage').textContent);
            assert.equal(f.redirectDelay, undefined);
            await f.send(); assert.equal(f.calls.length, 2);
        } finally { f.w.close(); }
    });
}

test('Database rejects old public URL and accepts private card path as the authenticated owner', async () => {
    const db = await createDatabase();
    const id = '00000000-0000-4000-8000-000000000091';
    try {
        await db.query('insert into auth.users(id,email) values($1,$2)', [id, 'signup@test.invalid']);
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
        await db.exec('set role authenticated');
        await assert.rejects(db.query("update public.users set student_card_url=$1 where user_id=$2", [
            `https://xecxofmogvqysejjpxvl.supabase.co/storage/v1/object/public/student-cards/${id}/card.jpg`, id
        ]), /Ảnh thẻ/);
        const { rows } = await db.query("update public.users set student_card_url=$1,verification_status='pending' where user_id=$2 returning user_id,student_card_url,verification_status", [`${id}/card.jpg`, id]);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].verification_status, 'pending');
        assert.equal(rows[0].student_card_url, `${id}/card.jpg`);
    } finally { await db.close(); }
});
