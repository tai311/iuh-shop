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











/* =========================================================
   BIẾN TOÀN CỤC
========================================================= */

let currentProduct = null;
let currentSeller = null;


/* =========================================================
   HELPER
========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   DOM
========================================================= */

const loadingState =
    $("loadingState");

const errorState =
    $("errorState");

const errorMessage =
    $("errorMessage");

const productDetail =
    $("productDetail");

const mainProductImage =
    $("mainProductImage");

const thumbnailList =
    $("thumbnailList");

const imageCount =
    $("imageCount");

const productCategory =
    $("productCategory");

const productName =
    $("productName");

const productPrice =
    $("productPrice");

const productStatus =
    $("productStatus");

const productQuantity =
    $("productQuantity");

const detailCategory =
    $("detailCategory");

const detailQuantity =
    $("detailQuantity");

const detailStatus =
    $("detailStatus");

const productDescription =
    $("productDescription");

const sellerName =
    $("sellerName");

const sellerAvatar =
    $("sellerAvatar");

const sellerProfileLink =
    $("sellerProfileLink");

const backButton =
    $("backButton");

const buyNowBtn =
    $("buyNowBtn");

const contactSellerBtn =
    $("contactSellerBtn");

const addToCartBtn =
    $("addToCartBtn");

const toast =
    $("toast");


/* =========================================================
   HIỂN THỊ LỖI
========================================================= */

function showError(message) {

    if (loadingState) {
        loadingState.hidden = true;
    }

    if (productDetail) {
        productDetail.hidden = true;
    }

    if (errorMessage) {
        errorMessage.textContent =
            message;
    }

    if (errorState) {
        errorState.hidden = false;
    }
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

    if (!toast) {
        return;
    }

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        showToast.timer
    );

    showToast.timer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            2500
        );
}


/* =========================================================
   FORMAT GIÁ
========================================================= */

function formatPrice(value) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number)
    ) {
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
   LẤY ID SẢN PHẨM TỪ URL
========================================================= */

function getProductId() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return params.get(
        "id"
    );
}


/* =========================================================
   CHUYỂN IMAGE_URLS VỀ ARRAY
========================================================= */

function normalizeImages(value) {

    if (!value) {
        return [];
    }


    /* ---------------------------------------------
       Supabase trả về Array
    --------------------------------------------- */

    if (
        Array.isArray(value)
    ) {

        return value.filter(
            Boolean
        );

    }


    /* ---------------------------------------------
       Supabase trả về JSON string
    --------------------------------------------- */

    if (
        typeof value === "string"
    ) {

        const trimmed =
            value.trim();

        if (!trimmed) {
            return [];
        }


        try {

            const parsed =
                JSON.parse(trimmed);

            if (
                Array.isArray(parsed)
            ) {

                return parsed.filter(
                    Boolean
                );

            }

        }
        catch (error) {

            /*
                Nếu chỉ là 1 URL
            */

            return [
                trimmed
            ];

        }

    }

    return [];
}


/* =========================================================
   LẤY SẢN PHẨM TỪ SUPABASE
========================================================= */

