/* =====================================================
   IUH SHOP - TÀI KHOẢN / SUPABASE
===================================================== */

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


/* =====================================================
   TRẠNG THÁI BODY
===================================================== */

function setBodyState(state) {

    document.body.classList.remove(
        "logged-in",
        "logged-out"
    );

    document.body.classList.add(state);
}



/* =====================================================
   HEADER - CHƯA ĐĂNG NHẬP
===================================================== */

function showGuestHeader() {

    const guestAccount =
        document.getElementById("guestAccount");

    const userAccount =
        document.getElementById("userAccount");


    if (guestAccount) {

        guestAccount.style.display =
            "flex";
    }


    if (userAccount) {

        userAccount.style.display =
            "none";
    }
}



/* =====================================================
   HEADER - ĐÃ ĐĂNG NHẬP
===================================================== */

function showUserHeader(fullname, avatar) {

    const guestAccount =
        document.getElementById("guestAccount");

    const userAccount =
        document.getElementById("userAccount");

    const headerAvatar =
        document.getElementById("headerAvatar");

    const headerUserName =
        document.getElementById("headerUserName");


    if (guestAccount) {

        guestAccount.style.display =
            "none";
    }


    if (userAccount) {

        userAccount.style.display =
            "flex";
    }


    if (headerAvatar) {

        headerAvatar.src =
            avatar || DEFAULT_AVATAR;


        headerAvatar.onerror =
            function () {

                headerAvatar.src =
                    DEFAULT_AVATAR;

            };
    }


    if (headerUserName) {

        headerUserName.textContent =
            fullname || "Tài khoản";
    }
}



/* =====================================================
   TRANG TÀI KHOẢN - CHƯA ĐĂNG NHẬP
===================================================== */

function renderGuestPage() {

    const accountName =
        document.getElementById(
            "accountName"
        );

    const accountEmail =
        document.getElementById(
            "accountEmail"
        );

    const accountAvatar =
        document.getElementById(
            "accountAvatar"
        );

    const accountStatus =
        document.getElementById(
            "accountStatus"
        );

    const authSection =
        document.getElementById(
            "authSection"
        );


    if (accountName) {

        accountName.textContent =
            "Khách";
    }


    if (accountStatus) {

        accountStatus.textContent =
            "Chưa đăng nhập";
    }


    if (accountEmail) {

        accountEmail.textContent =
            "Đăng nhập để sử dụng đầy đủ các chức năng của IUH SHOP.";
    }


    if (accountAvatar) {

        accountAvatar.src =
            DEFAULT_AVATAR;


        accountAvatar.onerror =
            function () {

                accountAvatar.src =
                    DEFAULT_AVATAR;

            };
    }


    if (authSection) {

        authSection.style.display =
            "grid";
    }
}



/* =====================================================
   TRANG TÀI KHOẢN - ĐÃ ĐĂNG NHẬP
===================================================== */

function renderUserPage(
    fullname,
    email,
    avatar,
    hasVerifiedBadge,
    role
) {

    const accountName =
        document.getElementById(
            "accountName"
        );

    const accountEmail =
        document.getElementById(
            "accountEmail"
        );

    const accountAvatar =
        document.getElementById(
            "accountAvatar"
        );

    const accountStatus =
        document.getElementById(
            "accountStatus"
        );
    const studentVerifiedBadge =
    document.getElementById(
        "studentVerifiedBadge"
    );

    /* =====================================
   HIỂN THỊ TÍCH XANH
===================================== */

if (studentVerifiedBadge) {

    if (hasVerifiedBadge) {

    studentVerifiedBadge.hidden = false;

    if (role === "admin") {
        studentVerifiedBadge.title =
            "Tài khoản Admin";
    }
    else if (role === "moderator") {
        studentVerifiedBadge.title =
            "Tài khoản Quản trị viên";
    }
    else {
        studentVerifiedBadge.title =
            "Tài khoản đã xác thực sinh viên";
    }

}
else {

    studentVerifiedBadge.hidden = true;
}
}

    const authSection =
        document.getElementById(
            "authSection"
        );


    if (accountName) {

        accountName.textContent =
            fullname;
    }


    if (accountEmail) {

        accountEmail.textContent =
            email;
    }


    if (accountStatus) {

    if (role === "admin") {

        accountStatus.textContent =
            "Admin";

    }

    else if (role === "moderator") {

        accountStatus.textContent =
            "Quản trị viên";

    }

    else if (hasVerifiedBadge) {

        accountStatus.textContent =
            "Đã xác thực sinh viên";

    }

    else {

        accountStatus.textContent =
            "Chưa xác thực";

    }
}


    if (accountAvatar) {

        accountAvatar.src =
            avatar || DEFAULT_AVATAR;


        accountAvatar.onerror =
            function () {

                accountAvatar.src =
                    DEFAULT_AVATAR;

            };
    }


    if (authSection) {

        authSection.style.display =
            "none";
    }
}



