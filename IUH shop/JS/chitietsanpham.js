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
   DOM
========================================================= */

const loadingState =
    document.getElementById(
        "loadingState"
    );


const errorState =
    document.getElementById(
        "errorState"
    );


const errorMessage =
    document.getElementById(
        "errorMessage"
    );


const productDetail =
    document.getElementById(
        "productDetail"
    );


/* =========================================================
   PRODUCT
========================================================= */

const mainProductImage =
    document.getElementById(
        "mainProductImage"
    );


const thumbnailList =
    document.getElementById(
        "thumbnailList"
    );


const imageCount =
    document.getElementById(
        "imageCount"
    );


const productCategory =
    document.getElementById(
        "productCategory"
    );


const productName =
    document.getElementById(
        "productName"
    );


const productPrice =
    document.getElementById(
        "productPrice"
    );


const productStatus =
    document.getElementById(
        "productStatus"
    );


const productQuantity =
    document.getElementById(
        "productQuantity"
    );


const detailCategory =
    document.getElementById(
        "detailCategory"
    );


const detailQuantity =
    document.getElementById(
        "detailQuantity"
    );


const detailStatus =
    document.getElementById(
        "detailStatus"
    );


const productDescription =
    document.getElementById(
        "productDescription"
    );


/* =========================================================
   SELLER
========================================================= */

const sellerName =
    document.getElementById(
        "sellerName"
    );


const sellerAvatar =
    document.getElementById(
        "sellerAvatar"
    );


const sellerProfileLink =
    document.getElementById(
        "sellerProfileLink"
    );


/* =========================================================
   BUTTON
========================================================= */

/* =========================================================
   BUTTON
========================================================= */

const backButton =
    document.getElementById(
        "backButton"
    );


const buyNowBtn =
    document.getElementById(
        "buyNowBtn"
    );


const contactSellerBtn =
    document.getElementById(
        "contactSellerBtn"
    );


const addToCartBtn =
    document.getElementById(
        "addToCartBtn"
    );


const toast =
    document.getElementById(
        "toast"
    );
/* =========================================================
   BIẾN TOÀN CỤC
========================================================= */

let currentProduct = null;

let currentSeller = null;


/* =========================================================
   HIỂN THỊ LỖI
========================================================= */

function showError(message) {

    loadingState.hidden = true;

    productDetail.hidden = true;

    errorMessage.textContent =
        message;

    errorState.hidden = false;
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

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
   LẤY ID SẢN PHẨM TRÊN URL
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


    /* Nếu Supabase trả về Array */

    if (
        Array.isArray(value)
    ) {

        return value.filter(
            Boolean
        );

    }


    /* Nếu Supabase trả về JSON string */

    if (
        typeof value === "string"
    ) {

        try {

            const parsed =
                JSON.parse(value);


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
                Nếu chỉ có 1 URL
            */

            return value.trim()
                ? [value.trim()]
                : [];

        }

    }


    return [];

}

/* =========================================================
   LẤY SẢN PHẨM TỪ SUPABASE
========================================================= */

