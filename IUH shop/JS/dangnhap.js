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
   ĐĂNG NHẬP
========================================= */

const loginForm =
    document.getElementById("loginForm");


loginForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        /* ==============================
           LẤY DỮ LIỆU
        ============================== */

        const account =
            document
                .getElementById("loginAccount")
                .value
                .trim();

        const password =
            document
                .getElementById("loginPassword")
                .value;


        const button =
            loginForm.querySelector(
                ".auth-button"
            );


        /* ==============================
           KIỂM TRA
        ============================== */

        if (!account || !password) {

            alert(
                "Vui lòng nhập đầy đủ email và mật khẩu."
            );

            return;
        }


        /* ==============================
           KHÓA BUTTON
        ============================== */

        button.disabled = true;

        button.textContent =
            "ĐANG ĐĂNG NHẬP...";


        /* ==============================
           XÁC ĐỊNH EMAIL
        ============================== */

        let email = account;


        /*
         Nếu người dùng nhập MSSV
         thì tìm email tương ứng
         trong bảng users.
        */

        if (!account.includes("@")) {

            const {
                data: userProfile,
                error: profileError
            } = await supabaseClient

                .from("users")

                .select("email")

                .eq("student_id", account)

                .maybeSingle();


            if (profileError) {

                console.error(
                    "Lỗi tìm tài khoản:",
                    profileError
                );

                alert(
                    "Không thể tìm thông tin tài khoản."
                );

                button.disabled = false;

                button.textContent =
                    "Đăng nhập";

                return;
            }


            if (!userProfile) {

                alert(
                    "Không tìm thấy mã sinh viên này."
                );

                button.disabled = false;

                button.textContent =
                    "Đăng nhập";

                return;
            }


            email =
                userProfile.email;
        }


        /* ==============================
           ĐĂNG NHẬP SUPABASE
        ============================== */

        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({

            email: email,

            password: password

        });


        /* ==============================
           XỬ LÝ LỖI
        ============================== */

        if (error) {

            console.error(
                "Lỗi đăng nhập:",
                error
            );

            alert(
                "Email hoặc mật khẩu không chính xác."
            );

            button.disabled = false;

            button.textContent =
                "Đăng nhập";

            return;
        }


        /* ==============================
           ĐĂNG NHẬP THÀNH CÔNG
        ============================== */

        console.log(
            "Đăng nhập thành công:",
            data.user
        );


        button.textContent =
            "ĐĂNG NHẬP THÀNH CÔNG";


        /* ==============================
           CHUYỂN VỀ TRANG CHỦ
        ============================== */

        setTimeout(function () {

            window.location.href =
                "../HTML/trangchu.html";

        }, 700);

    }
);