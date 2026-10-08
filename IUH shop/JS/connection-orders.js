(() => {
    'use strict';
    const root = document.getElementById('connectionRequests');
    if (!root) return;
    const C = window.ConnectionCommerce, db = C.getClient(), params = new URLSearchParams(location.search);
    const mode = root.dataset.mode || 'orders';
    let user, rows = [], tab = location.hash === '#sale' ? 'sale' : 'buy', automatic = false, currentChat = params.get('conversation'), busy = false, loading = false, clockOffset = 0;
    const stateNames = { awaiting_seller: 'Chờ người bán xác nhận', connected: 'Đã mở chat', expired: 'Hết hạn', cancelled: 'Đã hủy' };
    root.innerHTML = `<div class="connection-card-head"><div><p class="connection-eyebrow">PASSIT · Kết nối giao dịch</p><h2>${mode === 'admin' ? 'Yêu cầu giao dịch & giao hộ' : mode === 'chat' ? 'Giao dịch trong cuộc trò chuyện' : 'Yêu cầu mua bán'}</h2></div><button type="button" class="connection-button secondary" data-refresh>Làm mới</button></div>
        <p class="connection-lead">Đăng bán miễn phí. Người bán xác nhận phí sàn để mở chat; hai bên tự thỏa thuận tiền hàng, thời gian và địa điểm giao dịch.</p>
        <div data-test-note class="connection-test-note" hidden>Xác nhận thanh toán tự động đang bật để thử nghiệm. Không cần chuyển tiền thật; đây không phải xác nhận từ ngân hàng hoặc MoMo.</div>
        ${mode === 'orders' ? `<div class="connection-tabs"><button class="connection-tab" data-tab="buy">Tôi mua</button><button class="connection-tab" data-tab="sale">Tôi bán</button></div>` : ''}
        <p data-status class="connection-status" role="status" aria-live="polite"></p><div data-list></div>
        <dialog class="connection-dialog"><h2 data-dialog-title></h2><p data-dialog-text></p><p data-dialog-mode class="connection-test-note"></p><div class="connection-actions"><button class="connection-button secondary" data-dismiss>Quay lại</button><button class="connection-button" data-confirm>Xác nhận</button></div></dialog>`;
    const list = root.querySelector('[data-list]'), status = root.querySelector('[data-status]'), dialog = root.querySelector('dialog');
    let pendingAction;
    function remaining(r) {
        const ms = new Date(r.expires_at).getTime() - (Date.now() + clockOffset);
        if (ms <= 0) return 'Đã hết thời hạn xác nhận';
        return `Còn ${Math.floor(ms / 3600000)} giờ ${Math.floor(ms / 60000) % 60} phút · hạn ${new Date(r.expires_at).toLocaleString('vi-VN')}`;
    }
    function card(r) {
        const seller = r.seller_id === user.id, pending = r.status === 'awaiting_seller', connected = r.status === 'connected';
        const expired = new Date(r.expires_at).getTime() <= Date.now() + clockOffset;
        const delivery = r.delivery_method === 'passit' ? 'PASSIT giao hộ · 5.000đ do người bán chịu' : r.delivery_method === 'direct' ? 'Người bán giao trực tiếp' : 'Chưa chọn cách giao hàng';
        const deliveryStatus = {
            requested: 'Đã ghi nhận mô phỏng phí giao hộ; admin sẽ liên hệ với bạn. Vui lòng chờ.',
            arranging: 'Admin đang liên hệ và sắp xếp giao hộ.',
            delivered: 'PASSIT đã báo giao hàng; chờ người mua xác nhận đã nhận.',
            seller_delivered: 'Người bán đã báo giao hàng; chờ người mua xác nhận đã nhận.',
            completed: 'Người mua đã xác nhận nhận hàng · Hoàn tất'
        }[r.delivery_status];
        const adminContacts = mode === 'admin' ? `<div class="connection-admin-contacts"><span>Người mua: ${C.escape(r.buyer_contact?.fullname || r.recipient_name || 'Chưa có tên')}</span>
            <span>${r.buyer_contact?.phone ? `<a href="tel:${C.escape(r.buyer_contact.phone)}">${C.escape(r.buyer_contact.phone)}</a>` : 'Chưa có số điện thoại'}</span>
            <span>Người bán: ${C.escape(r.seller_contact?.fullname || 'Chưa có tên')}</span>
            <span>${r.seller_contact?.phone ? `<a href="tel:${C.escape(r.seller_contact.phone)}">${C.escape(r.seller_contact.phone)}</a>` : 'Chưa có số điện thoại'}</span></div>` : '';
        return `<article class="connection-card" data-request="${r.id}">
            <div class="connection-card-head"><strong>Yêu cầu #${r.id}</strong><span class="connection-badge ${r.status}">${stateNames[r.status]}</span></div>
            ${(r.items || []).map(i => `<div class="connection-product"><img src="${C.escape(C.image(i.image_urls))}" alt="" loading="lazy"><div><strong>${C.escape(i.name)}</strong><p>${i.quantity} × ${C.money(i.unit_price)}</p></div></div>`).join('')}
            <div class="connection-meta"><div><span>Tiền sản phẩm</span><p class="connection-price">${C.money(r.subtotal)}</p></div><div><span>Phí sàn người bán chịu (5%, tối thiểu 2.000đ)</span><p class="connection-price">${C.money(r.platform_fee)}</p></div>
            <div><span>Người nhận</span><p>${r.recipient_name || r.recipient_phone ? `${C.escape(r.recipient_name || 'Chưa cung cấp tên')} · ${C.escape(r.recipient_phone || 'Chưa cung cấp số điện thoại')}` : 'Thống nhất trong chat'}</p></div><div><span>Địa điểm dự kiến</span><p>${C.escape(r.recipient_address || 'Thống nhất trong chat')}</p></div></div>
            ${adminContacts}
            ${r.note ? `<p>Ghi chú: ${C.escape(r.note)}</p>` : ''}
            ${pending ? `<p class="connection-note">${seller ? `Bạn có một giao dịch đang chờ xác nhận. Phí sàn là ${C.money(r.platform_fee)}. Vui lòng thanh toán để tiếp tục giao dịch trong 24 giờ.` : 'Người bán đang xác nhận phí sàn. Bạn không thanh toán tại PASSIT; chat sẽ mở khi người bán xác nhận.'}<br><strong>${remaining(r)}</strong></p>` : ''}
            ${connected ? `<p class="connection-note">${delivery}${deliveryStatus ? ' · ' + deliveryStatus : ''}</p>` : ''}
            ${r.delivery_note ? `<p>Thỏa thuận giao: ${C.escape(r.delivery_note)}</p>` : ''}
            <div class="connection-actions">
                ${pending && seller ? `<button class="connection-button" data-action="fee" data-id="${r.id}" ${expired || !automatic ? 'disabled' : ''}>Xác nhận phí ${C.money(r.platform_fee)} & mở chat</button>` : ''}
                ${pending && (seller || r.buyer_id === user.id) ? `<button class="connection-button danger" data-action="cancel" data-id="${r.id}">${seller ? 'Từ chối yêu cầu' : 'Hủy yêu cầu'}</button>` : ''}
                ${connected && r.conversation_id && mode !== 'chat' && (seller || r.buyer_id === user.id) ? `<a class="connection-button" href="${C.chatURL(r.conversation_id)}">Mở chat ${seller ? 'người mua' : 'người bán'}</a>` : ''}
                ${connected && r.delivery_method === 'direct' && !r.delivery_status && seller ? `<button class="connection-button" data-action="seller-delivered" data-id="${r.id}">Xác nhận đã giao</button>` : ''}
                ${connected && ((r.delivery_method === 'direct' && r.delivery_status === 'seller_delivered') || (r.delivery_method === 'passit' && r.delivery_status === 'delivered')) && r.buyer_id === user.id ? `<button class="connection-button" data-action="buyer-received" data-id="${r.id}">Xác nhận đã nhận hàng</button>` : ''}
                ${mode === 'admin' && r.delivery_method === 'passit' && r.delivery_status === 'requested' ? `<button class="connection-button" data-action="arranging" data-id="${r.id}">Đã liên hệ · bắt đầu sắp xếp</button>` : ''}
                ${mode === 'admin' && r.delivery_method === 'passit' && r.delivery_status === 'arranging' ? `<button class="connection-button" data-action="delivered" data-id="${r.id}">Xác nhận PASSIT đã giao</button>` : ''}
            </div>
            ${connected && seller && !r.delivery_method ? `<section><h3>Người bán chọn cách giao hàng</h3><p>Thống nhất trong chat trước khi xác nhận. Phí giao hộ không tính cho người mua.</p>
                <label class="connection-field">Ghi chú thời gian, điểm nhận và giao đã thống nhất<textarea maxlength="2000" data-delivery-note="${r.id}" placeholder="Ví dụ: nhận tại cổng trường lúc 15:00…"></textarea></label>
                <div class="connection-actions"><button class="connection-button secondary" data-action="direct" data-id="${r.id}">Tôi giao trực tiếp · miễn phí</button><button class="connection-button" data-action="passit" data-id="${r.id}" ${!automatic ? 'disabled' : ''}>PASSIT giao hộ · 5.000đ</button></div></section>` : ''}
            </article>`;
    }
    function render() {
        root.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
        root.querySelector('[data-test-note]').hidden = !automatic;
        const visible = rows.filter(r => mode === 'chat' ? r.conversation_id === currentChat && r.status === 'connected' : mode === 'admin' ? true : mode === 'seller' || tab === 'sale' ? r.seller_id === user.id : r.buyer_id === user.id);
        if (mode === 'chat') root.hidden = visible.length === 0;
        list.innerHTML = visible.length ? visible.map(card).join('') : '<p class="connection-empty">Chưa có yêu cầu giao dịch ở mục này.</p>';
    }
    async function refresh() {
        if (loading || busy || dialog.open || document.hidden || !user || (root.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA')) return;
        loading = true;
        try {
            const data = await C.rpc('get_connection_requests'); rows = data.requests || []; automatic = data.auto_confirm === true;
            clockOffset = new Date(data.server_time).getTime() - Date.now();
            render(); status.textContent = '';
            const watch = params.get('watch'), r = rows.find(r => String(r.id) === watch && r.buyer_id === user.id);
            if (r?.status === 'connected' && r.conversation_id) location.assign(C.chatURL(r.conversation_id));
        } catch (error) { status.textContent = error.message || 'Chưa cập nhật được yêu cầu. Hãy bấm Làm mới.'; }
        finally { loading = false; }
    }
    function ask(action, id) {
        const r = rows.find(r => String(r.id) === String(id)); if (!r || busy) return;
        pendingAction = { action, id: r.id, note: root.querySelector(`[data-delivery-note="${r.id}"]`)?.value || '' };
        const amount = action === 'fee' ? r.platform_fee : action === 'passit' ? 5000 : 0;
        const titles = { fee: 'Xác nhận phí sàn & mở chat', passit: 'Đăng ký PASSIT giao hộ', cancel: 'Hủy yêu cầu giao dịch?', 'seller-delivered': 'Xác nhận đã giao hàng?', 'buyer-received': 'Xác nhận đã nhận hàng?', direct: 'Xác nhận giao trực tiếp', arranging: 'Xác nhận đã liên hệ và bắt đầu sắp xếp?', delivered: 'Xác nhận PASSIT đã giao hàng?' };
        const messages = {
            fee: `Phí do người bán chịu: ${C.money(amount)}. Xác nhận xong sẽ mở chat cho cả hai bên.`,
            passit: `Phí giao hộ ${C.money(amount)} do người bán chịu. Đây chỉ là xác nhận mô phỏng, chưa thu tiền thật. Yêu cầu sẽ chuyển đến admin để liên hệ sắp xếp giao hàng.`,
            cancel: 'Tồn kho sẽ được trả lại. Hai bên chưa được mở chat từ yêu cầu này.',
            'seller-delivered': 'Đánh dấu người bán đã giao trực tiếp. Người mua sẽ xác nhận khi nhận được hàng.',
            'buyer-received': 'Xác nhận bạn đã nhận hàng. Thao tác này sẽ hoàn tất yêu cầu.',
            direct: 'Xác nhận lựa chọn để hai bên cùng theo dõi.',
            arranging: 'Chỉ xác nhận sau khi admin đã liên hệ và bắt đầu sắp xếp giao hộ.',
            delivered: 'Xác nhận PASSIT đã giao hàng. Người mua sẽ được yêu cầu xác nhận đã nhận.'
        };
        root.querySelector('[data-dialog-title]').textContent = titles[action] || 'Xác nhận thao tác';
        root.querySelector('[data-dialog-text]').textContent = messages[action] || 'Xác nhận lựa chọn để hai bên cùng theo dõi.';
        const modeNote = root.querySelector('[data-dialog-mode]'); modeNote.hidden = !amount;
        modeNote.textContent = 'Chế độ thử nghiệm: hệ thống tự xác nhận phí. Không chuyển tiền thật.';
        dialog.showModal();
    }
    root.addEventListener('click', event => {
        const button = event.target.closest('button'); if (!button) return;
        if (button.hasAttribute('data-refresh')) void refresh();
        if (button.dataset.tab) { tab = button.dataset.tab; render(); }
        if (button.dataset.action) ask(button.dataset.action, button.dataset.id);
        if (button.hasAttribute('data-dismiss') && !busy) dialog.close();
    });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    root.querySelector('[data-confirm]').addEventListener('click', async event => {
        if (!pendingAction || busy) return;
        const { action, id, note } = pendingAction; let result;
        busy = true; event.target.disabled = true;
        try {
            if (action === 'fee') result = await C.rpc('confirm_connection_fee', { p_request_id: id });
            else if (action === 'cancel') await C.rpc('cancel_connection_request', { p_request_id: id });
            else if (['direct', 'passit'].includes(action)) await C.rpc('choose_connection_delivery', { p_request_id: id, p_method: action, p_note: note });
            else if (action === 'seller-delivered') await C.rpc('seller_mark_connection_delivered', { p_request_id: id });
            else if (action === 'buyer-received') await C.rpc('buyer_confirm_connection_received', { p_request_id: id });
            else await C.rpc('admin_update_connection_delivery', { p_request_id: id, p_status: action });
            dialog.close();
            if (result?.conversation_id) { location.assign(C.chatURL(result.conversation_id)); return; }
        } catch (error) { dialog.close(); status.textContent = error.message || 'Chưa xác nhận được. Vui lòng kiểm tra lại.'; return; }
        finally { busy = false; event.target.disabled = false; }
        await refresh();
    });
    document.addEventListener('passit:conversation-open', event => { currentChat = event.detail.conversationId; if (user) render(); });
    const interval = setInterval(refresh, 10000);
    window.addEventListener('pagehide', () => clearInterval(interval));
    document.addEventListener('visibilitychange', refresh);
    void (async () => {
        try {
        const auth = await db.auth.getUser();
        if (auth.error || !auth.data?.user) { status.textContent = 'Vui lòng đăng nhập để xem yêu cầu mua bán.'; return; }
        user = auth.data.user; await refresh();
        } catch { status.textContent = 'Không tải được tài khoản. Vui lòng tải lại trang.'; }
    })();
})();