/* =====================================================
   KIỂM TRA TÀI KHOẢN
===================================================== */

async function loadAccount() {

    /*
        QUAN TRỌNG:

        Ngay khi trang mở:
        mặc định là CHƯA đăng nhập.

        Như vậy sẽ không xảy ra tình trạng
        avatar "Tài khoản" tự xuất hiện.
    */

    setBodyState(
        "logged-out"
    );

    showGuestHeader();

    renderGuestPage();


    try {

        const {
            data: {
                user
            },
            error: userError
        } =
            await supabaseClient
                .auth
                .getUser();


        /* =====================================
           LỖI KIỂM TRA
        ===================================== */

        if (userError) {

            console.error(
                "Lỗi lấy tài khoản:",
                userError
            );

            return;
        }



        /* =====================================
           CHƯA ĐĂNG NHẬP
        ===================================== */

        if (!user) {

            console.log(
                "Người dùng chưa đăng nhập"
            );


            setBodyState(
                "logged-out"
            );

            showGuestHeader();

            renderGuestPage();

            return;
        }



        /* =====================================
           ĐÃ ĐĂNG NHẬP
        ===================================== */

        console.log(
            "Đã đăng nhập:",
            user.email
        );


        setBodyState(
            "logged-in"
        );



        /* =====================================
           LẤY PROFILE TỪ BẢNG users
        ===================================== */

        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("users")
                .select(
                 "fullname, email, avatar_url, student_verified, role"
                )
                .eq(
                    "user_id",
                    user.id
                )
                .maybeSingle();


        if (profileError) {

            console.error(
                "Không lấy được thông tin users:",
                profileError
            );
        }



        /* =====================================
           XÁC ĐỊNH THÔNG TIN USER
        ===================================== */

        const fullname =
            profile?.fullname ||
            user.user_metadata?.fullname ||
            user.email?.split("@")[0] ||
            "Tài khoản";


        const email =
            profile?.email ||
            user.email ||
            "";


        const avatar =
            profile?.avatar_url ||
            user.user_metadata?.avatar_url ||
            DEFAULT_AVATAR;

        /* =====================================
   TRẠNG THÁI TÍCH XANH
===================================== */

const studentVerified =
    profile?.student_verified === true;

const role =
    profile?.role || "user";


/*
   Xác định loại tài khoản
*/

const isAdmin =
    role === "admin";

const isModerator =
    role === "moderator";


/*
   Tích xanh:
   - Admin: có
   - Quản trị viên: có
   - Sinh viên đã xác thực: có
   - Sinh viên chưa xác thực: không
*/

const hasVerifiedBadge =
    isAdmin ||
    isModerator ||
    studentVerified;

        /* =====================================
           CẬP NHẬT HEADER
        ===================================== */

        showUserHeader(
            fullname,
            avatar
        );



        /* =====================================
           CẬP NHẬT TRANG TÀI KHOẢN
        ===================================== */

        renderUserPage(
    fullname,
    email,
    avatar,
    hasVerifiedBadge,
    role
);

    }

    catch (error) {

        console.error(
            "Lỗi tải tài khoản:",
            error
        );


        /*
            Nếu xảy ra lỗi thì vẫn coi như
            CHƯA đăng nhập.
        */

        setBodyState(
            "logged-out"
        );

        showGuestHeader();

        renderGuestPage();
    }
}



