const supabaseClient = window.IUHCore?.getClient() || window.supabase.createClient(
    "https://xecxofmogvqysejjpxvl.supabase.co",
    "sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC"
);

const registerForm = document.getElementById("registerForm");

// Custom messages name every invalid field; HTML required remains a no-JS fallback.
registerForm.noValidate = true;
const signupFields = {
    fullName: 'Họ và tên', studentId: 'Mã số sinh viên', faculty: 'Khoa',
    email: 'Email', phone: 'Số điện thoại', password: 'Mật khẩu',
    confirmPassword: 'Xác nhận mật khẩu', agreeTerms: 'Đồng ý điều khoản'
};
function validateSignup() {
    const errors = [];
    for (const [id, label] of Object.entries(signupFields)) {
        const field = document.getElementById(id);
        const value = field.value.trim();
        let error = '';
        if (id === 'agreeTerms') {
            if (!field.checked) error = 'Vui lòng đồng ý với Điều khoản sử dụng.';
        } else if (!value) error = `Vui lòng ${id === 'faculty' ? 'chọn' : 'nhập'} ${label.toLowerCase()}.`;
        else if (id === 'email' && field.validity.typeMismatch) error = 'Vui lòng nhập email hợp lệ, ví dụ: ten@example.com.';
        else if (id === 'phone' && !/^(?:0\d{9}|\+84\d{9})$/.test(value.replace(/[\s().-]/g, ''))) error = 'Nhập số điện thoại gồm 10 số bắt đầu bằng 0 hoặc dạng +84.';
        else if (id === 'password' && field.value.length < 8) error = 'Mật khẩu phải có ít nhất 8 ký tự.';
        else if (id === 'confirmPassword' && field.value !== document.getElementById('password').value) error = 'Mật khẩu xác nhận không trùng khớp.';
        let hint = document.getElementById(id + 'Error');
        if (!hint) {
            hint = document.createElement('p'); hint.id = id + 'Error'; hint.className = 'signup-field-error';
            hint.style.cssText = 'color:#b42318;font-size:13px;margin:6px 0 0';
            (field.closest('.form-group, .terms') || field.parentElement).appendChild(hint);
            const describedBy = field.getAttribute('aria-describedby');
            field.setAttribute('aria-describedby', [describedBy, hint.id].filter(Boolean).join(' '));
        }
        hint.textContent = error; hint.hidden = !error;
        field.setAttribute('aria-invalid', String(Boolean(error)));
        if (error) errors.push({ field, label });
    }
    return errors;
}
for (const type of ['input', 'change']) registerForm.addEventListener(type, () => {
    if (registering || accountCreated || !registerForm.dataset.validationAttempted) return;
    const errors = validateSignup();
    document.getElementById('formMessage').textContent = errors.length
        ? 'Vui lòng kiểm tra: ' + errors.map(e => e.label).join(', ') + '.' : '';
});

let registering = false;
let accountCreated = false;

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);

    input.type = input.type === "password" ? "text" : "password";

    button.textContent =
        input.type === "password" ? "Hiện" : "Ẩn";
}

registerForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (registering || accountCreated) return;

    const value = id =>
        document.getElementById(id).value.trim();

    const password =
        document.getElementById("password").value;

    const message =
        document.getElementById("formMessage");

    const button =
        registerForm.querySelector(".auth-button");

    const show = (text, failed = true) => {
        message.textContent = text;
        message.style.color =
            failed ? "#d64545" : "#193f9e";
    };

    show("");

    /* =========================
       KIỂM TRA THÔNG TIN
    ========================= */

    registerForm.dataset.validationAttempted = 'true';
    const invalidFields = validateSignup();
    if (invalidFields.length) {
        show('Vui lòng kiểm tra: ' + invalidFields.map(e => e.label).join(', ') + '.');
        invalidFields[0].field.focus();
        return;
    }

    if (password.length < 8) {
        return show(
            "Mật khẩu phải có ít nhất 8 ký tự."
        );
    }

    if (
        password !==
        document.getElementById("confirmPassword").value
    ) {
        return show(
            "Mật khẩu xác nhận không trùng khớp."
        );
    }

    if (
        !document.getElementById("agreeTerms").checked
    ) {
        return show(
            "Vui lòng đồng ý với Điều khoản sử dụng."
        );
    }


    /* =========================
       TẠO TÀI KHOẢN
    ========================= */

    registering = true;

    button.disabled = true;
    button.textContent = "ĐANG TẠO TÀI KHOẢN...";

    try {

        const isGraduated =
            document.getElementById("isGraduated").checked;

        const { data, error } =
            await supabaseClient.auth.signUp({

                email: value("email"),

                password,

                options: {
                    data: {
                        fullname: value("fullName"),
                        student_id: value("studentId"),
                        faculty: value("faculty"),
                        phone: value("phone"),
                        is_graduated: isGraduated
                    }
                }

            });


        if (error) {
            throw error;
        }


        if (!data?.user) {
            throw new Error(
                "Không lấy được tài khoản vừa đăng ký. Vui lòng thử đăng nhập."
            );
        }


        accountCreated = true;


        const hasSession =
            Boolean(data.session);


        /* =========================
           CHƯA XÁC NHẬN EMAIL
        ========================= */

        if (!hasSession) {

            show(
                "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản. Sau đó đăng nhập để sử dụng PASSIT.",
                false
            );

            return;
        }


        /* =========================
           ĐĂNG KÝ THÀNH CÔNG
           KHÔNG CẦN THẺ SINH VIÊN
        ========================= */

        show(
            "Đăng ký thành công! Bạn có thể sử dụng tài khoản PASSIT.",
            false
        );


        setTimeout(() => {
            window.location.href = "taikhoan.html";
        }, 800);


    } catch (error) {

        console.error(
            "Lỗi đăng ký:",
            error
        );


        if (accountCreated) {

            show(
                "Tài khoản đã được tạo. Vui lòng đăng nhập để tiếp tục."
            );

            const link =
                document.createElement("a");

            link.href = "dangnhap.html";

            link.textContent = " Đăng nhập";

            message.appendChild(link);

        } else {

            show(
                error.message ||
                "Không thể kết nối. Vui lòng thử lại."
            );
        }

    } finally {

        registering = false;

        button.disabled = accountCreated;

        button.textContent =
            accountCreated
                ? "ĐÃ TẠO TÀI KHOẢN"
                : "ĐĂNG KÝ";
    }
});
