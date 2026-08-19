/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://xecxofmogvqysejjpxvl.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );



/* =========================================================
   CẬP NHẬT HEADER KHI ĐĂNG NHẬP
========================================================= */

async function updateUserMenu() {

    try {

        /* ---------------------------------------------
           Lấy tài khoản Supabase hiện tại
        --------------------------------------------- */

        const {
            data: {
                user
            },
            error: userError
        } =
            await supabaseClient.auth.getUser();


        if (userError) {

            console.error(
                "Không lấy được tài khoản:",
                userError
            );

            return;
        }


        /* ---------------------------------------------
           Lấy các phần tử trên header
        --------------------------------------------- */

        const loginLink =
            document.querySelector(".login-link");

        const registerLink =
            document.querySelector(".register-link");

        const divider =
            document.querySelector(".top-divider");

        const userAccount =
            document.getElementById(
                "userAccount"
            );

        const headerAvatar =
            document.getElementById(
                "headerAvatar"
            );

        const headerUserName =
            document.getElementById(
                "headerUserName"
            );


        /* ---------------------------------------------
           Nếu chưa đăng nhập
        --------------------------------------------- */

        if (!user) {

            if (loginLink) {
                loginLink.style.display = "";
            }

            if (registerLink) {
                registerLink.style.display = "";
            }

            if (divider) {
                divider.style.display = "";
            }

            if (userAccount) {
                userAccount.style.display = "none";
            }

            return;
        }


        /* ---------------------------------------------
           Đã đăng nhập
        --------------------------------------------- */

        const {
    data: profile,
    error
} = await supabaseClient
    .from("users")
    .select("fullname, avatar_url, role")
    .eq("user_id", user.id)
    .maybeSingle();


        const adminLink =
    document.getElementById("adminLink");


if (adminLink) {

    if (profile?.role === "admin") {

        adminLink.style.display = "block";

    } else {

        adminLink.style.display = "none";

    }

}


        /* ---------------------------------------------
           Tên người dùng
        --------------------------------------------- */

        const fullname =
            profile?.fullname ||
            user.email?.split("@")[0] ||
            "Tài khoản";


        if (headerUserName) {

            headerUserName.textContent =
                fullname;

        }


        /* ---------------------------------------------
           Avatar
        --------------------------------------------- */

        if (headerAvatar) {

            if (profile?.avatar_url) {

                headerAvatar.src =
                    profile.avatar_url;

            } else {

                headerAvatar.src =
                    "../Images/default-avatar.svg";

            }

        }


        /* ---------------------------------------------
           Ẩn Đăng nhập / Đăng ký
        --------------------------------------------- */

        if (loginLink) {

            loginLink.style.display =
                "none";

        }

        if (registerLink) {

            registerLink.style.display =
                "none";

        }

        if (divider) {

            divider.style.display =
                "none";

        }


        /* ---------------------------------------------
           Hiện tài khoản
        --------------------------------------------- */

        if (userAccount) {

            userAccount.style.display =
                "flex";

        }

    }

    catch (error) {

        console.error(
            "Lỗi cập nhật tài khoản:",
            error
        );

    }

}



/* =========================================================
   DROPDOWN TÀI KHOẢN
========================================================= */

function setupAccountDropdown() {

    const userAccountButton =
        document.getElementById(
            "userAccountButton"
        );

    const accountDropdown =
        document.getElementById(
            "accountDropdown"
        );


    /* Không có dropdown thì dừng */

    if (
        !userAccountButton ||
        !accountDropdown
    ) {

        return;

    }


    /* ---------------------------------------------
       Bấm vào tài khoản
    --------------------------------------------- */

    userAccountButton.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            accountDropdown.classList.toggle(
                "show"
            );

        }
    );


    /* ---------------------------------------------
       Bấm ra ngoài dropdown
    --------------------------------------------- */

    document.addEventListener(
        "click",
        function () {

            accountDropdown.classList.remove(
                "show"
            );

        }
    );

}