/* =====================================================
   DROPDOWN TÀI KHOẢN
===================================================== */

function setupAccountDropdown() {

    const userAccountButton =
        document.getElementById(
            "userAccountButton"
        );

    const accountDropdown =
        document.getElementById(
            "accountDropdown"
        );


    if (
        !userAccountButton ||
        !accountDropdown
    ) {

        return;
    }


    /*
        Đóng dropdown
    */

    function closeDropdown() {

        accountDropdown.style.display =
            "none";
    }


    /*
        Mở / đóng dropdown
    */

    function toggleDropdown(event) {

        event.stopPropagation();


        /*
            Nếu chưa đăng nhập
            thì không cho mở dropdown.
        */

        if (
            !document.body.classList.contains(
                "logged-in"
            )
        ) {

            closeDropdown();

            return;
        }


        const isOpen =
            accountDropdown.style.display ===
            "block";


        accountDropdown.style.display =
            isOpen
                ? "none"
                : "block";
    }


    /*
        Ban đầu đóng
    */

    closeDropdown();


    /*
        Bấm avatar / tên
    */

    userAccountButton.addEventListener(
        "click",
        toggleDropdown
    );


    /*
        Bấm ra ngoài
    */

    document.addEventListener(
        "click",
        closeDropdown
    );


    /*
        Bấm bên trong dropdown
        không làm dropdown đóng ngay
    */

    accountDropdown.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

        }
    );
}



/* =====================================================
   ĐĂNG XUẤT
===================================================== */

async function logout() {

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


        /*
            Đổi trạng thái giao diện
        */

        setBodyState(
            "logged-out"
        );


        /*
            Về trang chủ
        */

        window.location.href =
            "trangchu.html";

    }

    catch (error) {

        console.error(
            "Lỗi đăng xuất:",
            error
        );

        alert(
            "Đã xảy ra lỗi khi đăng xuất."
        );
    }
}



/* =====================================================
   KHỞI ĐỘNG
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        /*
            Kiểm tra đăng nhập
        */

        await loadAccount();


        /*
            Thiết lập dropdown
        */

        setupAccountDropdown();


        /*
            Nút đăng xuất
            ở trang tài khoản
        */

        const accountLogout =
            document.getElementById(
                "accountLogout"
            );


        if (accountLogout) {

            accountLogout.addEventListener(
                "click",
                logout
            );
        }


        /*
            Nút đăng xuất
            trong dropdown header
        */

        const logoutButton =
            document.getElementById(
                "logoutButton"
            );


        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                logout
            );
        }

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