async function loadProduct() {

    /*
        URL dạng:

        chitietsanpham.html?id=xxxxx
    */

    const productId =
        getProductId();


    console.log(
        "IUH SHOP - Product ID:",
        productId
    );


    /* ---------------------------------------------
       Không có ID
    --------------------------------------------- */

    if (!productId) {

        showError(
            "Không tìm thấy mã sản phẩm trong đường dẫn."
        );

        return;
    }


    try {

        /* -----------------------------------------
           LẤY SẢN PHẨM
        ----------------------------------------- */

        const {
            data: product,
            error
        } =
            await supabaseClient
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
            "IUH SHOP - Product data:",
            product
        );

        console.log(
            "IUH SHOP - Product error:",
            error
        );


        /* -----------------------------------------
           SUPABASE ERROR
        ----------------------------------------- */

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


        /* -----------------------------------------
           KHÔNG TÌM THẤY SẢN PHẨM
        ----------------------------------------- */

        if (!product) {

            showError(
                "Sản phẩm không tồn tại hoặc đã bị xóa."
            );

            return;
        }


        /* -----------------------------------------
           LƯU SẢN PHẨM
        ----------------------------------------- */

        currentProduct =
            product;


        /* -----------------------------------------
           HIỂN THỊ DỮ LIỆU SẢN PHẨM
        ----------------------------------------- */

        renderProduct(
            product
        );


        /* =================================================
           QUAN TRỌNG

           HIỆN SẢN PHẨM NGAY SAU KHI LẤY ĐƯỢC
           DỮ LIỆU TỪ BẢNG PRODUCTS.

           KHÔNG CHỜ LOAD SELLER.
        ================================================= */

        if (loadingState) {
            loadingState.hidden = true;
        }

        if (productDetail) {
            productDetail.hidden = false;
        }


        /* -----------------------------------------
           TẢI NGƯỜI BÁN SAU

           Không dùng await.
           Nếu users chậm hoặc lỗi thì sản phẩm
           vẫn hiển thị bình thường.
        ----------------------------------------- */

        loadSeller(
            product.seller_id
        ).catch(
            error => {

                console.error(
                    "Lỗi tải người bán:",
                    error
                );

            }
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
   HIỂN THỊ DỮ LIỆU SẢN PHẨM
========================================================= */

function renderProduct(
    product
) {

    /* ---------------------------------------------
       TITLE
    --------------------------------------------- */

    document.title =
        `${product.name || "Sản phẩm"} - IUH SHOP`;


    /* ---------------------------------------------
       DANH MỤC
    --------------------------------------------- */

    if (productCategory) {

        productCategory.textContent =
            product.category ||
            "Khác";

    }


    /* ---------------------------------------------
       TÊN
    --------------------------------------------- */

    if (productName) {

        productName.textContent =
            product.name ||
            "Sản phẩm";

    }


    /* ---------------------------------------------
       GIÁ
    --------------------------------------------- */

    if (productPrice) {

        productPrice.textContent =
            formatPrice(
                product.price
            );

    }


    /* ---------------------------------------------
       SỐ LƯỢNG
    --------------------------------------------- */

    const quantity =
        Number(
            product.quantity
        ) || 0;


    if (productQuantity) {

        productQuantity.textContent =
            quantity;

    }


    if (detailQuantity) {

        detailQuantity.textContent =
            quantity;

    }


    /* ---------------------------------------------
       TRẠNG THÁI
    --------------------------------------------- */

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


    /* ---------------------------------------------
       DANH MỤC CHI TIẾT
    --------------------------------------------- */

    if (detailCategory) {

        detailCategory.textContent =
            product.category ||
            "Khác";

    }


    /* ---------------------------------------------
       MÔ TẢ
    --------------------------------------------- */

    if (productDescription) {

        productDescription.textContent =
            product.description ||
            "Người bán chưa thêm mô tả.";

    }


    /* ---------------------------------------------
       HÌNH ẢNH
    --------------------------------------------- */

    renderProductImages(
        product
    );
}


/* =========================================================
   HIỂN THỊ HÌNH ẢNH SẢN PHẨM
========================================================= */

function renderProductImages(
    product
) {

    const images =
        normalizeImages(
            product.image_urls
        );


    /* ---------------------------------------------
       KHÔNG CÓ ẢNH
    --------------------------------------------- */

    if (
        images.length === 0
    ) {

        if (mainProductImage) {

            mainProductImage.src =
                "../Images/default-product.png";

            mainProductImage.alt =
                product.name ||
                "Sản phẩm";

        }


        if (imageCount) {

            imageCount.textContent =
                "";

        }


        if (thumbnailList) {

            thumbnailList.innerHTML =
                "";

        }

        return;
    }


    /* ---------------------------------------------
       ẢNH CHÍNH
    --------------------------------------------- */

    if (mainProductImage) {

        mainProductImage.src =
            images[0];

        mainProductImage.alt =
            product.name ||
            "Sản phẩm";

    }


    /* ---------------------------------------------
       SỐ LƯỢNG ẢNH

       Không dùng kiểu:
       (2)
       (3)

       Chỉ hiển thị:
       2 ảnh
       3 ảnh
    --------------------------------------------- */

    if (imageCount) {

        imageCount.textContent =
            `${images.length} ảnh`;

    }


    /* ---------------------------------------------
       XÓA THUMBNAIL CŨ
    --------------------------------------------- */

    if (thumbnailList) {

        thumbnailList.innerHTML =
            "";

    }


    /* ---------------------------------------------
       TẠO THUMBNAIL
    --------------------------------------------- */

    images.forEach(
        (
            url,
            index
        ) => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                `thumbnail ${
                    index === 0
                        ? "active"
                        : ""
                }`;


            const img =
                document.createElement(
                    "img"
                );


            img.src =
                url;


            img.alt =
                `${product.name || "Sản phẩm"} - ảnh ${index + 1}`;


            /* -----------------------------------------
               ẢNH LỖI
            ----------------------------------------- */

            img.onerror =
                function () {

                    button.style.display =
                        "none";

                };


            button.appendChild(
                img
            );


            /* -----------------------------------------
               CLICK THUMBNAIL
            ----------------------------------------- */

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
                            item => {

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


            if (thumbnailList) {

                thumbnailList.appendChild(
                    button
                );

            }

        }
    );
}


/* =========================================================
   LẤY THÔNG TIN NGƯỜI BÁN
========================================================= */

async function loadSeller(
    sellerId
) {

    /* ---------------------------------------------
       Không có seller ID
    --------------------------------------------- */

    if (!sellerId) {

        if (sellerName) {

            sellerName.textContent =
                "Không xác định";

        }

        return;
    }


    try {

        const {
            data: seller,
            error
        } =
            await supabaseClient
                .from("users")
                .select(`
                    user_id,
                    fullname,
                    avatar_url,
                    email
                `)
                .eq(
                    "user_id",
                    sellerId
                )
                .maybeSingle();


        /* -----------------------------------------
           LỖI
        ----------------------------------------- */

        if (error) {

            console.error(
                "Lỗi lấy người bán:",
                error
            );


            if (sellerName) {

                sellerName.textContent =
                    "Người bán";

            }

            return;
        }


        /* -----------------------------------------
           LƯU SELLER
        ----------------------------------------- */

        currentSeller =
            seller;


        /* -----------------------------------------
           TÊN NGƯỜI BÁN
        ----------------------------------------- */

        if (sellerName) {

            sellerName.textContent =
                seller?.fullname ||
                seller?.email
                    ?.split("@")[0] ||
                "Người bán";

        }


        /* -----------------------------------------
           AVATAR
        ----------------------------------------- */

        if (sellerAvatar) {

            sellerAvatar.src =
                seller?.avatar_url ||
                "../Images/default-avatar.svg";

        }


        /* -----------------------------------------
           LINK PROFILE
        ----------------------------------------- */

        if (sellerProfileLink) {

            sellerProfileLink.href =
                `taikhoan.html?id=${
                    encodeURIComponent(
                        sellerId
                    )
                }`;

        }

    }
    catch (error) {

        console.error(
            "Lỗi seller:",
            error
        );


        if (sellerName) {

            sellerName.textContent =
                "Người bán";

        }
    }
}


/* =========================================================
   CHAT NGƯỜI BÁN
========================================================= */

if (contactSellerBtn) {

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
   MUA NGAY
========================================================= */

if (buyNowBtn) {

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


            if (
                quantity <= 0
            ) {

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
                `giohang.html?buyNow=${params.toString()}`;

        }
    );

}


/* =========================================================
   QUAY LẠI
========================================================= */

if (backButton) {

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
   TÌM KIẾM
========================================================= */

const searchForm =
    $("searchForm");


if (searchForm) {

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
                `sanpham.html?search=${
                    encodeURIComponent(
                        keyword
                    )
                }`;

        }
    );

}


/* =========================================================
   CẬP NHẬT HEADER KHI ĐĂNG NHẬP
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


        /* -----------------------------------------
           CHƯA ĐĂNG NHẬP
        ----------------------------------------- */

        if (!user) {

            if (loginLink) {

                loginLink.style.display =
                    "";

            }

            if (registerLink) {

                registerLink.style.display =
                    "";

            }

            if (divider) {

                divider.style.display =
                    "";

            }

            if (userAccount) {

                userAccount.style.display =
                    "none";

            }

            return;
        }


        /* -----------------------------------------
           ĐÃ ĐĂNG NHẬP
        ----------------------------------------- */

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


        /* -----------------------------------------
           ADMIN
        ----------------------------------------- */

        const adminLink =
            $("adminLink");


        if (adminLink) {

            if (
                profile?.role ===
                "admin"
            ) {

                adminLink.style.display =
                    "block";

            }
            else {

                adminLink.style.display =
                    "none";

            }

        }


        /* -----------------------------------------
           TÊN
        ----------------------------------------- */

        const fullname =
            profile?.fullname ||
            user.email
                ?.split("@")[0] ||
            "Tài khoản";


        if (headerUserName) {

            headerUserName.textContent =
                fullname;

        }


        /* -----------------------------------------
           AVATAR
        ----------------------------------------- */

        if (headerAvatar) {

            headerAvatar.src =
                profile?.avatar_url ||
                "../Images/default-avatar.svg";

        }


        /* -----------------------------------------
           ẨN ĐĂNG NHẬP / ĐĂNG KÝ
        ----------------------------------------- */

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


        /* -----------------------------------------
           HIỆN TÀI KHOẢN
        ----------------------------------------- */

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
   ĐĂNG XUẤT
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
   THEO DÕI TRẠNG THÁI ĐĂNG NHẬP
========================================================= */

supabaseClient.auth.onAuthStateChange(
    function (event, session) {

        console.log(
            "Auth event:",
            event
        );


        /*
            Không await.
            Auth không được phép chặn
            việc tải sản phẩm.
        */

        updateUserMenu();

    }
);


/* =========================================================
   DROPDOWN TÀI KHOẢN - 3 LỐI TẮT
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


    /* ---------------------------------------------
       BẤM MŨI TÊN
    --------------------------------------------- */

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


    /* ---------------------------------------------
       BẤM MENU
    --------------------------------------------- */

    accountShortcuts.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

        }
    );


    /* ---------------------------------------------
       BẤM RA NGOÀI
    --------------------------------------------- */

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
   MENU ACTIVE
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
            link => {

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
   THÊM SẢN PHẨM VÀO GIỎ HÀNG
========================================================= */

if (addToCartBtn) {

    addToCartBtn.addEventListener(
        "click",
        async function () {

            /* -----------------------------------------
               KIỂM TRA SẢN PHẨM
            ----------------------------------------- */

            if (!currentProduct) {

                showToast(
                    "Chưa tải được thông tin sản phẩm."
                );

                return;
            }


            /* -----------------------------------------
               KIỂM TRA SỐ LƯỢNG
            ----------------------------------------- */

            const productQuantity =
                Number(
                    currentProduct.quantity
                ) || 0;


            if (
                productQuantity <= 0
            ) {

                showToast(
                    "Sản phẩm đã hết hàng."
                );

                return;
            }


            /* -----------------------------------------
               LẤY USER
            ----------------------------------------- */

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


            /* -----------------------------------------
               KEY GIỎ HÀNG
            ----------------------------------------- */

            const cartKey =
                "iuhShopCart_" +
                user.id;


            let cart = [];


            /* -----------------------------------------
               ĐỌC GIỎ HÀNG
            ----------------------------------------- */

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


                if (
                    !Array.isArray(
                        cart
                    )
                ) {

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


            /* -----------------------------------------
               KIỂM TRA SẢN PHẨM ĐÃ CÓ
            ----------------------------------------- */

            const existingProduct =
                cart.find(
                    item =>
                        String(
                            item.id
                        ) ===
                        String(
                            currentProduct.id
                        )
                );


            /* -----------------------------------------
               ĐÃ CÓ TRONG GIỎ
            ----------------------------------------- */

            if (existingProduct) {

                if (
                    Number(
                        existingProduct.quantityInCart
                    ) >=
                    productQuantity
                ) {

                    showToast(
                        "Bạn đã thêm tối đa số lượng sản phẩm hiện có."
                    );

                    return;
                }


                existingProduct.quantityInCart +=
                    1;

            }


            /* -----------------------------------------
               CHƯA CÓ TRONG GIỎ
            ----------------------------------------- */

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


            /* -----------------------------------------
               LƯU GIỎ HÀNG
            ----------------------------------------- */

            try {

                localStorage.setItem(
                    cartKey,
                    JSON.stringify(
                        cart
                    )
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


            /* -----------------------------------------
               THÔNG BÁO
            ----------------------------------------- */

            showToast(
                "🛒 Đã thêm sản phẩm vào giỏ hàng."
            );


            /* -----------------------------------------
               ĐỔI TRẠNG THÁI NÚT
            ----------------------------------------- */

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
   KHỞI ĐỘNG TRANG
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        /*
            =================================================
            QUAN TRỌNG

            KHÔNG dùng:

            await updateUserMenu();
            await loadProduct();

            Vì nếu phần tài khoản bị chậm,
            sản phẩm sẽ bị kẹt ở "Đang tải...".
            =================================================
        */


        /* ---------------------------------------------
           1. TẢI HEADER / TÀI KHOẢN

           Không await.
        --------------------------------------------- */

        updateUserMenu()
            .catch(
                error => {

                    console.error(
                        "Lỗi cập nhật tài khoản:",
                        error
                    );

                }
            );


        /* ---------------------------------------------
           2. SETUP ACCOUNT
        --------------------------------------------- */

        setupAccountDropdown();

        setupAccountShortcuts();

        setupLogout();

        setupActiveMenu();


        /* ---------------------------------------------
           3. TẢI SẢN PHẨM

           Đây là phần chính.
           Chờ trực tiếp sản phẩm.
        --------------------------------------------- */

        await loadProduct();

    }
);