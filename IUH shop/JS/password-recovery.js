/* Recovery sessions stay in memory and never replace the normal login session. */
(() => {
    'use strict';
    const requestForm = document.getElementById('requestResetForm');
    const resetForm = document.getElementById('resetPasswordForm');
    const message = document.getElementById('recoveryMessage');
    const requestButton = requestForm.querySelector('button[type="submit"]');
    const resetButton = resetForm.querySelector('button[type="submit"]');
    const params = new URLSearchParams(location.hash.slice(1));
    const query = new URLSearchParams(location.search);
    const hasCallback = location.hash.length > 1 || query.has('error') || query.has('code');
    // Strip credentials before any auth calls; never log tokens or passwords.
    if (hasCallback) history.replaceState(null, '', location.pathname);
    let client, sending = false, saving = false, ready = false, cooldownUntil = 0;
    function show(text, error = false) {
        message.hidden = false;
        message.classList.toggle('is-error', error);
        message.setAttribute('role', error ? 'alert' : 'status');
        message.textContent = text;
    }
    function refreshButton() {
        const seconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
        requestButton.disabled = sending || seconds > 0;
        requestButton.textContent = sending ? 'Đang gửi…' : seconds ? 'Gửi lại sau ' + seconds + ' giây' : 'Gửi liên kết khôi phục';
    }
    function invalidLink() {
        ready = false; resetForm.hidden = true; resetButton.disabled = true; requestForm.hidden = false;
        show('Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu email mới.', true);
    }
    try {
        client = window.supabase.createClient('https://xecxofmogvqysejjpxvl.supabase.co', 'sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC', {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit', storageKey: 'passit-password-recovery' }
        });
    } catch {
        requestButton.disabled = true;
        show('Không thể tải chức năng khôi phục. Vui lòng tải lại trang.', true);
        return;
    }
    requestForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (sending || Date.now() < cooldownUntil || !requestForm.reportValidity()) return;
        if (!['http:', 'https:'].includes(location.protocol)) {
            show('Hãy mở PASSIT bằng địa chỉ website để nhận liên kết khôi phục.', true); return;
        }
        sending = true; refreshButton();
        try {
            const redirect = new URL('quenmatkhau.html', location.href);
            redirect.search = ''; redirect.hash = '';
            const { error } = await client.auth.resetPasswordForEmail(document.getElementById('recoveryEmail').value.trim(), { redirectTo: redirect.href });
            if (error) throw error;
            cooldownUntil = Date.now() + 60000;
            show('Nếu email này đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra hộp thư và thư rác.');
        } catch (error) {
            if (error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit') {
                cooldownUntil = Date.now() + 60000;
                show('Bạn gửi yêu cầu hơi nhanh. Vui lòng chờ một phút rồi thử lại.', true);
            } else show('Chưa gửi được yêu cầu. Kiểm tra kết nối và thử lại sau.', true);
        } finally { sending = false; refreshButton(); }
    });
    const interval = setInterval(refreshButton, 1000);
    window.addEventListener('pagehide', () => clearInterval(interval), { once: true });
    document.getElementById('showNewPassword').addEventListener('change', event => {
        for (const id of ['newPassword', 'confirmNewPassword']) document.getElementById(id).type = event.target.checked ? 'text' : 'password';
    });
    resetForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving || !ready || !resetForm.reportValidity()) return;
        const password = document.getElementById('newPassword').value;
        if (password.length < 8 || password.length > 128) { show('Mật khẩu phải từ 8 đến 128 ký tự.', true); return; }
        if (password !== document.getElementById('confirmNewPassword').value) { show('Hai mật khẩu chưa khớp. Bạn kiểm tra lại nha.', true); return; }
        saving = true; resetButton.disabled = true; resetButton.textContent = 'Đang lưu…';
        try {
            const { data: identity, error: identityError } = await client.auth.getUser();
            if (identityError || !identity?.user) { invalidLink(); return; }
            const { error } = await client.auth.updateUser({ password });
            if (error) throw error;
            ready = false; resetForm.reset(); resetForm.hidden = true;
            document.getElementById('recoveryTitle').textContent = 'Đã đổi mật khẩu';
            document.getElementById('recoverySubtitle').textContent = 'Bạn có thể quay lại đăng nhập với mật khẩu mới.';
            show('Mật khẩu đã được cập nhật thành công.');
            // A logout failure must never turn a successful password change into a failure notice.
            try { await client.auth.signOut({ scope: 'global' }); } catch { /* password is already saved */ }
        } catch (error) {
            if (error.status === 401 || error.code === 'session_not_found' || error.code === 'refresh_token_not_found') invalidLink();
            else if (error.code === 'same_password') show('Mật khẩu mới cần khác mật khẩu cũ.', true);
            else if (error.code === 'weak_password') show('Mật khẩu chưa đủ mạnh. Hãy dùng mật khẩu dài hơn, có chữ, số và ký tự đặc biệt.', true);
            else show('Chưa lưu được mật khẩu. Kiểm tra kết nối rồi thử lại.', true);
        } finally { saving = false; resetButton.disabled = !ready; resetButton.textContent = 'Lưu mật khẩu mới'; }
    });
    async function acceptRecovery() {
        if (!hasCallback) return;
        if (params.get('type') !== 'recovery' || !params.get('access_token') || !params.get('refresh_token') || params.has('error') || query.has('error')) { invalidLink(); return; }
        requestForm.hidden = true;
        show('Đang kiểm tra liên kết khôi phục…');
        try {
            const { error } = await client.auth.setSession({ access_token: params.get('access_token'), refresh_token: params.get('refresh_token') });
            params.delete('access_token'); params.delete('refresh_token');
            if (error) throw error;
            const { data, error: userError } = await client.auth.getUser();
            if (userError || !data?.user) throw userError || new Error('Missing user');
            ready = true; resetForm.hidden = false; resetButton.disabled = false; message.hidden = true;
            document.getElementById('recoveryTitle').textContent = 'Đặt mật khẩu mới';
            document.getElementById('recoverySubtitle').textContent = 'Tạo mật khẩu mới cho tài khoản của bạn.';
            document.getElementById('newPassword').focus();
        } catch { params.delete('access_token'); params.delete('refresh_token'); invalidLink(); }
    }
    acceptRecovery();
})();
