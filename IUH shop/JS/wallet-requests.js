(function(){
 'use strict';
 const host=document.querySelector('main')||document.querySelector('.wallet-container');if(!host)return;
 const panel=document.createElement('section');panel.className='iuh-panel';
 panel.innerHTML='<h2>Yêu cầu nạp/rút tiền</h2><p>Gửi yêu cầu chưa đồng nghĩa với hoàn tất chuyển khoản ngân hàng.</p><button type="button">Tải lại</button><div role="status"></div>';
 host.append(panel);const output=panel.querySelector('[role=status]');let busy=false;
 async function load(){if(busy)return;busy=true;output.textContent='Đang tải…';try{
  const db=IUHCore.getClient(),{data:auth,error:authError}=await db.auth.getUser();if(authError||!auth.user){output.textContent='Đăng nhập để xem yêu cầu của bạn.';return;}
  const {data,error}=await db.from('wallet_requests').select('id,kind,amount,status,bank,account,admin_note,created_at').eq('user_id',auth.user.id).order('created_at',{ascending:false}).limit(50);if(error)throw error;
  const e=IUHSecurity.escapeHTML,labels={pending:'Chờ đối soát',approved:'Đã đối soát',rejected:'Đã từ chối'};
  output.innerHTML=(data||[]).map(r=>`<article><strong>${r.kind==='deposit'?'Nạp':'Rút'} ${e(Number(r.amount).toLocaleString('vi-VN'))}đ · ${e(labels[r.status]||r.status)}</strong><p>${e(r.bank)} ${e(r.account||'')} · ${e(new Date(r.created_at).toLocaleString('vi-VN'))}</p><p>${e(r.admin_note||'')}</p></article>`).join('')||'Chưa có yêu cầu nạp/rút tiền.';
 }catch(error){output.textContent='Chưa tải được yêu cầu: '+error.message;}finally{busy=false;}}
 panel.querySelector('button').addEventListener('click',load);window.IUHWalletRequests={load};load();
})();
