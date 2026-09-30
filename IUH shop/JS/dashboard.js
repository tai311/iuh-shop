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
   IUH SHOP - DASHBOARD
   PHẦN TỪ DÒNG 567 TRỞ XUỐNG
===================================================== */


/* =====================================================
   CẤU HÌNH PHÍ
===================================================== */

// Phí sàn: 5% trên TIỀN HÀNG của 1 đơn
const PLATFORM_FEE_RATE = 0.05;

// Phí chậm thanh toán: 0,1% / ngày
const DAILY_LATE_RATE = 0.001;

// Thời hạn thanh toán phí COD
const PAYMENT_DEADLINE_DAYS = 7;

// Phí qua trung gian
const INTERMEDIARY_SHIPPING_FEE = 5000;


/* =====================================================
   BIẾN DÙNG CHUNG
===================================================== */

let dashboardUser = null;
let dashboardProfile = null;

let orders = [];
let wallet = null;
let walletTransactions = [];

let revenueChart = null;

let currentPaymentOrderId = null;


/* =====================================================
   USER HIỆN TẠI
===================================================== */

async function loadDashboardUser() {

    try {

        const {
            data: {
                user
            },
            error: userError
        } = await supabaseClient.auth.getUser();


        if (userError) {

            console.error(
                "Không lấy được tài khoản:",
                userError
            );

            return null;
        }


        if (!user) {

            dashboardUser = null;
            dashboardProfile = null;

            return null;
        }


        dashboardUser = user;


        const {
            data: profile,
            error: profileError
        } = await supabaseClient
            .from("users")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();


        if (profileError) {

            console.error(
                "Không lấy được thông tin người dùng:",
                profileError
            );
        }


        dashboardProfile =
            profile || null;


        return user;

    }
    catch (error) {

        console.error(
            "Lỗi load user:",
            error
        );

        return null;
    }
}


/* =====================================================
   KIỂM TRA ADMIN
===================================================== */

function isPrivilegedAccount() {

    const role =
        String(
            dashboardProfile?.role ||
            dashboardUser?.user_metadata?.role ||
            ""
        )
        .toLowerCase()
        .trim();


    return (
        role === "admin" ||
        role === "administrator" ||
        role === "quản trị viên" ||
        role === "quan tri vien"
    );
}


/* =====================================================
   TRẠNG THÁI ĐƠN
===================================================== */

function normalizeStatus(order) {

    return String(
        order?.status ||
        order?.order_status ||
        ""
    )
    .toLowerCase()
    .trim();
}


function isCompleted(order) {

    const status =
        normalizeStatus(order);


    return (
        status === "completed" ||
        status === "delivered" ||
        status === "hoàn thành" ||
        status === "hoan thanh" ||
        status === "đã giao" ||
        status === "da giao"
    );
}


function isCancelled(order) {

    const status =
        normalizeStatus(order);


    return (
        status === "cancelled" ||
        status === "canceled" ||
        status === "hủy" ||
        status === "huy" ||
        status === "đã hủy" ||
        status === "da huy"
    );
}


/* =====================================================
   PHƯƠNG THỨC THANH TOÁN
===================================================== */

function getPaymentMethod(order) {

    return String(
        order?.payment_method ||
        order?.paymentMethod ||
        order?.payment ||
        ""
    )
    .toLowerCase()
    .trim();
}


function isCOD(order) {

    const method =
        getPaymentMethod(order);


    return (
        method === "cod" ||
        method.includes("cod") ||
        method.includes("cash") ||
        method.includes("tiền mặt") ||
        method.includes("tien mat") ||
        method.includes("nhận hàng") ||
        method.includes("nhan hang")
    );
}


function isOnlinePayment(order) {

    const method =
        getPaymentMethod(order);


    return (
        method === "qr" ||
        method === "iuh_wallet" ||
        method === "wallet" ||
        method.includes("qr") ||
        method.includes("wallet") ||
        method.includes("online") ||
        method.includes("ví") ||
        method.includes("vi")
    );
}


/* =====================================================
   MÃ ĐƠN
===================================================== */

function getOrderId(order) {

    return (
        order?.id ??
        order?.order_id ??
        order?.orderId ??
        null
    );
}


function getOrderCode(order) {

    return (
        order?.order_code ||
        order?.orderCode ||
        `#${getOrderId(order) || ""}`
    );
}


/* =====================================================
   LẤY ITEMS
===================================================== */

function getOrderItems(order) {

    if (
        Array.isArray(
            order?.order_items
        )
    ) {
        return order.order_items;
    }


    if (
        Array.isArray(
            order?.items
        )
    ) {
        return order.items;
    }


    return [];
}


/* =====================================================
   LẤY ITEM CỦA SELLER HIỆN TẠI
===================================================== */

function getSellerItems(order) {

    if (!dashboardUser) {
        return [];
    }


    const items =
        getOrderItems(order);


    return items.filter(
        item =>
            String(
                item?.seller_id ??
                item?.sellerId ??
                ""
            )
            ===
            String(
                dashboardUser.id
            )
    );
}


