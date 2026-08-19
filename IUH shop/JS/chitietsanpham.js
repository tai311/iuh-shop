/* =========================================================
   IUH SHOP - CHI TIẾT SẢN PHẨM
   ========================================================= */


/* =========================================================
   1. SUPABASE
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
   2. BIẾN TOÀN CỤC
   ========================================================= */

let currentProduct = null;
let currentSeller = null;


/* =========================================================
   3. HELPER
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   4. DOM
   ========================================================= */

const loadingState = $("loadingState");
const errorState = $("errorState");
const errorMessage = $("errorMessage");
const productDetail = $("productDetail");

const mainProductImage = $("mainProductImage");
const thumbnailList = $("thumbnailList");
const imageCount = $("imageCount");

const productCategory = $("productCategory");
const productName = $("productName");
const productPrice = $("productPrice");
const productStatus = $("productStatus");
const productQuantity = $("productQuantity");

const detailCategory = $("detailCategory");
const detailQuantity = $("detailQuantity");
const detailStatus = $("detailStatus");
const productDescription = $("productDescription");

const sellerName =
    $("sellerName");

const sellerAvatar =
    $("sellerAvatar");

const sellerVerifiedBadge =
    $("sellerVerifiedBadge");

const sellerProfileLink =
    $("sellerProfileLink");

const backButton = $("backButton");

const buyNowBtn = $("buyNowBtn");
const contactSellerBtn = $("contactSellerBtn");
const addToCartBtn = $("addToCartBtn");

const toast = $("toast");


/* =========================================================
   5. HIỂN THỊ LỖI
   ========================================================= */

function showError(message) {

    if (loadingState) {
        loadingState.hidden = true;
    }

    if (productDetail) {
        productDetail.hidden = true;
    }

    if (errorMessage) {
        errorMessage.textContent = message;
    }

    if (errorState) {
        errorState.hidden = false;
    }
}


/* =========================================================
   6. TOAST
   ========================================================= */

function showToast(message) {

    if (!toast) {
        return;
    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {

        toast.classList.remove("show");

    }, 2500);
}


/* =========================================================
   7. FORMAT GIÁ
   ========================================================= */

function formatPrice(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "Liên hệ";
    }

    return new Intl.NumberFormat(
        "vi-VN",
        {
            style: "currency",
            currency: "VND",
            maximumFractionDigits: 0
        }
    ).format(number);
}


/* =========================================================
   8. LẤY ID SẢN PHẨM
   URL:
   chitietsanpham.html?id=2
   ========================================================= */

function getProductId() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return params.get("id");
}


/* =========================================================
   9. CHUYỂN IMAGE_URLS THÀNH ARRAY
   ========================================================= */

function normalizeImages(value) {

    if (!value) {
        return [];
    }

    /* Supabase trả về Array */

    if (Array.isArray(value)) {

        return value.filter(Boolean);

    }


    /* Supabase trả về JSON string */

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

        }
        catch (error) {

            /* Nếu chỉ là một URL */

            return [trimmed];

        }

    }

    return [];
}


/* =========================================================
   10. HIỂN THỊ SẢN PHẨM
   ========================================================= */

