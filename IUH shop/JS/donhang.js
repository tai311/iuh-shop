/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://xecxofmogvqysejjpxvl.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC";


window.IUH_SUPABASE =
    window.IUH_SUPABASE ||
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

const supabaseClient =
    window.IUH_SUPABASE;

const db = supabaseClient;



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






/* =========================================================
   IUH SHOP - KIỂM TRA ĐƠN HÀNG
   DATABASE VERSION
========================================================= */


/* =========================================================
   BIẾN
========================================================= */

let currentUser = null;

let allOrders = [];

let purchaseOrders = [];

let saleOrders = [];

let historyOrders = [];


/* =========================================================
   TRẠNG THÁI
========================================================= */

const ORDER_STATUS = {

    pending: {
        label: "Chờ xác nhận",
        className: "status-pending",
        icon: "fa-clock"
    },

    confirmed: {
        label: "Đã xác nhận",
        className: "status-confirmed",
        icon: "fa-circle-check"
    },

    shipping: {
        label: "Đang giao",
        className: "status-shipping",
        icon: "fa-truck"
    },

    delivered: {
        label: "Đã giao",
        className: "status-delivered",
        icon: "fa-box-open"
    },

    completed: {
        label: "Hoàn tất",
        className: "status-completed",
        icon: "fa-check-double"
    },

    cancelled: {
        label: "Đã hủy",
        className: "status-cancelled",
        icon: "fa-ban"
    }

};


const STATUS_ORDER = [
    "pending",
    "confirmed",
    "shipping",
    "delivered",
    "completed"
];


/* =========================================================
   FORMAT TIỀN
========================================================= */

function formatMoney(value) {

    return Number(value || 0)
        .toLocaleString("vi-VN") + "đ";

}


/* =========================================================
   FORMAT NGÀY
========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString(
        "vi-VN",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   LẤY USER ĐANG ĐĂNG NHẬP
========================================================= */

async function getCurrentUser() {

    try {

        const {
            data,
            error
        } = await db.auth.getSession();

        if (error) {

            console.error(
                "Lỗi lấy session:",
                error
            );

            return null;
        }

        return data?.session?.user || null;

    }
    catch (error) {

        console.error(
            "Lỗi xác định user:",
            error
        );

        return null;
    }

}


/* =========================================================
   LẤY ID ĐƠN
========================================================= */

function getOrderId(order) {

    return (
        order.order_code ||
        order.id ||
        "—"
    );

}


/* =========================================================
   LẤY STATUS
========================================================= */

function getOrderStatus(order) {

    const status =
        String(
            order.status || "pending"
        ).toLowerCase();

    return ORDER_STATUS[status]
        ? status
        : "pending";

}


/* =========================================================
   LẤY ITEMS
========================================================= */

function getOrderItems(order) {

    if (
        Array.isArray(
            order.order_items
        )
    ) {

        return order.order_items;

    }

    return [];

}


/* =========================================================
   TÊN SẢN PHẨM
========================================================= */

function getItemName(item) {

    return (
        item.product_name ||
        item.name ||
        "Sản phẩm"
    );

}


/* =========================================================
   ẢNH SẢN PHẨM
========================================================= */

function getItemImage(item) {

    return (
        item.product_image ||
        item.image ||
        item.image_url ||
        ""
    );

}


/* =========================================================
   SELLER ID
========================================================= */

function getSellerId(item) {

    return item.seller_id || null;

}


/* =========================================================
   PRODUCT ID
========================================================= */

function getProductId(item) {

    return item.product_id || null;

}


/* =========================================================
   GIÁ
========================================================= */

function getItemPrice(item) {

    return Number(
        item.price || 0
    );

}


/* =========================================================
   SỐ LƯỢNG
========================================================= */

function getItemQuantity(item) {

    return Number(
        item.quantity || 1
    );

}


/* =========================================================
   TỔNG ĐƠN
========================================================= */

function calculateOrderTotal(order) {

    if (
        order.total_amount !==
        undefined
    ) {

        return Number(
            order.total_amount
        ) || 0;

    }

    const items =
        getOrderItems(order);

    const subtotal =
        items.reduce(
            (
                total,
                item
            ) => {

                return total +
                    getItemPrice(item) *
                    getItemQuantity(item);

            },
            0
        );

    return subtotal +
        Number(
            order.shipping_fee || 0
        );

}


