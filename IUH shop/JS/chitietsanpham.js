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

function getProductId() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return params.get("id");
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

const sellerName = $("sellerName");
const sellerAvatar = $("sellerAvatar");
const sellerVerifiedBadge = $("sellerVerifiedBadge");
const sellerProfileLink = $("sellerProfileLink");

const backButton = $("backButton");

const buyNowBtn = $("buyNowBtn");
const addToCartBtn = $("addToCartBtn");
const contactSellerBtn = $("contactSellerBtn");

const toast = $("toast");


/* =========================================================
   5. TOAST
   ========================================================= */

function showToast(message) {

    if (!toast) {
        return;
    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(
        function () {
            toast.classList.remove("show");
        },
        2500
    );
}


/* =========================================================
   6. HIỂN THỊ LỖI
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
   8. CHUYỂN IMAGE_URLS THÀNH ARRAY
   ========================================================= */

function normalizeImages(value) {

    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

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

            return [trimmed];

        }
    }

    return [];
}


/* =========================================================
   9. HIỂN THỊ HÌNH ẢNH SẢN PHẨM
   ========================================================= */

function renderProductImages(product) {

    const images =
        normalizeImages(
            product.image_urls
        );


    /* Không có ảnh */

    if (images.length === 0) {

        if (mainProductImage) {

            mainProductImage.src =
                "../Images/default-product.png";

            mainProductImage.alt =
                product.name ||
                "Sản phẩm";
        }

        if (imageCount) {
            imageCount.textContent = "";
        }

        if (thumbnailList) {
            thumbnailList.innerHTML = "";
        }

        return;
    }


    /* Ảnh chính */

    if (mainProductImage) {

        mainProductImage.src =
            images[0];

        mainProductImage.alt =
            product.name ||
            "Sản phẩm";
    }


    /* Số ảnh */

    if (imageCount) {

        imageCount.textContent =
            `${images.length} ảnh`;
    }


    /* Thumbnail */

    if (!thumbnailList) {
        return;
    }

    thumbnailList.innerHTML = "";


    images.forEach(
        function (url, index) {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                index === 0
                    ? "thumbnail active"
                    : "thumbnail";


            const img =
                document.createElement("img");

            img.src = url;

            img.alt =
                `${product.name || "Sản phẩm"} - ảnh ${index + 1}`;


            img.onerror =
                function () {

                    button.style.display =
                        "none";
                };


            button.appendChild(img);


            button.addEventListener(
                "click",
                function () {

                    if (mainProductImage) {

                        mainProductImage.src =
                            url;
                    }


                    document
                        .querySelectorAll(
                            ".thumbnail"
                        )
                        .forEach(
                            function (item) {

                                item.classList.remove(
                                    "active"
                                );
                            }
                        );


                    button.classList.add(
                        "active"
                    );
                }
            );


            thumbnailList.appendChild(
                button
            );
        }
    );
}


/* =========================================================
   10. HIỂN THỊ SẢN PHẨM
   ========================================================= */

function renderProduct(product) {

    document.title =
        `${product.name || "Sản phẩm"} - IUH SHOP`;


    /* Danh mục */

    if (productCategory) {

        productCategory.textContent =
            product.category ||
            "Khác";
    }

    if (detailCategory) {

        detailCategory.textContent =
            product.category ||
            "Khác";
    }


    /* Tên */

    if (productName) {

        productName.textContent =
            product.name ||
            "Sản phẩm";
    }


    /* Giá */

    if (productPrice) {

        productPrice.textContent =
            formatPrice(
                product.price
            );
    }


    /* Số lượng */

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


    /* Trạng thái */

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


    /* Mô tả */

    if (productDescription) {

        productDescription.textContent =
            product.description ||
            "Người đăng chưa thêm mô tả.";
    }


    /* Hình ảnh */

    renderProductImages(product);
}


/* =========================================================
   11. LẤY ĐÚNG NGƯỜI ĐĂNG BÀI
   =========================================================

   QUAN TRỌNG:

   products.seller_id
          ↓
   users.user_id
          ↓
   fullname
   avatar_url
   student_verified

   KHÔNG lấy user đang đăng nhập.
   ========================================================= */

