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

const DEFAULT_AVATAR =
    "../Images/default-avatar.svg";

let users = [];
let currentFilter = "all";


/* =========================================
   KIỂM TRA ADMIN
========================================= */

async function checkAdmin() {

    const {
        data: { user },
        error: authError
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        window.location.href = "trangchu.html";
        return null;
    }

    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("users")
        .select("fullname, role")
        .eq("user_id", user.id)
        .maybeSingle();

    if (profileError) {

        console.error(
            "Lỗi lấy profile:",
            profileError
        );

        alert(
            "Không thể kiểm tra quyền Admin."
        );

        return null;
    }

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
   MỞ / ĐÓNG QUẢN LÝ NGƯỜI DÙNG
========================================= */

function setupUserManagement() {

    const manageUsers =
        document.getElementById(
            "manageUsers"
        );

    const verificationSection =
        document.getElementById(
            "verificationSection"
        );

    const closeVerification =
        document.getElementById(
            "closeVerification"
        );


    /* Không tìm thấy nút */

    if (!manageUsers) {

        console.error(
            "Không tìm thấy #manageUsers"
        );

        return;
    }


    /* Không tìm thấy khu vực xác thực */

    if (!verificationSection) {

        console.error(
            "Không tìm thấy #verificationSection"
        );

        return;
    }


    /* =====================================
       BẤM QUẢN LÝ NGƯỜI DÙNG
    ===================================== */

    manageUsers.addEventListener(
        "click",
        async function () {

            /*
               Hiện phần xác thực
            */

            verificationSection.classList.add(
                "show"
            );

            verificationSection.setAttribute(
                "aria-hidden",
                "false"
            );


            /*
               Cuộn xuống phần xác thực
            */

            verificationSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });


            /*
               Tải danh sách tài khoản
            */

            await loadUsers();
        }
    );


    /* =====================================
       BẤM ĐÓNG
    ===================================== */

    if (closeVerification) {

        closeVerification.addEventListener(
            "click",
            function () {

                verificationSection.classList.remove(
                    "show"
                );

                verificationSection.setAttribute(
                    "aria-hidden",
                    "true"
                );


                /*
                   Cuộn về đầu trang
                */

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );
    }
}


/* =========================================
   TẢI DANH SÁCH TÀI KHOẢN
========================================= */

async function loadUsers() {

    const verificationList =
        document.getElementById(
            "verificationList"
        );

    if (!verificationList) {
        return;
    }


    verificationList.innerHTML = `
        <div class="verification-loading">
            Đang tải tài khoản...
        </div>
    `;


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("users")
                .select(`
                    user_id,
                    fullname,
                    email,
                    avatar_url,
                    role,
                    student_verified,
                    verification_status,
                    verification_method,
                    verified_at
                `)
                .order(
                    "fullname",
                    {
                        ascending: true
                    }
                );


        if (error) {
            throw error;
        }


        users =
            data || [];


        /*
           Cập nhật tổng số người dùng
        */

        updateTotalUsers();


        /*
           Hiển thị danh sách
        */

        renderUsers();


        /*
           Cập nhật thống kê xác thực
        */

        updateSummary();

    }

    catch (error) {

        console.error(
            "Lỗi tải danh sách tài khoản:",
            error
        );


        verificationList.innerHTML = `

            <div class="verification-error">

                Không thể tải danh sách tài khoản.

                <br><br>

                ${escapeHtml(
                    error.message || ""
                )}

            </div>

        `;
    }
}


/* =========================================
   CẬP NHẬT TỔNG USER
========================================= */

function updateTotalUsers() {

    const totalUsers =
        document.getElementById(
            "totalUsers"
        );

    if (totalUsers) {

        totalUsers.textContent =
            users.length;
    }
}


/* =========================================
   FILTER + SEARCH
========================================= */

function setupFilters() {

    const filterButtons =
        document.querySelectorAll(
            ".filter-button"
        );


    /*
       Bộ lọc
    */

    filterButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    filterButtons.forEach(
                        function (item) {

                            item.classList.remove(
                                "active"
                            );
                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    currentFilter =
                        button.dataset.filter ||
                        "all";


                    renderUsers();

                    updateSummary();
                }
            );
        }
    );


    /*
       Tìm kiếm
    */

    const searchInput =
        document.getElementById(
            "verificationSearch"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function () {

                renderUsers();

                updateSummary();
            }
        );
    }
}