async function uploadAvatar(file) {

    if (!file) return;

    const {
        data: {
            user
        },
        error: userError
    } = await supabaseClient.auth.getUser();


    if (userError || !user) {
        alert("Vui lòng đăng nhập trước.");
        return;
    }


    /* Kiểm tra dung lượng */

    if (file.size > 5 * 1024 * 1024) {

        alert(
            "Ảnh không được lớn hơn 5MB."
        );

        return;
    }


    /* Tên file */

    const fileExt =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    const filePath =
        `${user.id}/avatar.${fileExt}`;


    /* Upload */

    const {
        error: uploadError
    } =
        await supabaseClient
            .storage
            .from("avatars")
            .upload(
                filePath,
                file,
                {
                    upsert: true,
                    contentType: file.type
                }
            );


    if (uploadError) {

        console.error(
            "Lỗi upload avatar:",
            uploadError
        );

        alert(
            "Không thể tải ảnh lên."
        );

        return;
    }


    /* Lấy URL */

    const {
        data: publicUrlData
    } =
        supabaseClient
            .storage
            .from("avatars")
            .getPublicUrl(filePath);


    const avatarUrl =
        publicUrlData.publicUrl;


    /* Lưu URL vào users */

    const {
        error: updateError
    } =
        await supabaseClient
            .from("users")
            .update({
                avatar_url: avatarUrl
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
            "Upload được ảnh nhưng không lưu được thông tin."
        );

        return;
    }


    /* Đổi ảnh ngay trên trang */

    const accountAvatar =
        document.getElementById(
            "accountAvatar"
        );

    const headerAvatar =
        document.getElementById(
            "headerAvatar"
        );


    if (accountAvatar) {
        accountAvatar.src =
            avatarUrl +
            "?t=" +
            Date.now();
    }


    if (headerAvatar) {
        headerAvatar.src =
            avatarUrl +
            "?t=" +
            Date.now();
    }


    alert(
        "Đổi ảnh đại diện thành công!"
    );
}

