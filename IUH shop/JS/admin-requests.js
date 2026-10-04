(function () {
 'use strict';
 const db=IUHCore.getClient(),e=IUHSecurity.escapeHTML;
 const nav=document.querySelector('.admin-sidebar nav'),main=document.querySelector('main');
 if(!nav||!main)return;
 const kinds={orders:'Đơn hàng',packages:'Gói dịch vụ',wallet_requests:'Nạp / rút ví',bank_refund_requests:'Hoàn tiền',contact_requests:'Hỗ trợ',product_reports:'Báo cáo sản phẩm',user_reports:'Báo cáo người dùng',verification:'Xác minh sinh viên',donations:'Ủng hộ'};
 const labels={pending:'Chờ xử lý',confirmed:'Đã xác nhận',shipping:'Đang giao',delivered:'Đã giao',completed:'Hoàn tất',cancelled:'Đã hủy',paid:'Đã thanh toán',unpaid:'Chưa thanh toán',refunded:'Đã hoàn tiền',refund_pending:'Chờ hoàn tiền',revoked:'Đã thu hồi',approved:'Đã duyệt',rejected:'Từ chối',reviewing:'Đang hỗ trợ',resolved:'Đã giải quyết',none:'Chưa xác minh',cash:'Tiền mặt',qr:'Chuyển khoản QR',iuh_wallet:'Ví IUH',wallet:'Ví IUH',bank:'Ngân hàng',bank_transfer:'Chuyển khoản',trial:'Chạy thử',deposit:'Nạp ví',withdraw:'Rút ví',personal:'Cá nhân',group:'Nhóm',meet:'Gặp trực tiếp',delivery:'Giao hàng'};
 const states={orders:['pending','confirmed','shipping','delivered','completed','cancelled'],packages:['pending','paid','cancelled'],wallet_requests:['pending','approved','rejected'],bank_refund_requests:['pending','completed'],donations:['pending','completed','rejected'],verification:['pending','approved'],contact_requests:['pending','reviewing','resolved','rejected'],product_reports:['pending','reviewing','resolved','rejected'],user_reports:['pending','reviewing','resolved','rejected']};
 const money=v=>v==null?'—':Number(v).toLocaleString('vi-VN')+' ₫',date=v=>v?new Date(v).toLocaleString('vi-VN'):'—',label=v=>labels[v]||v||'—';
 const payoutLabel=v=>({not_ready:'Chưa đủ điều kiện chuyển',pending:'Chờ chuyển ngân hàng',paid:'Đã chuyển ngân hàng',wallet_credited:'Đã cộng Ví IUH',trial:'Chờ ghi nhận chạy thử',trial_recorded:'Đã ghi nhận doanh thu chạy thử',review:'Cần đối soát',cash:'Người mua trả trực tiếp'})[v]||'Chưa phân bổ';
 function financePanel(f){return f?'<section class="ops-finance"><h3>Phân bổ tiền đơn hàng</h3><dl class="ops-facts"><div><dt>Khách thanh toán</dt><dd>'+money(f.total_amount)+'</dd></div><div><dt>Phí sàn '+e(f.fee_rate)+'% '+(f.fee_rate===5?'trên giá người bán':'ký gửi')+'</dt><dd>'+money(f.platform_fee)+'</dd></div><div><dt>Phí vận chuyển (riêng)</dt><dd>'+money(f.shipping_fee)+'</dd></div><div><dt>Người bán được nhận</dt><dd><strong>'+money(f.seller_net)+'</strong></dd></div><div><dt>Trạng thái chi</dt><dd>'+e(payoutLabel(f.payout_status))+'</dd></div><div><dt>Còn chờ chuyển ngân hàng</dt><dd>'+money(f.remaining_payout)+'</dd></div></dl></section>':'';}
 const badge=v=>`<span class="ops-badge ops-${/^[a-z_]+$/.test(v)?v:'unknown'}">${e(label(v))}</span>`;
 const button=document.createElement('button');button.type='button';button.className='admin-nav-item';button.dataset.page='requests';button.textContent='Đối soát & hỗ trợ';nav.insertBefore(button,nav.querySelector('[data-page=orders]'));
 const page=document.createElement('section');page.id='page-requests';page.className='admin-page ops';
 page.innerHTML=`<header class="ops-heading"><div><span class="ops-eyebrow">KHÔNG GIAN QUẢN TRỊ</span><h2>Đối soát & hỗ trợ</h2><p>Theo dõi đơn phát sinh, dòng tiền và yêu cầu của người dùng.</p></div><button type="button" id="opsReload">Làm mới</button></header>
 <div class="ops-tabs" role="group" aria-label="Nhóm hồ sơ">${Object.entries(kinds).map(([k,v])=>`<button type="button" data-kind="${k}">${v}<span data-count="${k}">—</span></button>`).join('')}</div>
 <p class="ops-hint">Số trên mỗi nhóm là hồ sơ cần theo dõi trong toàn hệ thống. Danh sách bao gồm cả lịch sử.</p>
 <form class="ops-filters" id="opsFilters"><label>Tìm hồ sơ<input id="opsSearch" maxlength="120" placeholder="Mã hồ sơ, tên hoặc ID người tạo"></label><label>Trạng thái xử lý<select id="opsState"></select></label><label id="opsPaymentLabel">Thanh toán<select id="opsPayment"><option value="">Tất cả thanh toán</option><option value="unpaid">Chưa thanh toán</option><option value="paid">Đã thanh toán</option><option value="refund_pending">Chờ hoàn tiền</option><option value="refunded">Đã hoàn tiền</option></select></label><label class="ops-check"><input type="checkbox" id="opsAttention">Chỉ cần theo dõi</label><button type="submit">Tìm / lọc</button></form>
 <div class="ops-list-heading"><h3 id="opsTitle">Đơn hàng</h3><span id="opsStatus" role="status" aria-live="polite"></span></div><div id="opsList"></div><div class="ops-pagination"><button type="button" id="opsPrev">← Trước</button><span id="opsPage"></span><button type="button" id="opsNext">Sau →</button></div>`;
 main.append(page);
 const dialog=document.createElement('dialog');dialog.className='ops-dialog';dialog.setAttribute('aria-labelledby','opsDetailTitle');dialog.innerHTML='<div class="ops-detail-top"><h2 id="opsDetailTitle">Chi tiết hồ sơ</h2><button type="button" id="opsClose" aria-label="Đóng chi tiết">Đóng ×</button></div><div id="opsDetail"></div>';document.body.append(dialog);
 const $=id=>document.getElementById(id);
 let kind='orders',pageNumber=1,total=0,request=0,detailRequest=0,selected=null,busy=false,authorized=false;
 let filters={status:'',payment:'',search:'',attention:false};
 async function requireAdmin(){const {data,error}=await db.auth.getUser();if(error||!data?.user)throw new Error('Vui lòng đăng nhập tài khoản admin.');const profile=await db.from('users').select('role').eq('user_id',data.user.id).single();if(profile.error||profile.data?.role!=='admin')throw new Error('Chỉ tài khoản admin được xem khu vực này.');}
 function clearPrivate(){request++;detailRequest++;authorized=false;selected=null;$('opsList').replaceChildren();$('opsDetail').replaceChildren();$('opsStatus').textContent='Phiên quản trị đã kết thúc.';if(dialog.open)dialog.close();}
 db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'||event==='USER_DELETED')clearPrivate();});
 function controls(){
  $('opsTitle').textContent=kinds[kind];page.querySelectorAll('[data-kind]').forEach(b=>{b.classList.toggle('selected',b.dataset.kind===kind);b.setAttribute('aria-pressed',String(b.dataset.kind===kind));});
  $('opsState').innerHTML='<option value="">Tất cả trạng thái</option>'+states[kind].map(s=>`<option value="${s}">${label(s)}</option>`).join('');$('opsState').value=filters.status;$('opsPayment').value=filters.payment;$('opsPaymentLabel').hidden=!['orders','packages'].includes(kind);
 }
 async function load(){
  const token=++request;$('opsStatus').textContent='Đang tải…';$('opsList').replaceChildren();$('opsPrev').disabled=true;$('opsNext').disabled=true;
  try{
   await requireAdmin();if(token!==request)return;authorized=true;
   const {data,error}=await db.rpc('admin_operations_list',{p_kind:kind,p_status:filters.status,p_payment:filters.payment,p_search:filters.search,p_page:pageNumber,p_attention:filters.attention});
   if(token!==request)return;if(error)throw error;
   total=Number(data.total);if(pageNumber>1&&total<=(pageNumber-1)*20){pageNumber=Math.max(1,Math.ceil(total/20));return load();}
   page.querySelectorAll('[data-count]').forEach(s=>s.textContent=data.counts?.[s.dataset.count]||0);$('opsStatus').textContent=`${total.toLocaleString('vi-VN')} hồ sơ · mới nhất trước`;
   $('opsList').innerHTML=data.rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Hồ sơ / phát sinh</th><th>Người tạo / người mua</th><th>Số tiền</th><th>Xử lý</th><th>Thanh toán / hình thức</th><th>Chi tiết</th></tr></thead><tbody>${data.rows.map(r=>`<tr><td><strong>${e(r.code)}</strong><small>${e(date(r.created_at))}</small>${r.needs_payment_review?'<span class="ops-warning">Cần đối soát</span>':''}</td><td>${e(r.actor_name||'Không có tên')}<small>${e(r.actor_id||'Khách chưa có tài khoản')}</small></td><td>${money(r.amount)}${r.finance?'<small>Phí sàn: '+money(r.finance.platform_fee)+'</small><small>Vận chuyển: '+money(r.finance.shipping_fee)+'</small><strong>Người bán: '+money(r.finance.seller_net)+'</strong><small>'+e(payoutLabel(r.finance.payout_status))+'</small>':''}</td><td>${badge(r.status)}</td><td>${r.payment_status?badge(r.payment_status):''}<small>${e(label(r.payment_method))}</small></td><td><button type="button" data-detail="${e(r.id)}">Xem chi tiết</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">Không có hồ sơ phù hợp với bộ lọc này.</div>';
   const columns=['Hồ sơ / phát sinh','Người tạo / người mua','Số tiền','Xử lý','Thanh toán / hình thức','Chi tiết'];$('opsList').querySelectorAll('tbody tr').forEach(tr=>Array.from(tr.cells).forEach((td,i)=>td.dataset.label=columns[i]));
   $('opsPage').textContent=`Trang ${pageNumber} / ${Math.max(1,Math.ceil(total/20))}`;$('opsPrev').disabled=pageNumber===1;$('opsNext').disabled=pageNumber*20>=total;
  }catch(err){if(token!==request)return;authorized=false;$('opsStatus').textContent=err.message||'Không tải được dữ liệu. Hãy thử làm mới.';$('opsPage').textContent='';}
 }
 const fields={order_code:'Mã đơn',transaction_code:'Mã thanh toán',plan_type:'Loại gói',kind:'Loại yêu cầu',payment_method:'Hình thức thanh toán',recipient_name:'Người nhận hàng',recipient_phone:'Điện thoại nhận hàng',recipient_address:'Địa chỉ nhận hàng',shipping_method:'Cách giao hàng',shipping_fee:'Phí vận chuyển',subtotal:'Tiền hàng',total_amount:'Tổng thanh toán',amount:'Số tiền',price:'Giá gói',captured_amount:'Đã ghi nhận thu',payment_reference:'Mã giao dịch thu',bank_reference:'Mã giao dịch ngân hàng',bank:'Ngân hàng nhận',account:'Tài khoản nhận',customer_reference:'Mã khách cung cấp',order_id:'Đơn liên quan',product_id:'Sản phẩm được báo cáo',fullname:'Họ tên liên hệ',email:'Email liên hệ',phone:'Điện thoại liên hệ',message:'Nội dung hỗ trợ',reason:'Lý do',description:'Mô tả',note:'Ghi chú',admin_note:'Phản hồi quản trị',cancellation_reason:'Lý do hủy',donor_name:'Người ủng hộ',bank_name:'Ngân hàng',transfer_content:'Nội dung chuyển khoản',created_at:'Thời điểm tạo',updated_at:'Cập nhật cuối',payment_approved_at:'Admin duyệt thanh toán',buyer_confirmed_at:'Người mua xác nhận nhận hàng',paid_at:'Ghi nhận thanh toán',settled_at:'Phân bổ tiền vào ví',completed_at:'Hoàn tất',reviewed_at:'Duyệt yêu cầu',expires_at:'Hết hạn',verified_at:'Xác minh'};
 function actionForm(r,k){
  if(['packages','orders'].includes(k)&&r.payos_order_code)return '<p class="ops-hint">Thanh toán payOS được xác minh tự động. Nếu cần đối soát, tra mã payOS và chứng từ bên trên; không xác nhận thu tiền lần nữa.</p>';
  const support=['contact_requests','product_reports','user_reports'].includes(k);
  const actionable=support||(!r.needs_payment_review&&(k==='orders'?r.status==='pending'&&!r.payment_approved_at:(r.status||r.verification_status)==='pending'));
  if(!actionable)return '<p class="ops-hint">Hồ sơ này không có thao tác đối soát đang chờ.</p>';
  if(k==='verification')return '<form id="opsAction"><p>Kiểm tra ảnh thẻ trước khi duyệt xác minh.</p><button name="decision" value="approve">Duyệt xác minh</button><p id="opsActionStatus" role="status"></p></form>';
    const bankReference=k==='packages'?r.payment_method==='bank':r.payment_method==='cash'||r.payment_method==='qr'&&r.payment_status!=='paid';
    return `<form id="opsAction" class="ops-action"><h3>${support?'Xử lý hỗ trợ':'Đối soát giao dịch'}</h3>${support?'<label>Trạng thái phản hồi<select id="opsResolution">'+states[k].map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${label(s)}</option>`).join('')+'</select></label>':bankReference?'<p>Chỉ xác nhận sau khi kiểm tra giao dịch ngân hàng thực tế. Nhập mã chứng từ đã đối soát.</p><label>Mã giao dịch ngân hàng<input id="opsReference" maxlength="200" autocomplete="off"></label>':r.payment_method==='trial'&&k==='packages'?'<p>Admin duyệt sẽ kích hoạt gói; hủy sẽ đóng yêu cầu. Giá trị gói được ghi nhận vào doanh thu chạy thử khi duyệt.</p>':r.payment_method==='trial'?'<p>Xác nhận thanh toán sẽ gửi đơn đến người bán. Doanh thu và phí chạy thử được ghi nhận khi admin hoàn tất đơn sau khi người bán báo đã giao.</p>':'<p>Khoản tiền đã được giữ trong ví. Duyệt sẽ kích hoạt gói và phân bổ khoản tiền cho admin.</p>'}<label>Ghi chú / phản hồi<textarea id="opsNote" maxlength="2000" rows="3">${e(r.admin_note||'')}</textarea></label><label class="ops-check"><input type="checkbox" required>Tôi đã kiểm tra hồ sơ và thông tin xử lý.</label><div><button name="decision" value="approve">${support?'Lưu phản hồi':k==='packages'?'Duyệt gói':'Xác nhận giao dịch'}</button> ${['packages','wallet_requests','donations'].includes(k)?'<button name="decision" value="reject" class="ops-secondary">Từ chối</button>':''}</div><p id="opsActionStatus" role="status"></p></form>`;
 }
 function packageRevokeForm(r){
   if(r.status!=='paid'||r.package_status!=='active'||!r.package_id)return '';
    return `<form id="opsRevokePackageForm" class="ops-action"><h3>Thu hồi gói đã duyệt</h3><p>Gói sẽ bị vô hiệu hóa. Việc hoàn tiền (nếu cần) phải được xử lý riêng.</p><label>Lý do thu hồi<textarea id="opsRevokeReason" required minlength="5" maxlength="500" rows="3"></textarea></label><label class="ops-check"><input type="checkbox" required>Tôi đã kiểm tra và xác nhận thu hồi gói này.</label><button type="submit">Thu hồi gói</button><p role="status"></p></form>`;
 }
 function orderCancelForm(r){
    if(r.needs_payment_review||!['pending','confirmed'].includes(r.status)||r.settled_at)return '';
    return `<form id="opsCancelOrderForm" class="ops-action"><h3>Hủy đơn hàng</h3><p>Đơn sẽ trả tồn kho. Khoản đã thu sẽ được hoàn hoặc tạo yêu cầu hoàn ngân hàng.</p><label>Lý do hủy<textarea id="opsCancelReason" required minlength="5" maxlength="500" rows="3"></textarea></label><label class="ops-check"><input type="checkbox" required>Tôi đã kiểm tra thanh toán và xác nhận hủy đơn.</label><button type="submit" class="ops-secondary">Hủy đơn</button><p role="status"></p></form>`;
 }
 async function openDetail(id,k=kind){
  const token=++detailRequest;selected=null;$('opsDetailTitle').textContent=kinds[k]+' · '+id;$('opsDetail').textContent='Đang tải chi tiết…';if(!dialog.open)dialog.showModal();
  try{
   await requireAdmin();if(token!==detailRequest)return;const {data,error}=await db.rpc('admin_operation_detail',{p_kind:k,p_id:id});if(token!==detailRequest)return;if(error)throw error;
   const r=data.record;
   if(k==='packages'){
    const extra=await db.from('service_package_payments').select('payos_order_code,payos_status,payos_reference,payos_received_amount,payos_note').eq('id',id).single();if(token!==detailRequest)return;if(extra.error)throw extra.error;Object.assign(r,extra.data);
    if(r.package_id){const pkg=await db.from('service_packages').select('status').eq('id',r.package_id).single();if(token!==detailRequest)return;if(pkg.error)throw pkg.error;r.package_status=pkg.data.status;const actions=await db.from('service_package_admin_actions').select('action,reason,actor_id,created_at').eq('package_id',r.package_id).order('created_at',{ascending:false});if(token!==detailRequest)return;if(actions.error)throw actions.error;r.admin_actions=actions.data||[];}
   }
   selected={id,k,row:r};
   $('opsDetail').innerHTML=`<div class="ops-detail-status">${badge(r.status||r.verification_status)} ${r.payment_status?badge(r.payment_status):''} ${r.package_status?badge(r.package_status):''}</div>${r.needs_payment_review?'<p class="ops-warning">Cần kiểm tra chứng từ và trạng thái giao dịch. Không thu hoặc hoàn tiền lần nữa khi chưa đối soát.</p>':''}<p class="ops-hint">Thông tin riêng tư chỉ phục vụ giao nhận, đối soát và hỗ trợ. Không chia sẻ ra ngoài.</p><h3>Người liên quan</h3><div class="ops-people">${data.people.map(p=>`<div><small>${e(p.role)}</small><strong>${e(p.fullname||'Chưa có tên')}</strong><small>${e(p.user_id)}</small></div>`).join('')||'<p>Không có tài khoản liên kết.</p>'}</div><dl class="ops-facts">${Object.entries(fields).filter(([key])=>r[key]!=null&&r[key]!=='').map(([key,title])=>`<div><dt>${title}</dt><dd>${e(key.endsWith('_at')?date(r[key]):['shipping_fee','subtotal','total_amount','amount','price','captured_amount'].includes(key)?money(r[key]):label(r[key]))}</dd></div>`).join('')}</dl>
   ${(r.admin_actions||[]).length?'<h3>Lịch sử admin gói</h3>'+r.admin_actions.map(a=>`<article class="ops-item"><strong>${e(label(a.action))}</strong><p>${e(a.reason)}</p><small>${e(date(a.created_at))} · ${e(a.actor_id)}</small></article>`).join(''):''}
   ${data.items.length?'<h3>Sản phẩm & người bán</h3>'+data.items.map(i=>`<article class="ops-item"><strong>${e(i.product_name)}</strong><p>${e(i.seller_name||'Không có tên người bán')} · ${e(i.seller_id||'—')}</p><p>${e(i.quantity)} × ${money(i.price)} = ${money(i.subtotal)}</p></article>`).join(''):''}
   ${financePanel(data.finance)}
   ${(data.payouts||[]).length?'<h3>Người hưởng tiền bán hàng</h3>'+data.payouts.map(p=>`<article class="ops-item"><strong>${e(p.fullname||p.user_id)}</strong><small>${e(p.user_id)}</small><p>${money(p.amount)} · ${p.payout_status?e(payoutLabel(p.payout_status)):r.settled_at?'Đã phân bổ vào ví':'Dự kiến khi hoàn tất đơn'}</p>${p.bank_reference?'<p>Chứng từ chuyển: '+e(p.bank_reference)+' · '+e(date(p.paid_at))+'</p>':''}${p.payout_id&&p.payout_status==='pending'&&!r.needs_payment_review&&r.status==='completed'&&r.payment_status==='paid'?'<form class="ops-payout-form" data-payout="'+e(p.payout_id)+'"><label>Mã chuyển khoản đã thành công<input name="reference" required minlength="4" maxlength="200" autocomplete="off"></label><label class="ops-check"><input type="checkbox" required>Tôi đã chuyển đúng số tiền cho người bán này.</label><button type="submit">Ghi nhận đã chuyển '+money(p.amount)+'</button><p role="status"></p></form>':''}</article>`).join(''):''}
   ${r.settled_at&&!r.payos_order_code&&r.payment_method!=='trial'?'<p class="ops-hint">Đã phân bổ vào số dư ví trên hệ thống. Việc chuyển khoản ra ngân hàng được theo dõi riêng trong mục Nạp / rút ví.</p>':''}
   ${(data.receipts||[]).length?'<h3>Chứng từ đã đối soát</h3>'+data.receipts.map(b=>`<article class="ops-item"><strong>${e(b.reference)}</strong><small>${e(date(b.created_at))} · ${e(b.reviewed_by||'Admin')}</small></article>`).join(''):''}
   ${data.history.length?'<h3>Lịch sử đơn hàng</h3><ol class="ops-timeline">'+data.history.map(h=>`<li>${badge(h.status)} <small>${e(date(h.created_at))} · ${e(h.actor_name||h.changed_by||'Hệ thống')}</small><p>${e(h.note||'')}</p></li>`).join('')+'</ol>':''}
   ${r.student_card_url?'<button type="button" id="opsViewCard">Xem ảnh thẻ sinh viên</button><div id="opsCard"></div>':''}${actionForm(r,k)}${k==='packages'?packageRevokeForm(r):''}`;
   if(k==='orders'&&!r.needs_payment_review&&(r.payment_method==='cash'||r.payment_status==='paid')){
    const next=r.status==='delivered'&&r.payment_approved_at?'completed':null;
    if(next){const form=document.createElement('form');form.id='opsOrderAction';form.className='ops-action';form.dataset.next=next;form.innerHTML=`<h3>Cập nhật tiến độ đơn</h3><p>Chuyển từ ${e(label(r.status))} sang ${e(label(next))}.${next==='completed'&&r.payment_method!=='trial'?(r.payos_order_code?' Khi hoàn tất, hệ thống tạo khoản chờ chuyển ngân hàng cho người bán.':' Đơn thanh toán online sẽ được phân bổ tiền vào ví khi hoàn tất.'):''}</p><label class="ops-check"><input type="checkbox" required>Tôi đã xác minh tiến độ giao nhận thực tế.</label><button name="decision" value="advance">${'Xác nhận đơn hàng hoàn thành'}</button><p role="status"></p>`;form.addEventListener('submit',save);$('opsDetail').append(form);}
   }
   if(k==='orders'){const markup=orderCancelForm(r);if(markup){const wrapper=document.createElement('div');wrapper.innerHTML=markup;const form=wrapper.firstElementChild;$('opsDetail').append(form);form.addEventListener('submit',cancelAdminOrder);}}
   if(r.payos_order_code){const panel=document.createElement('section');panel.className='ops-item';panel.innerHTML=`<h3>Đối soát payOS</h3><p>Mã payOS: ${e(r.payos_order_code)}</p><p>Trạng thái: ${e(({creating:'Đang tạo QR',pending:'Chờ thanh toán',paid:'Đã thanh toán',review:'Cần đối soát',cancelled:'Đã hủy',expired:'Hết hạn'})[r.payos_status]||r.payos_status)}</p><p>Đã nhận: ${money(r.payos_received_amount)}</p><p>Chứng từ: ${e(r.payos_reference||'—')}</p><p>${e(r.payos_note||'')}</p>`;$('opsDetail').prepend(panel);}
   $('opsDetail').querySelectorAll('.ops-payout-form').forEach(form=>form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;const entry=selected,reference=form.elements.reference.value.trim(),feedback=form.querySelector('[role=status]');
    busy=true;form.querySelector('button').disabled=true;feedback.textContent='Đang ghi nhận chứng từ…';
    try{await requireAdmin();if(selected!==entry)return;const result=await db.rpc('admin_complete_order_payout',{p_payout_id:form.dataset.payout,p_reference:reference});if(result.error)throw result.error;if(selected===entry){await openDetail(id,k);await load();}}
    catch(error){if(selected===entry)feedback.textContent=error.message||'Chưa ghi nhận được. Hãy kiểm tra lại cùng khoản chuyển.';}
    finally{busy=false;form.querySelector('button').disabled=false;}
   }));
   if(k==='orders'&&r.payos_order_code&&r.payment_status==='unpaid'){
    const b=document.createElement('button');b.textContent='Kiểm tra lại thanh toán payOS';b.type='button';b.addEventListener('click',async()=>{
     if(busy)return;busy=true;b.disabled=true;try{await requireAdmin();const result=await db.functions.invoke('payos-order',{timeout:45000,body:{action:'status',orderId:Number(id)}});if(result.error||result.data?.error)throw new Error(result.data?.error||'Chưa kiểm tra được payOS. Vui lòng thử lại.');if(token===detailRequest){await openDetail(id,k);await load();}}catch(error){b.textContent=error.message;}finally{busy=false;b.disabled=false;}
    });$('opsDetail').prepend(b);
   }
   $('opsAction')?.addEventListener('submit',save);
   $('opsRevokePackageForm')?.addEventListener('submit',revokePackage);
   $('opsViewCard')?.addEventListener('click',async()=>{const b=$('opsViewCard');b.disabled=true;try{const url=await IUHCore.privateImageURL(r.student_card_url,r.student_card_url.includes('/student-verifications/')?'student-verifications':'student-cards');if(token!==detailRequest)return;const img=document.createElement('img');img.src=url;img.alt='Thẻ sinh viên cần xác minh';$('opsCard').replaceChildren(img);}catch{if(token===detailRequest){b.textContent='Không tải được ảnh. Nhấn để thử lại';b.disabled=false;}}});
  }catch(err){if(token===detailRequest)$('opsDetail').textContent=err.message||'Không tải được chi tiết.';}
 }
 async function cancelAdminOrder(event){
  event.preventDefault();const form=event.currentTarget;if(busy||!selected||!form.reportValidity())return;
  const entry=selected,{row:r,id}=entry,reason=$('opsCancelReason').value.trim(),feedback=form.querySelector('[role=status]');busy=true;form.querySelector('button').disabled=true;feedback.textContent='Đang kiểm tra thanh toán và hủy đơn…';
  try{
   await requireAdmin();if(selected!==entry)return;
   if(r.payos_order_code&&r.payment_status==='unpaid'&&!['cancelled','expired'].includes(r.payos_status)){
    const result=await db.functions.invoke('payos-order',{timeout:45000,body:{action:'cancel',orderId:Number(id)}});
    if(result.error||result.data?.error)throw new Error(result.data?.error||'Chưa hủy được link payOS. Đơn vẫn được giữ.');
    if(result.data.payment_status!=='unpaid'||!['cancelled','expired'].includes(result.data.payos_status))throw new Error('payOS chưa xác nhận hủy link. Đơn vẫn được giữ.');
   }
   const {data,error}=await db.rpc('admin_cancel_order',{p_order_id:Number(id),p_reason:reason});if(error||data?.success===false)throw error||new Error(data.message||'Không hủy được đơn.');
   if(selected===entry){await openDetail(id,'orders');await load();}
  }catch(error){if(selected===entry)feedback.textContent=error.message||'Không hủy được đơn. Hãy thử lại.';}
  finally{busy=false;form.querySelector('button').disabled=false;}
 }
 async function revokePackage(event){
  event.preventDefault();const form=event.currentTarget;if(busy||!selected||!form.reportValidity())return;
  const entry=selected,{row:r,id}=entry,reason=$('opsRevokeReason').value.trim(),feedback=form.querySelector('[role=status]');busy=true;form.querySelector('button').disabled=true;feedback.textContent='Đang thu hồi gói…';
  try{
   await requireAdmin();if(selected!==entry)return;
   const {data,error}=await db.rpc('admin_revoke_service_package',{p_package_id:r.package_id,p_reason:reason});if(error||data?.success===false)throw error||new Error(data.message||'Không thu hồi được gói.');
   if(selected===entry){await openDetail(id,'packages');await load();}
  }catch(error){if(selected===entry)feedback.textContent=error.message||'Không thu hồi được gói. Hãy thử lại.';}
  finally{busy=false;form.querySelector('button').disabled=false;}
 }
 async function save(event){
  event.preventDefault();if(busy||!selected)return;
  const entry=selected,{row:r,k,id}=entry,advance=event.currentTarget.id==='opsOrderAction',next=event.currentTarget.dataset.next,feedback=event.currentTarget.querySelector('[role=status]'),approve=event.submitter?.value!=='reject',reference=$('opsReference')?.value.trim()||null,note=$('opsNote')?.value.trim()||null;
  const financial=['packages','orders','wallet_requests','bank_refund_requests','donations'].includes(k);
   const needsBankReference=k==='packages'?r.payment_method==='bank':financial&&k!=='orders'||k==='orders'&&(r.payment_method==='cash'||r.payment_method==='qr'&&r.payment_status!=='paid');
   if(needsBankReference&&approve&&!advance&&!reference){feedback.textContent='Nhập mã giao dịch ngân hàng đã kiểm tra.';return;}
  if(!approve&&!note){feedback.textContent='Nhập lý do từ chối để người dùng biết.';return;}
  const resolution=$('opsResolution')?.value;busy=true;dialog.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);feedback.textContent='Đang xử lý…';
  try{
   await requireAdmin();if(selected!==entry)return;let query;
   if(advance)query=db.rpc('update_order_status',{p_order_id:id,p_new_status:next});
   else if(k==='packages')query=db.rpc(approve?'approve_service_package_payment':'reject_service_package_payment',approve?{p_transaction_code:r.transaction_code,p_bank_reference:reference}:{p_transaction_code:r.transaction_code,p_reason:note});
   else if(k==='orders')query=db.rpc('admin_confirm_order_payment',{p_order_id:id,p_reference:reference});
   else if(k==='wallet_requests')query=db.rpc('review_wallet_request',{p_request_id:id,p_approve:approve,p_bank_reference:reference,p_note:note});
   else if(k==='bank_refund_requests')query=db.rpc('complete_bank_refund',{p_request_id:id,p_bank_reference:reference});
   else if(k==='donations')query=db.rpc('review_donation',{p_donation_id:id,p_approve:approve,p_bank_reference:reference,p_note:note});
   else if(k==='verification')query=db.rpc('admin_set_student_verified',{target_user_id:r.user_id,verified:true});
   else query=db.from(k).update({status:resolution,admin_note:note,updated_at:new Date().toISOString()}).eq('id',id).eq('status',r.status).select('id').single();
   const {data,error}=await query;if(error||data?.success===false)throw error||new Error(data.message);
   if(selected!==entry)return;await openDetail(id,k);await load();
  }catch(err){if(selected===entry)feedback.textContent=err.message||'Không xử lý được. Làm mới để kiểm tra lại hồ sơ.';}
  finally{busy=false;dialog.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=false);}
 }
 function close(){if(busy)return;detailRequest++;selected=null;dialog.close();$('opsDetail').replaceChildren();}
 $('opsClose').addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});button.addEventListener('click',()=>openPage('requests'));
 page.addEventListener('click',event=>{const tab=event.target.closest('[data-kind]');if(tab){kind=tab.dataset.kind;pageNumber=1;filters.status='';filters.payment='';controls();load();}const b=event.target.closest('[data-detail]');if(b&&authorized)openDetail(b.dataset.detail);});
 $('opsFilters').addEventListener('submit',event=>{event.preventDefault();filters={status:$('opsState').value,payment:['orders','packages'].includes(kind)?$('opsPayment').value:'',search:$('opsSearch').value.trim(),attention:$('opsAttention').checked};pageNumber=1;load();});
 $('opsPrev').addEventListener('click',()=>{pageNumber--;load();});$('opsNext').addEventListener('click',()=>{pageNumber++;load();});$('opsReload').addEventListener('click',load);
 controls();window.IUHAdminRequests={load,openOrders:()=>{kind='orders';filters.status='';filters.payment='';pageNumber=1;controls();load();},openPackages:()=>{kind='packages';filters.status='';filters.payment='';pageNumber=1;controls();load();}};
})();
