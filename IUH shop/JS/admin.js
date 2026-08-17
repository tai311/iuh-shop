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
   KIỂM TRA ADMIN
========================================= */

async function checkAdmin() {

    try {

        /* Lấy tài khoản đang đăng nhập */

        const {
            data: {
                user
            },
            error: userError
        } =
            await supabaseClient.auth.getUser();


        /* Không đăng nhập */

        if (
            userError ||
            !user
        ) {

            window.location.href =
                "trangchu.html";

            return null;

        }


        /* Lấy role */

        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("users")
                .select(
                    "fullname, role"
                )
                .eq(
                    "user_id",
                    user.id
                )
                .maybeSingle();


        /* Lỗi lấy profile */

        if (profileError) {

            console.error(
                profileError
            );

            window.location.href =
                "trangchu.html";

            return null;

        }


        /* Không phải Admin */

        if (
            !profile ||
            profile.role !== "admin"
        ) {

            alert(
                "Bạn không có quyền truy cập trang quản trị."
            );

            window.location.href =
                "trangchu.html";

            return null;

        }


        /* Hiện tên Admin */

        const adminName =
            document.getElementById(
                "adminName"
            );


        if (adminName) {

            adminName.textContent =
                profile.fullname ||
                "Admin";

        }


        return user;

    }

    catch (error) {

        console.error(
            "Lỗi kiểm tra Admin:",
            error
        );

        window.location.href =
            "trangchu.html";

        return null;

    }

}



/* =========================================
   ĐĂNG XUẤT
========================================= */

function setupLogout() {

    const logoutButton =
        document.getElementById(
            "adminLogout"
        );


    if (!logoutButton) {

        return;

    }


    logoutButton.addEventListener(
        "click",
        async function () {

            const {
                error
            } =
                await supabaseClient
                    .auth
                    .signOut();


            if (error) {

                console.error(
                    "Lỗi đăng xuất:",
                    error
                );

                alert(
                    "Đăng xuất thất bại."
                );

                return;

            }


            window.location.href =
                "trangchu.html";

        }
    );

}



/* =========================================
   KHỞI ĐỘNG
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        const user =
            await checkAdmin();


        if (!user) {

            return;

        }


        setupLogout();

    }
);