/* =========================================
   ĐỔI ẢNH ĐẠI DIỆN
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const changeAvatarButton =
            document.getElementById(
                "changeAvatarButton"
            );

        const avatarInput =
            document.getElementById(
                "avatarInput"
            );


        /*
            Kiểm tra xem HTML có đủ
            nút và input hay không
        */

        if (
            !changeAvatarButton ||
            !avatarInput
        ) {

            console.error(
                "Không tìm thấy changeAvatarButton hoặc avatarInput"
            );

            return;
        }


        /* =================================
           BẤM NÚT ĐỔI ẢNH
        ================================= */

        changeAvatarButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopPropagation();


                /*
                    Mở cửa sổ chọn file
                */

                avatarInput.click();

            }
        );


        /* =================================
           SAU KHI CHỌN ẢNH
        ================================= */

        avatarInput.addEventListener(
            "change",
            async function () {

                const file =
                    avatarInput.files[0];


                /*
                    Không chọn gì
                */

                if (!file) {
                    return;
                }


                console.log(
                    "Đã chọn ảnh:",
                    file.name
                );


                /* =================================
                   KIỂM TRA LOẠI FILE
                ================================= */

                const allowedTypes = [
                    "image/jpeg",
                    "image/png",
                    "image/webp"
                ];


                if (
                    !allowedTypes.includes(
                        file.type
                    )
                ) {

                    alert(
                        "Vui lòng chọn ảnh JPG, PNG hoặc WEBP."
                    );

                    avatarInput.value = "";

                    return;
                }


                /* =================================
                   KIỂM TRA DUNG LƯỢNG
                ================================= */

                if (
                    file.size >
                    5 * 1024 * 1024
                ) {

                    alert(
                        "Ảnh không được lớn hơn 5MB."
                    );

                    avatarInput.value = "";

                    return;
                }


                try {

                    /* =================================
                       KIỂM TRA ĐĂNG NHẬP
                    ================================= */

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
                        !user
                    ) {

                        alert(
                            "Vui lòng đăng nhập trước khi đổi ảnh."
                        );

                        return;
                    }


                    /* =================================
                       TẠO TÊN FILE
                    ================================= */

                    const fileExtension =
                        file.name
                            .split(".")
                            .pop()
                            .toLowerCase();


                    const filePath =
                        `${user.id}/avatar.${fileExtension}`;


                    /* =================================
                       UPLOAD SUPABASE STORAGE
                    ================================= */

                    const {
                        error: uploadError
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
                            "Upload lỗi:",
                            uploadError
                        );

                        alert(
                            "Không thể tải ảnh lên. Kiểm tra lại Storage."
                        );

                        return;
                    }


                    /* =================================
                       LẤY PUBLIC URL
                    ================================= */

                    const {
                        data: publicUrlData
                    } =
                        supabaseClient
                            .storage
                            .from("avatars")
                            .getPublicUrl(
                                filePath
                            );


                    const avatarUrl =
                        publicUrlData.publicUrl;


                    /* =================================
                       LƯU URL VÀO USERS
                    ================================= */

                    const {
                        error: updateError
                    } =
                        await supabaseClient
                            .from("users")
                            .update({
                                avatar_url:
                                    avatarUrl
                            })
                            .eq(
                                "user_id",
                                user.id
                            );


                    if (updateError) {

                        console.error(
                            "Lưu avatar lỗi:",
                            updateError
                        );

                        alert(
                            "Ảnh đã upload nhưng chưa lưu được vào tài khoản."
                        );

                        return;
                    }


                    /* =================================
                       HIỂN THỊ ẢNH MỚI
                    ================================= */

                    const accountAvatar =
                        document.getElementById(
                            "accountAvatar"
                        );

                    const headerAvatar =
                        document.getElementById(
                            "headerAvatar"
                        );


                    /*
                        Thêm timestamp để trình duyệt
                        không lấy ảnh cũ từ cache.
                    */

                    const newAvatarUrl =
                        avatarUrl +
                        "?t=" +
                        Date.now();


                    if (accountAvatar) {

                        accountAvatar.src =
                            newAvatarUrl;
                    }


                    if (headerAvatar) {

                        headerAvatar.src =
                            newAvatarUrl;
                    }


                    alert(
                        "Đổi ảnh đại diện thành công!"
                    );


                    /*
                        Reset input để lần sau
                        có thể chọn lại cùng ảnh.
                    */

                    avatarInput.value = "";

                }

                catch (error) {

                    console.error(
                        "Lỗi đổi avatar:",
                        error
                    );

                    alert(
                        "Có lỗi xảy ra khi đổi ảnh."
                    );

                }

            }
        );

    }
);/* =========================================
   ĐỔI ẢNH ĐẠI DIỆN
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const changeAvatarButton =
            document.getElementById(
                "changeAvatarButton"
            );

        const avatarInput =
            document.getElementById(
                "avatarInput"
            );


        /*
            Kiểm tra xem HTML có đủ
            nút và input hay không
        */

        if (
            !changeAvatarButton ||
            !avatarInput
        ) {

            console.error(
                "Không tìm thấy changeAvatarButton hoặc avatarInput"
            );

            return;
        }


        /* =================================
           BẤM NÚT ĐỔI ẢNH
        ================================= */

        changeAvatarButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopPropagation();


                /*
                    Mở cửa sổ chọn file
                */

                avatarInput.click();

            }
        );


        /* =================================
           SAU KHI CHỌN ẢNH
        ================================= */

        avatarInput.addEventListener(
            "change",
            async function () {

                const file =
                    avatarInput.files[0];


                /*
                    Không chọn gì
                */

                if (!file) {
                    return;
                }


                console.log(
                    "Đã chọn ảnh:",
                    file.name
                );


                /* =================================
                   KIỂM TRA LOẠI FILE
                ================================= */

                const allowedTypes = [
                    "image/jpeg",
                    "image/png",
                    "image/webp"
                ];


                if (
                    !allowedTypes.includes(
                        file.type
                    )
                ) {

                    alert(
                        "Vui lòng chọn ảnh JPG, PNG hoặc WEBP."
                    );

                    avatarInput.value = "";

                    return;
                }


                /* =================================
                   KIỂM TRA DUNG LƯỢNG
                ================================= */

                if (
                    file.size >
                    5 * 1024 * 1024
                ) {

                    alert(
                        "Ảnh không được lớn hơn 5MB."
                    );

                    avatarInput.value = "";

                    return;
                }


                try {

                    /* =================================
                       KIỂM TRA ĐĂNG NHẬP
                    ================================= */

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
                        !user
                    ) {

                        alert(
                            "Vui lòng đăng nhập trước khi đổi ảnh."
                        );

                        return;
                    }


                    /* =================================
                       TẠO TÊN FILE
                    ================================= */

                    const fileExtension =
                        file.name
                            .split(".")
                            .pop()
                            .toLowerCase();


                    const filePath =
                        `${user.id}/avatar.${fileExtension}`;


                    /* =================================
                       UPLOAD SUPABASE STORAGE
                    ================================= */

                    const {
                        error: uploadError
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
                            "Upload lỗi:",
                            uploadError
                        );

                        alert(
                            "Không thể tải ảnh lên. Kiểm tra lại Storage."
                        );

                        return;
                    }


                    /* =================================
                       LẤY PUBLIC URL
                    ================================= */

                    const {
                        data: publicUrlData
                    } =
                        supabaseClient
                            .storage
                            .from("avatars")
                            .getPublicUrl(
                                filePath
                            );


                    const avatarUrl =
                        publicUrlData.publicUrl;


                    /* =================================
                       LƯU URL VÀO USERS
                    ================================= */

                    const {
                        error: updateError
                    } =
                        await supabaseClient
                            .from("users")
                            .update({
                                avatar_url:
                                    avatarUrl
                            })
                            .eq(
                                "user_id",
                                user.id
                            );


                    if (updateError) {

                        console.error(
                            "Lưu avatar lỗi:",
                            updateError
                        );

                        alert(
                            "Ảnh đã upload nhưng chưa lưu được vào tài khoản."
                        );

                        return;
                    }


                    /* =================================
                       HIỂN THỊ ẢNH MỚI
                    ================================= */

                    const accountAvatar =
                        document.getElementById(
                            "accountAvatar"
                        );

                    const headerAvatar =
                        document.getElementById(
                            "headerAvatar"
                        );


                    /*
                        Thêm timestamp để trình duyệt
                        không lấy ảnh cũ từ cache.
                    */

                    const newAvatarUrl =
                        avatarUrl +
                        "?t=" +
                        Date.now();


                    if (accountAvatar) {

                        accountAvatar.src =
                            newAvatarUrl;
                    }


                    if (headerAvatar) {

                        headerAvatar.src =
                            newAvatarUrl;
                    }


                    alert(
                        "Đổi ảnh đại diện thành công!"
                    );


                    /*
                        Reset input để lần sau
                        có thể chọn lại cùng ảnh.
                    */

                    avatarInput.value = "";

                }

                catch (error) {

                    console.error(
                        "Lỗi đổi avatar:",
                        error
                    );

                    alert(
                        "Có lỗi xảy ra khi đổi ảnh."
                    );

                }

            }
        );

    }
);

