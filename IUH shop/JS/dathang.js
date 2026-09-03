/* =========================================================
   IUH SHOP - DATHANG.JS
   CHECKOUT
   Supabase Cart + QR + Ví IUH + Tiền mặt
   ========================================================= */


/* =========================================================
   1. SUPABASE
   ========================================================= */

const SUPABASE_URL =
    "https://xecxofmogvqysejjpxvl.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_3cUVNSuvbzUReIB3oA41w_0aqdUJqC";

/*
 * Dùng 1 Supabase client chung trên toàn trang.
 * Nếu file khác đã tạo client thì dùng lại client đó.
 */
window.IUH_SUPABASE =
    window.IUH_SUPABASE ||
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

const db = window.IUH_SUPABASE;


/* =========================================================
   2. BIẾN
   ========================================================= */

let currentUser = null;

let currentSession = null;

let checkoutItems = [];

let isBuyNow = false;

let qrPaymentConfirmed = false;

let walletBalance = 0;

let isSubmitting = false;


/* =========================================================
   3. DOM
   ========================================================= */

let cartItemsContainer;
let itemCount;
let subtotalEl;
let shippingFeeEl;
let totalEl;
let checkoutButton;

let qrPaymentBox;
let walletPaymentBox;
let cashPaymentBox;

let qrCodeImage;
let confirmPaymentBtn;
let paymentVerificationStatus;

let walletBalanceEl;
let walletOrderTotalEl;
let walletRemainingEl;
let walletStatusEl;

let toast;


/* =========================================================
   4. LẤY DOM
   ========================================================= */

function initDOM() {

    cartItemsContainer =
        document.getElementById("cartItems");

    itemCount =
        document.getElementById("itemCount");

    subtotalEl =
        document.getElementById("subtotal");

    shippingFeeEl =
        document.getElementById("shippingFee");

    totalEl =
        document.getElementById("total");

    checkoutButton =
        document.getElementById("checkoutButton");

    qrPaymentBox =
        document.getElementById("qrPaymentBox");

    walletPaymentBox =
        document.getElementById("walletPaymentBox");

    cashPaymentBox =
        document.getElementById("cashPaymentBox");

    qrCodeImage =
        document.getElementById("qrCodeImage");

    confirmPaymentBtn =
        document.getElementById("confirmPaymentBtn");

    paymentVerificationStatus =
        document.getElementById(
            "paymentVerificationStatus"
        );

    walletBalanceEl =
        document.getElementById("walletBalance");

    walletOrderTotalEl =
        document.getElementById("walletOrderTotal");

    walletRemainingEl =
        document.getElementById("walletRemaining");

    walletStatusEl =
        document.getElementById("walletStatus");

    toast =
        document.getElementById("toast");
}


/* =========================================================
   5. TIỆN ÍCH
   ========================================================= */

function formatCurrency(value) {

    return new Intl.NumberFormat(
        "vi-VN",
        {
            style: "currency",
            currency: "VND",
            maximumFractionDigits: 0
        }
    ).format(
        Number(value) || 0
    );
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function showToast(message) {

    if (!toast) {

        console.log(message);

        return;
    }

    toast.textContent = message;

    toast.classList.add("show");

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
            3000
        );
}


/* =========================================================
   6. ĐĂNG NHẬP
   ========================================================= */

async function getSession() {

    try {

        /*
         * Lấy session hiện tại.
         */
        let result =
            await db.auth.getSession();


        if (result.error) {

            throw result.error;
        }


        let session =
            result.data?.session;


        /*
         * Nếu chưa có session thì thử refresh.
         */
        if (!session) {

            const refresh =
                await db.auth.refreshSession();


            if (refresh.error) {

                throw refresh.error;
            }


            session =
                refresh.data?.session;
        }


        if (!session) {

            return null;
        }


        currentSession =
            session;

        currentUser =
            session.user;


        return session;


    } catch (error) {

        console.error(
            "Lỗi lấy session:",
            error
        );

        return null;
    }
}


/* =========================================================
   7. REFRESH SESSION
   ========================================================= */

async function refreshAuth() {

    try {

        const {
            data,
            error
        } =
            await db.auth.refreshSession();


        if (error) {

            throw error;
        }


        if (
            !data?.session?.user
        ) {

            return false;
        }


        currentSession =
            data.session;

        currentUser =
            data.session.user;


        return true;


    } catch (error) {

        console.error(
            "Không thể refresh session:",
            error
        );

        return false;
    }
}


/* =========================================================
   8. CHẠY REQUEST SUPABASE
   Nếu 401 → refresh session → chạy lại 1 lần
   ========================================================= */