async function loadSeller(sellerId) {

    if (!sellerId) {

        currentSeller = null;

        if (sellerName) {
            sellerName.textContent =
                "Không xác định";
        }

        if (sellerAvatar) {
            sellerAvatar.src =
                "../Images/default-avatar.svg";
        }

        if (sellerVerifiedBadge) {
            sellerVerifiedBadge.hidden = true;
        }

        if (sellerProfileLink) {
            sellerProfileLink.removeAttribute(
                "href"
            );
        }

        return;
    }


    try {

        console.log(
            "IUH SHOP - Seller ID:",
            sellerId
        );


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
                "Lỗi lấy người đăng:",
                error
            );

            currentSeller = null;

            if (sellerName) {
                sellerName.textContent =
                    "Không xác định";
            }

            if (sellerVerifiedBadge) {
                sellerVerifiedBadge.hidden =
                    true;
            }

            return;
        }


        if (!seller) {

            console.warn(
                "Không tìm thấy users với user_id:",
                sellerId
            );

            currentSeller = null;

            if (sellerName) {
                sellerName.textContent =
                    "Không xác định";
            }

            if (sellerVerifiedBadge) {
                sellerVerifiedBadge.hidden =
                    true;
            }

            return;
        }


        /* =============================================
           LƯU ĐÚNG NGƯỜI ĐĂNG
           ============================================= */

        currentSeller =
            seller;


        /* =============================================
           TÊN
           ============================================= */

        const fullname =
            seller.fullname?.trim() ||
            seller.email?.split("@")[0] ||
            "Không xác định";


        if (sellerName) {

            sellerName.textContent =
                fullname;
        }


        /* =============================================
           AVATAR
           ============================================= */

        if (sellerAvatar) {

            sellerAvatar.src =
                seller.avatar_url ||
                "../Images/default-avatar.svg";
        }


        /* =============================================
           TÍCH XÁC THỰC
           ============================================= */

        const verified =
            seller.student_verified === true ||
            seller.student_verified === "true" ||
            seller.student_verified === 1 ||
            seller.student_verified === "1";


        if (sellerVerifiedBadge) {

            sellerVerifiedBadge.hidden =
                !verified;
        }


        /* =============================================
           TRANG CÁ NHÂN ĐÚNG NGƯỜI ĐĂNG
           ============================================= */

        if (sellerProfileLink) {

            sellerProfileLink.href =
                `taikhoan.html?id=${encodeURIComponent(
                    seller.user_id
                )}`;
        }


        console.log(
            "IUH SHOP - Người đăng:",
            seller.fullname
        );

    }
    catch (error) {

        console.error(
            "Lỗi tải người đăng:",
            error
        );

        currentSeller = null;

        if (sellerName) {
            sellerName.textContent =
                "Không xác định";
        }

        if (sellerAvatar) {
            sellerAvatar.src =
                "../Images/default-avatar.svg";
        }

        if (sellerVerifiedBadge) {
            sellerVerifiedBadge.hidden =
                true;
        }
    }
}


/* =========================================================
   12. TẢI SẢN PHẨM
   ========================================================= */

