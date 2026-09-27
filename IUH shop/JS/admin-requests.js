(function(){
 'use strict';
 const db=IUHCore.getClient(),e=IUHSecurity.escapeHTML;
 const nav=document.querySelector('.admin-sidebar nav')||document.querySelector('.admin-sidebar');
 const target=document.querySelector('main')||document.querySelector('.admin-content');
 if(!nav||!target)return;
 const button=document.createElement('button');button.type='button';button.className='admin-nav-item';button.dataset.page='requests';button.textContent='Đối soát và hỗ trợ';nav.append(button);
 const page=document.createElement('section');page.id='page-requests';page.className='admin-page';
 page.innerHTML='<div class="iuh-panel"><h2>Đối soát và hỗ trợ</h2><p>Chỉ xác nhận thanh toán sau khi kiểm tra giao dịch ngân hàng thực tế. Mã giao dịch ngân hàng chỉ được sử dụng một lần.</p><button type="button" id="reloadRequests">Tải lại</button><p id="requestsStatus" role="status"></p><div class="iuh-requests-list" id="requestsList"></div></div>';
 target.append(page);
 button.addEventListener('click',()=>openPage('requests'));
 const list=page.querySelector('#requestsList'),status=page.querySelector('#requestsStatus');
 let rows=new Map(),loading=false;
 const labels={packages:'Gói dịch vụ chờ thanh toán',orders:'Đơn hàng chờ thanh toán',wallet_requests:'Nạp/rút ví',bank_refund_requests:'Hoàn tiền ngân hàng',donations:'Donate',product_reports:'Báo cáo sản phẩm',user_reports:'Báo cáo người dùng',contact_requests:'Yêu cầu hỗ trợ',verification:'Thẻ sinh viên chờ duyệt'};
 const formats={deposit:'Nạp tiền',withdraw:'Rút tiền',pending:'Chờ xử lý',unpaid:'Chưa thanh toán'};
 function actions(kind,row,key){
  if(kind==='orders'&&row.needs_payment_review)return '<p>Đơn cũ cần đối chiếu chứng từ; không tự thu lại hoặc hoàn tiền.</p>';
  const approve=['packages','orders','wallet_requests','bank_refund_requests','donations','verification'].includes(kind);
  return `<button type="button" data-key="${e(key)}" data-action="approve">${approve?'Xác nhận':'Lưu phản hồi'}</button>`+
   (['packages','wallet_requests','donations'].includes(kind)?`<button type="button" data-key="${e(key)}" data-action="reject">Từ chối</button>`:'');
 }
 async function load(){
  if(loading)return;loading=true;status.textContent='Đang tải…';list.replaceChildren();rows=new Map();
  const sources=[['packages',()=>db.from('service_package_payment_requests').select('*').eq('status','pending')],
   ['orders',()=>db.from('orders').select('id,order_code,total_amount,status,payment_status,needs_payment_review,buyer_id').in('payment_method',['qr','iuh_wallet']).neq('status','cancelled').or('payment_status.eq.unpaid,needs_payment_review.eq.true')],
   ['wallet_requests',()=>db.from('wallet_requests').select('*').eq('status','pending')],
   ['bank_refund_requests',()=>db.from('bank_refund_requests').select('*').eq('status','pending')],
   ['donations',()=>db.from('donations').select('*').eq('status','pending')],
   ...['product_reports','user_reports','contact_requests'].map(t=>[t,()=>db.from(t).select('*').in('status',['pending','reviewing'])]),
   ['verification',()=>db.from('users').select('user_id,fullname,student_card_url,verification_status').eq('verification_status','pending')]];
  let failed=0,count=0;
  try{
   const results=await Promise.allSettled(sources.map(async([kind,get])=>({kind,result:await get().limit(100)})));
   for(let i=0;i<results.length;i++){
    const r=results[i],kind=sources[i][0];
    if(r.status==='rejected'||r.value.result.error){failed++;const p=document.createElement('p');p.textContent=`${labels[kind]}: chưa tải được dữ liệu.`;list.append(p);continue;}
    for(const row of r.value.result.data||[]){
     const key=`${kind}:${row.id||row.transaction_code||row.user_id}`;rows.set(key,{kind,row});count++;
     const article=document.createElement('article');
     const money=row.amount??row.total_amount??row.price;
     article.innerHTML=`<strong>${e(labels[kind])} — ${e(row.order_code||row.transaction_code||row.id||row.fullname)}</strong>
      ${money!=null?`<p>Số tiền: ${e(Number(money).toLocaleString('vi-VN'))}đ</p>`:''}
      <p>${e(row.owner_name||row.fullname||row.donor_name||'')} ${e(row.plan_type||formats[row.kind]||'')}</p>
      <p>Tài khoản: ${e(row.owner_id||row.user_id||row.buyer_id||row.reporter_id||row.donor_id||'—')}${row.order_id?` · Đơn #${e(row.order_id)}`:''}</p>
      <p>${e(row.bank||row.bank_name||'')} ${e(row.account||'')}</p>
      <p>${e(row.customer_reference||row.transfer_content||'')}</p>
      <p>${e(row.reason||'')} ${e(row.description||row.message||'')}</p>
      ${actions(kind,row,key)}`;
     if(kind==='verification'&&row.student_card_url){const img=document.createElement('img');img.alt='Thẻ sinh viên đang chờ duyệt';img.style.cssText='display:block;max-width:320px;max-height:220px;object-fit:contain';article.prepend(img);
      const bucket=row.student_card_url.includes('/student-verifications/')?'student-verifications':'student-cards';
      IUHCore.privateImageURL(row.student_card_url,bucket).then(url=>img.src=url).catch(()=>{img.alt='Không tải được ảnh thẻ';});}
     list.append(article);
    }
   }
   status.textContent=`${count} mục đang chờ${failed?`; ${failed} nhóm chưa tải được`:''}.`;
  }finally{loading=false;}
 }
 list.addEventListener('click',async event=>{
  const b=event.target.closest('button[data-key]');if(!b||b.disabled)return;
  const entry=rows.get(b.dataset.key);if(!entry)return;
  const {kind,row}=entry,approve=b.dataset.action==='approve';
  let reference=null,note=null;
  if(approve&&['packages','orders','wallet_requests','bank_refund_requests','donations'].includes(kind)){
   reference=prompt('Nhập mã giao dịch ngân hàng đã đối soát (rút/hoàn: mã chuyển tiền đi thành công):');if(!reference?.trim())return;
  }else if(kind!=='verification'){note=prompt('Ghi chú / phản hồi cho người gửi:');if(note===null)return;}
  if(!confirm('Xác nhận thông tin đã được kiểm tra?'))return;
  b.disabled=true;status.textContent='Đang xử lý…';
  try{
   let query;
   if(kind==='packages')query=db.rpc(approve?'approve_service_package_payment':'reject_service_package_payment',approve?{p_transaction_code:row.transaction_code,p_bank_reference:reference}:{p_transaction_code:row.transaction_code,p_reason:note});
   else if(kind==='orders')query=db.rpc('admin_confirm_order_payment',{p_order_id:row.id,p_reference:reference});
   else if(kind==='wallet_requests')query=db.rpc('review_wallet_request',{p_request_id:row.id,p_approve:approve,p_bank_reference:reference,p_note:note});
   else if(kind==='bank_refund_requests')query=db.rpc('complete_bank_refund',{p_request_id:row.id,p_bank_reference:reference});
   else if(kind==='donations')query=db.rpc('review_donation',{p_donation_id:row.id,p_approve:approve,p_bank_reference:reference,p_note:note});
   else if(kind==='verification')query=db.rpc('admin_set_student_verified',{target_user_id:row.user_id,verified:true});
   else query=db.from(kind).update({status:'resolved',admin_note:note,updated_at:new Date().toISOString()}).eq('id',row.id).select('id').single();
   const {data,error}=await query;if(error||data?.success===false)throw error||new Error(data.message);
   await load();status.textContent='Đã xử lý. '+status.textContent;
  }catch(error){status.textContent=error.message||'Chưa xử lý được yêu cầu.';}finally{b.disabled=false;}
 });
 page.querySelector('#reloadRequests').addEventListener('click',()=>load().catch(err=>status.textContent=err.message));
 window.IUHAdminRequests={load:()=>load().catch(err=>status.textContent=err.message)};
})();
