/* =========================================
   SUPABASE
========================================= */



const supabaseClient =
    window.IUHCore.getClient();


/* =========================================
   HIỆN / ẨN MẬT KHẨU
========================================= */

function togglePassword(inputId, button) {

    const input =
        document.getElementById(inputId);

    if (input.type === "password") {

        input.type = "text";

        button.textContent = "Ẩn";

    } else {

        input.type = "password";

        button.textContent = "Hiện";
    }
}


/* =========================================
   ĐĂNG NHẬP
========================================= */

const loginForm = document.getElementById('loginForm');
let loginBusy = false;
loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (loginBusy || !loginForm.reportValidity()) return;
    const account = document.getElementById('loginAccount').value.trim();
    const password = document.getElementById('loginPassword').value;
    const button = loginForm.querySelector('.auth-button');
    if (!account || !password) return;
    loginBusy = true; button.disabled = true; button.textContent = 'Đang đăng nhập…';
    let success = false;
    try {
        let email = account;
        if (!account.includes('@')) {
            const { data, error } = await supabaseClient.from('users').select('email').eq('student_id', account).maybeSingle();
            if (error || !data?.email) { alert('Vui lòng đăng nhập bằng email đã đăng ký. Nếu quên mật khẩu, chọn “Quên mật khẩu?”.'); return; }
            email = data.email;
        }
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error || !data?.user) {
            alert(error?.code === 'email_not_confirmed' ? 'Vui lòng xác nhận email đăng ký trước khi đăng nhập.' : error?.status === 429 ? 'Bạn thử đăng nhập quá nhiều lần. Vui lòng chờ rồi thử lại.' : 'Email hoặc mật khẩu không chính xác.');
            return;
        }
        success = true; button.textContent = 'Đăng nhập thành công';
        setTimeout(() => { window.location.href = '../HTML/trangchu.html'; }, 700);
    } catch { alert('Không thể kết nối. Kiểm tra mạng rồi thử đăng nhập lại.'); }
    finally { if (!success) { loginBusy = false; button.disabled = false; button.textContent = 'Đăng nhập'; } }
});