async function loadProduct() {

    const productId =
        getProductId();


    console.log(
        "IUH SHOP - Product ID:",
        productId
    );


    if (!productId) {

        showError(
            "Không tìm thấy mã sản phẩm trong đường dẫn."
        );

        return;
    }


    try {

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
            .eq(
                "id",
                productId
            )
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


        if (!product) {

            showError(
                "Sản phẩm không tồn tại hoặc đã bị xóa."
            );

            return;
        }


        /* =============================================
           LƯU SẢN PHẨM
           ============================================= */

        currentProduct =
            product;


        /* =============================================
           RENDER SẢN PHẨM NGAY
           Không phụ thuộc users
           ============================================= */

        renderProduct(
            product
        );


        /* =============================================
           ẨN LOADING NGAY
           ============================================= */

        if (loadingState) {
            loadingState.hidden = true;
        }

        if (errorState) {
            errorState.hidden = true;
        }

        if (productDetail) {
            productDetail.hidden = false;
        }


        /* =============================================
           SAU ĐÓ MỚI TẢI NGƯỜI ĐĂNG
           ============================================= */

        await loadSeller(
            product.seller_id
        );


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
   13. CHAT NGƯỜI ĐĂNG
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
                !currentProduct.seller_id
            ) {

                showToast(
                    "Không xác định được người đăng."
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
   14. MUA NGAY
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
   15. THÊM VÀO GIỎ HÀNG
   ========================================================= */

function setupAddToCart() {

    if (!addToCartBtn) {
        return;
    }


    addToCartBtn.addEventListener(
        "click",
        async function () {

            if (!currentProduct) {

                showToast(
                    "Chưa tải được thông tin sản phẩm."
                );

                return;
            }


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


            /* =========================================
               LẤY USER ĐANG ĐĂNG NHẬP
               Chỉ dùng cho GIỎ HÀNG.
               Không dùng để xác định người đăng.
               ========================================= */

            const {
                data: {
                    user
                },
                error
            } =
                await supabaseClient
                    .auth
                    .getUser();


            if (error) {

                console.error(
                    "Lỗi lấy tài khoản:",
                    error
                );
            }


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


            /* =========================================
               GIỎ HÀNG RIÊNG THEO USER
               ========================================= */

            const cartKey =
                "iuhShopCart_" +
                user.id;


            let cart = [];


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


            /* =========================================
               KIỂM TRA SẢN PHẨM ĐÃ CÓ
               ========================================= */

            const existingProduct =
                cart.find(
                    item =>
                        String(item.id) ===
                        String(currentProduct.id)
                );


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
                        currentProduct.description ||
                        "",

                    image_urls:
                        currentProduct.image_urls ||
                        []
                });
            }


            /* =========================================
               LƯU
               ========================================= */

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


            showToast(
                "🛒 Đã thêm sản phẩm vào giỏ hàng."
            );


            /* =========================================
               HIỆU ỨNG NÚT
               ========================================= */

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
   16. QUAY LẠI
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
   17. TÌM KIẾM
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
                `sanpham.html?search=${encodeURIComponent(
                    keyword
                )}`;
        }
    );
}


/* =========================================================
   18. HEADER - TÀI KHOẢN
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


        /* Chưa đăng nhập */

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
                userAccount.style.display =
                    "none";
            }

            return;
        }


        /* =========================================
           LẤY PROFILE CỦA USER ĐANG ĐĂNG NHẬP
           Chỗ này chỉ phục vụ HEADER.
           Không liên quan seller của sản phẩm.
           ========================================= */

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


        /* Admin */

        const adminLink =
            $("adminLink");


        if (adminLink) {

            adminLink.style.display =
                profile?.role === "admin"
                    ? "block"
                    : "none";
        }


        /* Tên */

        const fullname =
            profile?.fullname ||
            user.email?.split("@")[0] ||
            "Tài khoản";


        if (headerUserName) {

            headerUserName.textContent =
                fullname;
        }


        /* Avatar */

        if (headerAvatar) {

            headerAvatar.src =
                profile?.avatar_url ||
                "../Images/default-avatar.svg";
        }


        /* Ẩn đăng nhập */

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


        /* Hiện tài khoản */

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
   19. DROPDOWN TÀI KHOẢN
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
   20. ACCOUNT SHORTCUTS
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


    accountShortcuts.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();
        }
    );


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
   21. ĐĂNG XUẤT
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
   22. MENU ACTIVE
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
        .forEach(
            function (link) {

                const href =
                    link.getAttribute(
                        "href"
                    );


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
            }
        );
}


/* =========================================================
   23. THEO DÕI AUTH
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
   24. KHỞI ĐỘNG
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /* Header */

        updateUserMenu()
            .catch(
                function (error) {

                    console.error(
                        "Lỗi cập nhật tài khoản:",
                        error
                    );
                }
            );


        /* Account */

        setupAccountDropdown();

        setupAccountShortcuts();

        setupLogout();


        /* Menu */

        setupActiveMenu();


        /* Sản phẩm */

        setupContactSeller();

        setupBuyNow();

        setupAddToCart();

        setupBackButton();


        /* Search */

        setupSearch();


        /* =========================================
           QUAN TRỌNG:
           TẢI SẢN PHẨM ĐỘC LẬP VỚI HEADER
           ========================================= */

        loadProduct();
    }
);