async function loadProduct() {

    /*
        Lấy id từ:

        chitietsanpham.html?id=xxxxx
    */

    const productId =
        getProductId();


    /* Không có ID */

    if (!productId) {

        showError(
            "Không tìm thấy mã sản phẩm trong đường dẫn."
        );

        return;

    }


    try {

        /*
            Truy vấn bảng products
        */

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


        /* SUPABASE ERROR */

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


        /* KHÔNG CÓ SẢN PHẨM */

        if (!product) {

            showError(
                "Sản phẩm không tồn tại hoặc đã bị xóa."
            );


            return;

        }


        /*
            Lưu lại sản phẩm
        */

        currentProduct =
            product;


        /*
            Đổ dữ liệu ra giao diện
        */

        await renderProduct(
            product
        );


        /*
            Lấy người bán
        */

        await loadSeller(
            product.seller_id
        );


        /*
            Ẩn loading
        */

        loadingState.hidden =
            true;


        /*
            Hiện sản phẩm
        */

        productDetail.hidden =
            false;

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

async function renderProduct(
    product
) {

    /*
        Đổi title trình duyệt
    */

    document.title =
        `${product.name} - IUH SHOP`;


    /* DANH MỤC */

    productCategory.textContent =
        product.category ||
        "Khác";


    /* TÊN */

    productName.textContent =
        product.name ||
        "Sản phẩm";


    /* GIÁ */

    productPrice.textContent =
        formatPrice(
            product.price
        );


    /* SỐ LƯỢNG */

    const quantity =
        Number(
            product.quantity
        ) || 0;


    productQuantity.textContent =
        quantity;


    detailQuantity.textContent =
        quantity;


    /* TRẠNG THÁI */

    const statusText =

        product.status === "active"
        &&
        quantity > 0

            ? "Đang bán"

            : "Tạm hết hàng";


    productStatus.textContent =
        statusText;


    detailStatus.textContent =
        statusText;


    /* DANH MỤC */

    detailCategory.textContent =
        product.category ||
        "Khác";


    /* MÔ TẢ */

    productDescription.textContent =

        product.description ||

        "Người bán chưa thêm mô tả.";


    /* =================================================
       HÌNH ẢNH
    ================================================= */

    const images =
        normalizeImages(
            product.image_urls
        );


    /*
        Không có ảnh
    */

    if (
        images.length === 0
    ) {

        mainProductImage.src =
            "../Images/default-product.png";


        mainProductImage.alt =
            product.name ||
            "Sản phẩm";


        imageCount.textContent =
            "";


        thumbnailList.innerHTML =
            "";


        return;

    }


    /*
        Ảnh chính
    */

    mainProductImage.src =
        images[0];


    mainProductImage.alt =
        product.name ||
        "Sản phẩm";


    /*
        Số lượng ảnh
    */

    imageCount.textContent =
        `${images.length} ảnh`;


    /*
        Xóa thumbnail cũ
    */

    thumbnailList.innerHTML =
        "";


    /*
        Tạo thumbnail
    */

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
                `${product.name} - ảnh ${index + 1}`;


            /*
                Nếu ảnh lỗi
            */

            img.onerror =
                () => {

                    button.style.display =
                        "none";

                };


            button.appendChild(
                img
            );


            /*
                Click ảnh nhỏ
            */

            button.addEventListener(
                "click",
                () => {

                    /*
                        Đổi ảnh chính
                    */

                    mainProductImage.src =
                        url;


                    /*
                        Bỏ active
                        ở tất cả ảnh
                    */

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


                    /*
                        Active ảnh
                        hiện tại
                    */

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
   LẤY NGƯỜI BÁN
========================================================= */

async function loadSeller(
    sellerId
) {

    /*
        Không có seller_id
    */

    if (!sellerId) {

        sellerName.textContent =
            "Không xác định";

        return;

    }


    try {

        /*
            Lấy profile
            từ bảng users
        */

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


        if (error) {

            console.error(
                "Lỗi lấy người bán:",
                error
            );


            sellerName.textContent =
                "Người bán";


            return;

        }


        /*
            Lưu seller
        */

        currentSeller =
            seller;


        /*
            Tên
        */

        sellerName.textContent =

            seller?.fullname ||

            seller?.email
                ?.split("@")[0] ||

            "Người bán";


        /*
            Avatar
        */

        sellerAvatar.src =

            seller?.avatar_url ||

            "../Images/default-avatar.svg";


        /*
            Link profile
        */

        sellerProfileLink.href =

            `taikhoan.html?id=${
                encodeURIComponent(
                    sellerId
                )
            }`;

    }
    catch (error) {

        console.error(
            "Lỗi seller:",
            error
        );


        sellerName.textContent =
            "Người bán";

    }

}



/* =========================================================
   CHAT NGƯỜI BÁN
========================================================= */

contactSellerBtn.addEventListener(
    "click",
    () => {

        if (
            !currentProduct ||
            !currentSeller
        ) {
            showToast(
                "Chưa tải được thông tin sản phẩm."
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


/* =========================================================
   MUA NGAY
========================================================= */

buyNowBtn.addEventListener(
    "click",
    () => {

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
            `giohang.html?buyNow=${params.toString()}`;

    }
);


/* =========================================================
   QUAY LẠI
========================================================= */

backButton.addEventListener(
    "click",
    () => {

        /*
            Nếu có trang trước
            là trang sản phẩm
            thì quay lại.
        */

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


/* =========================================================
   TÌM KIẾM
========================================================= */

document
    .getElementById(
        "searchForm"
    )
    .addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const keyword =

                document
                    .getElementById(
                        "searchInput"
                    )
                    .value
                    .trim();


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


/* =========================================================
   KHỞI ĐỘNG
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        /*
            Load tài khoản
        */

        await updateUserMenu();


        /*
            Load sản phẩm
        */

        await loadProduct();

    }
);

/* =========================================================
   THÊM SẢN PHẨM VÀO GIỎ HÀNG
========================================================= */

const addToCartBtn =
    document.getElementById("addToCartBtn");


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


            if (productQuantity <= 0) {

                showToast(
                    "Sản phẩm đã hết hàng."
                );

                return;
            }


            /* -----------------------------------------
               LẤY USER ĐANG ĐĂNG NHẬP
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
               LẤY GIỎ HÀNG HIỆN TẠI
            ----------------------------------------- */

            const cartKey =
                "iuhShopCart_" + user.id;


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


            /* -----------------------------------------
               KIỂM TRA SẢN PHẨM ĐÃ CÓ TRONG GIỎ CHƯA
            ----------------------------------------- */

            const existingProduct =
                cart.find(
                    item =>
                        String(item.id) ===
                        String(currentProduct.id)
                );


            if (existingProduct) {

                /* Không cho vượt quá số lượng người bán */

                if (
                    existingProduct.quantityInCart
                    >=
                    productQuantity
                ) {

                    showToast(
                        "Bạn đã thêm tối đa số lượng sản phẩm hiện có."
                    );

                    return;

                }


                existingProduct.quantityInCart += 1;

            }
            else {

                /* -----------------------------------------
                   THÊM SẢN PHẨM MỚI
                ----------------------------------------- */

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


            /* -----------------------------------------
               LƯU GIỎ HÀNG
            ----------------------------------------- */

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


            /* -----------------------------------------
               THÔNG BÁO
            ----------------------------------------- */

            showToast(
                "🛒 Đã thêm sản phẩm vào giỏ hàng."
            );


            /* Đổi trạng thái nút trong 1.5 giây */

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