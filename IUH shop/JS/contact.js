(function () {
    'use strict';
    const form = document.querySelector('.contact-form');
    if (!form) return;
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    form.append(status);
    const button = form.querySelector('[type="submit"]');
    const fields = Object.fromEntries(['name', 'email', 'phone', 'message'].map(id => [id, form.querySelector('#'+id)]));
    for (const [name, input] of Object.entries(fields)) {
        input.name = name;
        input.required = name !== 'phone';
        input.maxLength = ({name:150,email:254,phone:30,message:4000})[name];
    }
    fields.message.minLength = 10;
    let sending = false;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (sending || !form.reportValidity()) return;
        sending = true;
        button.disabled = true;
        status.textContent = 'Đang gửi yêu cầu…';
        try {
            const client = IUHCore.getClient();
            const {data:{user}, error:authError} = await client.auth.getUser();
            if(authError || !user) throw new Error('Vui lòng đăng nhập trước khi gửi yêu cầu hỗ trợ.');
            const {data,error} = await client.rpc('submit_contact_request', {
                p_fullname: fields.name.value.trim(), p_email: fields.email.value.trim(),
                p_phone: fields.phone.value.trim(), p_message: fields.message.value.trim()
            });
            if(error) throw error;
            if(!data) throw new Error('Máy chủ chưa xác nhận yêu cầu. Vui lòng thử lại.');
            form.reset();
            status.textContent = 'Đã nhận yêu cầu #'+data+'. Bạn có thể theo dõi phản hồi bên dưới.';
            await loadRequests();
        } catch(error) { status.textContent = error.message || 'Không gửi được yêu cầu. Vui lòng thử lại.'; }
        finally { sending = false; button.disabled = false; }
    });
    const history = document.createElement('div');
    form.after(history);
    async function loadRequests() {
        const client=IUHCore.getClient();
        const {data:{session}}=await client.auth.getSession();
        if(!session) return;
        const {data,error}=await client.from('contact_requests').select('id,message,status,admin_note,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}).limit(10);
        if(error) { history.textContent='Chưa tải được lịch sử hỗ trợ.'; return; }
        const e=IUHSecurity.escapeHTML;
        const labels={pending:'Chờ xử lý',reviewing:'Đang xử lý',resolved:'Đã phản hồi',rejected:'Đã đóng'};
        history.innerHTML=(data||[]).map(r=>`<article class="panel"><strong>Yêu cầu #${e(r.id)} — ${e(labels[r.status]||r.status)}</strong><p>${e(r.message)}</p><p>${e(r.admin_note||'Chưa có phản hồi.')}</p></article>`).join('');
    }
    loadRequests().catch(()=>{ history.textContent='Chưa tải được lịch sử hỗ trợ.'; });
})();
