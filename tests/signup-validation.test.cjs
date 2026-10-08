const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
function fixture(){
 const dom=new JSDOM(fs.readFileSync('IUH shop/HTML/dangky.html','utf8'),{url:'https://shop.invalid/HTML/dangky.html',runScripts:'outside-only'});
 const w=dom.window,d=w.document,calls=[];
 w.IUHCore={getClient:()=>({auth:{signUp:async body=>{calls.push(body);return {data:{user:{id:'new-user'},session:null}};}}})};
 w.IUHCaptcha = { takeToken: () => 'test-token', reset() {} };
    w.eval(fs.readFileSync('IUH shop/JS/dangky.js','utf8'));
 const submit=()=>d.getElementById('registerForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const fill=()=>{for(const [id,value] of Object.entries({fullName:'Nguyễn Văn A',studentId:'12345678',email:'a@example.com',phone:'0901234567',password:'password123',confirmPassword:'password123'}))d.getElementById(id).value=value;d.getElementById('faculty').selectedIndex=1;d.getElementById('agreeTerms').checked=true;};
 return {w,d,calls,submit,fill};
}
test('Empty signup names every missing field, links inline errors and focuses the first field',()=>{
 const f=fixture();try{
  f.submit();assert.equal(f.calls.length,0);
  assert.equal(f.d.activeElement.id,'fullName');
  for(const id of ['fullName','studentId','faculty','email','phone','password','confirmPassword','agreeTerms']){
   const field=f.d.getElementById(id),error=f.d.getElementById(id+'Error');
   assert.equal(field.getAttribute('aria-invalid'),'true');assert.equal(error.hidden,false);assert.ok(error.textContent);
   assert.match(field.getAttribute('aria-describedby'),new RegExp(id+'Error'));
  }
  assert.match(f.d.getElementById('formMessage').textContent,/Họ và tên.*Mã số sinh viên.*Khoa.*Email/);
  f.fill();f.d.getElementById('phone').dispatchEvent(new f.w.Event('input',{bubbles:true}));
  assert.equal(f.d.querySelectorAll('[aria-invalid="true"]').length,0);
 }finally{f.w.close();}
});
test('Invalid email, phone and mismatched password prevent signup; corrected form submits once',async()=>{
 const f=fixture();try{
  f.fill();f.d.getElementById('email').value='invalid';f.d.getElementById('phone').value='abc';f.d.getElementById('confirmPassword').value='different';
  f.submit();assert.equal(f.calls.length,0);assert.equal(f.d.activeElement.id,'email');
  assert.match(f.d.getElementById('confirmPasswordError').textContent,/không trùng/);
  f.fill();f.submit();f.submit();await new Promise(r=>setTimeout(r,0));
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.data.role,undefined);
  assert.match(f.d.getElementById('formMessage').textContent,/kiểm tra email/);
 }finally{f.w.close();}
});
