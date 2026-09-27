(function(){
 'use strict';
 const db=IUHCore.getClient();let sdkPromise,instance,version=0,timer,loadingTimer,orderId,busy=false,lastURL='';
 const dialog=document.createElement('dialog');dialog.className='payos-order-dialog';
 dialog.innerHTML='<header><h2>Thanh toán đơn hàng</h2><button type="button" data-close>Đóng ×</button></header><p data-summary></p><p data-status role="status" aria-live="polite"></p><div id="payosOrderFrame" hidden></div><div class="payos-order-actions"><button type="button" data-check>Kiểm tra thanh toán</button><button type="button" data-retry hidden>Tải lại QR</button><a data-fallback target="_blank" rel="noopener noreferrer" hidden>Mở tab riêng nếu khung QR không hiển thị</a></div>';
 document.body.append(dialog);const $=s=>dialog.querySelector(s),holder=$('#payosOrderFrame');
 async function request(action,id){
  const result=await db.functions.invoke('payos-order',{timeout:45000,body:{action,orderId:Number(id)}});
  if(result.error){let detail;try{detail=await result.error.context?.json();}catch{}throw new Error(detail?.error||'Chưa kiểm tra được giao dịch. Hãy thử lại cùng đơn hàng.');}
  if(result.data?.error)throw new Error(result.data.error);return result.data;
 }
 function sdk(){
  if(window.PayOSCheckout?.usePayOS)return Promise.resolve(window.PayOSCheckout);
  if(!sdkPromise)sdkPromise=new Promise((resolve,reject)=>{
   const s=document.createElement('script');s.src='https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js';
   const fail=()=>{clearTimeout(t);s.remove();sdkPromise=null;reject(new Error('Không tải được QR. Bấm tải lại hoặc mở tab riêng.'));};
   const t=setTimeout(fail,15000);s.onerror=fail;s.onload=()=>{clearTimeout(t);window.PayOSCheckout?.usePayOS?resolve(window.PayOSCheckout):fail();};document.head.append(s);
  });return sdkPromise;
 }
 function clearFrame(){clearTimeout(loadingTimer);if(instance&&holder.querySelector('iframe'))instance.exit();instance=null;holder.replaceChildren();holder.hidden=true;}
 function close(){version++;clearTimeout(timer);clearFrame();dialog.close();busy=false;}
 async function mount(url,v){
  clearFrame();holder.hidden=false;$('[data-retry]').hidden=true;$('[data-status]').textContent='Đang tải QR…';
  try{
   const api=await sdk();if(v!==version||!dialog.open)return;
   instance=api.usePayOS({RETURN_URL:location.origin+location.pathname,ELEMENT_ID:'payosOrderFrame',CHECKOUT_URL:url,embedded:true,
    onSuccess:()=>{if(v===version&&dialog.open)check();},onCancel:()=>{if(v===version&&dialog.open)check();},
    onExit:()=>{if(v===version&&dialog.open){clearTimeout(loadingTimer);holder.hidden=true;$('[data-retry]').hidden=false;$('[data-status]').textContent='Khung QR đã đóng. Có thể mở lại cùng giao dịch.';}}});
   instance.open();const frame=holder.querySelector('iframe');if(!frame)throw new Error('Chưa mở được khung QR. Vui lòng tải lại.');
   frame.title='Thanh toán đơn hàng IUH Shop qua payOS';
   loadingTimer=setTimeout(()=>{if(v===version){$('[data-retry]').hidden=false;$('[data-status]').textContent='Khung QR tải chậm. Bạn có thể tải lại hoặc mở tab riêng.';}},20000);
   frame.addEventListener('load',()=>{if(v===version){clearTimeout(loadingTimer);$('[data-status]').textContent='Quét QR bằng ứng dụng ngân hàng. Hệ thống tự kiểm tra thanh toán.';}},{once:true});
  }catch(error){if(v===version){holder.hidden=true;$('[data-status]').textContent=error.message;$('[data-retry]').hidden=false;}}
 }
 function render(data,v){
  $('[data-summary]').textContent='Đơn '+data.order_code+' · '+Number(data.total_amount).toLocaleString('vi-VN')+'đ';
  const done=data.payment_status!=='unpaid'||data.status==='cancelled'||['review','expired','cancelled'].includes(data.payos_status)||data.needs_payment_review;
  if(done){
   clearTimeout(timer);clearFrame();lastURL='';$('[data-fallback]').hidden=true;$('[data-retry]').hidden=true;$('[data-check]').hidden=true;
   $('[data-status]').textContent=data.needs_payment_review||data.payos_status==='review'?'Giao dịch cần đối soát. Không thanh toán lại; liên hệ hỗ trợ kèm mã đơn.':data.payment_status==='paid'?'Đã xác nhận thanh toán. Người bán sẽ xử lý đơn hàng.':data.payment_status==='refund_pending'?'Đơn đã hủy, đang chờ hoàn tiền ngân hàng.':'Link thanh toán đã hủy/hết hạn. Bạn có thể hủy đơn và đặt lại.';
   window.refreshPageData?.();return;
  }
  const url=data.checkout_url;
  if(typeof url==='string'&&/^https:\/\/pay\.payos\.vn\/web\/[A-Za-z0-9_-]+$/.test(url)){
   const a=$('[data-fallback]');a.href=url;a.hidden=false;
   if(lastURL!==url||!holder.querySelector('iframe')){lastURL=url;mount(url,v);}
  }
  clearTimeout(timer);timer=setTimeout(()=>check(),10000);
 }
 async function check(action='status'){
  if(busy||!dialog.open)return;const v=version,id=orderId;busy=true;$('[data-check]').disabled=true;
  try{const data=await request(action,id);if(v===version&&dialog.open)render(data,v);}
  catch(error){if(v===version){$('[data-status]').textContent=error.message;clearTimeout(timer);}}
  finally{if(v===version){busy=false;$('[data-check]').disabled=false;}}
 }
 function open(id){
  if(!Number.isSafeInteger(Number(id))||Number(id)<=0)return;
  version++;clearTimeout(timer);clearFrame();busy=false;orderId=Number(id);lastURL='';
  $('[data-summary]').textContent='Đang tải đơn hàng…';$('[data-status]').textContent='';$('[data-check]').hidden=false;$('[data-check]').disabled=false;$('[data-retry]').hidden=true;$('[data-fallback]').hidden=true;
  if(!dialog.open)dialog.showModal();check('create');
 }
 $('[data-close]').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 $('[data-check]').addEventListener('click',()=>check());$('[data-retry]').addEventListener('click',()=>{if(busy)return;if(lastURL)mount(lastURL,++version);else check();});
 document.addEventListener('click',event=>{const b=event.target.closest('[data-payos-order]');if(b)open(b.dataset.payosOrder);});
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')close();});
 window.IUHPayosOrders={open,request};
 const id=new URLSearchParams(location.search).get('payos_order');if(id){history.replaceState(null,'',location.pathname);open(id);}
})();
