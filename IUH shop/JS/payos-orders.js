(function(){
 'use strict';
 const db=IUHCore.getClient();let version=0,timer,orderId,busy=false,lastQR='';
 const dialog=document.createElement('dialog');dialog.className='payos-order-dialog';
 dialog.innerHTML='<header><h2>Thanh toán đơn hàng</h2><button type="button" data-close>Đóng ×</button></header><p data-summary></p><p data-status role="status" aria-live="polite"></p><div id="payosOrderFrame" hidden></div><div class="payos-order-actions"><button type="button" data-check>Kiểm tra thanh toán</button><a data-download download="iuh-shop-thanh-toan.gif" hidden>Tải ảnh QR</a><a data-fallback target="_blank" rel="noopener noreferrer" hidden>Mở trang thanh toán payOS nếu cần</a></div>';
 document.body.append(dialog);const $=s=>dialog.querySelector(s),holder=$('#payosOrderFrame');
 async function request(action,id){
  const result=await db.functions.invoke('payos-order',{timeout:45000,body:{action,orderId:Number(id)}});
  if(result.error){let detail;try{detail=await result.error.context?.json();}catch{}throw new Error(detail?.error||'Chưa kiểm tra được giao dịch. Hãy thử lại cùng đơn hàng.');}
  if(result.data?.error)throw new Error(result.data.error);return result.data;
 }
 function clearFrame(){holder.replaceChildren();holder.hidden=true;lastQR='';$('[data-download]').hidden=true;$('[data-download]').removeAttribute('href');}
 function close(){version++;clearTimeout(timer);clearFrame();dialog.close();busy=false;}
 function render(data,v){
  $('[data-summary]').textContent='Đơn '+data.order_code+' · '+Number(data.total_amount).toLocaleString('vi-VN')+'đ';
  const done=data.payment_status!=='unpaid'||data.status==='cancelled'||['review','expired','cancelled'].includes(data.payos_status)||data.needs_payment_review;
  if(done){
   clearTimeout(timer);clearFrame();$('[data-fallback]').hidden=true;$('[data-check]').hidden=true;
   $('[data-status]').textContent=data.needs_payment_review||data.payos_status==='review'?'Giao dịch cần đối soát. Không thanh toán lại; liên hệ hỗ trợ kèm mã đơn.':data.payment_status==='paid'?'Đã xác nhận thanh toán. Người bán sẽ xử lý đơn hàng.':data.payment_status==='refund_pending'?'Đơn đã hủy, đang chờ hoàn tiền ngân hàng.':'Link thanh toán đã hủy/hết hạn. Bạn có thể hủy đơn và đặt lại.';
   window.refreshPageData?.();return;
  }
  const url=data.checkout_url;
  if(typeof url==='string'&&/^https:\/\/pay\.payos\.vn\/web\/[A-Za-z0-9_-]+$/.test(url)){
   const a=$('[data-fallback]');a.href=url;a.hidden=false;
  }
  if(typeof data.qr_code==='string'&&data.qr_code.startsWith('000201')&&data.qr_code.length>=20&&data.qr_code.length<=4096){
   if(lastQR!==data.qr_code){
    clearFrame();
    try{
     const qr=window.qrcode(0,'M');qr.addData(data.qr_code,'Byte');qr.make();
     const img=document.createElement('img');img.src=qr.createDataURL(6,24);img.alt='Mã QR thanh toán đơn '+data.order_code;
     holder.replaceChildren(img);holder.hidden=false;lastQR=data.qr_code;
     const download=$('[data-download]');download.href=img.src;download.hidden=false;
    }catch{$('[data-status]').textContent='Chưa hiển thị được QR. Hãy tải lại trang hoặc mở trang payOS bên dưới.';return;}
   }
   $('[data-status]').textContent='Quét QR bằng ứng dụng ngân hàng, hoặc tải ảnh QR để chọn từ thư viện ảnh. Hệ thống tự xác nhận khi nhận đủ tiền.';
  }else{
   clearFrame();$('[data-status]').textContent='Link này chưa có dữ liệu QR trực tiếp. Dùng liên kết payOS bên dưới để thanh toán cùng đơn; không cần tạo đơn mới.';
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
  version++;clearTimeout(timer);clearFrame();busy=false;orderId=Number(id);
  $('[data-summary]').textContent='Đang tải đơn hàng…';$('[data-status]').textContent='';$('[data-check]').hidden=false;$('[data-check]').disabled=false;$('[data-fallback]').hidden=true;
  if(!dialog.open)dialog.showModal();check('create');
 }
 $('[data-close]').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 $('[data-check]').addEventListener('click',()=>check());
 document.addEventListener('click',event=>{const b=event.target.closest('[data-payos-order]');if(b)open(b.dataset.payosOrder);});
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')close();});
 window.IUHPayosOrders={open,request};
 const id=new URLSearchParams(location.search).get('payos_order');if(id){history.replaceState(null,'',location.pathname);open(id);}
})();
