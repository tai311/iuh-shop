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
   BIẾN TRẠNG THÁI
===================================================== */

let currentProfileUserId = null;
let currentAuthUserId = null;
let isProfileOwner = false;

const DEFAULT_PROFILE_AVATAR =
    "../Images/default-avatar.svg";


/* =====================================================
   LẤY ID NGƯỜI CẦN XEM
===================================================== */

async function getProfileUserId() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    /*
       Nếu URL là:

       trangcanhan.html?id=xxxxxxxx

       => xem tài khoản của người đó
    */

    const userIdFromUrl =
        params.get("id");

    if (userIdFromUrl) {
        return userIdFromUrl;
    }


    /*
       Nếu không có id
       => xem chính tài khoản đang đăng nhập
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
        ).textContent =
            "Không xác định";

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
            student_id,
            bio
        `)

        .eq(
            "user_id",
            userId
        )

        .maybeSingle();


    if (error) {

        console.error(
            "Lỗi lấy thông tin người dùng:",
            error
        );

        document.getElementById(
            "profileName"
        ).textContent =
            "Không thể tải thông tin";

        return null;
    }


    if (!profile) {

        document.getElementById(
            "profileName"
        ).textContent =
            "Không tìm thấy người dùng";

        return null;
    }


    /* =================================================
       TÊN
    ================================================= */

    const profileName =
        document.getElementById(
            "profileName"
        );

    profileName.textContent =
        profile.fullname ||
        "Người dùng";


    /* =================================================
       AVATAR
    ================================================= */

    const profileAvatar =
        document.getElementById(
            "profileAvatar"
        );

    profileAvatar.src =
        profile.avatar_url ||
        DEFAULT_PROFILE_AVATAR;


    /* =================================================
       CHỨC DANH
    ================================================= */

    const profileRole =
        document.getElementById(
            "profileRole"
        );

    let roleText =
        "Người dùng";


    if (profile.student_verified) {

        roleText =
            "Sinh viên / Người bán";

    } else if (
        profile.role === "admin"
    ) {

        roleText =
            "Quản trị viên";

    } else if (
        profile.role === "moderator"
    ) {

        roleText =
            "Kiểm duyệt viên";
    }


    profileRole.textContent =
        roleText;


    /* =================================================
       XÁC THỰC SINH VIÊN
    ================================================= */

    const verifiedBadge =
        document.getElementById(
            "verifiedBadge"
        );

    const studentVerifiedText =
        document.getElementById(
            "studentVerifiedText"
        );


    const verified =
        profile.student_verified === true ||
        profile.student_verified === "true" ||
        profile.student_verified === 1 ||
        profile.student_verified === "1";


    if (verified) {

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


    /* =================================================
       GIỚI THIỆU
    ================================================= */

    const profileDescription =
        document.getElementById(
            "profileDescription"
        );


    profileDescription.textContent =
        profile.bio?.trim() ||
        "Chưa có thông tin giới thiệu.";


    return profile;
}


/* =====================================================
   KIỂM TRA CHỦ TÀI KHOẢN
===================================================== */

function setupProfileOwnerUI(profile) {

    const editIntroductionButton =
        document.getElementById(
            "editIntroductionButton"
        );

    const changeAvatarButton =
        document.getElementById(
            "changeAvatarButton"
        );


    /*
       KHÔNG PHẢI CHỦ

       => ẨN toàn bộ nút chỉnh sửa
    */

    if (!isProfileOwner) {

        if (editIntroductionButton) {

            editIntroductionButton.hidden =
                true;
        }


        if (changeAvatarButton) {

            changeAvatarButton.hidden =
                true;
        }


        return;
    }


    /*
       LÀ CHỦ

       => cho phép chỉnh sửa
    */

    if (editIntroductionButton) {

        editIntroductionButton.hidden =
            false;
    }


    if (changeAvatarButton) {

        changeAvatarButton.hidden =
            false;
    }


    setupIntroductionEditor(
        profile
    );

    setupAvatarEditor();
}


/* =====================================================
   CHỈNH SỬA GIỚI THIỆU
===================================================== */