function renderProduct(product) {

    /* -----------------------------------------------------
       TITLE
       ----------------------------------------------------- */

    document.title =
        `${product.name || "Sản phẩm"} - IUH SHOP`;


    /* -----------------------------------------------------
       DANH MỤC
       ----------------------------------------------------- */

    if (productCategory) {

        productCategory.textContent =
            product.category || "Khác";

    }

    if (detailCategory) {

        detailCategory.textContent =
            product.category || "Khác";

    }


    /* -----------------------------------------------------
       TÊN
       ----------------------------------------------------- */

    if (productName) {

        productName.textContent =
            product.name || "Sản phẩm";

    }


    /* -----------------------------------------------------
       GIÁ
       ----------------------------------------------------- */

    if (productPrice) {

        productPrice.textContent =
            formatPrice(product.price);

    }


    /* -----------------------------------------------------
       SỐ LƯỢNG
       ----------------------------------------------------- */

    const quantity =
        Number(product.quantity) || 0;

    if (productQuantity) {

        productQuantity.textContent =
            quantity;

    }

    if (detailQuantity) {

        detailQuantity.textContent =
            quantity;

    }


    /* -----------------------------------------------------
       TRẠNG THÁI
       ----------------------------------------------------- */

    const statusText =
        product.status === "active" &&
        quantity > 0
            ? "Đang bán"
            : "Tạm hết hàng";


    if (productStatus) {

        productStatus.textContent =
            statusText;

    }

    if (detailStatus) {

        detailStatus.textContent =
            statusText;

    }


    /* -----------------------------------------------------
       MÔ TẢ
       ----------------------------------------------------- */

    if (productDescription) {

        productDescription.textContent =
            product.description ||
            "Người bán chưa thêm mô tả.";

    }


    /* -----------------------------------------------------
       HÌNH ẢNH
       ----------------------------------------------------- */

    renderProductImages(product);

}


/* =========================================================
   11. HIỂN THỊ HÌNH ẢNH
   ========================================================= */

function renderProductImages(product) {

    const images =
        normalizeImages(product.image_urls);


    /* -----------------------------------------------------
       KHÔNG CÓ ẢNH
       ----------------------------------------------------- */

    if (images.length === 0) {

        if (mainProductImage) {

            mainProductImage.src =
                "../Images/default-product.png";

            mainProductImage.alt =
                product.name || "Sản phẩm";

        }

        if (imageCount) {

            imageCount.textContent = "";

        }

        if (thumbnailList) {

            thumbnailList.innerHTML = "";

        }

        return;
    }


    /* -----------------------------------------------------
       ẢNH CHÍNH
       ----------------------------------------------------- */

    if (mainProductImage) {

        mainProductImage.src =
            images[0];

        mainProductImage.alt =
            product.name || "Sản phẩm";

    }


    /* -----------------------------------------------------
       SỐ LƯỢNG ẢNH

       Hiển thị:
       1 ảnh
       2 ảnh
       3 ảnh

       KHÔNG hiển thị:
       (2)
       (3)
       ----------------------------------------------------- */

    if (imageCount) {

        imageCount.textContent =
            `${images.length} ảnh`;

    }


    /* -----------------------------------------------------
       XÓA THUMBNAIL CŨ
       ----------------------------------------------------- */

    if (!thumbnailList) {
        return;
    }

    thumbnailList.innerHTML = "";


    /* -----------------------------------------------------
       TẠO THUMBNAIL
       ----------------------------------------------------- */

    images.forEach((url, index) => {

        const button =
            document.createElement("button");

        button.type = "button";

        button.className =
            `thumbnail ${
                index === 0
                    ? "active"
                    : ""
            }`;


        const img =
            document.createElement("img");

        img.src = url;

        img.alt =
            `${product.name || "Sản phẩm"} - ảnh ${index + 1}`;


        /* Ảnh lỗi */

        img.onerror = function () {

            button.style.display = "none";

        };


        button.appendChild(img);


        /* -------------------------------------------------
           CLICK THUMBNAIL
           ------------------------------------------------- */

        button.addEventListener(
            "click",
            function () {

                if (mainProductImage) {

                    mainProductImage.src =
                        url;

                }


                document
                    .querySelectorAll(".thumbnail")
                    .forEach(item => {

                        item.classList.remove(
                            "active"
                        );

                    });


                button.classList.add(
                    "active"
                );

            }
        );


        thumbnailList.appendChild(button);

    });

}


/* =========================================================
   12. LẤY THÔNG TIN NGƯỜI BÁN
   ========================================================= */

