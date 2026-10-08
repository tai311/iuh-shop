const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('IUH shop/JS/tinnhan.js', 'utf8');
function load(context, start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a);
    vm.runInContext(source.slice(a, b), context);
}

test('Many messages from one sender share a single profile request', async () => {
    let requests = 0;
    const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { requests++; return { data: { user_id: 'seller', fullname: 'Seller' } }; } };
    const context = vm.createContext({ console, supabaseClient: { from: () => q } });
    load(context, 'const chatProfileCache', 'async function getAdminUser(');
    const profiles = await Promise.all(Array.from({ length: 50 }, () => context.getUserProfile('seller')));
    assert.equal(requests, 1);
    assert.ok(profiles.every(p => p.fullname === 'Seller'));
});

test('Conversation members and profiles are batched; message summaries run concurrently', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ id: 'chat-' + i }));
    const members = rows.map((row, i) => ({ conversation_id: row.id, user_id: 'seller-' + i }));
    const profiles = members.map((m, i) => ({ user_id: m.user_id, fullname: m.user_id, role: i === 0 ? 'admin' : 'user' }));
    const requests = [];
    let active = 0, maxActive = 0;
    const summary = async () => { active++; maxActive = Math.max(maxActive, active); await new Promise(r => setImmediate(r)); active--; return null; };
    const client = { from(table) {
        requests.push(table);
        let columns;
        const q = { select(c) { columns = c; return q; }, eq() { return q; }, in() { return q; }, neq() { return q; }, order() { return q; },
            then(resolve) { resolve({ data: table === 'public_profiles' ? profiles : table === 'conversations' ? rows : columns === 'conversation_id' ? rows.map(r => ({ conversation_id: r.id })) : members }); }
        };
        return q;
    } };
    const context = vm.createContext({ console, supabaseClient: client, currentUser: { id: 'me' }, currentUserProfile: { role: 'user' },
        conversationList: {}, conversations: [], getUnreadCount: summary, getLatestMessage: summary,
        ensureAdminChat() { throw Error('Existing admin should not be queried again'); }, renderConversationList() {}
    });
    load(context, 'const chatProfileCache', 'async function getAdminUser(');
    load(context, 'async function loadConversations()', 'function renderConversationList(');
    await context.loadConversations();
    assert.equal(context.conversations.length, 12);
    assert.equal(requests.filter(t => t === 'public_profiles').length, 1);
    assert.equal(requests.filter(t => t === 'conversation_members').length, 2);
    assert.ok(maxActive > 1 && maxActive <= 12, 'Summary requests overlap with bounded concurrency');
});

test('Confirmed send renders and unlocks without waiting for preview bookkeeping', async () => {
    let rendered = false;
    const context = vm.createContext({ console, currentUser: { id: 'me' }, currentConversationId: 'chat',
        messageInput: { value: 'Hello', focus() {} }, selectedImage: null, pendingProductId: null, sendButton: {}, conversations: [],
        supabaseClient: { from: () => ({ insert: row => ({ select: () => ({ single: async () => ({ data: { id: 'message', ...row } }) }) }) }) },
        updateConversationLastMessage: () => new Promise(() => {}), removeSelectedImage() {},
        renderSingleMessage: async () => { rendered = true; }, scrollToBottom() {}, renderConversationList() {}, alert: assert.fail
    });
    load(context, 'let chatSendInFlight', 'async function uploadChatImage(');
    await context.sendMessage();
    assert.equal(rendered, true);
    assert.equal(context.sendButton.disabled, false);
    assert.equal(context.messageInput.value, '');
});

test('Read receipts do not reload message history or conversation list', async () => {
    const handlers = {};
    const channel = { on(_, config, fn) { handlers[config.event] = fn; return channel; }, subscribe() { return channel; } };
    const context = vm.createContext({ console, realtimeChannel: null, currentUser: { id: 'me' }, currentConversationId: 'chat',
        supabaseClient: { channel: () => channel }, loadMessages: assert.fail, loadConversations: assert.fail,
        conversations: [{ id: 'chat' }]
    });
    load(context, 'function subscribeToMessages()', 'if (conversationSearch)');
    context.subscribeToMessages();
    await handlers.UPDATE({ new: { id: 'message', conversation_id: 'chat', is_read: true, edited_at: null, recalled_at: null } });
});
