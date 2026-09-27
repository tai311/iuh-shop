const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'../IUH shop');
const source = name => fs.readFileSync(path.join(root,'JS',name),'utf8');

async function signupScenario({session,uploadFailure=false,signupFailure=false}) {
  const counts={upload:0,profile:0,signup:0};
  const nodes={}; let submit;
  const element = id => nodes[id] ||= {value:'value',checked:true,textContent:'',disabled:false,style:{},classList:{remove(){},add(){}},appendChild(){},replaceChildren(){},addEventListener(){}};
  Object.assign(element('password'),{value:'valid-password-1'});
  Object.assign(element('confirmPassword'),{value:'valid-password-1'});
  Object.assign(element('studentCard'),{files:[{type:'image/jpeg',size:100,name:'card.jpg'}]});
  const button=element('button');
  Object.assign(element('registerForm'),{querySelector:()=>button,addEventListener:(_,fn)=>submit=fn});
  const client={
    auth:{signUp:async()=>{counts.signup++;return signupFailure?{error:{message:'Unavailable'}}:{data:{user:{id:'user-1'},session},error:null};}},
    storage:{from:bucket=>({upload:async objectPath=>{assert.equal(bucket,'student-cards');assert.equal(objectPath,'user-1/random-id.jpg');counts.upload++;return {error:uploadFailure?new Error('Upload blocked'):null};}})},
    from:table=>({update:values=>{counts.profile++;assert.equal(table,'users');assert.equal(values.student_card_url,'user-1/random-id.jpg');assert.equal(values.verification_status,'pending');return {eq:()=>({select:()=>({single:async()=>({data:{user_id:'user-1'},error:null})})})};}})
  };
  const context={window:{location:{href:'https://shop.invalid/HTML/dangky.html'},supabase:{createClient:()=>client}},document:{getElementById:element,createElement:()=>({})},URL,crypto:{randomUUID:()=> 'random-id'},alert(){},console:{error(){}}};
  context.window.IUHCore={getClient:()=>client};
  vm.createContext(context);vm.runInContext(source('dangky.js'),context);
  await submit({preventDefault(){}});
  return {counts,button,message:element('formMessage').textContent,context};
}

(async()=>{
  let result=await signupScenario({session:null});
  assert.deepEqual(result.counts,{signup:1,upload:0,profile:0});
  assert.equal(result.button.disabled,true);
  assert.match(result.message,/email/);
  result=await signupScenario({session:{user:{id:'user-1'}}});
  assert.deepEqual(result.counts,{signup:1,upload:1,profile:1});
  assert.equal(result.context.window.location.href,'taikhoan.html');
  result=await signupScenario({session:{},uploadFailure:true});
  assert.equal(result.counts.profile,0);
  assert.equal(result.button.disabled,true,'Existing account should continue verification instead of retry signup');
  result=await signupScenario({signupFailure:true});
  assert.equal(result.button.disabled,false,'Signup failure releases retry button');

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
  console.log('PASS: signup confirmation, private card upload, recovery paths, private chat URL signing (0 live requests)');
})().catch(error=>{console.error(error);process.exitCode=1;});