/* =========================================================
   CHUẨN HÓA ORDER
========================================================= */

function normalizeOrder(order) {

    const items =
        getOrderItems(order);

    return {

        ...order,

        _id:
            getOrderId(order),

        _databaseId:
            order.id,

        _status:
            getOrderStatus(order),

        _items:
            items,

        _total:
            calculateOrderTotal(order),

        _createdAt:
            order.created_at

    };

}


/* =========================================================
   ĐỌC ĐƠN HÀNG TỪ DATABASE
========================================================= */

async function loadOrdersFromDatabase() {

    try {

        console.log(
            "IUH SHOP: Đang tải đơn hàng từ Database..."
        );

        const {
            data,
            error
        } = await db.rpc(
            "get_my_orders"
        );


        if (error) {

            console.error(
                "Lỗi RPC tải đơn hàng:",
                error
            );

            alert(
                "Không thể tải đơn hàng: " +
                (error.message || "Lỗi Database")
            );

            return [];

        }


        console.log(
            "IUH SHOP: Đã tải đơn hàng:",
            data
        );


        let orders = data || [];


        /*
         * RPC trả về JSONB
         * nên đảm bảo luôn là mảng
         */

        if (!Array.isArray(orders)) {

            orders = [];

        }


        return orders.map(
            order =>
                normalizeOrder(order)
        );

    }

    catch (error) {

        console.error(
            "Lỗi Database:",
            error
        );

        alert(
            "Có lỗi khi tải đơn hàng."
        );

        return [];

    }

}


/* =========================================================
   PHÂN LOẠI ĐƠN
========================================================= */

function classifyOrders() {

    const userId = currentUser?.id;

    if (!userId) {
        purchaseOrders = [];
        saleOrders = [];
        historyOrders = [];
        return;
    }

    /* =========================
       ĐƠN MUA
    ========================= */

    purchaseOrders = allOrders.filter(order => {
        return String(
            order.buyer_id ||
            order.buyerId ||
            ""
        ) === String(userId);
    });


    /* =========================
       ĐƠN BÁN
       Kiểm tra nhiều trường hợp
    ========================= */

    saleOrders = allOrders.filter(order => {

        const items = Array.isArray(order._items)
            ? order._items
            : [];

        return items.some(item => {

            const sellerId =
                item.seller_id ||
                item.sellerId ||
                item.seller ||
                item.product_seller_id ||
                item.productSellerId ||
                null;

            return String(sellerId) === String(userId);
        });

    });


    /* =========================
       LỊCH SỬ
    ========================= */

    historyOrders = allOrders.filter(order => {

        const isBuyer =
            String(
                order.buyer_id ||
                order.buyerId ||
                ""
            ) === String(userId);

        const isSeller =
            Array.isArray(order._items) &&
            order._items.some(item => {

                const sellerId =
                    item.seller_id ||
                    item.sellerId ||
                    item.seller ||
                    item.product_seller_id ||
                    item.productSellerId ||
                    null;

                return String(sellerId) === String(userId);
            });

        return (
            (order._status === "completed" ||
             order._status === "cancelled") &&
            (isBuyer || isSeller)
        );
    });


    console.log(
        "IUH SHOP: classifyOrders:",
        {
            userId,
            total: allOrders.length,
            purchase: purchaseOrders.length,
            sale: saleOrders.length
        }
    );
}


/* =========================================================
   TAB
========================================================= */

function setupTabs() {

    document
        .querySelectorAll(
            ".orders-tab"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function() {

                        const tab =
                            button.dataset.tab;


                        document
                            .querySelectorAll(
                                ".orders-tab"
                            )
                            .forEach(
                                item =>
                                    item.classList
                                        .remove(
                                            "active"
                                        )
                            );


                        document
                            .querySelectorAll(
                                ".orders-tab-panel"
                            )
                            .forEach(
                                panel =>
                                    panel.classList
                                        .remove(
                                            "active"
                                        )
                            );


                        button.classList.add(
                            "active"
                        );


                        const target =
                            document.getElementById(
                                tab === "purchase"
                                    ? "purchaseTab"
                                    : "saleTab"
                            );


                        if (target) {

                            target.classList.add(
                                "active"
                            );

                        }

                    }
                );

            }
        );

}


/* =========================================================
   STATUS HTML
========================================================= */

