/* =========================================================
   SLIDER
========================================================= */

const slides = document.querySelectorAll(".slide");
const dots = document.querySelectorAll(".slider-dot");
const prevButton = document.querySelector(".slider-prev");
const nextButton = document.querySelector(".slider-next");

let currentSlide = 0;
let slideInterval;


/* Hiển thị slide */

function showSlide(index) {

    slides.forEach((slide, i) => {

        slide.classList.toggle(
            "active",
            i === index
        );

    });


    dots.forEach((dot, i) => {

        dot.classList.toggle(
            "active",
            i === index
        );

    });


    currentSlide = index;
}


/* Slide tiếp theo */

function nextSlide() {

    let next = currentSlide + 1;

    if (next >= slides.length) {
        next = 0;
    }

    showSlide(next);
}


/* Slide trước */

function prevSlide() {

    let prev = currentSlide - 1;

    if (prev < 0) {
        prev = slides.length - 1;
    }

    showSlide(prev);
}


/* Tự động chuyển slide */

function startSlider() {

    slideInterval =
        setInterval(nextSlide, 7000);

}


/* Reset thời gian chuyển slide */

function resetSlider() {

    clearInterval(slideInterval);

    startSlider();

}


/* Nút slide trước */

if (prevButton) {

    prevButton.addEventListener(
        "click",
        function () {

            prevSlide();

            resetSlider();

        }
    );

}


/* Nút slide sau */

if (nextButton) {

    nextButton.addEventListener(
        "click",
        function () {

            nextSlide();

            resetSlider();

        }
    );

}


/* Các chấm slide */

dots.forEach((dot, index) => {

    dot.addEventListener(
        "click",
        function () {

            showSlide(index);

            resetSlider();

        }
    );

});


/* Khởi động slider */

if (slides.length > 0) {

    showSlide(0);

    startSlider();

}



/* =========================================================
   HIỆU ỨNG ĐẾM SỐ
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const counters =
            document.querySelectorAll(".counter");

        const statsSection =
            document.querySelector(".stats-section");


        if (
            counters.length === 0 ||
            !statsSection
        ) {
            return;
        }


        let hasAnimated = false;


        const observer =
            new IntersectionObserver(
                function (entries) {

                    entries.forEach(
                        function (entry) {

                            if (
                                entry.isIntersecting &&
                                !hasAnimated
                            ) {

                                hasAnimated = true;


                                counters.forEach(
                                    function (counter) {

                                        const target =
                                            Number(
                                                counter.dataset.target
                                            );


                                        let current = 0;

                                        const duration = 1800;

                                        const startTime =
                                            performance.now();


                                        function updateCounter(
                                            currentTime
                                        ) {

                                            const elapsed =
                                                currentTime -
                                                startTime;


                                            const progress =
                                                Math.min(
                                                    elapsed /
                                                    duration,
                                                    1
                                                );


                                            const easeOut =
                                                1 -
                                                Math.pow(
                                                    1 - progress,
                                                    3
                                                );


                                            current =
                                                Math.floor(
                                                    target *
                                                    easeOut
                                                );


                                            counter.textContent =
                                                current.toLocaleString(
                                                    "vi-VN"
                                                );


                                            if (
                                                progress < 1
                                            ) {

                                                requestAnimationFrame(
                                                    updateCounter
                                                );

                                            } else {

                                                counter.textContent =
                                                    target.toLocaleString(
                                                        "vi-VN"
                                                    );

                                            }

                                        }


                                        requestAnimationFrame(
                                            updateCounter
                                        );

                                    }
                                );

                            }

                        }
                    );

                },
                {
                    threshold: 0.35
                }
            );


        observer.observe(statsSection);

    }
);



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
   IUH SHOP - SẢN PHẨM NỔI BẬT TRANG CHỦ
===================================================== */

let featuredProducts = [];

let featuredSort = "newest";


/* =====================================================
   HELPER
===================================================== */

function formatFeaturedPrice(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "Liên hệ";
    }

    return new Intl.NumberFormat(
        "vi-VN"
    ).format(number) + "đ";
}


function normalizeFeaturedImages(value) {

    if (!value) {
        return [];
    }

    // Supabase trả về array
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    // Nếu là JSON string
    if (typeof value === "string") {

        const trimmed = value.trim();

        if (!trimmed) {
            return [];
        }

        try {

            const parsed =
                JSON.parse(trimmed);

            if (Array.isArray(parsed)) {
                return parsed.filter(Boolean);
            }

        } catch (error) {

            // Nếu chỉ là 1 URL
            return [trimmed];
        }
    }

    return [];
}


/* =====================================================
   KIỂM TRA TÍCH XANH
===================================================== */