/* =========================================
   VỀ AVATAR MẶC ĐỊNH
========================================= */

const resetAvatarButton =
    document.getElementById(
        "resetAvatarButton"
    );


if (resetAvatarButton) {

    resetAvatarButton.addEventListener(
        "click",
        async function () {

            /* Kiểm tra đăng nhập */

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
                !user
            ) {

                alert(
                    "Vui lòng đăng nhập trước."
                );

                return;
            }


            /* Xác nhận */

            const confirmed =
                confirm(
                    "Bạn có muốn chuyển về ảnh đại diện mặc định không?"
                );


            if (!confirmed) {
                return;
            }


            try {

                /* =================================
                   XÓA avatar_url TRONG DATABASE
                ================================= */

                const {
                    error: updateError
                } =
                    await supabaseClient
                        .from("users")
                        .update({
                            avatar_url: null
                        })
                        .eq(
                            "user_id",
                            user.id
                        );


                if (updateError) {

                    console.error(
                        "Lỗi reset avatar:",
                        updateError
                    );

                    alert(
                        "Không thể chuyển về avatar mặc định."
                    );

                    return;
                }


                /* =================================
                   HIỂN THỊ AVATAR MẶC ĐỊNH
                ================================= */

                const accountAvatar =
                    document.getElementById(
                        "accountAvatar"
                    );

                const headerAvatar =
                    document.getElementById(
                        "headerAvatar"
                    );


                if (accountAvatar) {

                    accountAvatar.src =
                        DEFAULT_AVATAR +
                        "?t=" +
                        Date.now();
                }


                if (headerAvatar) {

                    headerAvatar.src =
                        DEFAULT_AVATAR +
                        "?t=" +
                        Date.now();
                }


                alert(
                    "Đã chuyển về avatar mặc định!"
                );

            }

            catch (error) {

                console.error(
                    "Lỗi reset avatar:",
                    error
                );

                alert(
                    "Có lỗi xảy ra."
                );

            }

        }
    );

}