function renderStatus(status) {

    const info =
        ORDER_STATUS[
            status
        ] ||
        ORDER_STATUS.pending;


    return `
        <span class="
            order-status
            ${info.className}
        ">
            <i class="fa-solid ${info.icon}"></i>
            ${info.label}
        </span>
    `;

}


/* =========================================================
   PROGRESS
========================================================= */

function renderProgress(status) {

    if (
        status === "cancelled"
    ) {

        return `
            <div class="order-progress">
                <div style="
                    color:#c62828;
                    font-weight:600;
                    font-size:14px;
                    text-align:center;
                ">
                    <i class="fa-solid fa-ban"></i>
                    Đơn hàng đã bị hủy
                </div>
            </div>
        `;

    }


    const currentIndex =
        STATUS_ORDER.indexOf(
            status
        );


    return `
        <div class="order-progress">

            <div class="progress-track">

                ${STATUS_ORDER
                    .map(
                        (
                            itemStatus,
                            index
                        ) => {

                            let className = "";


                            if (
                                index <
                                currentIndex
                            ) {

                                className =
                                    "done";

                            }


                            if (
                                index ===
                                currentIndex
                            ) {

                                className =
                                    "current";

                            }


                            const info =
                                ORDER_STATUS[
                                    itemStatus
                                ];


                            return `
                                <div class="
                                    progress-step
                                    ${className}
                                ">

                                    <div class="progress-dot">

                                        <i class="
                                            fa-solid
                                            ${info.icon}
                                        "></i>

                                    </div>

                                    <span>
                                        ${info.label}
                                    </span>

                                </div>
                            `;

                        }
                    )
                    .join("")}

            </div>

        </div>
    `;

}

/* =========================================================
   KIỂM TRA NGƯỜI MUA ĐÃ XÁC NHẬN NHẬN HÀNG
   ========================================================= */

function isOrderReceived(orderId) {

    return localStorage.getItem(
        `iuh_order_received_${orderId}`
    ) === "true";

}


/* =========================================================
   CÓ ĐƯỢC HỦY?
========================================================= */

function canCancelOrder(order) {

    return (
        order._status ===
            "pending" ||

        order._status ===
            "confirmed"
    );

}


/* =========================================================
   RENDER ĐƠN MUA
========================================================= */

function renderPurchaseOrders() {

    const container =
        document.getElementById(
            "purchaseOrderList"
        );


    if (!container) {
        return;
    }


    const filter =
        document.getElementById(
            "purchaseFilter"
        )?.value ||
        "all";


    let orders =
        [...purchaseOrders];


    if (
        filter !== "all"
    ) {

        orders =
            orders.filter(
                order =>
                    order._status ===
                    filter
            );

    }


    document.getElementById(
        "purchaseCount"
    ).textContent =
        purchaseOrders.filter(
            order =>
                order._status !==
                    "completed" &&

                order._status !==
                    "cancelled"
        ).length;


    if (
        orders.length === 0
    ) {

        container.innerHTML =
            renderEmpty(
                "fa-cart-shopping",
                "Chưa có đơn mua",
                "Các đơn hàng bạn đã đặt sẽ xuất hiện ở đây."
            );

        return;

    }


    container.innerHTML =
        orders
            .map(
                order =>
                    renderPurchaseCard(
                        order
                    )
            )
            .join("");

}


/* =========================================================
   CARD ĐƠN MUA
   ========================================================= */