function isFeaturedSellerVerified(seller) {

    if (!seller) {
        return false;
    }

    /*
       ADMIN → mặc định có tích
       QUẢN TRỊ VIÊN → mặc định có tích
       TÀI KHOẢN THƯỜNG → có tích nếu đã xác thực
    */

    return (
        seller.role === "admin" ||
        seller.role === "moderator" ||

        seller.student_verified === true ||
        seller.student_verified === "true" ||
        seller.student_verified === 1 ||
        seller.student_verified === "1"
    );
}


/* =====================================================
   TẢI SẢN PHẨM
===================================================== */

async function loadFeaturedProducts() {

    const container =
        document.getElementById(
            "featuredProductList"
        );

    if (!container) {
        return;
    }

    try {

        container.innerHTML = `
            <div class="featured-loading">
                Đang tải sản phẩm...
            </div>
        `;


        /* -----------------------------------------
           LẤY CÁC TIN ĐANG HOẠT ĐỘNG
        ----------------------------------------- */

        const {
            data: productData,
            error: productError
        } = await supabaseClient

            .from("products")

            .select(`
                id,
                seller_id,
                name,
                category,
                price,
                image_urls,
                status,
                created_at
            `)

            .eq(
                "status",
                "active"
            )

            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (productError) {

            console.error(
                "Lỗi tải sản phẩm nổi bật:",
                productError
            );

            throw productError;
        }


        if (
            !productData ||
            productData.length === 0
        ) {

            featuredProducts = [];

            renderFeaturedProducts();

            return;
        }


        /* -----------------------------------------
           LẤY ID NGƯỜI BÁN
        ----------------------------------------- */

        const sellerIds = [
            ...new Set(
                productData
                    .map(
                        product =>
                            product.seller_id
                    )
                    .filter(Boolean)
            )
        ];


        let users = [];


        /* -----------------------------------------
           LẤY USERS
        ----------------------------------------- */

        if (sellerIds.length > 0) {

            const {
                data: userData,
                error: userError
            } = await supabaseClient

                .from("users")

                .select(`
                    user_id,
                    fullname,
                    avatar_url,
                    student_verified,
                    role
                `)

                .in(
                    "user_id",
                    sellerIds
                );


            if (userError) {

                console.error(
                    "Lỗi tải người bán:",
                    userError
                );

                throw userError;
            }


            users =
                userData || [];
        }


        /* -----------------------------------------
           GHÉP SẢN PHẨM + NGƯỜI BÁN
        ----------------------------------------- */

        featuredProducts =
            productData.map(
                product => {

                    const seller =
                        users.find(
                            user =>
                                String(
                                    user.user_id
                                ) ===
                                String(
                                    product.seller_id
                                )
                        );


                    return {

                        ...product,

                        seller:
                            seller || null
                    };
                }
            );


        renderFeaturedProducts();


    } catch (error) {

        console.error(
            "Không thể tải sản phẩm nổi bật:",
            error
        );


        container.innerHTML = `
            <div class="featured-empty">
                Không thể tải sản phẩm.
            </div>
        `;
    }
}


/* =====================================================
   CARD SẢN PHẨM
===================================================== */

function renderFeaturedCard(product) {

    const seller =
        product.seller || {};


    const images =
        normalizeFeaturedImages(
            product.image_urls
        );


    const image =
        images[0] ||
        "../Images/default-product.png";


    const sellerName =
        seller.fullname ||
        "Người bán";


    const avatar =
        seller.avatar_url ||
        "../Images/default-avatar.svg";


    const verified =
        isFeaturedSellerVerified(
            seller
        );


    const category =
        product.category ||
        "Sản phẩm";


    const badgeHTML =
        verified
            ? `
                <span
                    class="featured-seller-badge"
                    title="Tài khoản đã xác thực">
                    ✓
                </span>
            `
            : "";


    const roleText =
        seller.role === "admin"
            ? "Admin"
            : seller.role === "moderator"
                ? "Quản trị viên"
                : "Sinh viên";


    return `

        <article
            class="featured-product-card"
            data-featured-product-id="${product.id}">

            <!-- Ảnh -->
            <div class="featured-product-image">

                <img
                    src="${image}"
                    alt="${product.name || "Sản phẩm"}"
                    loading="lazy"
                    onerror="
                        this.onerror=null;
                        this.src='../Images/default-product.png';
                    "
                >

                <span class="featured-heart">
                    ♡
                </span>

            </div>


            <!-- Nội dung -->
            <div class="featured-product-content">

                <span class="featured-product-category">
                    ${category}
                </span>


                <h3 class="featured-product-name">
                    ${product.name || "Sản phẩm"}
                </h3>


                <div class="featured-product-price">
                    ${formatFeaturedPrice(product.price)}
                </div>


                <!-- Người bán -->
                <div class="featured-seller">

                    <img
                        class="featured-seller-avatar"
                        src="${avatar}"
                        alt="${sellerName}"
                        onerror="
                            this.onerror=null;
                            this.src='../Images/default-avatar.svg';
                        "
                    >


                    <div class="featured-seller-info">

                        <div class="featured-seller-name">

                            <span
                                class="featured-seller-name-text">
                                ${sellerName}
                            </span>

                            ${badgeHTML}

                        </div>


                        <div class="featured-seller-role">
                            ${roleText}
                        </div>

                    </div>

                </div>

            </div>

        </article>
    `;
}


