const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'../IUH shop');
const source = name => fs.readFileSync(path.join(root,'JS',name),'utf8');

(async()=>{
  const mediaSource=source('iuh-chat-notification.js').split('/* =========================================================')[0];
  const context={window:{},URL,console};
  vm.createContext(context);vm.runInContext(mediaSource,context);
  let requested;
  const client={storage:{from:bucket=>({createSignedUrl:async objectPath=>{assert.equal(bucket,'chat-images');requested=objectPath;return {data:{signedUrl:'https://signed.invalid/image'},error:null};}})}};
  assert.equal(await context.window.IUHChatMedia.signedURL(client,'https://evil.invalid/track'), '');
  assert.equal(requested,undefined);
  await context.window.IUHChatMedia.signedURL(client,'user/chat/image.jpg');
  assert.equal(requested,'user/chat/image.jpg');
  await context.window.IUHChatMedia.signedURL(client,'https://xecxofmogvqysejjpxvl.supabase.co/storage/v1/object/public/chat-images/user/chat/old.jpg');
  assert.equal(requested,'user/chat/old.jpg');
  console.log('PASS: private chat URL signing (0 live requests)');
})().catch(error=>{console.error(error);process.exitCode=1;});