function renderPurchaseCard(
    order
) {

    const items =
        order._items;


    const firstItem =
        items[0] || {};


    const itemName =
        getItemName(
            firstItem
        );


    const image =
        getItemImage(
            firstItem
        );


    const quantity =
        getItemQuantity(
            firstItem
        );


    const price =
        getItemPrice(
            firstItem
        );


    /*
       Chỉ hiện nút khi:

       1. Người bán đã chuyển đơn sang completed
       2. Người mua chưa xác nhận nhận hàng
    */

    const showReceivedButton =
        order._status === "completed" &&
        !isOrderReceived(
            order._databaseId
        );


    return `

        <article
            class="order-card"
            data-order-id="${escapeHtml(order._id)}"
        >

            <div class="order-card-header">

                <div class="order-number">

                    <strong>
                        Đơn hàng #${escapeHtml(order._id)}
                    </strong>

                    <span>
                        Đặt ngày:
                        ${formatDate(order._createdAt)}
                    </span>

                </div>


                ${renderStatus(
                    order._status
                )}

            </div>


            <div class="order-product">

                ${
                    image
                    ? `

                        <img
                            class="order-product-image"
                            src="${escapeHtml(image)}"
                            alt="${escapeHtml(itemName)}"
                            onerror="this.style.display='none'"
                        >

                    `
                    : `

                        <div
                            class="order-product-image"
                            style="
                                display:flex;
                                align-items:center;
                                justify-content:center;
                                color:#bbb;
                                font-size:25px;
                            "
                        >

                            <i class="fa-solid fa-image"></i>

                        </div>

                    `
                }


                <div class="order-product-info">

                    <h3>
                        ${escapeHtml(itemName)}
                    </h3>


                    <p>
                        Số lượng:
                        ${quantity}
                    </p>


                    <p>
                        Đơn giá:
                        ${formatMoney(price)}
                    </p>


                    ${
                        items.length > 1
                        ? `

                            <p>
                                Và ${items.length - 1}
                                sản phẩm khác
                            </p>

                        `
                        : ""
                    }

                </div>


                <div class="order-product-price">

                    <strong>
                        ${formatMoney(
                            price * quantity
                        )}
                    </strong>

                </div>

            </div>


            ${renderProgress(
                order._status
            )}


            ${
                showReceivedButton
                ? `

                    <div
                        style="
                            margin-top:18px;
                            padding:16px;
                            border-radius:12px;
                            background:#f8fafc;
                            border:1px solid #e5e7eb;
                        "
                    >

                        <div
                            style="
                                margin-bottom:10px;
                                font-size:14px;
                                color:#555;
                            "
                        >

                            <strong>
                                Đơn hàng đã được giao hoàn tất.
                            </strong>

                            <br>

                            Vui lòng xác nhận bạn đã nhận được
                            hàng để hoàn tất đơn hàng và giải ngân
                            tiền cho người bán.

                        </div>


                        <button
                            type="button"
                            class="order-btn update"
                            onclick="
                                confirmReceivedOrder(
                                    '${escapeHtml(order._databaseId)}'
                                )
                            "
                        >

                            <i class="fa-solid fa-box-open"></i>

                            Đã nhận được hàng

                        </button>

                    </div>

                `
                : ""
            }


            <div class="order-card-footer">

                <div class="order-total">

                    <span>
                        Tổng thanh toán
                    </span>

                    <strong>
                        ${formatMoney(
                            order._total
                        )}
                    </strong>

                </div>


                <div class="order-actions">

                    ${
                        canCancelOrder(order)
                        ? `

                            <button
                                type="button"
                                class="order-btn cancel"
                                onclick="
                                    cancelOrder(
                                        '${escapeHtml(order._databaseId)}'
                                    )
                                "
                            >

                                <i class="fa-solid fa-xmark"></i>

                                Hủy đơn

                            </button>

                        `
                        : ""
                    }


                    <button
                        type="button"
                        class="order-btn"
                        onclick="
                            showOrderDetail(
                                '${escapeHtml(order._databaseId)}'
                            )
                        "
                    >

                        <i class="fa-solid fa-eye"></i>

                        Chi tiết

                    </button>

                </div>

            </div>

        </article>

    `;

}


/* =========================================================
   RENDER ĐƠN BÁN
========================================================= */

function renderSaleOrders() {

    const container =
        document.getElementById(
            "saleOrderList"
        );


    if (!container) {
        return;
    }


    const filter =
        document.getElementById(
            "saleFilter"
        )?.value ||
        "all";


    let orders =
        [...saleOrders];


    if (
        filter !== "all"
    ) {

        orders =
            orders.filter(
                order =>
                    order._status ===
                    filter
            );

    }


    document.getElementById(
        "saleCount"
    ).textContent =
        saleOrders.filter(
            order =>
                order._status !==
                    "completed" &&

                order._status !==
                    "cancelled"
        ).length;


    if (
        orders.length === 0
    ) {

        container.innerHTML =
            renderEmpty(
                "fa-store",
                "Chưa có đơn bán",
                "Các đơn hàng từ sản phẩm bạn đăng sẽ xuất hiện ở đây."
            );

        return;

    }


    container.innerHTML =
        orders
            .map(
                order =>
                    renderSaleCard(
                        order
                    )
            )
            .join("");

}


