(() => {
    'use strict';
    const C = window.ConnectionCommerce, db = C.getClient(), $ = id => document.getElementById(id);
    let user, items = [], cartIds = [], busy = false, receipt = null, attempt = null, timer, polling = false;
    const params = new URLSearchParams(location.search);
    const show = text => { $('connectionCheckoutStatus').textContent = text; };
    const total = () => items.reduce((sum, i) => sum + Number(i.price) * i.requestQuantity, 0);
    async function waitForSeller() {
        $('connectionCheckoutForm').hidden = true; $('connectionWaiting').hidden = false;
        show('Đã gửi yêu cầu. Bạn không cần thanh toán trên PASSIT. Người bán có 24 giờ để xác nhận phí sàn.');
        try {
            sessionStorage.setItem('passitConnectionWaiting:' + user.id, JSON.stringify(receipt));
            sessionStorage.removeItem('passitConnectionAttempt:' + user.id);
        } catch {}
        try { history.replaceState(null, '', 'dathang.html?waiting=true'); } catch {}
        await poll(); clearInterval(timer); timer = setInterval(poll, 5000);
    }
    function render() {
        $('connectionCheckoutItems').innerHTML = items.map(i => `<article class="connection-product">
            <img src="${C.escape(C.image(i.image_urls))}" alt="" loading="lazy">
            <div><strong>${C.escape(i.name)}</strong><p>${C.money(i.price)} × ${i.requestQuantity}</p></div>
            <strong>${C.money(Number(i.price) * i.requestQuantity)}</strong></article>`).join('');
        $('connectionSubtotal').textContent = C.money(total());
        $('connectionOrderCount').textContent = `${new Set(items.map(i => i.seller_id)).size} yêu cầu, tách theo người bán`;
        $('connectionSubmit').disabled = !items.length;
    }
    async function loadItems() {
        let wanted;
        if (params.get('buyNow') === 'true') {
            const quantity = Number(params.get('quantity') || 1), id = params.get('product') || params.get('id');
            if (!/^\d+$/.test(id || '') || !Number.isInteger(quantity) || quantity < 1) throw Error('Sản phẩm hoặc số lượng không hợp lệ.');
            wanted = [{ product_id: id, quantity }];
        } else {
            cartIds = (params.get('cart') || '').split(',').filter(id => /^\d+$/.test(id)).map(Number);
            if (!cartIds.length) throw Error('Hãy chọn sản phẩm trong giỏ hàng trước.');
            const result = await db.from('cart_items').select('id,product_id,quantity').eq('user_id', user.id).in('id', cartIds);
            if (result.error) throw result.error;
            wanted = result.data || [];
            if (wanted.length !== cartIds.length) throw Error('Giỏ hàng đã thay đổi. Vui lòng chọn lại sản phẩm.');
        }
        const result = await db.from('products').select('id,seller_id,name,price,quantity,image_urls,status').in('id', wanted.map(i => i.product_id));
        if (result.error) throw result.error;
        items = wanted.map(w => {
            const product = result.data?.find(p => String(p.id) === String(w.product_id));
            if (!product || product.status !== 'active' || product.quantity < w.quantity || product.seller_id === user.id) throw Error('Có sản phẩm hết hàng hoặc không thể đặt mua. Vui lòng kiểm tra lại giỏ hàng.');
            return { ...product, price: Math.round(Number(product.price)), requestQuantity: w.quantity };
        });
        render();
    }
    async function poll() {
        if (!receipt || document.hidden || polling) return;
        polling = true;
        try {
            const state = await C.rpc('get_connection_requests');
            const requests = state.requests.filter(r => receipt.request_ids.map(String).includes(String(r.id)));
            $('connectionWaitingList').innerHTML = requests.map(r => `<div class="connection-waiting-row"><strong>Yêu cầu #${r.id}</strong>
                ${r.status === 'connected' && r.conversation_id ? `<a class="connection-button" href="${C.chatURL(r.conversation_id)}">Mở chat</a>` :
                    `<span>${r.status === 'awaiting_seller' ? 'Chờ người bán xác nhận phí sàn' : r.status === 'expired' ? 'Đã hết hạn' : 'Đã hủy'}</span>`}</div>`).join('');
            if (requests.length === 1 && requests[0].status === 'connected' && requests[0].conversation_id) {
                clearInterval(timer); location.assign(C.chatURL(requests[0].conversation_id));
            }
        } catch { show('Yêu cầu đã gửi. Chưa cập nhật được trạng thái; bạn có thể xem trong Đơn hàng.'); }
        finally { polling = false; }
    }
    async function submit(event) {
        event.preventDefault();
        if (busy || receipt || !items.length) return;
        const payload = { p_recipient_name: '', p_recipient_phone: '', p_recipient_address: '', p_note: $('orderNote').value.trim(),
            p_items: items.map(i => ({ product_id: i.id, quantity: i.requestQuantity })), p_expected_subtotal: total(), p_cart_ids: cartIds };
        const signature = JSON.stringify(payload), key = 'passitConnectionAttempt:' + user.id;
        try {
            busy = true; $('connectionSubmit').disabled = true; show('Đang gửi yêu cầu đến người bán…');
            if (!attempt) { try { attempt = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch {} }
            if (!attempt || attempt.signature !== signature) attempt = { signature, key: crypto.randomUUID(), route: location.search };
            try { sessionStorage.setItem(key, JSON.stringify(attempt)); } catch {}
            receipt = await C.rpc('request_connection_orders', { ...payload, p_request_key: attempt.key });
            await waitForSeller();
        } catch (error) {
            show(error.message || 'Chưa nhận được kết quả. Bấm lại để kiểm tra cùng yêu cầu.');
        } finally { busy = false; $('connectionSubmit').disabled = !!receipt; }
    }
    async function init() {
        $('userAccountButton')?.addEventListener('click', event => { event.stopPropagation(); $('accountDropdown')?.classList.toggle('show'); });
        document.addEventListener('click', () => $('accountDropdown')?.classList.remove('show'));
        $('logoutButton')?.addEventListener('click', async () => {
            try { const result = await db.auth.signOut(); if (result.error) throw result.error; location.assign('dangnhap.html'); }
            catch { show('Chưa đăng xuất được. Vui lòng thử lại.'); }
        });
        $('connectionCheckoutForm').addEventListener('submit', submit);
        $('connectionNewOrder').addEventListener('click', () => { try { sessionStorage.removeItem('passitConnectionWaiting:' + user.id); } catch {} location.assign('sanpham.html'); });
        try {
            const auth = await db.auth.getUser(); if (auth.error || !auth.data?.user) { location.assign('dangnhap.html'); return; }
            user = auth.data.user;
            const profile = await db.from('users').select('fullname').eq('user_id', user.id).maybeSingle();
            if ($('headerUserName')) $('headerUserName').textContent = profile.data?.fullname || 'Tài khoản';
            if ($('userAccount')) $('userAccount').style.display = 'block';
            if ($('guestAccount')) $('guestAccount').style.display = 'none';
            // Explicit order route survives refresh without depending on product availability.
            if (params.get('waiting') === 'true') {
                try { receipt = JSON.parse(sessionStorage.getItem('passitConnectionWaiting:' + user.id) || 'null'); } catch {}
                if (!receipt) { location.assign('donhang.html'); return; }
            }
            if (!receipt) {
                try { attempt = JSON.parse(sessionStorage.getItem('passitConnectionAttempt:' + user.id) || 'null'); } catch {}
                if (attempt?.route === location.search) receipt = await C.rpc('get_connection_receipt', { p_request_key: attempt.key });
            }
            if (receipt) { await waitForSeller(); return; }
            await loadItems(); show('Kiểm tra sản phẩm rồi gửi yêu cầu. Phí sàn do người bán chịu.');
        } catch (error) { show(error.message || 'Không thể tải yêu cầu đặt hàng.'); }
    }
    window.addEventListener('pagehide', () => clearInterval(timer));
    document.addEventListener('visibilitychange', poll);
    void init();
})();