/* =========================================================
   ĐĂNG XUẤT
========================================================= */

function setupLogout() {

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    if (!logoutButton) {

        return;

    }


    logoutButton.addEventListener(
        "click",
        async function () {

            try {

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
                        "Đăng xuất thất bại. Vui lòng thử lại."
                    );

                    return;

                }


                /* Đăng xuất thành công */

                window.location.reload();

            }

            catch (error) {

                console.error(
                    "Lỗi đăng xuất:",
                    error
                );

                alert(
                    "Có lỗi xảy ra khi đăng xuất."
                );

            }

        }
    );

}



/* =========================================================
   THEO DÕI TRẠNG THÁI ĐĂNG NHẬP
========================================================= */

supabaseClient.auth.onAuthStateChange(
    function (event, session) {

        console.log(
            "Auth event:",
            event
        );

        updateUserMenu();

    }
);



/* =========================================================
   KHỞI ĐỘNG PHẦN TÀI KHOẢN
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        await updateUserMenu();

        setupAccountDropdown();

        setupLogout();

    }
);

/* =========================================
   DROPDOWN TÀI KHOẢN - 3 LỐI TẮT
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const accountWrapper =
            document.querySelector(
                ".account-nav-wrapper"
            );

        const accountArrow =
            document.getElementById(
                "accountNavArrow"
            );

        const accountShortcuts =
            document.getElementById(
                "accountShortcuts"
            );


        if (
            !accountWrapper ||
            !accountArrow ||
            !accountShortcuts
        ) {
            return;
        }


        /* =========================
           BẤM MŨI TÊN
        ========================= */

        accountArrow.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopPropagation();


                accountWrapper.classList.toggle(
                    "open"
                );

            }
        );


        /* =========================
           BẤM VÀO MENU
        ========================= */

        accountShortcuts.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

            }
        );


        /* =========================
           BẤM RA NGOÀI
        ========================= */

        document.addEventListener(
            "click",
            function () {

                accountWrapper.classList.remove(
                    "open"
                );

            }
        );

    }
);

document.addEventListener("DOMContentLoaded", function () {

    const currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();

    document.querySelectorAll(".navigation a.nav-item").forEach(link => {

        const linkPage =
            link.getAttribute("href")
                ?.split("/")
                .pop()
                .toLowerCase();

        if (!linkPage) return;

        if (linkPage === currentPage) {
            link.classList.add("active");
        }

    });

});

/* =====================================================
   MENU ACTIVE
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const currentPage =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();


        document
            .querySelectorAll(
                ".navigation a.nav-item"
            )
            .forEach(link => {

                const linkPage =
                    link
                        .getAttribute("href")
                        ?.split("/")
                        .pop()
                        .toLowerCase();


                if (!linkPage) {
                    return;
                }


                if (linkPage === currentPage) {

                    link.classList.add(
                        "active"
                    );

                }

            });

    }
);


/* =====================================================
   TRANG CÁ NHÂN
===================================================== */


/* =====================================================
   LẤY USER ID CẦN HIỂN THỊ
===================================================== */

async function getProfileUserId() {

    /*
       Nếu URL có:

       trangcanhan.html?id=xxxxx

       thì xem trang cá nhân của người đó.
    */

    const params = new URLSearchParams(
        window.location.search
    );

    const userIdFromUrl = params.get("id");

    if (userIdFromUrl) {
        return userIdFromUrl;
    }


    /*
       Nếu không có id trên URL
       thì lấy tài khoản đang đăng nhập.
    */

    const {
        data: {
            user
        },
        error
    } = await supabaseClient.auth.getUser();


    if (error) {

        console.error(
            "Không lấy được tài khoản:",
            error
        );

        return null;
    }


    return user?.id || null;
}


/* =====================================================
   LOAD THÔNG TIN NGƯỜI DÙNG
===================================================== */