async function supabaseRequest(
    requestFunction
) {

    try {

        return await requestFunction();


    } catch (error) {

        /*
         * Supabase thường trả status = 401
         * khi access token hết hạn.
         */

        if (
            error?.status === 401 ||
            error?.code === "PGRST301"
        ) {

            const refreshed =
                await refreshAuth();


            if (!refreshed) {

                throw new Error(
                    "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại."
                );
            }


            return await requestFunction();
        }


        throw error;
    }
}


/* =========================================================
   9. HEADER TÀI KHOẢN
   ========================================================= */

async function updateUserMenu() {

    /*
     * QUAN TRỌNG:
     * Không gọi getUser() nữa.
     * Dùng currentUser đã lấy từ session.
     */

    if (!currentUser)
        return;


    try {

        const {
            data: profile,
            error
        } =
            await supabaseRequest(
                () =>
                    db
                        .from("users")
                        .select(
                            "fullname, avatar_url, role"
                        )
                        .eq(
                            "user_id",
                            currentUser.id
                        )
                        .maybeSingle()
            );


        if (error)
            throw error;


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

        const adminLink =
            document.getElementById(
                "adminLink"
            );


        if (loginLink)
            loginLink.style.display =
                "none";


        if (registerLink)
            registerLink.style.display =
                "none";


        if (divider)
            divider.style.display =
                "none";


        if (userAccount)
            userAccount.style.display =
                "flex";


        if (headerUserName) {

            headerUserName.textContent =
                profile?.fullname ||
                currentUser.email
                    ?.split("@")[0] ||
                "Tài khoản";
        }


        if (headerAvatar) {

            headerAvatar.src =
                profile?.avatar_url ||
                "../Images/default-avatar.svg";
        }


        if (adminLink) {

            adminLink.style.display =
                profile?.role === "admin"
                    ? "block"
                    : "none";
        }


    } catch (error) {

        /*
         * Không để lỗi header làm chết checkout.
         */
        console.error(
            "Lỗi tải thông tin tài khoản:",
            error
        );
    }
}


/* =========================================================
   10. DROPDOWN TÀI KHOẢN
   ========================================================= */

function setupAccountDropdown() {

    const button =
        document.getElementById(
            "userAccountButton"
        );

    const dropdown =
        document.getElementById(
            "accountDropdown"
        );


    if (
        !button ||
        !dropdown
    ) {

        return;
    }


    button.addEventListener(
        "click",
        function(event) {

            event.stopPropagation();

            dropdown.classList.toggle(
                "show"
            );
        }
    );


    document.addEventListener(
        "click",
        function() {

            dropdown.classList.remove(
                "show"
            );
        }
    );
}


/* =========================================================
   11. LOGOUT
   ========================================================= */

function setupLogout() {

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    if (!logoutButton)
        return;


    logoutButton.addEventListener(
        "click",
        async function() {

            try {

                const {
                    error
                } =
                    await db.auth.signOut();


                if (error)
                    throw error;


                window.location.href =
                    "dangnhap.html";


            } catch (error) {

                console.error(
                    "Lỗi đăng xuất:",
                    error
                );

                showToast(
                    "Đăng xuất thất bại."
                );
            }
        }
    );
}


/* =========================================================
   12. MENU ACTIVE
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


                if (!href)
                    return;


                const page =
                    href
                        .split("/")
                        .pop()
                        .toLowerCase();


                if (
                    page ===
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
   13. ACCOUNT ARROW
   ========================================================= */

function setupAccountArrow() {

    const wrapper =
        document.querySelector(
            ".account-nav-wrapper"
        );

    const arrow =
        document.getElementById(
            "accountNavArrow"
        );

    const shortcuts =
        document.getElementById(
            "accountShortcuts"
        );


    if (
        !wrapper ||
        !arrow ||
        !shortcuts
    ) {

        return;
    }


    arrow.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

            wrapper.classList.toggle(
                "open"
            );
        }
    );


    shortcuts.addEventListener(
        "click",
        function(event) {

            event.stopPropagation();
        }
    );


    document.addEventListener(
        "click",
        function() {

            wrapper.classList.remove(
                "open"
            );
        }
    );
}


/* =========================================================
   14. BUY NOW
   ========================================================= */

function getBuyNowParams() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return {

        buyNow:
            params.get("buyNow") === "true",

        productId:
            params.get("product") ||
            params.get("id"),

        quantity:
            Math.max(
                1,
                Number(
                    params.get("quantity")
                ) || 1
            )
    };
}

/* =========================================================
   15. LOAD BUY NOW
   ========================================================= */