/* =========================================
   XÁC THỰC SINH VIÊN - MỞ / ĐÓNG
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const toggle =
            document.getElementById(
                "verificationToggle"
            );

        const panel =
            document.getElementById(
                "verificationPanel"
            );

        const arrow =
            document.getElementById(
                "verificationArrow"
            );


        if (!toggle || !panel) {
            return;
        }


        toggle.addEventListener(
            "click",
            function () {

                panel.classList.toggle(
                    "open"
                );


                if (arrow) {

                    arrow.style.transform =
                        panel.classList.contains("open")
                            ? "rotate(90deg)"
                            : "";

                }

            }
        );

    }
);

/* =========================================
   CHỌN ẢNH THẺ SINH VIÊN
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const fileInput =
            document.getElementById(
                "studentCardFile"
            );

        const uploadButton =
            document.getElementById(
                "uploadStudentCard"
            );

        const preview =
            document.getElementById(
                "studentCardPreview"
            );

        const submitButton =
            document.getElementById(
                "submitVerification"
            );


        if (
            !fileInput ||
            !uploadButton ||
            !preview
        ) {
            return;
        }


        /* Bấm Tải ảnh lên */

        uploadButton.addEventListener(
            "click",
            function () {

                fileInput.click();

            }
        );


        /* Chọn ảnh */

        fileInput.addEventListener(
            "change",
            function () {

                const file =
                    fileInput.files[0];


                if (!file) {
                    return;
                }


                const allowedTypes = [
                    "image/jpeg",
                    "image/png",
                    "image/webp"
                ];


                if (
                    !allowedTypes.includes(
                        file.type
                    )
                ) {

                    alert(
                        "Vui lòng chọn ảnh JPG, PNG hoặc WEBP."
                    );

                    fileInput.value = "";

                    return;
                }


                if (
                    file.size >
                    5 * 1024 * 1024
                ) {

                    alert(
                        "Ảnh không được lớn hơn 5MB."
                    );

                    fileInput.value = "";

                    return;
                }


                const imageUrl =
                    URL.createObjectURL(
                        file
                    );


                preview.innerHTML = `
                    <img
                        src="${imageUrl}"
                        alt="Ảnh thẻ sinh viên"
                    >
                `;


                if (submitButton) {

                    submitButton.disabled =
                        false;

                }

            }
        );

    }
);

