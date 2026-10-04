/* Donate confirmation with an idempotent server receipt. */
(function () {
    'use strict';
    function setup() {
        const $ = id => document.getElementById(id);
        const modal = $('donateModal');
        if (!modal || modal.dataset.ready) return;
        modal.dataset.ready = 'true';
        const client = window.IUHCore?.getClient() || window.IUH_SUPABASE || window.supabase.createClient(
            'https://xecxofmogvqysejjpxvl.supabase.co', 'sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC');
        let busy = false, userId = null, attempt = null, mode = null, completed = false;
        const money = value => Number(value).toLocaleString('vi-VN') + 'đ';
        const storageKey = id => 'iuh_donate_attempt_' + id;
        const fields = ['donateDonorName', 'donateBankName', 'donateAmount', 'donateTransferContentInput'];
        function view(step) {
            $('donatePaymentView').hidden = step !== 'payment';
            $('donateTransferView').hidden = step !== 'transfer';
            $('donateSuccessView').hidden = step !== 'success';
        }
        function restore() {
            if (!attempt) return;
            $('donateDonorName').value = attempt.p_donor_name;
            $('donateBankName').value = attempt.p_bank_name;
            $('donateAmount').value = attempt.p_amount;
            $('donateTransferContentInput').value = attempt.p_transfer_content;
        }
        function preview() {
            $('donateTransferBank').textContent = attempt.p_bank_name;
            $('donateTransferDonor').textContent = attempt.p_donor_name;
            $('donateTransferAmount').textContent = money(attempt.p_amount);
            $('donateTransferContent').textContent = attempt.p_transfer_content;
            view('transfer');
        }
        function close() {
            if (busy) return;
            modal.classList.remove('show'); modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
        async function open() {
            if (busy) return;
            modal.classList.add('show'); modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden'; view('payment');
            $('donateMessage').textContent = '';
            $('donateTransferMessage').textContent = '';
            $('startDonateTransfer').disabled = true;
            try {
                const { data: { user }, error } = await client.auth.getUser();
                if (error || !user) throw new Error('Vui lòng đăng nhập để Donate.');
                userId = user.id;
                const result = await client.rpc('get_iuh_trial_mode');
                if (result.error) throw result.error;
                mode = result.data === true;
                $('donateModeNote').textContent = mode ? 'Chọn số tiền và xác nhận Donate. Không cần chuyển khoản.' : 'Gửi thông tin Donate để quản trị viên đối soát chuyển khoản.';
                $('donateConfirmNote').textContent = mode ? 'Kiểm tra thông tin và bấm xác nhận để hoàn tất Donate.' : 'Khoản Donate sẽ được ghi nhận sau khi quản trị viên đối soát.';
                if (completed) { fields.forEach(id => $(id).value = ''); completed = false; }
                attempt = null;
                const saved = sessionStorage.getItem(storageKey(userId));
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (typeof parsed.p_request_key === 'string' && Number.isInteger(parsed.p_amount) &&
                        ['p_donor_name', 'p_bank_name', 'p_transfer_content'].every(key => typeof parsed[key] === 'string')) attempt = parsed;
                }
                if (attempt) { restore(); preview(); }
                else if (!$('donateTransferContentInput').value.trim()) $('donateTransferContentInput').value = 'DONATE IUH SHOP - ' + crypto.randomUUID().slice(0, 8).toUpperCase();
                $('startDonateTransfer').disabled = false;
            } catch (error) { $('donateMessage').textContent = error.message || 'Không tải được thông tin Donate. Vui lòng thử lại.'; }
        }
        $('donateFloatingButton').addEventListener('click', open);
        for (const id of ['closeDonateModal', 'donateModalOverlay', 'finishDonate']) $(id)?.addEventListener('click', close);
        document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
        document.querySelectorAll('[data-donate-amount]').forEach(button => button.addEventListener('click', () => {
            if (!attempt && !busy) $('donateAmount').value = button.dataset.donateAmount;
        }));
        $('startDonateTransfer').addEventListener('click', () => {
            if (busy || !userId || mode === null) return;
            if (attempt) { restore(); preview(); return; }
            const amount = Number($('donateAmount').value);
            const name = $('donateDonorName').value.trim(), bank = $('donateBankName').value;
            const content = $('donateTransferContentInput').value.trim();
            if (!name || name.length > 150 || !bank || !content || content.length > 200 || !Number.isInteger(amount) || amount < 1000 || amount > 100000000) {
                $('donateMessage').textContent = 'Điền đủ thông tin và nhập số tiền nguyên từ 1.000đ đến 100.000.000đ.'; return;
            }
            attempt = { p_amount: amount, p_donor_name: name, p_bank_name: bank, p_transfer_content: content, p_request_key: 'DONATE-' + crypto.randomUUID() };
            preview();
        });
        $('backToDonateAmount').addEventListener('click', () => {
            if (busy) return;
            // Once sent, keep the same receipt key until the server answers.
            if (userId && sessionStorage.getItem(storageKey(userId))) {
                $('donateTransferMessage').textContent = 'Giao dịch trước chưa rõ kết quả. Bấm xác nhận lại để kiểm tra, không tạo Donate mới.'; return;
            }
            attempt = null; view('payment');
        });
        $('confirmDonateTransfer').addEventListener('click', async () => {
            if (busy || !attempt || completed) return;
            busy = true; $('confirmDonateTransfer').disabled = true;
            $('confirmDonateTransfer').textContent = 'ĐANG XỬ LÝ...'; $('donateTransferMessage').textContent = '';
            try {
                const auth = await client.auth.getUser();
                if (auth.error || auth.data?.user?.id !== userId) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng mở lại Donate.');
                sessionStorage.setItem(storageKey(userId), JSON.stringify(attempt));
                const { data, error } = await client.rpc('request_donation', attempt);
                if (error || !data?.success) {
                    if (/^(22|23|42|P0)/.test(error?.code || '')) {
                        sessionStorage.removeItem(storageKey(userId)); attempt = null;
                        view('payment'); $('donateMessage').textContent = error.message;
                    }
                    throw error || new Error('Không ghi nhận được Donate.');
                }
                if (!['completed', 'pending'].includes(data.status)) throw new Error('Yêu cầu Donate đã bị từ chối. Vui lòng liên hệ hỗ trợ.');
                $('donateSuccessAmount').textContent = money(attempt.p_amount);
                $('donateSuccessCode').textContent = data.transfer_code;
                $('donateSuccessView').querySelector('h3').textContent = data.status === 'completed' ? 'DONATE THÀNH CÔNG' : 'ĐÃ GỬI YÊU CẦU DONATE';
                $('donateSuccessView').querySelector('p').textContent = data.status === 'completed' ? 'Cảm ơn bạn đã ủng hộ IUH SHOP.' : 'Đang chờ quản trị viên đối soát thanh toán.';
                sessionStorage.removeItem(storageKey(userId)); attempt = null; completed = true; view('success');
            } catch (error) { $('donateTransferMessage').textContent = error.message || 'Chưa nhận được kết quả. Bấm xác nhận lại để kiểm tra giao dịch.'; }
            finally { busy = false; $('confirmDonateTransfer').disabled = false; $('confirmDonateTransfer').textContent = 'XÁC NHẬN DONATE'; }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
})();