/* =====================================================
   HIỂN THỊ
===================================================== */

function renderFeaturedProducts() {

    const container =
        document.getElementById(
            "featuredProductList"
        );


    if (!container) {
        return;
    }


    let result =
        [...featuredProducts];


    /* -----------------------------------------
       SẮP XẾP
    ----------------------------------------- */

    if (featuredSort === "newest") {

        result.sort(
            (a, b) =>
                new Date(b.created_at) -
                new Date(a.created_at)
        );

    }


    if (featuredSort === "price-low") {

        result.sort(
            (a, b) =>
                Number(a.price || 0) -
                Number(b.price || 0)
        );

    }


    if (featuredSort === "price-high") {

        result.sort(
            (a, b) =>
                Number(b.price || 0) -
                Number(a.price || 0)
        );

    }


    // Chỉ lấy 5 sản phẩm trên trang chủ
    result =
        result.slice(0, 5);


    if (result.length === 0) {

        container.innerHTML = `
            <div class="featured-empty">
                Chưa có sản phẩm đang bán.
            </div>
        `;

        return;
    }


    container.innerHTML =
        result
            .map(
                renderFeaturedCard
            )
            .join("");


    bindFeaturedProductEvents();
}


/* =====================================================
   BẤM CARD → CHI TIẾT SẢN PHẨM
===================================================== */

function bindFeaturedProductEvents() {

    document
        .querySelectorAll(
            "[data-featured-product-id]"
        )
        .forEach(card => {

            card.addEventListener(
                "click",
                function () {

                    const productId =
                        this.dataset
                            .featuredProductId;


                    if (!productId) {
                        return;
                    }


                    window.location.href =
                        `chitietsanpham.html?id=${encodeURIComponent(productId)}`;
                }
            );

        });
}


/* =====================================================
   TAB SẢN PHẨM NỔI BẬT
===================================================== */

function setupFeaturedTabs() {

    document
        .querySelectorAll(
            ".featured-tab"
        )
        .forEach(tab => {

            tab.addEventListener(
                "click",
                function () {

                    document
                        .querySelectorAll(
                            ".featured-tab"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    this.classList.add(
                        "active"
                    );


                    featuredSort =
                        this.dataset
                            .featuredSort ||
                        "newest";


                    renderFeaturedProducts();
                }
            );

        });
}


/* =====================================================
   KHỞI ĐỘNG
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        loadFeaturedProducts();

        setupFeaturedTabs();

    }
);

/* =====================================================
   SCROLL REVEAL ANIMATION
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const revealElements = [

            ".welcome-section",
            ".stats-section",
            ".popular-categories",
            ".featured-products",
            ".why-iuh-section",
            ".reviews-section",
            ".post-cta-section",
            ".site-footer"

        ];


        /* -----------------------------------------
           Lấy tất cả section cần animation
        ----------------------------------------- */

        const elements = [];

        revealElements.forEach(function (selector) {

            document
                .querySelectorAll(selector)
                .forEach(function (element) {

                    element.classList.add(
                        "scroll-reveal"
                    );

                    elements.push(element);

                });

        });


        if (elements.length === 0) {
            return;
        }


        /* -----------------------------------------
           Intersection Observer
        ----------------------------------------- */

        const revealObserver =
            new IntersectionObserver(
                function (entries, observer) {

                    entries.forEach(function (entry) {

                        if (
                            !entry.isIntersecting
                        ) {
                            return;
                        }


                        entry.target.classList.add(
                            "is-visible"
                        );


                        /*
                         * Chỉ chạy một lần.
                         * Khi đã xuất hiện thì không
                         * theo dõi nữa.
                         */

                        observer.unobserve(
                            entry.target
                        );

                    });

                },
                {
                    threshold: 0.15,

                    rootMargin:
                        "0px 0px -60px 0px"
                }
            );


        elements.forEach(function (element) {

            revealObserver.observe(
                element
            );

        });

    }
);