/* =====================================================
   TIỀN HÀNG CỦA 1 ITEM
===================================================== */

function getItemSubtotal(item) {

    const subtotal =
        Number(
            item?.subtotal ??
            (
                Number(
                    item?.price || 0
                ) *
                Number(
                    item?.quantity || 0
                )
            )
        );


    return Number.isFinite(
        subtotal
    )
        ? subtotal
        : 0;
}


/* =====================================================
   TỔNG TIỀN HÀNG CỦA ĐƠN
===================================================== */

function getOrderProductTotal(order) {

    const items =
        getOrderItems(order);


    if (
        items.length > 0
    ) {

        return items.reduce(
            (
                total,
                item
            ) => {

                return (
                    total +
                    getItemSubtotal(
                        item
                    )
                );

            },
            0
        );
    }


    return Number(
        order?.subtotal ||
        order?.product_total ||
        order?.productTotal ||
        order?.sellerPrice ||
        order?.productPrice ||
        order?.price ||
        0
    );
}


/* =====================================================
   TỔNG TIỀN HÀNG CỦA SELLER
===================================================== */

function getSellerProductTotal(order) {

    const sellerItems =
        getSellerItems(order);


    /*
        Nếu xác định được seller_id
        thì chỉ tính phần hàng của seller.
    */

    if (
        sellerItems.length > 0
    ) {

        return sellerItems.reduce(
            (
                total,
                item
            ) => {

                return (
                    total +
                    getItemSubtotal(
                        item
                    )
                );

            },
            0
        );
    }


    /*
        Fallback cho dữ liệu đơn cũ.
    */

    return getOrderProductTotal(
        order
    );
}


/* =====================================================
   PHÍ TRUNG GIAN / SHIP
===================================================== */

function getShippingFee(order) {

    /*
        Lấy trực tiếp shipping_fee
        từ bảng orders.
    */

    const dbShippingFee =
        Number(
            order?.shipping_fee ??
            order?.shippingFee ??
            0
        );


    if (
        Number.isFinite(
            dbShippingFee
        ) &&
        dbShippingFee > 0
    ) {

        return dbShippingFee;
    }


    /*
        Fallback:

        Nếu đơn có shipping method
        là qua trung gian → 5.000đ.

        Gặp trực tiếp → 0đ.
    */

    const method =
        String(
            order?.shipping_method ||
            order?.shippingMethod ||
            ""
        )
        .toLowerCase()
        .trim();


    if (
        method.includes("trung gian") ||
        method.includes("trung_gian") ||
        method.includes("intermediary") ||
        method.includes("shipping") ||
        method.includes("delivery")
    ) {

        return INTERMEDIARY_SHIPPING_FEE;
    }


    return 0;
}


/* =====================================================
   TIỀN KHÁCH PHẢI TRẢ
===================================================== */

function getCustomerTotal(order) {

    /*
        Ưu tiên total_amount từ DB.
    */

    if (
        order?.total_amount !== undefined &&
        order?.total_amount !== null
    ) {

        return Number(
            order.total_amount
        );
    }


    /*
        Fallback:
        tiền hàng + phí trung gian.
    */

    return (
        getOrderProductTotal(order) +
        getShippingFee(order)
    );
}


/* =====================================================
   PHÍ SÀN 5%
===================================================== */

function calculatePlatformFee(order) {

    if (
        isPrivilegedAccount()
    ) {
        return 0;
    }


    /*
        QUAN TRỌNG:

        Phí sàn chỉ tính trên TIỀN HÀNG.

        Không tính:
        - phí ship
        - phí trung gian
    */

    const sellerProductTotal =
        getSellerProductTotal(
            order
        );


    return (
        sellerProductTotal *
        PLATFORM_FEE_RATE
    );
}


/* =====================================================
   TIỀN SELLER NHẬN
===================================================== */

function calculateSellerReceive(order) {

    const sellerProductTotal =
        getSellerProductTotal(
            order
        );

    /*
        ONLINE:
        Người mua đã thanh toán phí sàn
        cùng với tiền hàng.

        Vì vậy người bán nhận đủ
        100% giá người bán đặt.
    */

    if (
        isOnlinePayment(order)
    ) {

        return sellerProductTotal;
    }

    /*
        COD:
        Người bán nhận đủ tiền hàng
        từ khách.

        Phí sàn thanh toán riêng.
    */

    return sellerProductTotal;
}


/* =====================================================
   NGÀY HOÀN THÀNH
===================================================== */

function getCompletedDate(order) {

    return (
        order?.completed_at ||
        order?.completedAt ||
        order?.completed_date ||
        order?.completedDate ||
        order?.updated_at ||
        order?.updatedAt ||
        order?.created_at ||
        order?.createdAt ||
        null
    );
}


/* =====================================================
   SỐ NGÀY QUÁ HẠN
===================================================== */

