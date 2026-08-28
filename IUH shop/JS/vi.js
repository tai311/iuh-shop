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
   IUH SHOP WALLET
   LƯU TRỮ: localStorage
===================================================== */


/* =====================================================
   LẤY USER HIỆN TẠI
===================================================== */

function getCurrentWalletUser() {

    try {

        return JSON.parse(
            localStorage.getItem("currentUser")
        );

    } catch {

        return null;

    }

}


/* =====================================================
   KEY RIÊNG CHO TỪNG TÀI KHOẢN
===================================================== */

function getWalletKey() {

    const user =
        getCurrentWalletUser();


    /*
        Không dùng chung ví giữa các tài khoản.
    */

    const identity =
        user?.id ||
        user?.userId ||
        user?.email ||
        user?.username ||
        "guest";


    return "iuhWallet_" +
        String(identity)
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "_"
            );

}


/* =====================================================
   TẠO MÃ GIAO DỊCH
===================================================== */

function generateWalletTransactionId(
    prefix = "IUH"
) {

    const time =
        Date.now()
            .toString()
            .slice(-8);


    const random =
        Math.floor(
            1000 +
            Math.random() * 9000
        );


    return `${prefix}${time}${random}`;

}


/* =====================================================
   WALLET DEFAULT
===================================================== */

function createDefaultWallet() {

    return {

        balance: 0,

        pending: 0,

        totalReceived: 0,

        transactions: [],

        updatedAt:
            new Date().toISOString()

    };

}


/* =====================================================
   LẤY VÍ
===================================================== */

function getWallet() {

    const key =
        getWalletKey();


    try {

        const saved =
            JSON.parse(
                localStorage.getItem(key)
            );


        if (saved) {

            return {

                ...createDefaultWallet(),

                ...saved

            };

        }

    } catch {

        console.warn(
            "Không đọc được dữ liệu Ví IUH SHOP."
        );

    }


    const wallet =
        createDefaultWallet();


    localStorage.setItem(
        key,
        JSON.stringify(wallet)
    );


    return wallet;

}


/* =====================================================
   LƯU VÍ
===================================================== */

function saveWallet(wallet) {

    wallet.updatedAt =
        new Date().toISOString();


    localStorage.setItem(
        getWalletKey(),
        JSON.stringify(wallet)
    );

}


/* =====================================================
   FORMAT TIỀN
===================================================== */

function formatWalletMoney(value) {

    return Number(value || 0)
        .toLocaleString("vi-VN") +
        "đ";

}


/* =====================================================
   FORMAT NGÀY
===================================================== */