/* =========================================================
   CARD ĐƠN BÁN
========================================================= */

function renderSaleCard(order) {

    const sellerItems =
        order._items.filter(
            item =>
                String(
                    getSellerId(item)
                ) ===
                String(
                    currentUser.id
                )
        );


    const item =
        sellerItems[0] ||
        order._items[0] ||
        {};


    const itemName =
        getItemName(item);


    const image =
        getItemImage(item);


    const quantity =
        getItemQuantity(item);


    const price =
        getItemPrice(item);


    const canUpdate =
        order._status !==
            "completed" &&

        order._status !==
            "cancelled";


    return `
        <article
            class="order-card"
            data-order-id="${escapeHtml(order._databaseId)}"
        >

            <div class="order-card-header">

                <div class="order-number">

                    <strong>
                        Đơn hàng #${escapeHtml(order._id)}
                    </strong>

                    <span>
                        Đặt ngày:
                        ${formatDate(order._createdAt)}
                    </span>

                </div>

                ${renderStatus(
                    order._status
                )}

            </div>


            <div class="order-product">

                ${
                    image
                    ? `
                        <img
                            class="order-product-image"
                            src="${escapeHtml(image)}"
                            alt="${escapeHtml(itemName)}"
                            onerror="this.style.display='none'"
                        >
                    `
                    : `
                        <div class="order-product-image"
                             style="
                                display:flex;
                                align-items:center;
                                justify-content:center;
                                color:#bbb;
                                font-size:25px;
                             ">
                            <i class="fa-solid fa-image"></i>
                        </div>
                    `
                }


                <div class="order-product-info">

                    <h3>
                        ${escapeHtml(itemName)}
                    </h3>

                    <p>
                        Người mua:
                        ${escapeHtml(
                            order.recipient_name ||
                            "Khách hàng"
                        )}
                    </p>

                    <p>
                        Số lượng:
                        ${quantity}
                    </p>

                    <p>
                        Giá:
                        ${formatMoney(price)}
                    </p>

                </div>


                <div class="order-product-price">

                    <strong>
                        ${formatMoney(
                            price * quantity
                        )}
                    </strong>

                </div>

            </div>


            ${renderProgress(
                order._status
            )}


            ${
                canUpdate
                ? `
                    <div class="seller-control">

                        <div class="seller-control-title">
                            Cập nhật trạng thái đơn hàng
                        </div>

                        <div class="seller-control-row">

                            <select
                                class="seller-status-select"
                                id="status-${escapeHtml(order._databaseId)}"
                            >
                                ${renderStatusOptions(
                                    order._status
                                )}
                            </select>


                            <button
                                type="button"
                                class="order-btn update"
                                onclick="updateOrderStatus('${escapeHtml(order._databaseId)}')"
                            >
                                <i class="fa-solid fa-arrows-rotate"></i>
                                Cập nhật
                            </button>

                        </div>

                    </div>
                `
                : ""
            }


            <div class="order-card-footer">

                <div class="order-total">

                    <span>
                        Tổng đơn
                    </span>

                    <strong>
                        ${formatMoney(
                            order._total
                        )}
                    </strong>

                </div>


                <div class="order-actions">

                    <button
                        type="button"
                        class="order-btn"
                        onclick="showOrderDetail('${escapeHtml(order._databaseId)}')"
                    >
                        <i class="fa-solid fa-eye"></i>
                        Chi tiết
                    </button>

                </div>

            </div>

        </article>
    `;

}


/* =========================================================
   OPTION STATUS
========================================================= */

function renderStatusOptions(
    currentStatus
) {

    const currentIndex =
        STATUS_ORDER.indexOf(
            currentStatus
        );


    return STATUS_ORDER
        .map(
            (
                status,
                index
            ) => {

                if (
                    index <
                    currentIndex
                ) {

                    return "";

                }


                return `
                    <option
                        value="${status}"
                        ${
                            status === currentStatus
                                ? "selected"
                                : ""
                        }
                    >
                        ${ORDER_STATUS[status].label}
                    </option>
                `;

            }
        )
        .join("");

}


/* =========================================================
   EMPTY
========================================================= */

function renderEmpty(
    icon,
    title,
    message
) {

    return `
        <div class="order-empty">

            <i class="
                fa-solid
                ${icon}
            "></i>

            <h3>
                ${title}
            </h3>

            <p>
                ${message}
            </p>

        </div>
    `;

}