function setupIntroductionEditor(
    profile
) {

    const editButton =
        document.getElementById(
            "editIntroductionButton"
        );

    const editor =
        document.getElementById(
            "introductionEditor"
        );

    const description =
        document.getElementById(
            "profileDescription"
        );

    const input =
        document.getElementById(
            "introductionInput"
        );

    const counter =
        document.getElementById(
            "introductionCounter"
        );

    const cancelButton =
        document.getElementById(
            "cancelIntroductionButton"
        );

    const saveButton =
        document.getElementById(
            "saveIntroductionButton"
        );


    if (
        !editButton ||
        !editor ||
        !description ||
        !input ||
        !counter ||
        !cancelButton ||
        !saveButton
    ) {

        return;
    }


    /* =================================================
       ĐẾM KÝ TỰ
    ================================================= */

    function updateCounter() {

        counter.textContent =
            `${input.value.length}/1000`;
    }


    /* =================================================
       BẤM CHỈNH SỬA
    ================================================= */

    editButton.onclick =
        function () {

            input.value =
                profile.bio || "";

            updateCounter();


            description.hidden =
                true;

            editor.hidden =
                false;

            editButton.hidden =
                true;

            input.focus();
        };


    /* =================================================
       NHẬP NỘI DUNG
    ================================================= */

    input.oninput =
        updateCounter;


    /* =================================================
       HỦY
    ================================================= */

    cancelButton.onclick =
        function () {

            input.value =
                profile.bio || "";

            description.hidden =
                false;

            editor.hidden =
                true;

            editButton.hidden =
                false;

            updateCounter();
        };


    /* =================================================
       LƯU
    ================================================= */

    saveButton.onclick =
        async function () {

            const bio =
                input.value.trim();


            saveButton.disabled =
                true;

            saveButton.textContent =
                "Đang lưu...";


            try {

                /*
                   Kiểm tra lại người đăng nhập
                   trước khi cập nhật database.
                */

                const {
                    data: {
                        user
                    },
                    error: userError
                } =
                    await supabaseClient
                        .auth
                        .getUser();


                if (
                    userError ||
                    !user ||
                    user.id !== currentProfileUserId
                ) {

                    alert(
                        "Bạn không có quyền chỉnh sửa trang cá nhân này."
                    );

                    return;
                }


                /*
                   Cập nhật bio
                */

                const {
                    error
                } =
                    await supabaseClient

                        .from("users")

                        .update({
                            bio:
                                bio || null
                        })

                        .eq(
                            "user_id",
                            user.id
                        );


                if (error) {

                    console.error(
                        "Lỗi lưu giới thiệu:",
                        error
                    );

                    alert(
                        "Không thể lưu phần giới thiệu."
                    );

                    return;
                }


                /*
                   Cập nhật giao diện
                */

                profile.bio =
                    bio;


                description.textContent =
                    bio ||
                    "Chưa có thông tin giới thiệu.";


                description.hidden =
                    false;

                editor.hidden =
                    true;

                editButton.hidden =
                    false;


                alert(
                    "Đã cập nhật giới thiệu."
                );

            } finally {

                saveButton.disabled =
                    false;

                saveButton.textContent =
                    "Lưu thay đổi";
            }
        };
}


/* =====================================================
   ĐỔI ẢNH ĐẠI DIỆN
===================================================== */

function setupAvatarEditor() {

    const changeButton =
        document.getElementById(
            "changeAvatarButton"
        );

    const input =
        document.getElementById(
            "avatarInput"
        );

    const avatar =
        document.getElementById(
            "profileAvatar"
        );


    if (
        !changeButton ||
        !input ||
        !avatar
    ) {

        return;
    }


    /* =================================================
       MỞ FILE
    ================================================= */

    changeButton.onclick =
        function () {

            input.click();
        };


    /* =================================================
       CHỌN FILE
    ================================================= */

    input.onchange =
        async function () {

            const file =
                input.files?.[0];


            input.value = "";


            if (!file) {
                return;
            }


            /* Kiểm tra ảnh */

            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                alert(
                    "Vui lòng chọn một file ảnh."
                );

                return;
            }


            /* Tối đa 5MB */

            if (
                file.size >
                5 * 1024 * 1024
            ) {

                alert(
                    "Ảnh không được lớn hơn 5MB."
                );

                return;
            }


            /*
               Kiểm tra quyền
            */

            const {
                data: {
                    user
                },
                error: userError
            } =
                await supabaseClient
                    .auth
                    .getUser();


            if (
                userError ||
                !user ||
                user.id !== currentProfileUserId
            ) {

                alert(
                    "Bạn không có quyền đổi ảnh đại diện."
                );

                return;
            }


            changeButton.disabled =
                true;

            changeButton.textContent =
                "...";


            try {

                /*
                   Lấy đuôi file
                */

                const extension =
                    file.name
                        .split(".")
                        .pop()
                        ?.toLowerCase() ||
                    "jpg";


                /*
                   Mỗi user có 1 avatar riêng
                */

                const filePath =
                    `${user.id}/avatar.${extension}`;


                /*
                   Upload Storage
                */

                const {
                    error:
                        uploadError
                } =
                    await supabaseClient

                        .storage

                        .from("avatars")

                        .upload(
                            filePath,
                            file,
                            {
                                upsert: true,
                                contentType:
                                    file.type
                            }
                        );


                if (uploadError) {

                    console.error(
                        "Lỗi upload avatar:",
                        uploadError
                    );

                    alert(
                        "Không thể tải ảnh lên. Hãy kiểm tra bucket avatars."
                    );

                    return;
                }


                /*
                   Lấy URL
                */

                const {
                    data:
                        publicUrlData
                } =
                    supabaseClient

                        .storage

                        .from("avatars")

                        .getPublicUrl(
                            filePath
                        );


                const avatarUrl =
                    `${publicUrlData.publicUrl}?t=${Date.now()}`;


                /*
                   Lưu URL vào users
                */

                const {
                    error:
                        updateError
                } =
                    await supabaseClient

                        .from("users")

                        .update({
                            avatar_url:
                                publicUrlData.publicUrl
                        })

                        .eq(
                            "user_id",
                            user.id
                        );


                if (updateError) {

                    console.error(
                        "Lỗi lưu avatar:",
                        updateError
                    );

                    alert(
                        "Ảnh đã tải lên nhưng chưa thể lưu vào tài khoản."
                    );

                    return;
                }


                /*
                   Cập nhật ảnh trên trang
                */

                avatar.src =
                    avatarUrl;


                /*
                   Cập nhật avatar trên header
                */

                const headerAvatar =
                    document.getElementById(
                        "headerAvatar"
                    );


                if (headerAvatar) {

                    headerAvatar.src =
                        avatarUrl;
                }


                alert(
                    "Đã cập nhật ảnh đại diện."
                );

            } catch (error) {

                console.error(
                    "Lỗi đổi ảnh đại diện:",
                    error
                );

                alert(
                    "Có lỗi xảy ra khi đổi ảnh đại diện."
                );

            } finally {

                changeButton.disabled =
                    false;

                changeButton.textContent =
                    "✎";
            }
        };
}