async function loadBuyNow() {

    const {
        productId,
        quantity
    } =
        getBuyNowParams();


    if (!productId) {

        renderEmpty();

        return;
    }


    const {
        data: product,
        error
    } =
        await supabaseRequest(
            () =>
                db
                    .from("products")
                    .select(`
                        id,
                        seller_id,
                        name,
                        category,
                        price,
                        quantity,
                        description,
                        image_urls,
                        status
                    `)
                    .eq(
                        "id",
                        productId
                    )
                    .maybeSingle()
        );


    if (error)
        throw error;


    if (
        !product ||
        product.status !== "active" ||
        Number(product.quantity) <= 0
    ) {

        renderEmpty();

        showToast(
            "Sản phẩm không còn hàng."
        );

        return;
    }


    const stock =
        Number(
            product.quantity
        ) || 0;


    checkoutItems = [

        {

            id:
                product.id,

            cart_item_id:
                null,

            seller_id:
                product.seller_id,

            name:
                product.name,

            category:
                product.category,

            price:
                Number(
                    product.price
                ) || 0,

            stock:
                stock,

            image_urls:
                product.image_urls ||
                [],

            quantityInCart:
                Math.min(
                    quantity,
                    stock
                )
        }
    ];


    renderItems();
}


/* =========================================================
   16. LOAD CART
   ========================================================= */

async function loadCart() {

    const {
        data: cartRows,
        error
    } =
        await supabaseRequest(
            () =>
                db
                    .from("cart_items")
                    .select(`
                        id,
                        product_id,
                        quantity,
                        selected
                    `)
                    .eq(
                        "user_id",
                        currentUser.id
                    )
                    .eq(
                        "selected",
                        true
                    )
                    .order(
                        "created_at",
                        {
                            ascending:
                                true
                        }
                    )
        );


    if (error)
        throw error;


    if (
        !cartRows ||
        !cartRows.length
    ) {

        renderEmpty();

        return;
    }


    const productIds =
        cartRows.map(
            row =>
                row.product_id
        );


    const {
        data: products,
        error: productError
    } =
        await supabaseRequest(
            () =>
                db
                    .from("products")
                    .select(`
                        id,
                        seller_id,
                        name,
                        category,
                        price,
                        quantity,
                        description,
                        image_urls,
                        status
                    `)
                    .in(
                        "id",
                        productIds
                    )
        );


    if (productError)
        throw productError;


    checkoutItems =
        cartRows
            .map(
                row => {

                    const product =
                        products?.find(
                            p =>
                                String(
                                    p.id
                                ) ===
                                String(
                                    row.product_id
                                )
                        );


                    if (!product)
                        return null;


                    if (
                        product.status !==
                        "active"
                    ) {

                        return null;
                    }


                    const stock =
                        Number(
                            product.quantity
                        ) || 0;


                    const requested =
                        Number(
                            row.quantity
                        ) || 0;


                    const quantity =
                        Math.min(
                            requested,
                            stock
                        );


                    if (
                        quantity <= 0
                    ) {

                        return null;
                    }


                    return {

                        id:
                            product.id,

                        cart_item_id:
                            row.id,

                        seller_id:
                            product.seller_id,

                        name:
                            product.name,

                        category:
                            product.category,

                        price:
                            Number(
                                product.price
                            ) || 0,

                        stock:
                            stock,

                        image_urls:
                            product.image_urls ||
                            [],

                        quantityInCart:
                            quantity
                    };
                }
            )
            .filter(Boolean);


    if (!checkoutItems.length) {

        renderEmpty();

        return;
    }


    renderItems();
}


/* =========================================================
   17. LOAD CHECKOUT
   ========================================================= */

async function loadCheckoutItems() {

    const params =
        getBuyNowParams();


    isBuyNow =
        params.buyNow;


    if (isBuyNow) {

        await loadBuyNow();

    } else {

        await loadCart();
    }
}


/* =========================================================
   18. ẢNH SẢN PHẨM
   ========================================================= */

function getProductImage(
    imageUrls
) {

    if (
        Array.isArray(
            imageUrls
        ) &&
        imageUrls.length
    ) {

        return imageUrls[0];
    }


    if (
        typeof imageUrls ===
        "string"
    ) {

        try {

            const parsed =
                JSON.parse(
                    imageUrls
                );


            if (
                Array.isArray(
                    parsed
                ) &&
                parsed.length
            ) {

                return parsed[0];
            }


        } catch {

            return imageUrls;
        }
    }


    return "";
}


/* =========================================================
   19. HIỂN THỊ SẢN PHẨM
   ========================================================= */