/* =========================================================
   LỊCH SỬ
========================================================= */

function renderHistory() {

    const container =
        document.getElementById(
            "orderHistoryList"
        );


    if (!container) {
        return;
    }


    if (
        historyOrders.length === 0
    ) {

        container.innerHTML =
            renderEmpty(
                "fa-clock-rotate-left",
                "Chưa có lịch sử",
                "Các đơn đã hoàn tất hoặc đã hủy sẽ xuất hiện tại đây."
            );

        return;

    }


    container.innerHTML =
        [...historyOrders]
            .sort(
                (
                    a,
                    b
                ) =>
                    new Date(
                        b._createdAt
                    ) -
                    new Date(
                        a._createdAt
                    )
            )
            .map(
                order => {

                    return `
                        <div class="history-item">

                            <div class="history-info">

                                <strong>

                                    #${escapeHtml(
                                        order._id
                                    )}

                                    ${renderStatus(
                                        order._status
                                    )}

                                </strong>

                                <span>
                                    ${formatDate(
                                        order._createdAt
                                    )}
                                </span>

                            </div>


                            <div class="history-money">

                                ${formatMoney(
                                    order._total
                                )}

                            </div>

                        </div>
                    `;

                }
            )
            .join("");

}


/* =========================================================
   HỦY ĐƠN - DATABASE
   + HOÀN TIỀN NẾU THANH TOÁN ONLINE
========================================================= */

async function cancelOrder(orderId) {

    const order =
        allOrders.find(
            item =>
                String(
                    item._databaseId
                ) ===
                String(orderId)
        );


    if (!order) {

        alert(
            "Không tìm thấy đơn hàng."
        );

        return;
    }


    /* =========================
       KIỂM TRA TRẠNG THÁI
    ========================= */

    if (!canCancelOrder(order)) {

        alert(
            "Đơn hàng hiện tại không thể hủy."
        );

        return;
    }


    /* =========================
       XÁC NHẬN
    ========================= */

    const confirmed =
        confirm(
            "Bạn có chắc muốn hủy đơn hàng này?"
        );


    if (!confirmed) {
        return;
    }


    try {

        /* =========================
           GỌI DATABASE RPC
        ========================= */

        const {
            data,
            error
        } = await db.rpc(
            "cancel_order",
            {
                p_order_id:
                    Number(orderId)
            }
        );


        if (error) {

            console.error(
                "Lỗi hủy đơn:",
                error
            );

            alert(
                error.message ||
                "Không thể hủy đơn hàng."
            );

            return;
        }


        /* =========================
           KIỂM TRA KẾT QUẢ
        ========================= */

        if (!data?.success) {

            alert(
                "Không thể hủy đơn hàng."
            );

            return;
        }


        /* =========================
           THÔNG BÁO
        ========================= */

        if (
            data.refunded === true
        ) {

            alert(
                "Đã hủy đơn hàng.\n\n" +
                "Số tiền " +
                formatMoney(
                    data.refund_amount
                ) +
                " đã được hoàn vào IUH Wallet."
            );

        }
        else {

            alert(
                "Đã hủy đơn hàng."
            );

        }


        /* =========================
           TẢI LẠI DATABASE
        ========================= */

        await refreshPageData();

    }
    catch (error) {

        console.error(
            "Lỗi hủy đơn:",
            error
        );

        alert(
            "Có lỗi xảy ra khi hủy đơn."
        );

    }

}

/* =========================================================
   NGƯỜI MUA XÁC NHẬN ĐÃ NHẬN ĐƯỢC HÀNG

   Chỉ tại bước này mới giải ngân tiền.
   ========================================================= */

