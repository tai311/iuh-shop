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
    const nodes = {}, calls = { signup: 0, upload: 0, profile: 0 };
    let submit;
    const element = id => nodes[id] ||= { value: 'value', checked: true, style: {},
        appendChild(link) { this.link = link; }, addEventListener() {} };
    element('password').value = element('confirmPassword').value = 'valid-password-1';
    element('studentCard').files = [{ type: options.type || 'image/jpeg', size: 100, name: 'card.jpg' }];
    element('registerForm').querySelector = () => element('button');
    element('registerForm').addEventListener = (_, fn) => submit = fn;
    const client = {
        auth: { signUp: async () => {
            calls.signup++;
            if (options.network) throw new Error('Network interrupted');
            return { data: { user: { id: 'user-1' }, session: options.confirmEmail ? null : {} } };
        } },
        storage: { from: () => ({ upload: async path => {
            calls.upload++; assert.equal(path, 'user-1/card-id.jpg');
            return { error: options.uploadError ? new Error('Upload failed') : null };
        } }) },
        from: () => ({ update: values => {
            calls.profile++;
            assert.equal(values.student_card_url, 'user-1/card-id.jpg');
            assert.equal(values.verification_status, 'pending');
            return { eq: () => ({ select: () => ({ single: async () => ({
                data: options.emptyProfile ? null : { user_id: 'user-1' },
                error: options.profileError ? new Error('Permission denied') : null
            }) }) }) };
        } })
    };
    const context = { window: { supabase: { createClient: () => client }, location: {} },
        document: { getElementById: element, createElement: () => ({}) },
        crypto: { randomUUID: () => 'card-id' }, console: { error() {} } };
    vm.runInNewContext(source, context);
    await Promise.all([submit({ preventDefault() {} }), submit({ preventDefault() {} })]);
    return { calls, nodes, context, submit };
}

test('Signup saves a private card path and pending status, preventing double submission', async () => {
    const f = await scenario();
    assert.deepEqual(f.calls, { signup: 1, upload: 1, profile: 1 });
    assert.equal(f.context.window.location.href, 'taikhoan.html');
});
test('Email confirmation stops authenticated upload until login', async () => {
    const f = await scenario({ confirmEmail: true });
    assert.deepEqual(f.calls, { signup: 1, upload: 0, profile: 0 });
    assert.match(f.nodes.formMessage.textContent, /email/);
    assert.equal(f.nodes.button.disabled, true);
});
for (const failure of ['uploadError', 'profileError', 'emptyProfile']) {
    test(`Signup ${failure} offers recovery without creating another account`, async () => {
        const f = await scenario({ [failure]: true });
        assert.equal(f.context.window.location.href, undefined);
        assert.equal(f.nodes.formMessage.link.href, 'taikhoan.html?verify=1');
        assert.equal(f.nodes.button.disabled, true);
        await f.submit({ preventDefault() {} });
        assert.equal(f.calls.signup, 1);
    });
}
test('Network failure unlocks signup; unsupported card types never create an account', async () => {
    const f = await scenario({ network: true });
    assert.equal(f.nodes.button.disabled, false);
    const invalid = await scenario({ type: 'image/svg+xml' });
    assert.equal(invalid.calls.signup, 0);
});
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
