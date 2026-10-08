const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { createDatabase } = require('./helpers/database.cjs');
const source = file => fs.readFileSync('IUH shop/JS/' + file, 'utf8');
function evaluate(context, file, start, end) {
    const s = source(file), a = s.indexOf(start), b = s.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, start);
    vm.runInContext(s.slice(a, b), context);
}

test('New chat and both read receipts call authorized RPCs', async () => {
    const calls = [];
    const context = vm.createContext({ currentUser: { id: 'me' }, console,
        supabaseClient: { rpc: async (name, args) => { calls.push([name, args]); return { data: { id: 'chat' } }; } } });
    evaluate(context, 'tinnhan.js', 'async function createConversation(', 'async function ensureAdminChat(');
    evaluate(context, 'tinnhan.js', 'async function markMessagesAsRead(', 'function subscribeToMessages(');
    evaluate(context, 'iuh-chat-notification.js', 'async function markMiniChatAsRead(', 'async function sendMiniChatMessage(');
    assert.equal((await context.createConversation('seller')).id, 'chat');
    await context.markMessagesAsRead('chat');
    await context.markMiniChatAsRead('chat');
    assert.equal(calls[0][0], 'get_or_create_direct_conversation');
    assert.equal(calls[0][1].p_other_user_id, 'seller');
    assert.deepEqual(calls.slice(1).map(c => c[0]), ['mark_conversation_read', 'mark_conversation_read']);
    await assert.rejects(context.createConversation('me'));
});

test('Chat initialization subscribes to realtime and opens a notification conversation', async () => {
    let subscribed = 0, opened;
    const context = vm.createContext({ console, URLSearchParams,
        window: { location: { search: '?conversation=chat' } },
        currentUser: { id: 'me' }, conversations: [{ id: 'chat' }],
        updateUserMenu: async () => {}, loadCurrentUser: async () => ({ id: 'me' }),
        loadConversations: async () => {}, subscribeToMessages: () => subscribed++,
        openConversation: async id => { opened = id; }, conversationList: {}
    });
    evaluate(context, 'tinnhan.js', 'async function initChat()', 'document.addEventListener(');
    await context.initChat();
    assert.equal(subscribed, 1);
    assert.equal(opened, 'chat');
});

test('Realtime renders received messages and refreshes edited messages', async () => {
    const handlers = {}, rendered = [], refreshed = [];
    const channel = { on(_, config, handler) { assert.equal(handlers[config.event], undefined, 'Listener registered once'); handlers[config.event] = handler; return channel; }, subscribe() { return channel; } };
    const context = vm.createContext({ console, currentUser: { id: 'me' }, currentConversationId: 'chat', realtimeChannel: null,
        conversations: [{ id: 'chat', unreadCount: 0 }],
        supabaseClient: { channel: () => channel }, document: { querySelector: () => null },
        renderSingleMessage: async m => rendered.push(m.id), loadMessages: async id => refreshed.push(id),
        loadConversations: async () => {}, markMessagesAsRead: async () => {}, scrollToBottom() {}, renderConversationList() {}
    });
    evaluate(context, 'tinnhan.js', 'function subscribeToMessages()', 'if (conversationSearch)');
    context.subscribeToMessages();
    await handlers.INSERT({ new: { id: 'message', conversation_id: 'chat', sender_id: 'seller', content: 'Hello' } });
    await handlers.UPDATE({ new: { id: 'message', conversation_id: 'chat', recalled_at: 'now' } });
    assert.deepEqual(rendered, ['message']);
    assert.deepEqual(refreshed, ['chat']);
});

test('Image uploads keep a private path and reject unsupported or oversized files', async () => {
    const uploaded = [];
    const context = vm.createContext({ currentConversationId: 'new-chat', currentUser: { id: 'me' }, CHAT_BUCKET: 'chat-images',
        crypto: { randomUUID: () => 'image' },
        supabaseClient: { storage: { from(bucket) { assert.equal(bucket, 'chat-images'); return { upload: async path => { uploaded.push(path); return {}; } }; } } }
    });
    evaluate(context, 'tinnhan.js', 'async function uploadChatImage(', 'const conversationPreviewWrites');
    assert.equal(await context.uploadChatImage({ type: 'image/png', size: 10 }, 'original-chat', 'me'), 'me/original-chat/image.png');
    await assert.rejects(context.uploadChatImage({ type: 'image/svg+xml', size: 10 }));
    await assert.rejects(context.uploadChatImage({ type: 'image/png', size: 11 * 1024 * 1024 }));
    assert.equal(uploaded.length, 1);
});

test('Mini chat renders signed private images rather than public storage URLs', async () => {
    const dom = new JSDOM('<div id="messages"></div>');
    try {
        const requested = [];
        const context = vm.createContext({ window: dom.window, document: dom.window.document, URL, console,
            currentUser: { id: 'me' },
            supabaseClient: { storage: { from: () => ({ createSignedUrl: async path => { requested.push(path); return { data: { signedUrl: 'https://signed.invalid/image' } }; } }) } },
            renderMiniReactionSummary() {}, createMiniMessageActions: () => dom.window.document.createElement('div'),
            formatMiniTime: () => '', formatMessageTime: () => ''
        });
        const s = source('iuh-chat-notification.js');
        vm.runInContext(s.split('/* =========================================================')[0], context);
        evaluate(context, 'iuh-chat-notification.js', 'async function renderMiniMessage(', 'async function loadMiniReactions(');
        const container = dom.window.document.getElementById('messages');
        await context.renderMiniMessage({ id: 'message', sender_id: 'me', image_url: 'me/chat/image.png', created_at: new Date().toISOString() }, container);
        assert.equal(container.querySelector('img').src, 'https://signed.invalid/image');
        assert.deepEqual(requested, ['me/chat/image.png']);
    } finally { dom.window.close(); }
});

test('Chat database allows participants to send/read but blocks outsiders', async () => {
    const db = await createDatabase();
    const ids = [1, 2, 3].map(n => '00000000-0000-4000-8000-00000000050' + n);
    const as = async id => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec('set role authenticated'); };
    try {
        for (const id of ids) await db.query('insert into auth.users(id,email) values($1,$2)', [id, id + '@test.invalid']);
        await db.query("insert into public.connection_requests(buyer_id,seller_id,recipient_name,recipient_phone,recipient_address,subtotal,platform_fee,status,fee_confirmed_at) values($1,$2,'Buyer','0901234567','Campus',10000,2000,'connected',now())", [ids[0],ids[1]]);
        await as(ids[0]);
        const create = async () => (await db.query('select public.get_or_create_direct_conversation($1) as chat', [ids[1]])).rows[0].chat.id;
        const id = await create();
        assert.equal(await create(), id);
        await db.query("insert into public.messages(conversation_id,sender_id,content,is_read) values($1,$2,'Hello',false)", [id, ids[0]]);
        await as(ids[1]);
        assert.equal((await db.query('select public.mark_conversation_read($1) as count', [id])).rows[0].count, 1);
        assert.equal((await db.query('select content from public.messages where conversation_id=$1', [id])).rows[0].content, 'Hello');
        await as(ids[2]);
        assert.equal((await db.query('select * from public.messages where conversation_id=$1', [id])).rows.length, 0);
        await assert.rejects(db.query('select public.mark_conversation_read($1)', [id]));
    } finally { await db.close(); }
});