async function confirmReceivedOrder(
    orderId
) {

    const order =
        allOrders.find(
            item =>
                String(
                    item._databaseId
                ) ===
                String(orderId)
        );


    if (!order) {

        alert(
            "Không tìm thấy đơn hàng."
        );

        return;

    }


    /* =========================
       KIỂM TRA NGƯỜI MUA
       ========================= */

    if (
        String(
            order.buyer_id
        ) !==
        String(
            currentUser?.id
        )
    ) {

        alert(
            "Bạn không có quyền xác nhận đơn hàng này."
        );

        return;

    }


    /* =========================
       KIỂM TRA TRẠNG THÁI
       ========================= */

    if (
        order._status !==
        "completed"
    ) {

        alert(
            "Đơn hàng chưa ở trạng thái Hoàn tất."
        );

        return;

    }


    /* =========================
       CHỐNG XÁC NHẬN 2 LẦN
       ========================= */

    if (
        isOrderReceived(
            orderId
        )
    ) {

        alert(
            "Đơn hàng này đã được xác nhận nhận hàng."
        );

        return;

    }


    /* =========================
       XÁC NHẬN
       ========================= */

    const confirmed =
        confirm(
            "Bạn xác nhận đã nhận được hàng?\n\n" +
            "Sau khi xác nhận, tiền sẽ được giải ngân " +
            "vào Ví IUH của người bán."
        );


    if (!confirmed) {

        return;

    }


    try {

        /* =========================
           GIẢI NGÂN
           ========================= */

        const {
            data: settlementData,
            error: settlementError
        } = await db.rpc(
            "settle_online_order",
            {
                p_order_id:
                    Number(orderId)
            }
        );


        if (settlementError) {

            console.error(
                "Lỗi giải ngân:",
                settlementError
            );

            alert(
                "Không thể giải ngân tiền.\n\n" +
                settlementError.message
            );

            return;

        }


        /* =========================
           KIỂM TRA KẾT QUẢ
           ========================= */

        if (
            settlementData?.settled !== true
        ) {

            console.error(
                "Kết quả giải ngân:",
                settlementData
            );

            alert(
                "Không thể hoàn tất giải ngân.\n\n" +
                "Vui lòng thử lại."
            );

            return;

        }


        /* =========================
           GHI NHỚ ĐÃ XÁC NHẬN
           ========================= */

        localStorage.setItem(
            `iuh_order_received_${orderId}`,
            "true"
        );


        /* =========================
           THÔNG BÁO
           ========================= */

        alert(
            "✓ Đã xác nhận nhận hàng!\n\n" +
            "Tiền đã được giải ngân vào Ví IUH của người bán."
        );


        /* =========================
           TẢI LẠI DỮ LIỆU
           ========================= */

        await refreshPageData();

    }
    catch (error) {

        console.error(
            "Lỗi xác nhận nhận hàng:",
            error
        );

        alert(
            "Có lỗi xảy ra khi xác nhận nhận hàng."
        );

    }

}


/* =========================================================
   CẬP NHẬT TRẠNG THÁI - DATABASE

   LƯU Ý:
   - Người bán cập nhật "Hoàn tất"
     KHÔNG được giải ngân tiền.
   - Tiền chỉ được giải ngân khi
     người mua xác nhận "Đã nhận được hàng".
   ========================================================= */

async function updateOrderStatus(
    orderId
) {

    const order =
        allOrders.find(
            item =>
                String(
                    item._databaseId
                ) ===
                String(orderId)
        );


    if (!order) {

        alert(
            "Không tìm thấy đơn hàng."
        );

        return;

    }


    const select =
        document.getElementById(
            `status-${orderId}`
        );


    if (!select) {

        return;

    }


    const newStatus =
        select.value;


    const currentIndex =
        STATUS_ORDER.indexOf(
            order._status
        );


    const newIndex =
        STATUS_ORDER.indexOf(
            newStatus
        );


    /* =========================
       KHÔNG CHO QUAY LẠI
       ========================= */

    if (
        newIndex <
        currentIndex
    ) {

        alert(
            "Không thể quay lại trạng thái trước đó."
        );

        return;

    }


    /* =========================
       HOÀN TẤT PHẢI SAU ĐÃ GIAO
       ========================= */

    if (
        newStatus === "completed" &&
        order._status !== "delivered" &&
        order._status !== "completed"
    ) {

        alert(
            "Đơn hàng phải ở trạng thái Đã giao trước khi hoàn tất."
        );

        return;

    }


    /* =========================
       KHÔNG CẬP NHẬT TRÙNG
       ========================= */

    if (
        newStatus ===
        order._status
    ) {

        alert(
            "Đơn hàng đang ở trạng thái này."
        );

        return;

    }


    try {

        /* =========================
           CẬP NHẬT TRẠNG THÁI
           ========================= */

        const {
            error
        } = await db.rpc(
            "update_order_status",
            {
                p_order_id:
                    Number(orderId),

                p_new_status:
                    newStatus
            }
        );


        if (error) {

            console.error(
                "Lỗi cập nhật trạng thái:",
                error
            );

            alert(
                error.message ||
                "Không thể cập nhật trạng thái."
            );

            return;

        }


        /* =================================================
           QUAN TRỌNG:

           KHÔNG GỌI settle_online_order Ở ĐÂY.

           Khi người bán chuyển sang "Hoàn tất",
           chỉ cập nhật trạng thái đơn.

           TIỀN CHƯA ĐƯỢC GIẢI NGÂN.
           ================================================= */


        if (
            newStatus === "completed"
        ) {

            alert(
                "✓ Đã cập nhật đơn hàng thành Hoàn tất.\n\n" +
                "Người mua sẽ xác nhận Đã nhận được hàng " +
                "trước khi tiền được giải ngân vào Ví IUH."
            );

        }
        else {

            alert(
                "✓ Đã cập nhật trạng thái đơn hàng."
            );

        }


        /* =========================
           TẢI LẠI DATABASE
           ========================= */

        await refreshPageData();

    }
    catch (error) {

        console.error(
            error
        );

        alert(
            "Có lỗi xảy ra khi cập nhật đơn hàng."
        );

    }

}