function renderItems() {

    if (!cartItemsContainer)
        return;


    if (!checkoutItems.length) {

        renderEmpty();

        return;
    }


    cartItemsContainer.innerHTML =
        checkoutItems
            .map(
                item => {

                    const image =
                        getProductImage(
                            item.image_urls
                        );


                    const quantity =
                        Number(
                            item.quantityInCart
                        );


                    const price =
                        Number(
                            item.price
                        ) || 0;


                    const total =
                        quantity *
                        price;


                    return `

                        <div class="checkout-item">

                            <img
                                src="${escapeHtml(
                                    image
                                )}"
                                alt="${escapeHtml(
                                    item.name
                                )}"
                                onerror="
                                    this.style.display='none'
                                "
                            >

                            <div class="checkout-info">

                                <h3>
                                    ${escapeHtml(
                                        item.name
                                    )}
                                </h3>

                                <div class="product-meta">
                                    Danh mục:
                                    ${escapeHtml(
                                        item.category ||
                                        "Khác"
                                    )}
                                </div>

                                <div class="price-box">

                                    <strong>
                                        ${formatCurrency(
                                            price
                                        )}
                                    </strong>

                                    <span class="qty-tag">
                                        SL: ${quantity}
                                    </span>

                                </div>

                            </div>

                            <div class="checkout-price">

                                <strong>
                                    ${formatCurrency(
                                        total
                                    )}
                                </strong>

                            </div>

                        </div>

                    `;
                }
            )
            .join("");


    const quantity =
        checkoutItems.reduce(
            (
                sum,
                item
            ) =>
                sum +
                Number(
                    item.quantityInCart
                ),
            0
        );


    if (itemCount) {

        itemCount.textContent =
            `${quantity} sản phẩm`;
    }


    updateSummary();
}


/* =========================================================
   20. GIỎ HÀNG RỖNG
   ========================================================= */

function renderEmpty() {

    if (cartItemsContainer) {

        cartItemsContainer.innerHTML = `

            <div class="empty-cart">

                <div class="empty-icon">
                    🛒
                </div>

                <h3>
                    Không có sản phẩm để đặt hàng
                </h3>

                <p>
                    Vui lòng quay lại giỏ hàng
                    và chọn sản phẩm.
                </p>

            </div>

        `;
    }


    if (itemCount) {

        itemCount.textContent =
            "0 sản phẩm";
    }


    if (checkoutButton) {

        checkoutButton.disabled =
            true;
    }
}


/* =========================================================
   21. TIỀN
   ========================================================= */

function getShippingFee() {

    const shipping =
        document.querySelector(
            'input[name="shippingMethod"]:checked'
        );


    return shipping?.value === "mid"
        ? 5000
        : 0;
}


function getSubtotal() {

    return checkoutItems.reduce(
        (
            total,
            item
        ) => {

            return total +
                (
                    Number(
                        item.price
                    ) *
                    Number(
                        item.quantityInCart
                    )
                );
        },
        0
    );
}


function getTotal() {

    return (
        getSubtotal() +
        getShippingFee()
    );
}


function updateSummary() {

    const subtotal =
        getSubtotal();

    const shipping =
        getShippingFee();

    const total =
        subtotal +
        shipping;


    if (subtotalEl) {

        subtotalEl.textContent =
            formatCurrency(
                subtotal
            );
    }


    if (shippingFeeEl) {

        shippingFeeEl.textContent =
            formatCurrency(
                shipping
            );
    }


    if (totalEl) {

        totalEl.textContent =
            formatCurrency(
                total
            );
    }


    updateWalletPreview();
}


/* =========================================================
   22. RADIO UI
   ========================================================= */

function updateOptionUI() {

    document
        .querySelectorAll(
            ".option-box"
        )
        .forEach(
            box => {

                const radio =
                    box.querySelector(
                        'input[type="radio"]'
                    );


                if (
                    radio?.checked
                ) {

                    box.classList.add(
                        "selected"
                    );

                } else {

                    box.classList.remove(
                        "selected"
                    );
                }
            }
        );
}


/* =========================================================
   23. QR
   ========================================================= */

function updateQR() {

    if (
        !qrCodeImage ||
        !currentUser
    ) {

        return;
    }


    const total =
        getTotal();


    const content =
        `IUH SHOP ${currentUser.id} ${total}`;


    qrCodeImage.src =
        "https://api.qrserver.com/v1/create-qr-code/" +
        "?size=220x220&data=" +
        encodeURIComponent(
            content
        );
}


/* =========================================================
   24. VÍ IUH
   ========================================================= */