/* =====================================================
   LOAD TIN ĐĂNG BÁN CỦA NGƯỜI DÙNG
===================================================== */

async function loadProfileProducts(userId) {

    const productsGrid =
        document.getElementById("productsGrid");

    const productsCount =
        document.getElementById("productsCount");


    if (!productsGrid) {
        return;
    }


    /* Hiển thị loading */

    productsGrid.innerHTML = `
        <div class="profile-loading">
            Đang tải tin đăng...
        </div>
    `;


    try {

        console.log(
            "IUH SHOP - Đang tải tin của user:",
            userId
        );


        /* =================================================
           LẤY CÁC TIN ĐĂNG CỦA ĐÚNG NGƯỜI DÙNG

           products.seller_id
                    ↓
           userId của trang cá nhân
           ================================================= */

        const {
            data: products,
            error
        } = await supabaseClient

            .from("products")

            .select(`
                id,
                seller_id,
                name,
                category,
                quantity,
                price,
                description,
                image_urls,
                status,
                created_at
            `)

            .eq(
                "seller_id",
                userId
            )

            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        /* =================================================
           KIỂM TRA LỖI
           ================================================= */

        if (error) {

            console.error(
                "IUH SHOP - Lỗi lấy tin đăng:",
                error
            );


            if (productsCount) {

                productsCount.textContent =
                    "Không thể tải dữ liệu";

            }


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

            return;
        }


        /* =================================================
           KHÔNG CÓ TIN ĐĂNG
           ================================================= */

        if (
            !products ||
            products.length === 0
        ) {

            if (productsCount) {

                productsCount.textContent =
                    "Chưa có tin đăng nào";

            }


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


        /* =================================================
           CÓ TIN ĐĂNG
           ================================================= */

        if (productsCount) {

            productsCount.textContent =
                `Đang hiển thị ${products.length} tin đăng`;

        }


        productsGrid.innerHTML = "";


        /* =================================================
           HIỂN THỊ TỪNG TIN
           ================================================= */

        products.forEach(
            function (product) {

                const card =
                    document.createElement("a");


                card.className =
                    "profile-product-card";


                /* -----------------------------------------
                   BẤM VÀO TIN → CHI TIẾT SẢN PHẨM
                   ----------------------------------------- */

                card.href =
                    `chitietsanpham.html?id=${encodeURIComponent(
                        product.id
                    )}`;


                /* -----------------------------------------
                   HÌNH ẢNH

                   image_urls có thể là:
                   - array
                   - JSON string
                   - null
                   ----------------------------------------- */

                let images = [];


                if (
                    Array.isArray(
                        product.image_urls
                    )
                ) {

                    images =
                        product.image_urls;

                }

                else if (
                    typeof product.image_urls ===
                    "string"
                ) {

                    try {

                        const parsed =
                            JSON.parse(
                                product.image_urls
                            );


                        if (
                            Array.isArray(parsed)
                        ) {

                            images = parsed;

                        }

                        else {

                            images = [
                                product.image_urls
                            ];

                        }

                    }

                    catch (error) {

                        images = [
                            product.image_urls
                        ];

                    }

                }


                const image =
                    images[0] ||
                    "../Images/default-product.png";


                /* -----------------------------------------
                   THÔNG TIN
                   ----------------------------------------- */

                const title =
                    product.name ||
                    "Sản phẩm";


                const category =
                    product.category ||
                    "Khác";


                const price =
                    formatProfilePrice(
                        product.price
                    );


                const quantity =
                    Number(
                        product.quantity
                    ) || 0;


                /* -----------------------------------------
                   TRẠNG THÁI
                   ----------------------------------------- */

                const status =
                    product.status === "active" &&
                    quantity > 0
                        ? "Đang bán"
                        : "Tạm hết hàng";


                /* -----------------------------------------
                   HTML CARD
                   ----------------------------------------- */

                card.innerHTML = `

                    <div class="profile-product-image-wrap">

                        <img
                            src="${escapeProfileHTML(image)}"
                            alt="${escapeProfileHTML(title)}"
                            class="profile-product-image"
                            onerror="
                                this.src='../Images/default-product.png';
                            "
                        >

                    </div>


                    <div class="profile-product-info">

                        <span class="profile-product-category">

                            ${escapeProfileHTML(
                                category
                            )}

                        </span>


                        <h3 class="profile-product-title">

                            ${escapeProfileHTML(
                                title
                            )}

                        </h3>


                        <div class="profile-product-price">

                            ${price}

                        </div>


                        <div class="profile-product-meta">

                            <span>
                                ${status}
                            </span>

                            <span>
                                Còn ${quantity}
                            </span>

                        </div>

                    </div>

                `;


                productsGrid.appendChild(
                    card
                );

            }
        );


        console.log(
            "IUH SHOP - Đã tải",
            products.length,
            "tin đăng"
        );

    }

    catch (error) {

        console.error(
            "IUH SHOP - Lỗi tải tin đăng:",
            error
        );


        if (productsCount) {

            productsCount.textContent =
                "Không thể tải dữ liệu";

        }


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

    }

}


/* =====================================================
   FORMAT GIÁ
===================================================== */

function formatProfilePrice(
    price
) {

    const number =
        Number(price);


    if (
        !Number.isFinite(number)
    ) {

        return "Liên hệ";
    }


    return (
        number.toLocaleString(
            "vi-VN"
        ) +
        " đ"
    );
}


/* =====================================================
   CHỐNG HTML INJECTION
===================================================== */

function escapeProfileHTML(
    value
) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


/* =====================================================
   TAB TIN ĐĂNG / BÀI VIẾT
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


    /* =================================================
       TIN ĐĂNG
    ================================================= */

    productsTab.onclick =
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
        };


    /* =================================================
       BÀI VIẾT
    ================================================= */

    postsTab.onclick =
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
        };
}