/* =========================================================
   KHỞI ĐỘNG + TẢI ĐƠN HÀNG
   FIX: currentUser + loadOrders + classify + render
========================================================= */

async function refreshPageData() {
    try {
        console.log("IUH SHOP: ===== BẮT ĐẦU TẢI ĐƠN HÀNG =====");

        /* 1. Lấy user đang đăng nhập */
        currentUser = await getCurrentUser();

        console.log(
            "IUH SHOP: currentUser =",
            currentUser?.id || null
        );

        /* Nếu chưa đăng nhập */
        if (!currentUser) {
            allOrders = [];
            purchaseOrders = [];
            saleOrders = [];
            historyOrders = [];

            renderPurchaseOrders();
            renderSaleOrders();
            renderHistory();

            console.log(
                "IUH SHOP: Chưa đăng nhập."
            );

            return;
        }

        /* 2. Lấy đơn từ Database */
        allOrders = await loadOrdersFromDatabase();

        console.log(
            "IUH SHOP: Tổng số đơn lấy được =",
            allOrders.length
        );

        /* 3. Phân loại Đơn mua / Đơn bán */
        classifyOrders();

        console.log(
            "IUH SHOP: Đơn mua =",
            purchaseOrders.length
        );

        console.log(
            "IUH SHOP: Đơn bán =",
            saleOrders.length
        );

        /* 4. Render giao diện */
        renderPurchaseOrders();
        renderSaleOrders();
        renderHistory();

        console.log(
            "IUH SHOP: ===== TẢI ĐƠN HÀNG XONG ====="
        );

    } catch (error) {
        console.error(
            "IUH SHOP: Lỗi refreshPageData:",
            error
        );
    }
}


/* =========================================================
   KHỞI ĐỘNG TRANG ĐƠN HÀNG
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "IUH SHOP: Trang đơn hàng đã sẵn sàng."
        );

        /* Tab Đơn mua / Đơn bán */
        setupTabs();

        /* Bộ lọc Đơn mua */
        const purchaseFilter =
            document.getElementById("purchaseFilter");

        if (purchaseFilter) {
            purchaseFilter.addEventListener(
                "change",
                function () {
                    renderPurchaseOrders();
                }
            );
        }

        /* Bộ lọc Đơn bán */
        const saleFilter =
            document.getElementById("saleFilter");

        if (saleFilter) {
            saleFilter.addEventListener(
                "change",
                function () {
                    renderSaleOrders();
                }
            );
        }

        /* TẢI ĐƠN */
        await refreshPageData();
    }
);


/* =========================================================
   TỰ ĐỘNG TẢI LẠI KHI ĐĂNG NHẬP / ĐĂNG XUẤT
========================================================= */

supabaseClient.auth.onAuthStateChange(
    async function (event, session) {

        console.log(
            "IUH SHOP: Auth event =",
            event
        );

        if (
            event === "SIGNED_IN" ||
            event === "INITIAL_SESSION" ||
            event === "SIGNED_OUT" ||
            event === "TOKEN_REFRESHED"
        ) {
            /* Đợi Supabase ổn định session */
            setTimeout(
                async function () {
                    await refreshPageData();
                },
                100
            );
        }
    }
);