async function loadWallet() {

    if (!currentUser)
        return false;


    if (walletBalanceEl) {

        walletBalanceEl.textContent =
            "Đang tải...";
    }


    try {

        const {
            data,
            error
        } =
            await supabaseRequest(
                () =>
                    db
                        .from("iuh_wallets")
                        .select(
                            "balance"
                        )
                        .eq(
                            "user_id",
                            currentUser.id
                        )
                        .maybeSingle()
            );


        if (error)
            throw error;


        if (!data) {

            walletBalance =
                0;


            if (walletBalanceEl) {

                walletBalanceEl.textContent =
                    "Chưa thiết lập";
            }


            if (walletStatusEl) {

                walletStatusEl.textContent =
                    "Ví IUH chưa được thiết lập cho tài khoản.";

                walletStatusEl.className =
                    "wallet-status error";
            }


            return false;
        }


        walletBalance =
            Number(
                data.balance
            ) || 0;


        updateWalletPreview();


        return true;


    } catch (error) {

        console.error(
            "Lỗi tải Ví IUH:",
            error
        );


        if (walletBalanceEl) {

            walletBalanceEl.textContent =
                "Không tải được";
        }


        if (walletStatusEl) {

            walletStatusEl.textContent =
                error.message ||
                "Không thể kiểm tra số dư Ví IUH.";

            walletStatusEl.className =
                "wallet-status error";
        }


        return false;
    }
}


/* =========================================================
   25. HIỂN THỊ VÍ
   ========================================================= */

function updateWalletPreview() {

    const total =
        getTotal();


    if (walletBalanceEl) {

        walletBalanceEl.textContent =
            formatCurrency(
                walletBalance
            );
    }


    if (walletOrderTotalEl) {

        walletOrderTotalEl.textContent =
            formatCurrency(
                total
            );
    }


    const remaining =
        walletBalance -
        total;


    if (walletRemainingEl) {

        walletRemainingEl.textContent =
            remaining >= 0
                ? formatCurrency(
                    remaining
                )
                : "Không đủ số dư";
    }


    if (walletStatusEl) {

        if (
            walletBalance >=
            total
        ) {

            walletStatusEl.textContent =
                "✓ Số dư Ví IUH đủ để thanh toán.";

            walletStatusEl.className =
                "wallet-status success";

        } else {

            walletStatusEl.textContent =
                "⚠ Số dư Ví IUH không đủ để thanh toán.";

            walletStatusEl.className =
                "wallet-status error";
        }
    }
}


/* =========================================================
   26. HIỂN THỊ PHƯƠNG THỨC THANH TOÁN
   ========================================================= */

async function updatePaymentUI() {

    const payment =
        document.querySelector(
            'input[name="paymentMethod"]:checked'
        )?.value;


    if (qrPaymentBox)
        qrPaymentBox.classList.add(
            "hidden"
        );


    if (walletPaymentBox)
        walletPaymentBox.classList.add(
            "hidden"
        );


    if (cashPaymentBox)
        cashPaymentBox.classList.add(
            "hidden"
        );


    /*
     * QR
     */
    if (
        payment === "qr"
    ) {

        if (qrPaymentBox)
            qrPaymentBox.classList.remove(
                "hidden"
            );


        updateQR();


        if (checkoutButton) {

            checkoutButton.disabled =
                !qrPaymentConfirmed;
        }


        return;
    }


    /*
     * VÍ IUH
     */
    if (
        payment === "iuh_wallet"
    ) {

        if (walletPaymentBox)
            walletPaymentBox.classList.remove(
                "hidden"
            );


        const walletOK =
            await loadWallet();


        if (checkoutButton) {

            checkoutButton.disabled =
                !walletOK ||
                walletBalance <
                getTotal();
        }


        return;
    }


    /*
     * TIỀN MẶT
     */
    if (
        payment === "cash"
    ) {

        if (cashPaymentBox)
            cashPaymentBox.classList.remove(
                "hidden"
            );


        if (checkoutButton) {

            checkoutButton.disabled =
                false;
        }
    }
}


/* =========================================================
   27. XÁC NHẬN QR
   ========================================================= */

function setupQRPayment() {

    if (!confirmPaymentBtn)
        return;


    confirmPaymentBtn.addEventListener(
        "click",
        function() {

            if (
                qrPaymentConfirmed
            )
                return;


            confirmPaymentBtn.disabled =
                true;


            confirmPaymentBtn.textContent =
                "Đang xác minh...";


            if (
                paymentVerificationStatus
            ) {

                paymentVerificationStatus.textContent =
                    "Đang xác minh thanh toán...";
            }


            setTimeout(
                function() {

                    qrPaymentConfirmed =
                        true;


                    confirmPaymentBtn.textContent =
                        "✓ Đã xác nhận thanh toán";


                    if (
                        paymentVerificationStatus
                    ) {

                        paymentVerificationStatus.textContent =
                            "Đã xác nhận thanh toán.";

                        paymentVerificationStatus.classList.add(
                            "success"
                        );
                    }


                    if (checkoutButton) {

                        checkoutButton.disabled =
                            false;
                    }


                    showToast(
                        "Đã xác nhận thanh toán."
                    );

                },
                1000
            );
        }
    );
}


/* =========================================================
   28. KIỂM TRA FORM
   ========================================================= */