async function loadSeller(sellerId) {

    if (!sellerId) {

        if (sellerName) {
            sellerName.textContent = "Không xác định";
        }

        return;
    }

    try {

        const {
            data: seller,
            error
        } = await supabaseClient
            .from("users")
            .select(`
                user_id,
                fullname,
                avatar_url,
                email,
                role,
                student_verified
            `)
            .eq(
                "user_id",
                sellerId
            )
            .maybeSingle();


        if (error) {

            console.error(
                "Lỗi lấy thông tin người đăng:",
                error
            );

            if (sellerName) {
                sellerName.textContent =
                    "Không xác định";
            }

            return;
        }


        if (!seller) {

            if (sellerName) {
                sellerName.textContent =
                    "Không xác định";
            }

            return;
        }


        /* =========================================
           LƯU NGƯỜI ĐĂNG
        ========================================= */

        currentSeller =
            seller;


        /* =========================================
           TÊN NGƯỜI ĐĂNG
        ========================================= */

        const fullname =
            seller.fullname ||
            seller.email?.split("@")[0] ||
            "Không xác định";


        if (sellerName) {

            sellerName.textContent =
                fullname;

        }


        /* =========================================
           AVATAR
        ========================================= */

        if (sellerAvatar) {

            sellerAvatar.src =
                seller.avatar_url ||
                "../Images/default-avatar.svg";

        }


        /* =========================================
           TÍCH XÁC THỰC
        ========================================= */

        const verified =
            seller.student_verified === true;


        if (sellerVerifiedBadge) {

            sellerVerifiedBadge.hidden =
                !verified;

        }


        /* =========================================
           TRANG CÁ NHÂN
        ========================================= */

        if (sellerProfileLink) {

            sellerProfileLink.href =
                `taikhoan.html?id=${encodeURIComponent(
                    sellerId
                )}`;

        }

    }
    catch (error) {

        console.error(
            "Lỗi tải người đăng:",
            error
        );

        if (sellerName) {

            sellerName.textContent =
                "Không xác định";

        }

    }

}


/* =========================================================
   13. TẢI SẢN PHẨM
   ========================================================= */