async function loadProfileUser(userId) {

    if (!userId) {

        document.getElementById(
            "profileName"
        ).textContent = "Không xác định";

        return null;
    }


    const {
        data: profile,
        error
    } = await supabaseClient
        .from("users")
        .select(`
            user_id,
            fullname,
            avatar_url,
            role,
            student_verified,
            faculty,
            student_id
        `)
        .eq("user_id", userId)
        .maybeSingle();


    if (error) {

        console.error(
            "Lỗi lấy thông tin người dùng:",
            error
        );

        document.getElementById(
            "profileName"
        ).textContent = "Không thể tải thông tin";

        return null;
    }


    if (!profile) {

        document.getElementById(
            "profileName"
        ).textContent = "Không tìm thấy người dùng";

        return null;
    }


    /* =========================
       TÊN
    ========================= */

    const profileName =
        document.getElementById(
            "profileName"
        );


    profileName.textContent =
        profile.fullname ||
        "Người dùng";


    /* =========================
       AVATAR
    ========================= */

    const profileAvatar =
        document.getElementById(
            "profileAvatar"
        );


    profileAvatar.src =
        profile.avatar_url ||
        "../Images/default-avatar.svg";


    /* =========================
       CHỨC DANH
    ========================= */

    const profileRole =
        document.getElementById(
            "profileRole"
        );


    let roleText =
        "Người dùng";


    if (profile.student_verified) {

        roleText =
            "Sinh viên / Người bán";

    } else if (profile.role === "admin") {

        roleText =
            "Quản trị viên";

    } else if (profile.role === "moderator") {

        roleText =
            "Kiểm duyệt viên";

    }


    profileRole.textContent =
        roleText;


    /* =========================
       XÁC THỰC SINH VIÊN
    ========================= */

    const verifiedBadge =
        document.getElementById(
            "verifiedBadge"
        );


    const studentVerifiedText =
        document.getElementById(
            "studentVerifiedText"
        );


    if (profile.student_verified === true) {

        verifiedBadge.style.display =
            "inline-flex";

        studentVerifiedText.style.display =
            "inline-flex";

    } else {

        verifiedBadge.style.display =
            "none";

        studentVerifiedText.style.display =
            "none";
    }


    return profile;
}


/* =====================================================
   LOAD TIN ĐĂNG BÁN
===================================================== */

async function loadProfileProducts(userId) {

    const productsGrid =
        document.getElementById(
            "productsGrid"
        );


    const productsCount =
        document.getElementById(
            "productsCount"
        );


    if (!productsGrid) {
        return;
    }


    productsGrid.innerHTML = `
        <div class="profile-loading">
            Đang tải tin đăng...
        </div>
    `;


    /*
       seller_id chính là người đăng sản phẩm.

       Vì vậy chỉ lấy những sản phẩm
       có seller_id = userId đang xem.
    */

    const {
        data: products,
        error
    } = await supabaseClient
        .from("products")
        .select(`
            id,
            title,
            price,
            image_url,
            category,
            quantity
        `)
        .eq("seller_id", userId)
        .order("id", {
            ascending: false
        });


    if (error) {

        console.error(
            "Lỗi lấy tin đăng:",
            error
        );


        productsGrid.innerHTML = `
            <div class="empty-content">

                <div class="empty-icon">
                    !
                </div>

                <h3>
                    Không thể tải tin đăng
                </h3>

                <p>
                    Vui lòng thử lại sau.
                </p>

            </div>
        `;

        productsCount.textContent =
            "Không thể tải dữ liệu";

        return;
    }


    /* Không có tin */

    if (!products || products.length === 0) {

        productsCount.textContent =
            "Chưa có tin đăng nào";


        productsGrid.innerHTML = `
            <div class="empty-content">

                <div class="empty-icon">
                    🛍
                </div>

                <h3>
                    Chưa có tin đăng bán
                </h3>

                <p>
                    Người dùng chưa đăng sản phẩm nào.
                </p>

            </div>
        `;

        return;
    }


    /* Có tin */

    productsCount.textContent =
        `Đang hiển thị ${products.length} tin đăng`;


    productsGrid.innerHTML = "";


    products.forEach(product => {

        const card =
            document.createElement("a");


        card.className =
            "profile-product-card";


        /*
           Khi bấm sản phẩm
           chuyển sang trang chi tiết.
        */

        card.href =
            `chitietsanpham.html?id=${encodeURIComponent(product.id)}`;


        const image =
            product.image_url ||
            "../Images/default-product.jpg";


        const title =
            product.title ||
            "Sản phẩm";


        const category =
            product.category ||
            "Sản phẩm";


        const price =
            formatProfilePrice(
                product.price
            );


        const quantity =
            product.quantity ??
            0;


        card.innerHTML = `

            <img
                src="${escapeProfileHTML(image)}"
                alt="${escapeProfileHTML(title)}"
                class="profile-product-image"
            >

            <div class="profile-product-info">

                <span class="profile-product-category">
                    ${escapeProfileHTML(category)}
                </span>

                <h3 class="profile-product-title">
                    ${escapeProfileHTML(title)}
                </h3>

                <div class="profile-product-bottom">

                    <span class="profile-product-price">
                        ${price}
                    </span>

                    <span class="profile-product-quantity">
                        SL: ${quantity}
                    </span>

                </div>

            </div>

        `;


        productsGrid.appendChild(card);

    });

}