function validateForm() {

    const name =
        document
            .getElementById(
                "recipientName"
            )
            ?.value
            .trim() || "";


    const phone =
        document
            .getElementById(
                "recipientPhone"
            )
            ?.value
            .trim() || "";


    const address =
        document
            .getElementById(
                "recipientAddress"
            )
            ?.value
            .trim() || "";


    if (!name) {

        showToast(
            "Vui lòng nhập họ tên."
        );

        document
            .getElementById(
                "recipientName"
            )
            ?.focus();

        return false;
    }


    if (!phone) {

        showToast(
            "Vui lòng nhập số điện thoại."
        );

        document
            .getElementById(
                "recipientPhone"
            )
            ?.focus();

        return false;
    }


    if (!address) {

        showToast(
            "Vui lòng nhập địa chỉ."
        );

        document
            .getElementById(
                "recipientAddress"
            )
            ?.focus();

        return false;
    }


    return true;
}


/* =========================================================
   29. KIỂM TRA TỒN KHO
   ========================================================= */

async function checkStock() {

    for (
        const item of checkoutItems
    ) {

        const {
            data: product,
            error
        } =
            await supabaseRequest(
                () =>
                    db
                        .from("products")
                        .select(
                            "id,name,quantity,status"
                        )
                        .eq(
                            "id",
                            item.id
                        )
                        .maybeSingle()
            );


        if (error)
            throw error;


        if (
            !product ||
            product.status !== "active"
        ) {

            throw new Error(
                `"${item.name}" không còn bán.`
            );
        }


        const stock =
            Number(
                product.quantity
            ) || 0;


        const requested =
            Number(
                item.quantityInCart
            ) || 0;


        if (
            stock <
            requested
        ) {

            throw new Error(
                `"${item.name}" chỉ còn ${stock} sản phẩm.`
            );
        }
    }
}


/* =========================================================
   30. TRỪ TIỀN VÍ
   ========================================================= */

async function payWallet() {

    const total =
        getTotal();


    const {
        data: wallet,
        error
    } =
        await supabaseRequest(
            () =>
                db
                    .from("iuh_wallets")
                    .select(
                        "balance"
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    )
                    .maybeSingle()
        );


    if (error)
        throw error;


    if (!wallet) {

        throw new Error(
            "Ví IUH chưa được thiết lập."
        );
    }


    const balance =
        Number(
            wallet.balance
        ) || 0;


    if (
        balance <
        total
    ) {

        throw new Error(
            "Số dư Ví IUH không đủ."
        );
    }


    const newBalance =
        balance -
        total;


    const {
        error: updateError
    } =
        await supabaseRequest(
            () =>
                db
                    .from("iuh_wallets")
                    .update({

                        balance:
                            newBalance,

                        updated_at:
                            new Date()
                                .toISOString()

                    })
                    .eq(
                        "user_id",
                        currentUser.id
                    )
        );


    if (updateError)
        throw updateError;


    walletBalance =
        newBalance;
}


/* =========================================================
   31. TRỪ TỒN KHO
   ========================================================= */

async function decreaseStock() {

    for (
        const item of checkoutItems
    ) {

        const {
            data: product,
            error
        } =
            await supabaseRequest(
                () =>
                    db
                        .from("products")
                        .select(
                            "quantity"
                        )
                        .eq(
                            "id",
                            item.id
                        )
                        .maybeSingle()
            );


        if (error)
            throw error;


        if (!product) {

            throw new Error(
                `Không tìm thấy sản phẩm "${item.name}".`
            );
        }


        const oldQuantity =
            Number(
                product.quantity
            ) || 0;


        const orderQuantity =
            Number(
                item.quantityInCart
            ) || 0;


        const newQuantity =
            oldQuantity -
            orderQuantity;


        if (
            newQuantity < 0
        ) {

            throw new Error(
                `"${item.name}" không đủ hàng.`
            );
        }


        const {
            error: updateError
        } =
            await supabaseRequest(
                () =>
                    db
                        .from("products")
                        .update({

                            quantity:
                                newQuantity,

                            status:
                                newQuantity <= 0
                                    ? "deleted"
                                    : "active",

                            updated_at:
                                new Date()
                                    .toISOString()

                        })
                        .eq(
                            "id",
                            item.id
                        )
            );


        if (updateError)
            throw updateError;
    }
}


/* =========================================================
   32. XÓA GIỎ HÀNG
   ========================================================= */

async function removeFromCart() {

    if (isBuyNow)
        return;


    const ids =
        checkoutItems
            .map(
                item =>
                    item.cart_item_id
            )
            .filter(Boolean);


    if (!ids.length)
        return;


    const {
        error
    } =
        await supabaseRequest(
            () =>
                db
                    .from("cart_items")
                    .delete()
                    .in(
                        "id",
                        ids
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    )
        );


    if (error)
        throw error;
}