/* =========================================
   CAMERA XÁC THỰC SINH VIÊN
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const openCamera =
            document.getElementById(
                "openStudentCamera"
            );

        const closeCamera =
            document.getElementById(
                "closeCamera"
            );

        const cameraContainer =
            document.getElementById(
                "cameraContainer"
            );

        const video =
            document.getElementById(
                "studentCamera"
            );

        const captureButton =
            document.getElementById(
                "captureStudentCard"
            );

        const preview =
            document.getElementById(
                "studentCardPreview"
            );

        const submitButton =
            document.getElementById(
                "submitVerification"
            );


        let cameraStream = null;


        if (
            !openCamera ||
            !cameraContainer ||
            !video
        ) {
            return;
        }


        /* MỞ CAMERA */

        openCamera.addEventListener(
            "click",
            async function () {

                try {

                    cameraStream =
                        await navigator.mediaDevices
                            .getUserMedia({
                                video: {
                                    facingMode:
                                        "environment"
                                },
                                audio: false
                            });


                    video.srcObject =
                        cameraStream;


                    cameraContainer.classList.add(
                        "open"
                    );

                }

                catch (error) {

                    console.error(
                        "Không mở được camera:",
                        error
                    );

                    alert(
                        "Không thể mở camera. Hãy cấp quyền sử dụng camera cho trình duyệt."
                    );

                }

            }
        );


        /* CHỤP ẢNH */

        captureButton.addEventListener(
            "click",
            function () {

                if (!cameraStream) {
                    return;
                }


                const canvas =
                    document.createElement(
                        "canvas"
                    );


                canvas.width =
                    video.videoWidth;

                canvas.height =
                    video.videoHeight;


                const context =
                    canvas.getContext(
                        "2d"
                    );


                context.drawImage(
                    video,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );


                const imageUrl =
                    canvas.toDataURL(
                        "image/jpeg",
                        0.9
                    );


                preview.innerHTML = `
                    <img
                        src="${imageUrl}"
                        alt="Ảnh thẻ sinh viên"
                    >
                `;


                if (submitButton) {

                    submitButton.disabled =
                        false;

                }


                stopCamera();

            }
        );


        /* ĐÓNG CAMERA */

        closeCamera.addEventListener(
            "click",
            function () {

                stopCamera();

            }
        );


        function stopCamera() {

            if (cameraStream) {

                cameraStream
                    .getTracks()
                    .forEach(
                        track => track.stop()
                    );

                cameraStream = null;
            }


            video.srcObject = null;


            cameraContainer.classList.remove(
                "open"
            );

        }

    }
);

document.addEventListener("DOMContentLoaded", function () {

    const paymentButton =
        document.getElementById("confirmVerificationPayment");

    const uploadButton =
        document.getElementById("uploadStudentCard");

    const cameraButton =
        document.getElementById("openStudentCamera");

    const fileInput =
        document.getElementById("studentCardFile");

    const submitButton =
        document.getElementById("submitVerification");

    const paymentStatus =
        document.getElementById("verificationPaymentStatus");


    // BAN ĐẦU: KHÓA
    function lockVerification() {

        if (uploadButton) {
            uploadButton.disabled = true;
            uploadButton.classList.add("payment-locked");
        }

        if (cameraButton) {
            cameraButton.disabled = true;
            cameraButton.classList.add("payment-locked");
        }

        if (fileInput) {
            fileInput.disabled = true;
        }

        if (submitButton) {
            submitButton.disabled = true;
        }
    }


    // SAU KHI THANH TOÁN: MỞ
    function unlockVerification() {

        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.classList.remove("payment-locked");
        }

        if (cameraButton) {
            cameraButton.disabled = false;
            cameraButton.classList.remove("payment-locked");
        }

        if (fileInput) {
            fileInput.disabled = false;
        }

        // Chưa có ảnh thì vẫn chưa cho gửi
        if (submitButton) {
            submitButton.disabled = true;
        }
    }


    // Khóa lúc mới vào
    lockVerification();


    // BẤM "TÔI ĐÃ THANH TOÁN"
    if (paymentButton) {

        paymentButton.addEventListener("click", function () {

            unlockVerification();

            paymentButton.disabled = true;

            paymentButton.textContent =
                "✓ Đã xác nhận thanh toán";

            if (paymentStatus) {
                paymentStatus.textContent =
                    "Đã xác nhận thanh toán. Bạn có thể tải ảnh thẻ sinh viên hoặc mở camera.";

                paymentStatus.classList.add("show");
            }

        });

    }


    // Khi chọn ảnh → mới mở nút gửi
    if (fileInput) {

        fileInput.addEventListener("change", function () {

            if (
                fileInput.files &&
                fileInput.files.length > 0
            ) {

                if (submitButton) {
                    submitButton.disabled = false;
                }

            }

        });

    }

});