function calculateOverdueDays(
    completedDate
) {

    if (!completedDate) {
        return 0;
    }


    const completed =
        new Date(
            completedDate
        );


    if (
        Number.isNaN(
            completed.getTime()
        )
    ) {
        return 0;
    }


    const deadline =
        new Date(
            completed
        );


    deadline.setDate(
        deadline.getDate() +
        PAYMENT_DEADLINE_DAYS
    );


    const now =
        new Date();


    if (
        now <= deadline
    ) {
        return 0;
    }


    const difference =
        now.getTime() -
        deadline.getTime();


    return Math.floor(
        difference /
        (
            1000 *
            60 *
            60 *
            24
        )
    );
}


/* =====================================================
   PHÍ CHẬM
===================================================== */

function calculateFeeWithLateCharge(
    baseFee,
    overdueDays
) {

    if (
        baseFee <= 0 ||
        overdueDays <= 0
    ) {

        return baseFee;
    }


    /*
        0,1% / ngày trên phí gốc.

        Ví dụ:
        Phí sàn = 10.000đ
        Trễ 5 ngày

        10.000 × 0,1% × 5
        = 50đ

        Tổng = 10.050đ
    */

    return (
        baseFee +
        (
            baseFee *
            DAILY_LATE_RATE *
            overdueDays
        )
    );
}


/* =====================================================
   KIỂM TRA PHÍ ĐÃ THANH TOÁN
===================================================== */

function isFeePaid(order) {

    /*
        Online:
        phí được hệ thống tự động tách
        ngay lúc thanh toán.
    */

    if (
        isOnlinePayment(order)
    ) {

        return true;
    }


    const orderCode =
        String(
            getOrderCode(order)
        )
        .toLowerCase();


    const orderId =
        String(
            getOrderId(order)
        );


    /*
        COD:
        tìm transaction phí.

        Cho phép cả type = fee
        và payment nếu RPC hiện tại
        đang dùng pay_iuh_wallet().
    */

    return walletTransactions.some(
        transaction => {

            const description =
                String(
                    transaction?.description ||
                    ""
                )
                .toLowerCase();


            const title =
                String(
                    transaction?.title ||
                    ""
                )
                .toLowerCase();


            const type =
                String(
                    transaction?.type ||
                    ""
                )
                .toLowerCase();


            const isFeeTransaction =
                (
                    type === "fee"
                )
                ||
                (
                    type === "payment" &&
                    description.includes(
                        "thanh toán phí sàn"
                    )
                )
                ||
                (
                    title.includes(
                        "phí sàn"
                    )
                )
                ||
                (
                    title.includes(
                        "phi san"
                    )
                );


            if (
                !isFeeTransaction
            ) {
                return false;
            }


            return (
                description.includes(
                    orderCode
                )
                ||
                description.includes(
                    orderId
                )
            );
        }
    );
}


/* =====================================================
   LOAD WALLET
===================================================== */

