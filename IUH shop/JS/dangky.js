/* =========================================
   SUPABASE
========================================= */

const SUPABASE_URL =
    "https://xecxofmogvqysejjpxvl.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


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
   FORM ĐĂNG KÝ
========================================= */

const registerForm =
    document.getElementById("registerForm");


registerForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        /* ==============================
           LẤY DỮ LIỆU
        ============================== */

        const fullName =
            document
                .getElementById("fullName")
                .value
                .trim();


        const studentId =
            document
                .getElementById("studentId")
                .value
                .trim();


        const faculty =
            document
                .getElementById("faculty")
                .value;


        const email =
            document
                .getElementById("email")
                .value
                .trim();


        const phone =
            document
                .getElementById("phone")
                .value
                .trim();


        const password =
            document
                .getElementById("password")
                .value;


        const confirmPassword =
            document
                .getElementById("confirmPassword")
                .value;


        const agreeTerms =
            document
                .getElementById("agreeTerms")
                .checked;


        const message =
            document.getElementById("formMessage");


        const button =
            registerForm.querySelector(
                ".auth-button"
            );


        /* ==============================
           XÓA THÔNG BÁO CŨ
        ============================== */

        message.textContent = "";


        /* ==============================
           KIỂM TRA MẬT KHẨU
        ============================== */

        if (password.length < 8) {

            message.textContent =
                "Mật khẩu phải có ít nhất 8 ký tự.";

            message.style.color = "#d64545";

            return;
        }


        /* ==============================
           XÁC NHẬN MẬT KHẨU
        ============================== */

        if (password !== confirmPassword) {

            message.textContent =
                "Mật khẩu xác nhận không trùng khớp.";

            message.style.color = "#d64545";

            return;
        }


        /* ==============================
           KIỂM TRA ĐIỀU KHOẢN
        ============================== */

        if (!agreeTerms) {

            message.textContent =
                "Vui lòng đồng ý với Điều khoản sử dụng.";

            message.style.color = "#d64545";

            return;
        }


        /* ==============================
           KHÓA BUTTON
        ============================== */

        button.disabled = true;

        button.textContent =
            "ĐANG TẠO TÀI KHOẢN...";


        /* ==============================
           ĐĂNG KÝ SUPABASE AUTH
        ============================== */

        const {
            data,
            error
        } = await supabaseClient.auth.signUp({

            email: email,

            password: password,

            options: {

                data: {

                    fullname: fullName,

                    student_id: studentId,

                    faculty: faculty,

                    phone: phone
                }
            }
        });


        /* ==============================
           XỬ LÝ LỖI
        ============================== */

        if (error) {

            console.error(
                "Lỗi đăng ký:",
                error
            );

            message.textContent =
                error.message;

            message.style.color =
                "#d64545";

            button.disabled = false;

            button.textContent =
                "ĐĂNG KÝ";

            return;
        }


        /* ==============================
           ĐĂNG KÝ THÀNH CÔNG
        ============================== */

        console.log(
            "Đăng ký thành công:",
            data
        );


        message.textContent =
            "Đăng ký thành công! Đang chuyển sang trang đăng nhập...";

        message.style.color =
            "#193f9e";


        /* ==============================
           CHUYỂN TRANG
        ============================== */

        showPageTransition();

setTimeout(() => {
    window.location.href = "dangnhap.html";
}, 1000);

    }
);

function showPageTransition() {

    const transition =
        document.createElement("div");

    transition.className =
        "page-transition";


    transition.innerHTML = `
        <div class="transition-content">

            <img
                src="../Images/logo-trang.png"
                alt="IUH SHOP"
                class="transition-logo"
            >

            <div class="transition-spinner"></div>

            <div class="transition-text">
                Đang chuyển đến trang đăng nhập...
            </div>

        </div>
    `;


    document.body.appendChild(transition);


    requestAnimationFrame(() => {

        transition.classList.add("active");

    });

}