/* =========================================
   LỌC USER
========================================= */

function getFilteredUsers() {

    const searchInput =
        document.getElementById(
            "verificationSearch"
        );


    const keyword =
        (
            searchInput?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    return users.filter(
        function (user) {

            const verified =
                user.student_verified === true;


            /*
               Kiểm tra bộ lọc
            */

            const filterMatch =

                currentFilter === "all"

                ||

                (
                    currentFilter === "verified" &&
                    verified
                )

                ||

                (
                    currentFilter === "unverified" &&
                    !verified
                );


            /*
               Tên
            */

            const name =
                (
                    user.fullname ||
                    ""
                )
                    .toLowerCase();


            /*
               Email
            */

            const email =
                (
                    user.email ||
                    ""
                )
                    .toLowerCase();


            /*
               Kiểm tra từ khóa
            */

            const searchMatch =

                !keyword

                ||

                name.includes(
                    keyword
                )

                ||

                email.includes(
                    keyword
                );


            return (
                filterMatch &&
                searchMatch
            );
        }
    );
}


/* =========================================
   HIỂN THỊ USER
========================================= */

function renderUsers() {

    const verificationList =
        document.getElementById(
            "verificationList"
        );


    if (!verificationList) {
        return;
    }


    const filteredUsers =
        getFilteredUsers();


    /*
       Không có tài khoản
    */

    if (
        filteredUsers.length === 0
    ) {

        verificationList.innerHTML = `

            <div class="verification-empty">

                Không tìm thấy tài khoản phù hợp.

            </div>

        `;

        return;
    }


    /*
       Tạo danh sách card
    */

    verificationList.innerHTML =
        filteredUsers
            .map(
                createUserCard
            )
            .join("");
}


/* =========================================
   TẠO CARD USER
========================================= */

function createUserCard(
    user
) {

    const verified =
        user.student_verified === true;


    const role =
        user.role ||
        "user";


    /* =====================================
       CHỨC DANH
    ===================================== */

    let roleText =
        "Sinh viên";


    if (
        role === "admin"
    ) {

        roleText =
            "Admin";

    }

    else if (
        role === "moderator"
    ) {

        roleText =
            "Quản trị viên";
    }


    /* =====================================
       TRẠNG THÁI
    ===================================== */

    let stateText =
        "Chưa có tích xác thực";


    if (verified) {

        if (
            user.verification_method ===
            "admin_grant"
        ) {

            stateText =
                "Được Admin cấp tích";

        }

        else {

            stateText =
                "Đã xác thực sinh viên";
        }
    }


    /* =====================================
       NÚT
    ===================================== */

    let action = "";


    /*
       Admin và Quản trị viên:

       - Mặc định có tích
       - Không cần cấp
       - Không hiện nút thu hồi
    */

    if (
        role === "admin" ||
        role === "moderator"
    ) {

        action = `

            <span
                class="verification-state is-verified"
            >
                Quyền hệ thống
            </span>

        `;

    }


    /*
       Sinh viên đã có tích
    */

    else if (verified) {

        action = `

            <button
                type="button"
                class="verification-action revoke"
                data-action="revoke"
                data-user-id="${escapeAttribute(
                    user.user_id
                )}"
            >

                Thu hồi tích

            </button>

        `;

    }


    /*
       Sinh viên chưa có tích
    */

    else {

        action = `

            <button
                type="button"
                class="verification-action grant"
                data-action="grant"
                data-user-id="${escapeAttribute(
                    user.user_id
                )}"
            >

                Cấp tích ✓

            </button>

        `;
    }


    /* =====================================
       TÍCH XANH
    ===================================== */

    const badge =

        verified ||

        role === "admin" ||

        role === "moderator"

            ?

            `

                <span
                    class="student-verified-badge"
                    title="Đã xác thực"
                >

                    ✓

                </span>

            `

            :

            "";


    /* =====================================
       CARD
    ===================================== */

    return `

        <article
            class="verification-card"
        >

            <img
                class="verification-avatar"
                src="${escapeAttribute(
                    user.avatar_url ||
                    DEFAULT_AVATAR
                )}"
                alt="Avatar"
                onerror="this.src='${DEFAULT_AVATAR}'"
            >


            <div
                class="verification-user"
            >

                <div
                    class="verification-name"
                >

                    <strong>

                        ${escapeHtml(
                            user.fullname ||
                            "Chưa cập nhật tên"
                        )}

                    </strong>


                    ${badge}

                </div>


                <span
                    class="verification-email"
                >

                    ${escapeHtml(
                        user.email ||
                        ""
                    )}

                </span>


                <span
                    class="verification-role"
                >

                    ${roleText}

                </span>


                <span
                    class="verification-state ${
                        verified
                            ? "is-verified"
                            : ""
                    }"
                >

                    ${stateText}

                </span>

            </div>


            <div>

                ${action}

            </div>

        </article>

    `;
}


/* =========================================
   CẤP / THU HỒI TÍCH
========================================= */

document.addEventListener(
    "click",
    async function (event) {

        const button =
            event.target.closest(
                ".verification-action"
            );


        if (!button) {
            return;
        }


        const userId =
            button.dataset.userId;


        const verified =
            button.dataset.action ===
            "grant";


        if (!userId) {
            return;
        }


        const message =

            verified

                ?

                "Bạn có chắc muốn cấp tích cho tài khoản này không?"

                :

                "Bạn có chắc muốn thu hồi tích của tài khoản này không?";


        if (
            !confirm(message)
        ) {
            return;
        }


        button.disabled =
            true;


        try {

            const {
                data,
                error
            } =
                await supabaseClient
                    .rpc(
                        "admin_set_student_verified",
                        {
                            target_user_id:
                                userId,

                            verified:
                                verified
                        }
                    );


            if (error) {
                throw error;
            }


            if (
                !data ||
                data.success !== true
            ) {

                throw new Error(
                    "Máy chủ không trả về kết quả hợp lệ."
                );
            }


            alert(

                verified

                    ?

                    "Đã cấp tích xác thực."

                    :

                    "Đã thu hồi tích xác thực."

            );


            /*
               Tải lại danh sách
            */

            await loadUsers();

        }

        catch (error) {

            console.error(
                "Lỗi cập nhật tích:",
                error
            );


            alert(
                error.message ||
                "Không thể cập nhật trạng thái xác thực."
            );


            button.disabled =
                false;
        }
    }
);


/* =========================================
   THỐNG KÊ XÁC THỰC
========================================= */

function updateSummary() {

    const summary =
        document.getElementById(
            "verificationSummary"
        );


    if (!summary) {
        return;
    }


    /*
       Chỉ tính tài khoản sinh viên
    */

    const students =
        users.filter(
            function (user) {

                return (
                    user.role ===
                    "user"
                );
            }
        );


    /*
       Sinh viên đã có tích
    */

    const verified =
        students.filter(
            function (user) {

                return (
                    user.student_verified ===
                    true
                );
            }
        ).length;


    /*
       Số tài khoản đang hiển thị
    */

    const visible =
        getFilteredUsers().length;


    summary.textContent =

        `Có ${students.length} tài khoản sinh viên · ` +

        `${verified} đã có tích · ` +

        `${students.length - verified} chưa có tích · ` +

        `Đang hiển thị ${visible}`;
}


/* =========================================
   ESCAPE HTML
========================================= */

function escapeHtml(
    value
) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );
}


function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );
}


/* =========================================
   KHỞI ĐỘNG
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "IUH SHOP ADMIN JS đã chạy."
        );


        /*
           Kiểm tra tài khoản Admin
        */

        const user =
            await checkAdmin();


        if (!user) {
            return;
        }


        /*
           Khởi tạo các chức năng
        */

        setupLogout();

        setupUserManagement();

        setupFilters();


        /*
           KHÔNG tải danh sách xác thực
           ngay khi mở trang.

           Chỉ tải khi Admin bấm:
           "Quản lý người dùng".
        */
    }
);