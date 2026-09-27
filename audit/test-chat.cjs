/* Offline regression test. Uses the actual sendMessage function and mocks
 * storage/database; never connects to Supabase or changes application files.
 * Run: node audit/test-chat.cjs
 * Covers switching conversations during upload and duplicate send protection.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const filename = path.resolve(__dirname, '../IUH shop/JS/tinnhan.js');
const source = fs.readFileSync(filename, 'utf8');
const start = source.indexOf('let chatSendInFlight = false;');
const end = source.indexOf('async function uploadChatImage(');
assert.ok(start >= 0 && end > start, 'Source function boundaries were not found');

let releaseUpload;
let insertedMessage;
let insertCount = 0;
let renderedCount = 0;
let clearedImageCount = 0;
const context = {
  currentUser: { id: 'sender' },
  currentConversationId: 'conversation-A',
  messageInput: { value: 'Private message intended for A', focus() {} },
  selectedImage: { name: 'image.png' },
  sendButton: { disabled: false },
  pendingProductId: null,
  conversations: [],
  uploadChatImage: () => new Promise(resolve => { releaseUpload = resolve; }),
  supabaseClient: {
    from(table) {
      assert.equal(table, 'messages');
      return {
        insert(row) {
          insertCount++;
          insertedMessage = row;
          return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
        }
      };
    }
  },
  updateConversationLastMessage: async () => {},
  removeSelectedImage() { clearedImageCount++; },
  renderSingleMessage: async () => { renderedCount++; },
  scrollToBottom() {},
  renderConversationList() {},
  console,
  alert(message) { throw new Error(`Unexpected alert: ${message}`); }
};

vm.createContext(context);
vm.runInContext(source.slice(start, end), context, { filename });

(async () => {
  const sending = context.sendMessage();
  assert.equal(typeof releaseUpload, 'function', 'Expected send to be waiting for upload');
  context.currentConversationId = 'conversation-B';
  context.messageInput.value = 'New draft for B';
  await context.sendMessage();
  releaseUpload('https://example.invalid/photo.png');
  await sending;
  assert.equal(insertedMessage.conversation_id, 'conversation-A');
  assert.equal(insertedMessage.content, 'Private message intended for A');
  assert.equal(context.messageInput.value, 'New draft for B');
  assert.equal(insertCount, 1);
  assert.equal(renderedCount, 0, 'Do not render A message in B');
  assert.equal(clearedImageCount, 0);
  console.log(JSON.stringify({
    passed: true,
    expectedRecipient: 'conversation-A',
    actualRecipient: insertedMessage.conversation_id,
    liveRequests: 0
  }));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