async function loadProduct() {

    const productId =
        getProductId();


    console.log(
        "IUH SHOP - Product ID:",
        productId
    );


    /* -----------------------------------------------------
       KHÔNG CÓ ID
       ----------------------------------------------------- */

    if (!productId) {

        showError(
            "Không tìm thấy mã sản phẩm trong đường dẫn."
        );

        return;

    }


    try {

        /* -------------------------------------------------
           LẤY SẢN PHẨM
           ------------------------------------------------- */

        const {
            data: product,
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
                status
            `)
            .eq("id", productId)
            .maybeSingle();


        console.log(
            "IUH SHOP - Product:",
            product
        );


        if (error) {

            console.error(
                "Lỗi lấy sản phẩm:",
                error
            );

            showError(
                "Không thể tải dữ liệu sản phẩm từ hệ thống."
            );

            return;

        }


        /* -------------------------------------------------
           KHÔNG TÌM THẤY
           ------------------------------------------------- */

        if (!product) {

            showError(
                "Sản phẩm không tồn tại hoặc đã bị xóa."
            );

            return;

        }


        /* -------------------------------------------------
           LƯU SẢN PHẨM
           ------------------------------------------------- */

        currentProduct =
            product;


        /* -------------------------------------------------
           RENDER SẢN PHẨM NGAY
           Không chờ users
           ------------------------------------------------- */

        renderProduct(product);


        /* -------------------------------------------------
           HIỆN SẢN PHẨM NGAY
           ------------------------------------------------- */

        if (loadingState) {

            loadingState.hidden = true;

        }

        if (errorState) {

            errorState.hidden = true;

        }

        if (productDetail) {

            productDetail.hidden = false;

        }


        /* -------------------------------------------------
           TẢI NGƯỜI BÁN SAU
           ------------------------------------------------- */

        loadSeller(
            product.seller_id
        ).catch(error => {

            console.error(
                "Lỗi tải seller:",
                error
            );

        });

    }
    catch (error) {

        console.error(
            "Lỗi chi tiết sản phẩm:",
            error
        );

        showError(
            "Có lỗi xảy ra khi tải sản phẩm."
        );

    }

}


/* =========================================================
   14. CHAT NGƯỜI BÁN
   ========================================================= */

function setupContactSeller() {

    if (!contactSellerBtn) {
        return;
    }


    contactSellerBtn.addEventListener(
        "click",
        function () {

            if (
                !currentProduct ||
                !currentSeller
            ) {

                showToast(
                    "Chưa tải được thông tin người bán."
                );

                return;

            }


            const params =
                new URLSearchParams({

                    product:
                        currentProduct.id,

                    seller:
                        currentProduct.seller_id,

                    productName:
                        currentProduct.name

                });


            window.location.href =
                `tinnhan.html?${params.toString()}`;

        }
    );

}


/* =========================================================
   15. MUA NGAY
   ========================================================= */

function setupBuyNow() {

    if (!buyNowBtn) {
        return;
    }


    buyNowBtn.addEventListener(
        "click",
        function () {

            if (!currentProduct) {

                showToast(
                    "Chưa tải được thông tin sản phẩm."
                );

                return;

            }


            const quantity =
                Number(
                    currentProduct.quantity
                ) || 0;


            if (quantity <= 0) {

                showToast(
                    "Sản phẩm hiện đã hết hàng."
                );

                return;

            }


            /*
             * Chuyển sang giỏ hàng
             * với sản phẩm cần mua ngay.
             */

            const params =
                new URLSearchParams({

                    id:
                        currentProduct.id,

                    quantity:
                        "1"

                });


            window.location.href =
                `giohang.html?buyNow=true&${params.toString()}`;

        }
    );

}


/* =========================================================
   16. THÊM VÀO GIỎ HÀNG
   ========================================================= */

function setupAddToCart() {

    if (!addToCartBtn) {
        return;
    }


    addToCartBtn.addEventListener(
        "click",
        async function () {

            /* -------------------------------------------------
               KIỂM TRA SẢN PHẨM
               ------------------------------------------------- */

            if (!currentProduct) {

                showToast(
                    "Chưa tải được thông tin sản phẩm."
                );

                return;

            }


            /* -------------------------------------------------
               KIỂM TRA SỐ LƯỢNG
               ------------------------------------------------- */

            const productQuantity =
                Number(
                    currentProduct.quantity
                ) || 0;


            if (productQuantity <= 0) {

                showToast(
                    "Sản phẩm đã hết hàng."
                );

                return;

            }


            /* -------------------------------------------------
               LẤY USER
               ------------------------------------------------- */

            const {
                data: {
                    user
                }
            } =
                await supabaseClient
                    .auth
                    .getUser();


            if (!user) {

                showToast(
                    "Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng."
                );


                setTimeout(
                    function () {

                        window.location.href =
                            "dangnhap.html";

                    },
                    1200
                );

                return;

            }


            /* -------------------------------------------------
               KEY GIỎ HÀNG THEO USER
               ------------------------------------------------- */

            const cartKey =
                "iuhShopCart_" +
                user.id;


            let cart = [];


            /* -------------------------------------------------
               ĐỌC GIỎ HÀNG
               ------------------------------------------------- */

            try {

                const savedCart =
                    localStorage.getItem(
                        cartKey
                    );


                if (savedCart) {

                    cart =
                        JSON.parse(
                            savedCart
                        );

                }


                if (!Array.isArray(cart)) {

                    cart = [];

                }

            }
            catch (error) {

                console.error(
                    "Lỗi đọc giỏ hàng:",
                    error
                );

                cart = [];

            }


            /* -------------------------------------------------
               KIỂM TRA SẢN PHẨM ĐÃ CÓ
               ------------------------------------------------- */

            const existingProduct =
                cart.find(
                    item =>
                        String(item.id) ===
                        String(currentProduct.id)
                );


            /* -------------------------------------------------
               ĐÃ CÓ TRONG GIỎ
               ------------------------------------------------- */

            if (existingProduct) {

                const currentCartQuantity =
                    Number(
                        existingProduct.quantityInCart
                    ) || 0;


                if (
                    currentCartQuantity >=
                    productQuantity
                ) {

                    showToast(
                        "Bạn đã thêm tối đa số lượng sản phẩm hiện có."
                    );

                    return;

                }


                existingProduct.quantityInCart =
                    currentCartQuantity + 1;

            }


            /* -------------------------------------------------
               CHƯA CÓ TRONG GIỎ
               ------------------------------------------------- */

            else {

                cart.push({

                    id:
                        currentProduct.id,

                    seller_id:
                        currentProduct.seller_id,

                    name:
                        currentProduct.name,

                    category:
                        currentProduct.category,

                    price:
                        Number(
                            currentProduct.price
                        ) || 0,

                    quantity:
                        productQuantity,

                    quantityInCart:
                        1,

                    description:
                        currentProduct.description || "",

                    image_urls:
                        currentProduct.image_urls || []

                });

            }


            /* -------------------------------------------------
               LƯU GIỎ HÀNG
               ------------------------------------------------- */

            try {

                localStorage.setItem(
                    cartKey,
                    JSON.stringify(cart)
                );

            }
            catch (error) {

                console.error(
                    "Lỗi lưu giỏ hàng:",
                    error
                );

                showToast(
                    "Không thể lưu sản phẩm vào giỏ hàng."
                );

                return;

            }


            /* -------------------------------------------------
               THÔNG BÁO
               ------------------------------------------------- */

            showToast(
                "🛒 Đã thêm sản phẩm vào giỏ hàng."
            );


            /* -------------------------------------------------
               ĐỔI TRẠNG THÁI NÚT
               ------------------------------------------------- */

            const oldText =
                addToCartBtn.innerHTML;


            addToCartBtn.innerHTML =
                "✓ Đã thêm vào giỏ hàng";


            addToCartBtn.disabled =
                true;


            setTimeout(
                function () {

                    addToCartBtn.innerHTML =
                        oldText;

                    addToCartBtn.disabled =
                        false;

                },
                1500
            );

        }
    );

}


/* =========================================================
   17. QUAY LẠI
   ========================================================= */

function setupBackButton() {

    if (!backButton) {
        return;
    }


    backButton.addEventListener(
        "click",
        function () {

            if (
                document.referrer &&
                document.referrer.includes(
                    "sanpham"
                )
            ) {

                history.back();

            }
            else {

                window.location.href =
                    "sanpham.html";

            }

        }
    );

}


/* =========================================================
   18. TÌM KIẾM
   ========================================================= */

function setupSearch() {

    const searchForm =
        $("searchForm");


    if (!searchForm) {
        return;
    }


    searchForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const searchInput =
                $("searchInput");


            const keyword =
                searchInput
                    ? searchInput.value.trim()
                    : "";


            if (!keyword) {
                return;
            }


            window.location.href =
                `sanpham.html?search=${encodeURIComponent(keyword)}`;

        }
    );

}


/* =========================================================
   19. CẬP NHẬT HEADER THEO USER
   ========================================================= */

async function updateUserMenu() {

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


        if (userError) {

            console.error(
                "Không lấy được tài khoản:",
                userError
            );

            return;

        }


        const loginLink =
            document.querySelector(
                ".login-link"
            );

        const registerLink =
            document.querySelector(
                ".register-link"
            );

        const divider =
            document.querySelector(
                ".top-divider"
            );

        const userAccount =
            $("userAccount");

        const headerAvatar =
            $("headerAvatar");

        const headerUserName =
            $("headerUserName");


        /* -------------------------------------------------
           CHƯA ĐĂNG NHẬP
           ------------------------------------------------- */

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


        /* -------------------------------------------------
           LẤY PROFILE
           ------------------------------------------------- */

        const {
            data: profile,
            error
        } =
            await supabaseClient
                .from("users")
                .select(
                    "fullname, avatar_url, role"
                )
                .eq(
                    "user_id",
                    user.id
                )
                .maybeSingle();


        if (error) {

            console.error(
                "Lỗi lấy profile:",
                error
            );

        }


        /* -------------------------------------------------
           ADMIN
           ------------------------------------------------- */

        const adminLink =
            $("adminLink");


        if (adminLink) {

            if (
                profile?.role === "admin"
            ) {

                adminLink.style.display =
                    "block";

            }
            else {

                adminLink.style.display =
                    "none";

            }

        }


        /* -------------------------------------------------
           TÊN
           ------------------------------------------------- */

        const fullname =
            profile?.fullname ||
            user.email?.split("@")[0] ||
            "Tài khoản";


        if (headerUserName) {

            headerUserName.textContent =
                fullname;

        }


        /* -------------------------------------------------
           AVATAR
           ------------------------------------------------- */

        if (headerAvatar) {

            headerAvatar.src =
                profile?.avatar_url ||
                "../Images/default-avatar.svg";

        }


        /* -------------------------------------------------
           ẨN LOGIN / REGISTER
           ------------------------------------------------- */

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


        /* -------------------------------------------------
           HIỆN ACCOUNT
           ------------------------------------------------- */

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
   20. DROPDOWN TÀI KHOẢN
   ========================================================= */

function setupAccountDropdown() {

    const userAccountButton =
        $("userAccountButton");

    const accountDropdown =
        $("accountDropdown");


    if (
        !userAccountButton ||
        !accountDropdown
    ) {

        return;

    }


    userAccountButton.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            accountDropdown.classList.toggle(
                "show"
            );

        }
    );


    accountDropdown.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

        }
    );


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
   21. DROPDOWN - CÁC LỐI TẮT
   ========================================================= */

function setupAccountShortcuts() {

    const accountWrapper =
        document.querySelector(
            ".account-nav-wrapper"
        );

    const accountArrow =
        $("accountNavArrow");

    const accountShortcuts =
        $("accountShortcuts");


    if (
        !accountWrapper ||
        !accountArrow ||
        !accountShortcuts
    ) {

        return;

    }


    /* -----------------------------------------------------
       BẤM MŨI TÊN
       ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       BẤM MENU
       ----------------------------------------------------- */

    accountShortcuts.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

        }
    );


    /* -----------------------------------------------------
       BẤM RA NGOÀI
       ----------------------------------------------------- */

    document.addEventListener(
        "click",
        function () {

            accountWrapper.classList.remove(
                "open"
            );

        }
    );

}


/* =========================================================
   22. ĐĂNG XUẤT
   ========================================================= */

function setupLogout() {

    const logoutButton =
        $("logoutButton");


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
   23. MENU ACTIVE
   ========================================================= */

function setupActiveMenu() {

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

            const href =
                link.getAttribute("href");


            if (!href) {
                return;
            }


            const linkPage =
                href
                    .split("/")
                    .pop()
                    .toLowerCase();


            if (
                linkPage ===
                currentPage
            ) {

                link.classList.add(
                    "active"
                );

            }

        });

}


/* =========================================================
   24. THEO DÕI AUTH
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
    function (event, session) {

        console.log(
            "Auth event:",
            event
        );


        /*
         * Không await ở đây.
         * Auth không được phép chặn
         * việc tải sản phẩm.
         */

        updateUserMenu();

    }
);


/* =========================================================
   25. KHỞI ĐỘNG TRANG
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /* -------------------------------------------------
           HEADER
           ------------------------------------------------- */

        updateUserMenu().catch(error => {

            console.error(
                "Lỗi cập nhật tài khoản:",
                error
            );

        });


        /* -------------------------------------------------
           ACCOUNT
           ------------------------------------------------- */

        setupAccountDropdown();

        setupAccountShortcuts();

        setupLogout();


        /* -------------------------------------------------
           MENU
           ------------------------------------------------- */

        setupActiveMenu();


        /* -------------------------------------------------
           CÁC NÚT SẢN PHẨM
           ------------------------------------------------- */

        setupContactSeller();

        setupBuyNow();

        setupAddToCart();

        setupBackButton();


        /* -------------------------------------------------
           TÌM KIẾM
           ------------------------------------------------- */

        setupSearch();


        /* -------------------------------------------------
           QUAN TRỌNG:
           TẢI SẢN PHẨM ĐỘC LẬP VỚI HEADER
           ------------------------------------------------- */

        loadProduct();

    }
);