/* =========================================================
   33. TẠO THÔNG TIN ĐƠN
   ========================================================= */

function buildOrder() {

    const recipientName =
        document
            .getElementById(
                "recipientName"
            )
            ?.value
            .trim() || "";


    const recipientPhone =
        document
            .getElementById(
                "recipientPhone"
            )
            ?.value
            .trim() || "";


    const recipientAddress =
        document
            .getElementById(
                "recipientAddress"
            )
            ?.value
            .trim() || "";


    const note =
        document
            .getElementById(
                "orderNote"
            )
            ?.value
            .trim() || "";


    const shippingMethod =
        document.querySelector(
            'input[name="shippingMethod"]:checked'
        )?.value || "";


    const paymentMethod =
        document.querySelector(
            'input[name="paymentMethod"]:checked'
        )?.value || "";


    return {

        buyer_id:
            currentUser.id,

        recipient_name:
            recipientName,

        recipient_phone:
            recipientPhone,

        recipient_address:
            recipientAddress,

        note:
            note,

        shipping_method:
            shippingMethod,

        shipping_fee:
            getShippingFee(),

        payment_method:
            paymentMethod,

        subtotal:
            getSubtotal(),

        total_amount:
            getTotal(),

        items:
            checkoutItems.map(
                item => ({

                    product_id:
                        item.id,

                    seller_id:
                        item.seller_id,

                    name:
                        item.name,

                    price:
                        item.price,

                    quantity:
                        item.quantityInCart,

                    image:
                        getProductImage(
                            item.image_urls
                        )
                })
            ),

        created_at:
            new Date()
                .toISOString()
    };
}


/* =========================================================
   34. LƯU ĐƠN TẠM
   ========================================================= */

function saveLatestOrder(
    order
) {

    localStorage.setItem(
        "iuhShopLatestOrder",
        JSON.stringify(
            order
        )
    );
}


/* =========================================================
   35. ĐẶT HÀNG
   ========================================================= */

async function submitOrder() {

    if (isSubmitting)
        return;

    if (!currentUser) {
        showToast("Vui lòng đăng nhập lại.");
        return;
    }

    if (!checkoutItems.length) {
        showToast("Không có sản phẩm để đặt hàng.");
        return;
    }

    if (!validateForm())
        return;

    const paymentMethod =
        document.querySelector(
            'input[name="paymentMethod"]:checked'
        )?.value;

    if (!paymentMethod) {
        showToast("Vui lòng chọn phương thức thanh toán.");
        return;
    }

    /* QR phải xác nhận trước */
    if (
        paymentMethod === "qr" &&
        !qrPaymentConfirmed
    ) {
        showToast("Vui lòng xác nhận thanh toán QR.");
        return;
    }

    /* Kiểm tra ví */
    if (paymentMethod === "iuh_wallet") {

        const walletOK =
            await loadWallet();

        if (
            !walletOK ||
            walletBalance < getTotal()
        ) {
            showToast(
                "Số dư Ví IUH không đủ."
            );
            return;
        }
    }

    isSubmitting = true;

    if (checkoutButton) {

        checkoutButton.disabled = true;

        const text =
            checkoutButton.querySelector(
                "span:first-child"
            );

        if (text)
            text.textContent =
                "Đang xử lý...";
    }

    try {

        /* =========================================
           1. KIỂM TRA TỒN KHO
        ========================================= */

        await checkStock();


        /* =========================================
           2. TẠO THÔNG TIN ĐƠN
        ========================================= */

        const order =
            buildOrder();


        /* =========================================
           3. CHUYỂN ITEMS SANG JSON CHO RPC
        ========================================= */

        const orderItems =
            checkoutItems.map(item => ({

                product_id:
                    Number(item.id),

                seller_id:
                    item.seller_id,

                product_name:
                    item.name,

                product_image:
                    getProductImage(
                        item.image_urls
                    ),

                price:
                    Number(item.price),

                quantity:
                    Number(item.quantityInCart),

                subtotal:
                    Number(item.price) *
                    Number(item.quantityInCart)

            }));


        /* =========================================
           4. ID GIỎ HÀNG CẦN XÓA
        ========================================= */

        const cartIds =
            isBuyNow
                ? []
                : checkoutItems
                    .map(item =>
                        item.cart_item_id
                    )
                    .filter(Boolean);


        /* =========================================
           5. TẠO ĐƠN TRỰC TIẾP TRONG DATABASE
        ========================================= */

        const {
            data,
            error
        } = await db.rpc(
            "create_order",
            {
                p_recipient_name:
                    order.recipient_name,

                p_recipient_phone:
                    order.recipient_phone,

                p_recipient_address:
                    order.recipient_address,

                p_note:
                    order.note,

                p_shipping_method:
                    order.shipping_method,

                p_shipping_fee:
                    order.shipping_fee,

                p_payment_method:
                    order.payment_method,

                p_subtotal:
                    order.subtotal,

                p_total_amount:
                    order.total_amount,

                p_items:
                    orderItems,

                p_cart_ids:
                    cartIds
            }
        );


        if (error) {

            console.error(
                "Lỗi tạo đơn:",
                error
            );

            throw error;
        }


        if (!data?.success) {

            throw new Error(
                data?.message ||
                "Không thể tạo đơn hàng."
            );
        }


        /* =========================================
           6. THÀNH CÔNG
        ========================================= */

        if (checkoutButton) {

            const text =
                checkoutButton.querySelector(
                    "span:first-child"
                );

            if (text)
                text.textContent =
                    "Đặt hàng thành công";
        }


        showToast(
            "🎉 Đặt hàng thành công!"
        );


        console.log(
            "IUH SHOP: Đã tạo đơn:",
            data
        );


        /* Nếu thanh toán bằng ví thì cập nhật số dư */
        if (
            paymentMethod ===
            "iuh_wallet"
        ) {

            await loadWallet();
        }


        /* =========================================
           7. CHUYỂN SANG TRANG SẢN PHẨM
        ========================================= */

        setTimeout(() => {

            window.location.href =
                "sanpham.html";

        }, 1500);


    } catch (error) {

        console.error(
            "Lỗi đặt hàng:",
            error
        );

        showToast(
            error.message ||
            "Đặt hàng thất bại."
        );

        if (checkoutButton) {

            checkoutButton.disabled =
                false;

            const text =
                checkoutButton.querySelector(
                    "span:first-child"
                );

            if (text)
                text.textContent =
                    "Xác nhận đặt hàng";
        }

    } finally {

        isSubmitting = false;
    }
}


