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
const studentCardInput =
    document.getElementById("studentCard");

const studentCardPreview =
    document.getElementById("studentCardPreview");

const isGraduatedInput =
    document.getElementById("isGraduated");

/* =========================================
   XEM TRƯỚC THẺ SINH VIÊN
========================================= */

if (studentCardInput) {

    studentCardInput.addEventListener(
        "change",
        function () {

            const file =
                this.files?.[0];

            if (!file) {
                studentCardPreview.innerHTML = "";
                studentCardPreview.classList.remove("show");
                return;
            }

            if (!file.type.startsWith("image/")) {

                this.value = "";

                alert(
                    "Vui lòng chọn file hình ảnh."
                );

                return;
            }

            if (file.size > 5 * 1024 * 1024) {

                this.value = "";

                alert(
                    "Ảnh thẻ sinh viên không được vượt quá 5MB."
                );

                return;
            }

            const reader =
                new FileReader();

            reader.onload =
                function (event) {

                    studentCardPreview.innerHTML = `
                        <img
                            src="${event.target.result}"
                            alt="Thẻ sinh viên"
                        >
                    `;

                    studentCardPreview.classList.add(
                        "show"
                    );
                };

            reader.readAsDataURL(file);

        }
    );

}


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

        const studentCardFile =
    document
        .getElementById("studentCard")
        .files?.[0];

const isGraduated =
    document
        .getElementById("isGraduated")
        .checked;


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

        if (!studentCardFile) {

    message.textContent =
        "Vui lòng tải lên thẻ sinh viên.";

    message.style.color =
        "#d64545";

    return;
}


if (studentCardFile.size > 5 * 1024 * 1024) {

    message.textContent =
        "Ảnh thẻ sinh viên không được vượt quá 5MB.";

    message.style.color =
        "#d64545";

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

        /* =========================================
   UPLOAD THẺ SINH VIÊN
========================================= */

const newUser =
    data?.user;

if (!newUser) {

    message.textContent =
        "Không lấy được tài khoản vừa đăng ký.";

    message.style.color =
        "#d64545";

    button.disabled = false;
    button.textContent = "ĐĂNG KÝ";

    return;
}


const fileExtension =
    studentCardFile.name
        .split(".")
        .pop()
        .toLowerCase();


const filePath =
    `${newUser.id}/${Date.now()}.${fileExtension}`;


const {
    error: uploadError
} =
    await supabaseClient
        .storage
        .from("student-cards")
        .upload(
            filePath,
            studentCardFile,
            {
                cacheControl: "3600",
                upsert: false
            }
        );


if (uploadError) {

    console.error(
        "Lỗi upload thẻ sinh viên:",
        uploadError
    );

    message.textContent =
        "Tạo tài khoản thành công nhưng tải thẻ sinh viên thất bại.";

    message.style.color =
        "#d64545";

    button.disabled = false;
    button.textContent = "ĐĂNG KÝ";

    return;
}


/* =========================================
   LẤY URL ẢNH
========================================= */

const {
    data: publicUrlData
} =
    supabaseClient
        .storage
        .from("student-cards")
        .getPublicUrl(filePath);


const studentCardUrl =
    publicUrlData.publicUrl;

/* =========================================
   LƯU THÔNG TIN XÁC THỰC
========================================= */

const {
    error: profileError
} =
    await supabaseClient
        .from("users")
        .update({
            student_card_url:
                studentCardUrl,

            is_graduated:
                isGraduated
        })
        .eq(
            "user_id",
            newUser.id
        );


if (profileError) {

    console.error(
        "Lỗi lưu thông tin sinh viên:",
        profileError
    );

    message.textContent =
        "Tài khoản đã tạo nhưng không lưu được thông tin thẻ.";

    message.style.color =
        "#d64545";

    button.disabled = false;
    button.textContent = "ĐĂNG KÝ";

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