function formatTransactionDate(date) {

    const d =
        new Date(date);


    if (
        isNaN(
            d.getTime()
        )
    ) {

        return "—";

    }


    return d.toLocaleString(
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


/* =====================================================
   THÊM GIAO DỊCH
===================================================== */

function addWalletTransaction({

    type,

    title,

    amount,

    description,

    bank = "",

    account = ""

}) {

    const wallet =
        getWallet();


    wallet.transactions.unshift({

        id:
            generateWalletTransactionId(),

        type,

        title,

        amount:

            Number(amount || 0),

        description,

        bank,

        account,

        createdAt:
            new Date().toISOString()

    });


    /*
        Giữ lịch sử tối đa 100 giao dịch
    */

    wallet.transactions =
        wallet.transactions.slice(
            0,
            100
        );


    saveWallet(wallet);

}


/* =====================================================
   CẬP NHẬT GIAO DIỆN
===================================================== */

function renderWallet() {

    const wallet =
        getWallet();


    document.getElementById(
        "walletBalance"
    ).textContent =
        formatWalletMoney(
            wallet.balance
        );


    document.getElementById(
        "pendingBalance"
    ).textContent =
        formatWalletMoney(
            wallet.pending
        );


    document.getElementById(
        "totalReceived"
    ).textContent =
        formatWalletMoney(
            wallet.totalReceived
        );


    /*
        Tính phí từ orders
    */

    const feeData =
        calculateOutstandingFees();


    document.getElementById(
        "outstandingFee"
    ).textContent =
        formatWalletMoney(
            feeData.total
        );


    const status =
        document.getElementById(
            "feeStatus"
        );


    if (feeData.total > 0) {

        status.textContent =
            `${feeData.items.length} khoản cần thanh toán`;

    }
    else {

        status.textContent =
            "Không có khoản phí cần thanh toán";

    }


    renderTransactions();

}


/* =====================================================
   LẤY ORDERS
===================================================== */

function getWalletOrders() {

    try {

        const orders =
            JSON.parse(
                localStorage.getItem("orders")
            );


        return Array.isArray(orders)
            ? orders
            : [];

    } catch {

        return [];

    }

}


/* =====================================================
   KIỂM TRA ROLE
===================================================== */

function isWalletPrivileged() {

    const user =
        getCurrentWalletUser();


    const role =
        String(
            user?.role ||
            user?.userRole ||
            user?.type ||
            ""
        )
        .toLowerCase()
        .trim();


    return (

        role === "admin" ||

        role === "quản trị viên" ||

        role === "quan tri vien" ||

        role === "administrator"

    );

}


/* =====================================================
   LẤY GIÁ
===================================================== */

function getOrderPrice(order) {

    return Number(

        order.sellerPrice ||

        order.productPrice ||

        order.price ||

        order.amount ||

        0

    );

}


/* =====================================================
   COD
===================================================== */

function isWalletCOD(order) {

    const method =
        String(
            order.paymentMethod ||
            order.payment ||
            ""
        )
        .toLowerCase();


    return (

        method.includes("cod") ||

        method.includes("nhận hàng") ||

        method.includes("nhan hang")

    );

}


/* =====================================================
   COMPLETED
===================================================== */

function isWalletCompleted(order) {

    const status =
        String(
            order.status ||
            order.orderStatus ||
            ""
        )
        .toLowerCase()
        .trim();


    return (

        status === "completed" ||

        status === "hoàn thành" ||

        status === "hoan thanh" ||

        status === "delivered" ||

        status === "đã giao" ||

        status === "da giao"

    );

}


/* =====================================================
   PHÍ SÀN
===================================================== */

const WALLET_PLATFORM_FEE =
    0.05;


/* =====================================================
   PHÍ CHẬM
   0.1% / NGÀY
===================================================== */

const WALLET_DAILY_LATE_RATE =
    0.001;


const WALLET_DEADLINE_DAYS =
    7;


/* =====================================================
   TÍNH NGÀY QUÁ HẠN
===================================================== */

function getWalletOverdueDays(dateValue) {

    if (!dateValue) {

        return 0;

    }


    const completed =
        new Date(dateValue);


    if (
        isNaN(
            completed.getTime()
        )
    ) {

        return 0;

    }


    const deadline =
        new Date(completed);


    deadline.setDate(
        deadline.getDate() +
        WALLET_DEADLINE_DAYS
    );


    const now =
        new Date();


    if (now <= deadline) {

        return 0;

    }


    return Math.floor(

        (
            now.getTime() -
            deadline.getTime()
        )
        /
        (1000 * 60 * 60 * 24)

    );

}


/* =====================================================
   TÍNH PHÍ SAU QUÁ HẠN
===================================================== */

function getWalletFinalFee(
    baseFee,
    overdueDays
) {

    if (
        overdueDays <= 0
    ) {

        return baseFee;

    }


    return (

        baseFee *
        Math.pow(
            1 + WALLET_DAILY_LATE_RATE,
            overdueDays
        )

    );

}


/* =====================================================
   TÍNH CÔNG NỢ
===================================================== */

function calculateOutstandingFees() {

    /*
        Admin / quản trị viên:
        luôn = 0
    */

    if (
        isWalletPrivileged()
    ) {

        return {

            total: 0,

            items: []

        };

    }


    const orders =
        getWalletOrders();


    const items = [];


    orders.forEach(order => {


        if (
            !isWalletCompleted(order)
        ) {

            return;

        }


        if (
            !isWalletCOD(order)
        ) {

            return;

        }


        if (
            order.platformFeePaid === true ||
            order.feePaid === true
        ) {

            return;

        }


        const baseFee =
            getOrderPrice(order) *
            WALLET_PLATFORM_FEE;


        const completedDate =
            order.completedAt ||
            order.completedDate ||
            order.updatedAt ||
            order.createdAt;


        const overdueDays =
            getWalletOverdueDays(
                completedDate
            );


        const finalFee =
            getWalletFinalFee(
                baseFee,
                overdueDays
            );


        items.push({

            id:
                order.id ||
                order.orderId,

            product:
                order.productName ||
                order.name ||
                "Đơn hàng",

            baseFee,

            finalFee,

            overdueDays

        });

    });


    return {

        total:
            items.reduce(
                (sum, item) =>
                    sum + item.finalFee,
                0
            ),

        items

    };

}


/* =====================================================
   NẠP TIỀN
===================================================== */

function openDepositModal() {

    document.getElementById(
        "depositAmount"
    ).value = "";


    document.getElementById(
        "depositModal"
    ).classList.add(
        "active"
    );


    document.body.style.overflow =
        "hidden";

}


function confirmDeposit() {

    const amount =
        Number(
            document.getElementById(
                "depositAmount"
            ).value
        );


    const bank =
        document.getElementById(
            "depositBank"
        ).value;


    if (
        !amount ||
        amount < 1000
    ) {

        alert(
            "Số tiền nạp tối thiểu là 1.000đ."
        );

        return;

    }


    const wallet =
        getWallet();


    wallet.balance +=
        amount;


    /*
        Nạp tiền không tính
        vào doanh thu bán hàng.
    */

    wallet.transactions.unshift({

        id:
            generateWalletTransactionId(
                "NAP"
            ),

        type:
            "deposit",

        title:
            "Nạp tiền từ ngân hàng",

        amount,

        description:
            `Nạp tiền từ ${bank}`,

        bank,

        createdAt:
            new Date().toISOString()

    });


    saveWallet(wallet);


    closeWalletModal(
        "depositModal"
    );


    renderWallet();


    alert(
        "✓ Nạp tiền mô phỏng thành công!\n\n" +
        `Số tiền: ${formatWalletMoney(amount)}`
    );

}


/* =====================================================
   RÚT TIỀN
===================================================== */

function openWithdrawModal() {

    const wallet =
        getWallet();


    document.getElementById(
        "withdrawAvailable"
    ).textContent =
        formatWalletMoney(
            wallet.balance
        );


    document.getElementById(
        "withdrawAmount"
    ).value = "";


    document.getElementById(
        "withdrawAccount"
    ).value = "";


    document.getElementById(
        "withdrawModal"
    ).classList.add(
        "active"
    );


    document.body.style.overflow =
        "hidden";

}


function confirmWithdraw() {

    const amount =
        Number(
            document.getElementById(
                "withdrawAmount"
            ).value
        );


    const bank =
        document.getElementById(
            "withdrawBank"
        ).value;


    const account =
        document.getElementById(
            "withdrawAccount"
        ).value.trim();


    if (
        !account
    ) {

        alert(
            "Vui lòng nhập số tài khoản."
        );

        return;

    }


    if (
        !amount ||
        amount < 1000
    ) {

        alert(
            "Số tiền rút tối thiểu là 1.000đ."
        );

        return;

    }


    const wallet =
        getWallet();


    if (
        amount > wallet.balance
    ) {

        alert(
            "Số dư khả dụng không đủ."
        );

        return;

    }


    /*
        Trừ tiền khỏi ví
    */

    wallet.balance -=
        amount;


    /*
        Ghi lịch sử
    */

    wallet.transactions.unshift({

        id:
            generateWalletTransactionId(
                "RUT"
            ),

        type:
            "withdraw",

        title:
            "Rút tiền về ngân hàng",

        amount,

        description:
            `Rút tiền về ${bank}`,

        bank,

        account:
            maskAccount(account),

        createdAt:
            new Date().toISOString()

    });


    saveWallet(wallet);


    closeWalletModal(
        "withdrawModal"
    );


    renderWallet();


    alert(
        "✓ Yêu cầu rút tiền mô phỏng thành công!\n\n" +
        `Số tiền: ${formatWalletMoney(amount)}\n` +
        `Ngân hàng: ${bank}`
    );

}


/* =====================================================
   CHE SỐ TÀI KHOẢN
===================================================== */

function maskAccount(account) {

    if (
        account.length <= 4
    ) {

        return account;

    }


    return (
        "*".repeat(
            account.length - 4
        ) +
        account.slice(-4)
    );

}


/* =====================================================
   THANH TOÁN PHÍ SÀN
===================================================== */

function payFeeFromWallet(orderId) {

    const feeData =
        calculateOutstandingFees();


    const item =
        feeData.items.find(
            fee =>
                String(fee.id) ===
                String(orderId)
        );


    if (!item) {

        alert(
            "Không tìm thấy khoản phí."
        );

        return;

    }


    const wallet =
        getWallet();


    /*
        Kiểm tra số dư
    */

    if (
        wallet.balance <
        item.finalFee
    ) {

        alert(
            "Số dư Ví IUH SHOP không đủ để thanh toán khoản phí này."
        );

        return;

    }


    /*
        Trừ tiền ví
    */

    wallet.balance -=
        item.finalFee;


    /*
        Lưu giao dịch
    */

    wallet.transactions.unshift({

        id:
            generateWalletTransactionId(
                "PHI"
            ),

        type:
            "fee",

        title:
            "Thanh toán phí sàn",

        amount:
            item.finalFee,

        description:
            item.product,

        createdAt:
            new Date().toISOString()

    });


    saveWallet(wallet);


    /*
        Cập nhật order
    */

    const orders =
        getWalletOrders();


    const index =
        orders.findIndex(
            order =>
                String(
                    order.id ||
                    order.orderId
                ) ===
                String(orderId)
        );


    if (
        index !== -1
    ) {

        orders[index].platformFeePaid =
            true;

        orders[index].feePaid =
            true;

        orders[index].feePaidAt =
            new Date().toISOString();

    }


    localStorage.setItem(
        "orders",
        JSON.stringify(orders)
    );


    renderWallet();


    alert(
        "✓ Thanh toán phí sàn thành công!"
    );

}


/* =====================================================
   LỊCH SỬ
===================================================== */

function renderTransactions() {

    const container =
        document.getElementById(
            "transactionList"
        );


    if (!container) {

        return;

    }


    const wallet =
        getWallet();


    const transactions =
        wallet.transactions || [];


    if (
        transactions.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-transaction">

                Chưa có giao dịch nào.

            </div>

        `;

        return;

    }


    container.innerHTML =
        transactions
            .map(transaction => {

                const incoming =
                    transaction.type ===
                    "deposit" ||
                    transaction.type ===
                    "order";


                const sign =
                    incoming
                    ? "+"
                    : "-";


                const icon =
                    incoming
                    ? "↓"
                    : "↑";


                return `

                    <div
                        class="transaction-item"
                    >

                        <div
                            class="transaction-left"
                        >

                            <div
                                class="
                                    transaction-icon
                                    ${incoming
                                        ? "in"
                                        : "out"}
                                "
                            >
                                ${icon}
                            </div>


                            <div
                                class="
                                    transaction-info
                                "
                            >

                                <strong>
                                    ${transaction.title}
                                </strong>

                                <span>

                                    ${
                                        transaction.description ||
                                        ""
                                    }

                                    ·

                                    ${
                                        formatTransactionDate(
                                            transaction.createdAt
                                        )
                                    }

                                </span>

                            </div>

                        </div>


                        <div
                            class="
                                transaction-amount
                                ${incoming
                                    ? "in"
                                    : "out"}
                            "
                        >

                            ${sign}
                            ${formatWalletMoney(
                                transaction.amount
                            )}

                        </div>

                    </div>

                `;

            })
            .join("");

}


/* =====================================================
   ĐÓNG MODAL
===================================================== */

function closeWalletModal(
    modalId
) {

    const modal =
        document.getElementById(
            modalId
        );


    if (modal) {

        modal.classList.remove(
            "active"
        );

    }


    document.body.style.overflow =
        "";

}


/* =====================================================
   TỰ CẬP NHẬT
===================================================== */

function startWalletRealtime() {

    /*
        Cập nhật mỗi 60 giây để
        phát hiện phí quá hạn.
    */

    setInterval(
        function() {

            renderWallet();

        },
        60 * 1000
    );


    /*
        Khi quay lại tab
    */

    document.addEventListener(
        "visibilitychange",
        function() {

            if (
                !document.hidden
            ) {

                renderWallet();

            }

        }
    );


    /*
        Nếu tab khác thay đổi localStorage
    */

    window.addEventListener(
        "storage",
        function(event) {

            if (
                event.key ===
                getWalletKey()
            ) {

                renderWallet();

            }

        }
    );

}


/* =====================================================
   INIT
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        renderWallet();

        startWalletRealtime();

    }
);