/* =====================================================
   FORMAT GIÁ
===================================================== */

function formatProfilePrice(price) {

    const number =
        Number(price);


    if (!Number.isFinite(number)) {

        return "Liên hệ";
    }


    return number.toLocaleString(
        "vi-VN"
    ) + " đ";
}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeProfileHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   TAB: TIN ĐĂNG / BÀI VIẾT
===================================================== */

function setupProfileTabs() {

    const productsTab =
        document.getElementById(
            "productsTab"
        );


    const postsTab =
        document.getElementById(
            "postsTab"
        );


    const productsContent =
        document.getElementById(
            "productsContent"
        );


    const postsContent =
        document.getElementById(
            "postsContent"
        );


    if (
        !productsTab ||
        !postsTab ||
        !productsContent ||
        !postsContent
    ) {
        return;
    }


    /* Tin đăng */

    productsTab.addEventListener(
        "click",
        function () {

            productsTab.classList.add(
                "active"
            );

            postsTab.classList.remove(
                "active"
            );


            productsContent.classList.add(
                "active"
            );

            postsContent.classList.remove(
                "active"
            );

        }
    );


    /* Bài viết */

    postsTab.addEventListener(
        "click",
        function () {

            postsTab.classList.add(
                "active"
            );

            productsTab.classList.remove(
                "active"
            );


            postsContent.classList.add(
                "active"
            );

            productsContent.classList.remove(
                "active"
            );

        }
    );

}


/* =====================================================
   KHỞI TẠO TRANG CÁ NHÂN
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        try {

            /*
               Xác định người cần xem
            */

            const userId =
                await getProfileUserId();


            if (!userId) {

                document.getElementById(
                    "profileName"
                ).textContent =
                    "Chưa đăng nhập";


                document.getElementById(
                    "profileDescription"
                ).textContent =
                    "Vui lòng đăng nhập để xem trang cá nhân.";


                return;
            }


            /*
               Tải thông tin người dùng
            */

            const profile =
                await loadProfileUser(
                    userId
                );


            if (!profile) {
                return;
            }


            /*
               Tải các tin đăng của
               ĐÚNG người này
            */

            await loadProfileProducts(
                userId
            );


            /*
               Khởi tạo tab
            */

            setupProfileTabs();

        }
        catch (error) {

            console.error(
                "Lỗi khởi tạo trang cá nhân:",
                error
            );

        }

    }
);