/* =====================================================
   KHỞI TẠO TRANG
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        try {

            /*
               ==========================================
               1. LẤY NGƯỜI ĐANG ĐĂNG NHẬP
               ==========================================
            */

            const {
                data: {
                    user: authUser
                },
                error: authError
            } =
                await supabaseClient
                    .auth
                    .getUser();


            if (authError) {

                console.error(
                    "Lỗi lấy tài khoản đăng nhập:",
                    authError
                );
            }


            currentAuthUserId =
                authUser?.id ||
                null;


            /*
               ==========================================
               2. LẤY NGƯỜI CẦN HIỂN THỊ
               ==========================================
            */

            const userId =
                await getProfileUserId();


            currentProfileUserId =
                userId;


            /*
               ==========================================
               3. CHƯA CÓ USER
               ==========================================
            */

            if (!userId) {

                document.getElementById(
                    "profileName"
                ).textContent =
                    "Chưa đăng nhập";


                document.getElementById(
                    "profileDescription"
                ).textContent =
                    "Vui lòng đăng nhập để xem trang cá nhân.";


                setupProfileTabs();

                return;
            }


            /*
               ==========================================
               4. XÁC ĐỊNH CHỦ TÀI KHOẢN
               ==========================================
            */

            isProfileOwner =
                !!currentAuthUserId &&
                currentAuthUserId === userId;


            /*
               ==========================================
               5. LOAD PROFILE
               ==========================================
            */

            const profile =
                await loadProfileUser(
                    userId
                );


            if (!profile) {
                return;
            }


            /*
               ==========================================
               6. QUYỀN CHỈNH SỬA
               ==========================================
            */

            setupProfileOwnerUI(
                profile
            );


            /*
               ==========================================
               7. LOAD TIN ĐĂNG
               ==========================================
            */

            await loadProfileProducts(
                userId
            );


            /*
               ==========================================
               8. TAB
               ==========================================
            */

            setupProfileTabs();


        } catch (error) {

            console.error(
                "Lỗi khởi tạo trang cá nhân:",
                error
            );
        }

    }
);