async function loadWallet() {

    if (!dashboardUser) {

        wallet = null;
        walletTransactions = [];

        return;
    }


    try {

        /*
            Đảm bảo Wallet tồn tại.
        */

        await supabaseClient
            .rpc(
                "ensure_iuh_wallet"
            );


        /*
            Lấy Wallet.
        */

        const {
            data: walletData,
            error: walletError
        } =
            await supabaseClient
                .from(
                    "iuh_wallets"
                )
                .select("*")
                .eq(
                    "user_id",
                    dashboardUser.id
                )
                .maybeSingle();


        if (walletError) {

            console.error(
                "Lỗi lấy Wallet:",
                walletError
            );

            wallet = null;

        }
        else {

            wallet =
                walletData || null;
        }


        /*
            Lấy giao dịch.
        */

        const {
            data: transactions,
            error: transactionError
        } =
            await supabaseClient
                .from(
                    "wallet_transactions"
                )
                .select("*")
                .eq(
                    "user_id",
                    dashboardUser.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(200);


        if (transactionError) {

            console.error(
                "Lỗi lấy giao dịch:",
                transactionError
            );

            walletTransactions = [];

        }
        else {

            walletTransactions =
                Array.isArray(
                    transactions
                )
                    ? transactions
                    : [];
        }

    }
    catch (error) {

        console.error(
            "Lỗi load Wallet:",
            error
        );

        wallet = null;
        walletTransactions = [];
    }
}


/* =====================================================
   KIỂM TRA ĐƠN CÓ LIÊN QUAN USER
===================================================== */

function isOrderRelevant(order) {

    if (!dashboardUser) {
        return false;
    }


    /*
        Người mua.
    */

    if (
        String(
            order?.buyer_id ??
            order?.buyerId ??
            ""
        )
        ===
        String(
            dashboardUser.id
        )
    ) {

        return true;
    }


    /*
        Người bán.
    */

    return getOrderItems(
        order
    )
    .some(
        item =>
            String(
                item?.seller_id ??
                item?.sellerId ??
                ""
            )
            ===
            String(
                dashboardUser.id
            )
    );
}


/* =====================================================
   LOAD ORDERS
===================================================== */

async function loadOrders() {

    if (!dashboardUser) {

        orders = [];

        return;
    }


    try {

        /*
            Ưu tiên RPC để tránh lỗi RLS
            khi orders và order_items
            tham chiếu lẫn nhau.
        */

        const {
            data,
            error
        } =
            await supabaseClient
                .rpc(
                    "get_my_orders"
                );


        if (
            !error &&
            Array.isArray(data)
        ) {

            orders =
                data.filter(
                    isOrderRelevant
                );

            return;
        }


        /*
            Fallback nếu RPC chưa có.
        */

        const {
            data: directOrders,
            error: directError
        } =
            await supabaseClient
                .from("orders")
                .select(`
                    *,
                    order_items (
                        id,
                        order_id,
                        product_id,
                        seller_id,
                        product_name,
                        product_image,
                        price,
                        quantity,
                        subtotal,
                        created_at
                    )
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (directError) {

            console.error(
                "Lỗi lấy đơn hàng:",
                directError
            );

            orders = [];

            return;
        }


        orders =
            (
                Array.isArray(
                    directOrders
                )
                    ? directOrders
                    : []
            )
            .filter(
                isOrderRelevant
            );

    }
    catch (error) {

        console.error(
            "Lỗi load orders:",
            error
        );

        orders = [];
    }
}


/* =====================================================
   TÍNH DỮ LIỆU DASHBOARD
===================================================== */

function calculateDashboard() {

    const relevantOrders =
        orders.filter(
            isOrderRelevant
        );


    /*
        Chỉ đơn hoàn thành
        mới tính doanh thu/phí.
    */

    const completedOrders =
        relevantOrders.filter(
            order =>
                isCompleted(order) &&
                !isCancelled(order)
        );


    /*
        =================================================
        DOANH THU SELLER
        =================================================
    */

    const revenue =
        completedOrders.reduce(
            (
                total,
                order
            ) => {

                const sellerItems =
                    getSellerItems(
                        order
                    );


                if (
                    sellerItems.length === 0
                ) {

                    return total;
                }


                return (
                    total +
                    calculateSellerReceive(
                        order
                    )
                );

            },
            0
        );


    /*
        =================================================
        PHÍ
        =================================================
    */

    let totalFee = 0;
    let outstandingFee = 0;

    const feeItems = [];


    if (
        !isPrivilegedAccount()
    ) {

        completedOrders.forEach(
            order => {

                const sellerItems =
                    getSellerItems(
                        order
                    );


                if (
                    sellerItems.length === 0
                ) {

                    return;
                }


                /*
                    Tiền hàng của seller.
                */

                const sellerProductTotal =
                    sellerItems.reduce(
                        (
                            total,
                            item
                        ) => {

                            return (
                                total +
                                getItemSubtotal(
                                    item
                                )
                            );

                        },
                        0
                    );


                /*
                    Phí sàn 5%.
                */

                const baseFee =
                    sellerProductTotal *
                    PLATFORM_FEE_RATE;


                if (
                    baseFee <= 0
                ) {

                    return;
                }


                /*
                    Phí trung gian/ship.
                */

                const shippingFee =
                    getShippingFee(
                        order
                    );


                /*
                    Tổng khách trả.
                */

                const customerTotal =
                    getCustomerTotal(
                        order
                    );


                /*
                    =================================================
                    ONLINE
                    =================================================
                */

                if (
                    isOnlinePayment(
                        order
                    )
                ) {

                    /*
                        Phí online đã được
                        tự động tách khi thanh toán.
                    */


                    feeItems.push({

                        id:
                            getOrderId(
                                order
                            ),

                        orderCode:
                            getOrderCode(
                                order
                            ),

                        product:
                            getOrderProductNames(
                                order
                            ),

                        productTotal:
                            sellerProductTotal,

                        shippingFee,

                        customerTotal,

                        baseFee,

                        finalFee:
                            baseFee,

                        overdueDays: 0,

                        paymentMethod:
                            getPaymentMethod(
                                order
                            ),

                        paid: true,

                        autoPaid: true,

                        completedDate:
                            getCompletedDate(
                                order
                            )
                    });


                    return;
                }


                /*
                    =================================================
                    COD
                    =================================================
                */

                if (
                    isCOD(order)
                ) {

                    const overdueDays =
                        calculateOverdueDays(
                            getCompletedDate(
                                order
                            )
                        );


                    const finalFee =
    calculateFeeWithLateCharge(
        baseFee,
        overdueDays
    );


const paid =
    isFeePaid(
        order
    );


/*
    Chỉ tính vào Chi phí
    nếu CHƯA thanh toán.
*/
if (!paid) {

    totalFee +=
        finalFee;

    outstandingFee +=
        finalFee;
}

                    feeItems.push({

                        id:
                            getOrderId(
                                order
                            ),

                        orderCode:
                            getOrderCode(
                                order
                            ),

                        product:
                            getOrderProductNames(
                                order
                            ),

                        productTotal:
                            sellerProductTotal,

                        shippingFee,

                        customerTotal,

                        baseFee,

                        finalFee,

                        overdueDays,

                        paymentMethod:
                            "COD",

                        paid,

                        autoPaid: false,

                        completedDate:
                            getCompletedDate(
                                order
                            )
                    });
                }

            }
        );
    }


    return {

        revenue,

        totalOrders:
            relevantOrders.length,

        completedOrders:
            completedOrders.length,

        processingOrders:
            relevantOrders.filter(
                order =>
                    !isCompleted(order) &&
                    !isCancelled(order)
            ).length,

        totalFee,

        outstandingFee,

        walletBalance:
            Number(
                wallet?.balance || 0
            ),

        feeItems
    };
}


/* =====================================================
   TÊN SẢN PHẨM
===================================================== */

function getOrderProductNames(order) {

    const items =
        getSellerItems(
            order
        );


    if (
        items.length === 0
    ) {

        return (
            order?.product_name ||
            order?.productName ||
            "Đơn hàng"
        );
    }


    const names =
        items
            .map(
                item =>
                    item?.product_name ||
                    item?.productName ||
                    "Sản phẩm"
            )
            .filter(Boolean);


    return [
        ...new Set(
            names
        )
    ].join(", ");
}


/* =====================================================
   FORMAT TIỀN
===================================================== */

function formatMoney(value) {

    const amount =
        Number(
            value || 0
        );


    return (
        Math.round(
            amount
        )
        .toLocaleString(
            "vi-VN"
        ) +
        "đ"
    );
}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHtml(value) {

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
   ANIMATION SỐ
===================================================== */

function animateNumber(
    element,
    target,
    duration = 800,
    formatter = formatMoney
) {

    if (!element) {
        return;
    }


    const startTime =
        performance.now();


    function update(
        currentTime
    ) {

        const progress =
            Math.min(
                (
                    currentTime -
                    startTime
                ) /
                duration,
                1
            );


        const eased =
            1 -
            Math.pow(
                1 - progress,
                3
            );


        const value =
            target *
            eased;


        element.textContent =
            formatter(
                value
            );


        if (
            progress < 1
        ) {

            requestAnimationFrame(
                update
            );
        }
    }


    requestAnimationFrame(
        update
    );
}


/* =====================================================
   RENDER STATS
===================================================== */

function renderStats() {

    const data =
        calculateDashboard();


    animateNumber(
        document.getElementById(
            "totalRevenue"
        ),
        data.revenue
    );


    animateNumber(
        document.getElementById(
            "totalFee"
        ),
        data.totalFee
    );


    animateNumber(
        document.getElementById(
            "totalOrders"
        ),
        data.totalOrders,
        700,
        value =>
            Math.round(
                value
            )
            .toLocaleString(
                "vi-VN"
            )
    );


    animateNumber(
        document.getElementById(
            "completedOrders"
        ),
        data.completedOrders,
        700,
        value =>
            Math.round(
                value
            )
            .toLocaleString(
                "vi-VN"
            )
    );


    const processingElement =
        document.getElementById(
            "processingOrders"
        );


    if (
        processingElement
    ) {

        processingElement.textContent =
            data.processingOrders
                .toLocaleString(
                    "vi-VN"
                );
    }


    const walletElement =
        document.getElementById(
            "walletBalance"
        );


    if (
        walletElement
    ) {

        walletElement.textContent =
            formatMoney(
                data.walletBalance
            );
    }


    const outstandingElement =
        document.getElementById(
            "outstandingFee"
        );


    if (
        outstandingElement
    ) {

        outstandingElement.textContent =
            formatMoney(
                data.outstandingFee
            );
    }


    const debtStatus =
        document.getElementById(
            "debtStatus"
        );


    if (
        debtStatus
    ) {

        if (
            isPrivilegedAccount()
        ) {

            debtStatus.textContent =
                "Tài khoản quản trị · Không phát sinh phí";
        }

        else if (
            data.outstandingFee > 0
        ) {

            debtStatus.textContent =
                "Có khoản phí cần thanh toán";
        }

        else {

            debtStatus.textContent =
                "Không có khoản phí cần thanh toán";
        }
    }


    const feeDescription =
        document.getElementById(
            "feeDescription"
        );


    if (
        feeDescription
    ) {

        feeDescription.textContent =
            "Phí sàn 5% trên tiền hàng mỗi đơn. Phí qua trung gian 5.000đ do người mua thanh toán.";
    }
}


/* =====================================================
   RENDER PHÍ
===================================================== */

function renderFees() {

    const container =
        document.getElementById(
            "feeList"
        );


    if (!container) {
        return;
    }


    const data =
        calculateDashboard();


    /*
        ADMIN
    */

    if (
        isPrivilegedAccount()
    ) {

        container.innerHTML = `

            <div class="fee-item">

                <div class="fee-top">

                    <strong>
                        Tài khoản quản trị
                    </strong>

                    <span
                        class="fee-amount"
                        style="color:#35845c"
                    >
                        0đ
                    </span>

                </div>

                <div class="fee-detail">

                    Admin không phát sinh
                    phí sàn.

                </div>

            </div>

        `;

        return;
    }


    /*
        CHƯA CÓ PHÍ
    */

    if (
        data.feeItems.length === 0
    ) {

        container.innerHTML = `

            <div class="fee-item">

                <strong>
                    Chưa có khoản phí nào
                </strong>

                <div class="fee-detail">

                    Phí sàn sẽ xuất hiện
                    sau khi đơn hàng hoàn thành.

                </div>

            </div>

        `;

        return;
    }


    /*
        DANH SÁCH PHÍ
    */

    container.innerHTML =
        data.feeItems
            .map(
                item => {

                    /*
                        ONLINE
                    */

                    if (
                        item.autoPaid
                    ) {

                        return `

                            <div class="fee-item">

                                <div class="fee-top">

                                    <strong>
                                        ${escapeHtml(
                                            item.orderCode
                                        )}
                                    </strong>

                                    <span
                                        class="fee-amount"
                                        style="color:#35845c"
                                    >
                                        ${formatMoney(
                                            item.finalFee
                                        )}
                                    </span>

                                </div>


                                <div class="fee-detail">

                                    ${escapeHtml(
                                        item.product
                                    )}

                                    <br>

                                    Tiền hàng:
                                    ${formatMoney(
                                        item.productTotal
                                    )}

                                    <br>

                                    Phí trung gian:
                                    ${formatMoney(
                                        item.shippingFee
                                    )}

                                    <br>

                                    Tổng khách trả:
                                    ${formatMoney(
                                        item.customerTotal
                                    )}

                                    <br>

                                    Phí sàn 5%:
                                    ${formatMoney(
                                        item.baseFee
                                    )}

                                </div>


                                <div
                                    style="
                                        margin-top:10px;
                                        color:#35845c;
                                        font-weight:600;
                                    "
                                >
                                    ✓ Đã tự động khấu trừ khi thanh toán online
                                </div>

                            </div>

                        `;
                    }


                    /*
                        COD
                    */

                    const lateFee =
                        Math.max(
                            0,
                            item.finalFee -
                            item.baseFee
                        );


                    return `

                        <div
                            class="
                                fee-item
                                ${
                                    item.overdueDays > 0
                                        ? "overdue"
                                        : ""
                                }
                            "
                        >

                            <div class="fee-top">

                                <strong>
                                    ${escapeHtml(
                                        item.orderCode
                                    )}
                                </strong>

                                <span
                                    class="fee-amount"
                                >
                                    ${formatMoney(
                                        item.finalFee
                                    )}
                                </span>

                            </div>


                            <div class="fee-detail">

                                ${escapeHtml(
                                    item.product
                                )}

                                <br>

                                Tiền hàng:
                                ${formatMoney(
                                    item.productTotal
                                )}

                                <br>

                                Phí trung gian:
                                ${formatMoney(
                                    item.shippingFee
                                )}

                                <br>

                                Tổng khách trả:
                                ${formatMoney(
                                    item.customerTotal
                                )}

                                <br>

                                Phí sàn 5%:
                                ${formatMoney(
                                    item.baseFee
                                )}

                                ${
                                    item.overdueDays > 0

                                    ?

                                    `
                                        <br>

                                        Quá hạn:
                                        ${item.overdueDays}
                                        ngày

                                        <br>

                                        Phí chậm:
                                        ${formatMoney(
                                            lateFee
                                        )}
                                    `

                                    :

                                    `
                                        <br>

                                        Hạn thanh toán:
                                        ${PAYMENT_DEADLINE_DAYS}
                                        ngày
                                    `
                                }

                            </div>


                            ${
                                item.paid

                                ?

                                `
                                    <div
                                        style="
                                            margin-top:10px;
                                            color:#35845c;
                                            font-weight:600;
                                        "
                                    >
                                        ✓ Đã thanh toán phí
                                    </div>
                                `

                                :

                                `
                                    <button
                                        class="pay-fee-button"
                                        onclick="
                                            payPlatformFee(
                                                '${String(
                                                    item.id
                                                )}'
                                            )
                                        "
                                    >
                                        Thanh toán phí
                                    </button>
                                `
                            }

                        </div>

                    `;
                }
            )
            .join("");
}


/* =====================================================
   THANH TOÁN PHÍ COD
===================================================== */

async function payPlatformFee(
    orderId
) {

    if (!dashboardUser) {

        alert(
            "Vui lòng đăng nhập."
        );

        return;
    }


    const order =
        orders.find(
            item =>
                String(
                    getOrderId(
                        item
                    )
                )
                ===
                String(
                    orderId
                )
        );


    if (!order) {

        alert(
            "Không tìm thấy đơn hàng."
        );

        return;
    }


    if (
        !isCOD(order)
    ) {

        alert(
            "Đơn này không phải COD."
        );

        return;
    }


    if (
        isFeePaid(order)
    ) {

        alert(
            "Khoản phí của đơn này đã được thanh toán."
        );

        return;
    }


    const sellerProductTotal =
        getSellerProductTotal(
            order
        );


    const baseFee =
        sellerProductTotal *
        PLATFORM_FEE_RATE;


    const overdueDays =
        calculateOverdueDays(
            getCompletedDate(
                order
            )
        );


    const finalFee =
        calculateFeeWithLateCharge(
            baseFee,
            overdueDays
        );


    currentPaymentOrderId =
        orderId;


    const amountElement =
        document.getElementById(
            "paymentAmount"
        );


    if (
        amountElement
    ) {

        amountElement.textContent =
            formatMoney(
                finalFee
            );
    }


    const transactionElement =
        document.getElementById(
            "paymentTransaction"
        );


    if (
        transactionElement
    ) {

        transactionElement.textContent =
            generateTransactionCode();
    }


    const modal =
        document.getElementById(
            "paymentModal"
        );


    if (
        modal
    ) {

        modal.classList.add(
            "active"
        );

        document.body.style.overflow =
            "hidden";
    }
}


/* =====================================================
   MÃ GIAO DỊCH
===================================================== */

function generateTransactionCode() {

    return (
        "IUH" +
        Date.now()
            .toString()
            .slice(-8) +
        Math.floor(
            1000 +
            Math.random() *
            9000
        )
    );
}


/* =====================================================
   ĐÓNG MODAL
===================================================== */

function closePaymentModal() {

    const modal =
        document.getElementById(
            "paymentModal"
        );


    if (
        modal
    ) {

        modal.classList.remove(
            "active"
        );
    }


    document.body.style.overflow =
        "";


    currentPaymentOrderId =
        null;
}


/* =====================================================
   XÁC NHẬN THANH TOÁN PHÍ
===================================================== */

async function confirmPayment() {

    if (
        currentPaymentOrderId === null
    ) {

        return;
    }


    if (!dashboardUser) {

        alert(
            "Vui lòng đăng nhập."
        );

        return;
    }


    const order =
        orders.find(
            item =>
                String(
                    getOrderId(
                        item
                    )
                )
                ===
                String(
                    currentPaymentOrderId
                )
        );


    if (!order) {

        alert(
            "Không tìm thấy đơn hàng."
        );

        return;
    }


    if (
        !isCOD(order)
    ) {

        alert(
            "Chỉ đơn COD mới cần thanh toán phí."
        );

        return;
    }


    const sellerProductTotal =
        getSellerProductTotal(
            order
        );


    const baseFee =
        sellerProductTotal *
        PLATFORM_FEE_RATE;


    const overdueDays =
        calculateOverdueDays(
            getCompletedDate(
                order
            )
        );


    const finalFee =
        calculateFeeWithLateCharge(
            baseFee,
            overdueDays
        );


    try {

        /*
            Trừ tiền từ IUH Wallet.

            Không dùng localStorage.
        */

        const {
            data,
            error
        } =
            await supabaseClient
                .rpc(
                    "pay_platform_fee",
                    {

                        p_amount:
                            finalFee,

                        p_description:
                            `Thanh toán phí sàn đơn ${getOrderCode(order)}`
                    }
                );


        if (error) {

            console.error(
                "Lỗi thanh toán phí:",
                error
            );


            alert(
                error.message ||
                "Thanh toán phí thất bại."
            );

            return;
        }


        closePaymentModal();


        alert(
            "✓ Thanh toán phí thành công!\n\n" +
            `Đơn: ${getOrderCode(order)}\n` +
            `Phí: ${formatMoney(finalFee)}`
        );


        await refreshDashboard();

    }
    catch (error) {

        console.error(
            "Lỗi thanh toán phí:",
            error
        );


        alert(
            "Có lỗi xảy ra khi thanh toán phí."
        );
    }
}


/* =====================================================
   RENDER ĐƠN GẦN ĐÂY
===================================================== */

function renderOrders() {

    const container =
        document.getElementById(
            "recentOrders"
        );


    if (!container) {
        return;
    }


    const recent =
        [...orders]
            .sort(
                (
                    a,
                    b
                ) => {

                    return (
                        new Date(
                            b?.created_at ||
                            b?.createdAt ||
                            0
                        ) -
                        new Date(
                            a?.created_at ||
                            a?.createdAt ||
                            0
                        )
                    );
                }
            )
            .slice(
                0,
                5
            );


    if (
        recent.length === 0
    ) {

        container.innerHTML = `

            <div class="order-item">

                <div class="order-info">

                    <strong>
                        Chưa có đơn hàng
                    </strong>

                    <span>
                        Các đơn hàng sẽ xuất hiện tại đây.
                    </span>

                </div>

            </div>

        `;

        return;
    }


    container.innerHTML =
        recent
            .map(
                order => {

                    const sellerItems =
                        getSellerItems(
                            order
                        );


                    const items =
                        sellerItems.length > 0
                            ? sellerItems
                            : getOrderItems(
                                order
                            );


                    const total =
                        items.reduce(
                            (
                                sum,
                                item
                            ) => {

                                return (
                                    sum +
                                    getItemSubtotal(
                                        item
                                    )
                                );

                            },
                            0
                        );


                    const productName =
                        items.length > 0
                            ? (
                                items[0]
                                    ?.product_name ||
                                items[0]
                                    ?.productName ||
                                "Sản phẩm"
                            )
                            : "Đơn hàng";


                    return `

                        <div class="order-item">

                            <div class="order-info">

                                <strong>
                                    ${escapeHtml(
                                        productName
                                    )}
                                </strong>

                                <span>

                                    ${escapeHtml(
                                        getOrderCode(
                                            order
                                        )
                                    )}

                                    ·

                                    ${escapeHtml(
                                        order?.status ||
                                        "Đang xử lý"
                                    )}

                                </span>

                            </div>


                            <div class="order-price">

                                ${formatMoney(
                                    total
                                )}

                            </div>

                        </div>

                    `;
                }
            )
            .join("");
}


/* =====================================================
   CHART DOANH THU
===================================================== */

function renderChart() {

    const canvas =
        document.getElementById(
            "revenueChart"
        );


    if (!canvas) {
        return;
    }


    const ctx =
        canvas.getContext(
            "2d"
        );


    const monthlyRevenue =
        Array(
            12
        )
        .fill(0);


    orders.forEach(
        order => {

            if (
                !isCompleted(order) ||
                isCancelled(order)
            ) {

                return;
            }


            const sellerItems =
                getSellerItems(
                    order
                );


            if (
                sellerItems.length === 0
            ) {

                return;
            }


            const date =
                new Date(
                    getCompletedDate(
                        order
                    )
                );


            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {

                return;
            }


            monthlyRevenue[
                date.getMonth()
            ] +=
                calculateSellerReceive(
                    order
                );
        }
    );


    const labels = [

        "T1",
        "T2",
        "T3",
        "T4",
        "T5",
        "T6",
        "T7",
        "T8",
        "T9",
        "T10",
        "T11",
        "T12"

    ];


    if (
        revenueChart
    ) {

        revenueChart.destroy();

        revenueChart =
            null;
    }


    revenueChart =
        new Chart(
            ctx,
            {

                type:
                    "bar",

                data: {

                    labels,

                    datasets: [

                        {

                            label:
                                "Doanh thu",

                            data:
                                monthlyRevenue,

                            borderRadius:
                                8,

                            backgroundColor:
                                "#29499c"
                        }

                    ]
                },


                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            display:
                                false
                        }
                    },


                    scales: {

                        y: {

                            beginAtZero:
                                true,

                            ticks: {

                                callback:
                                    function(
                                        value
                                    ) {

                                        return (
                                            Number(
                                                value
                                            )
                                            .toLocaleString(
                                                "vi-VN"
                                            ) +
                                            "đ"
                                        );
                                    }
                            }
                        }
                    }
                }
            }
        );
}


/* =====================================================
   NGÀY
===================================================== */

function renderDate() {

    const element =
        document.getElementById(
            "dashboardDate"
        );


    if (!element) {
        return;
    }


    element.textContent =
        new Date()
            .toLocaleDateString(
                "vi-VN",
                {

                    day:
                        "2-digit",

                    month:
                        "2-digit",

                    year:
                        "numeric"
                }
            );
}


/* =====================================================
   REFRESH
===================================================== */

async function refreshDashboard() {

    try {

        await loadDashboardUser();


        if (!dashboardUser) {

            orders = [];

            wallet = null;

            walletTransactions = [];

            renderStats();

            renderFees();

            renderOrders();

            renderChart();

            renderDate();

            return;
        }


        await Promise.all([
            loadOrders(),
            loadWallet()
        ]);


        renderStats();

        renderFees();

        renderOrders();

        renderChart();

        renderDate();

    }
    catch (error) {

        console.error(
            "Lỗi refresh dashboard:",
            error
        );
    }
}


/* =====================================================
   TỰ ĐỘNG CẬP NHẬT
===================================================== */

let dashboardRefreshTimer = null;


function startDashboardTimer() {

    if (
        dashboardRefreshTimer
    ) {

        clearInterval(
            dashboardRefreshTimer
        );
    }


    dashboardRefreshTimer =
        setInterval(
            function() {

                refreshDashboard();

            },
            60 * 1000
        );
}


/* =====================================================
   KHI QUAY LẠI TAB
===================================================== */

document.addEventListener(
    "visibilitychange",
    function() {

        if (
            !document.hidden
        ) {

            refreshDashboard();
        }
    }
);


/* =====================================================
   AUTH CHANGE
===================================================== */

supabaseClient.auth.onAuthStateChange(
    function(
        event,
        session
    ) {

        console.log(
            "Dashboard Auth:",
            event
        );


        setTimeout(
            function() {

                refreshDashboard();

            },
            0
        );
    }
);


/* =====================================================
   KHỞI ĐỘNG
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        await refreshDashboard();

        startDashboardTimer();

    }
);