/* =========================================================
   36. RADIO EVENTS
   ========================================================= */

function setupRadioEvents() {

    document.addEventListener(
        "change",
        async function(event) {

            if (
                event.target.name ===
                "shippingMethod"
            ) {

                updateOptionUI();

                updateSummary();

                return;
            }


            if (
                event.target.name ===
                "paymentMethod"
            ) {

                qrPaymentConfirmed =
                    false;


                if (
                    confirmPaymentBtn
                ) {

                    confirmPaymentBtn.disabled =
                        false;

                    confirmPaymentBtn.textContent =
                        "Xác nhận đã thanh toán";
                }


                if (
                    paymentVerificationStatus
                ) {

                    paymentVerificationStatus.textContent =
                        "";
                }


                updateOptionUI();

                await updatePaymentUI();
            }
        }
    );
}


/* =========================================================
   37. CONTINUE SHOPPING
   ========================================================= */

function setupContinueShopping() {

    const button =
        document.getElementById(
            "continueShopping"
        );


    if (!button)
        return;


    button.addEventListener(
        "click",
        function() {

            window.location.href =
                "sanpham.html";
        }
    );
}


/* =========================================================
   38. AUTH STATE
   ========================================================= */

db.auth.onAuthStateChange(
    function(
        event,
        session
    ) {

        /*
         * Chỉ cập nhật biến.
         * Không gọi getUser() ở đây.
         */

        if (session?.user) {

            currentSession =
                session;

            currentUser =
                session.user;
        }
    }
);


/* =========================================================
   39. KHỞI TẠO
   ========================================================= */

async function initCheckout() {

    console.log(
        "IUH SHOP: Đang khởi tạo checkout..."
    );


    initDOM();


    /*
     * Lấy session.
     */
    const session =
        await getSession();


    if (!session) {

        console.error(
            "IUH SHOP: Không có session."
        );


        showToast(
            "Vui lòng đăng nhập để thanh toán."
        );


        setTimeout(
            () => {

                window.location.href =
                    "dangnhap.html";

            },
            1000
        );


        return;
    }


    console.log(
        "IUH SHOP: User =",
        currentUser.id
    );


    /*
     * Header
     */
    await updateUserMenu();


    setupAccountDropdown();

    setupAccountArrow();

    setupLogout();

    setupActiveMenu();


    /*
     * Checkout
     */
    updateOptionUI();


    await loadCheckoutItems();


    updateSummary();


    /*
     * Tải Ví IUH ngay khi vào trang.
     */
    await loadWallet();


    updateQR();


    await updatePaymentUI();


    /*
     * Events
     */
    setupQRPayment();

    setupRadioEvents();

    setupContinueShopping();

    if (checkoutButton) {
    checkoutButton.addEventListener(
        "click",
        submitOrder
    );
}


    console.log(
        "IUH SHOP: Checkout đã sẵn sàng."
    );
}


/* =========================================================
   40. DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        initCheckout();

    }
);