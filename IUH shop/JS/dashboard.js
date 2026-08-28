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
   IUH SHOP DASHBOARD
===================================================== */


/* =====================================================
   CẤU HÌNH
===================================================== */

const PLATFORM_FEE_RATE = 0.05;

/*
    PHÍ CHẬM THANH TOÁN: 0,1% / ngày

    0,1% = 0.001
*/

const DAILY_LATE_RATE = 0.001;

const PAYMENT_DEADLINE_DAYS = 7;


/* =====================================================
   LẤY USER HIỆN TẠI
===================================================== */

function getCurrentUser() {

    try {

        return JSON.parse(
            localStorage.getItem("currentUser")
        );

    } catch {

        return null;

    }

}


const currentUser = getCurrentUser();


/* =====================================================
   XÁC ĐỊNH QUYỀN
===================================================== */

function isPrivilegedAccount() {

    if (!currentUser) {

        return false;

    }


    const role =
        String(
            currentUser.role ||
            currentUser.userRole ||
            currentUser.type ||
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


const IS_PRIVILEGED =
    isPrivilegedAccount();


/* =====================================================
   LẤY ĐƠN HÀNG
===================================================== */

function getOrders() {

    try {

        const data =
            JSON.parse(
                localStorage.getItem("orders")
            );


        return Array.isArray(data)

            ? data

            : [];

    }

    catch {

        return [];

    }

}


let orders =
    getOrders();


/* =====================================================
   HELPER
===================================================== */

function normalizeStatus(order) {

    return String(
        order.status ||
        order.orderStatus ||
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

        status === "hoàn thành" ||

        status === "hoan thanh" ||

        status === "delivered" ||

        status === "đã giao" ||

        status === "da giao"

    );

}


function isCOD(order) {

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
   LẤY GIÁ NGƯỜI BÁN
===================================================== */

function getSellerPrice(order) {

    return Number(

        order.sellerPrice ||

        order.productPrice ||

        order.price ||

        order.amount ||

        0

    );

}


/* =====================================================
   TÍNH PHÍ SÀN
===================================================== */

function calculatePlatformFee(order) {

    /*
        Admin / Quản trị viên:
        Dashboard không ghi nhận phí.
    */

    if (IS_PRIVILEGED) {

        return 0;

    }


    const sellerPrice =
        getSellerPrice(order);


    return (

        sellerPrice *
        PLATFORM_FEE_RATE

    );

}


/* =====================================================
   TÍNH SỐ NGÀY QUÁ HẠN
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
        isNaN(
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
   TÍNH PHÍ SAU KHI QUÁ HẠN
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
        Công thức:

        F = P × (1 + r)^n

        P = phí gốc
        r = 0,1% / ngày
        n = số ngày quá hạn

        0,1% = 0.001
    */


    return (

        baseFee *

        Math.pow(

            1 +
            DAILY_LATE_RATE,

            overdueDays

        )

    );

}


/* =====================================================
   VÍ IUH SHOP
   ĐỒNG BỘ VỚI localStorage CỦA TRANG VÍ
===================================================== */

function getDashboardWalletBalance() {

    const user =
        currentUser;


    const identity =

        user?.id ||

        user?.userId ||

        user?.email ||

        user?.username ||

        "guest";


    const key =

        "iuhWallet_" +

        String(identity)
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "_"
            );


    try {

        const savedWallet =

            localStorage.getItem(
                key
            );


        if (!savedWallet) {

            return 0;

        }


        const wallet =

            JSON.parse(
                savedWallet
            );


        return Number(

            wallet?.balance || 0

        );

    }

    catch (error) {

        console.error(

            "Không đọc được Ví IUH SHOP:",

            error

        );


        return 0;

    }

}


/* =====================================================
   TÍNH DỮ LIỆU DASHBOARD
===================================================== */

function calculateDashboard() {

    const completed =

        orders.filter(

            order =>
                isCompleted(order)

        );


    /*
        DOANH THU
    */

    const revenue =

        completed.reduce(

            (total, order) => {

                return (

                    total +

                    getSellerPrice(
                        order
                    )

                );

            },

            0

        );


    /*
        TỔNG ĐƠN
    */

    const totalOrders =

        orders.length;


    /*
        ĐƠN HOÀN THÀNH
    */

    const completedOrders =

        completed.length;


    /*
        ĐƠN ĐANG XỬ LÝ
    */

    const processingOrders =

        orders.filter(

            order =>
                !isCompleted(order)

        ).length;


    /*
        PHÍ SÀN
    */

    let totalFee = 0;

    let outstandingFee = 0;

    const feeItems = [];


    /*
        Admin / Quản trị viên:
        không tính công nợ phí.
    */

    if (!IS_PRIVILEGED) {

        completed.forEach(
            order => {

                /*
                    Chỉ COD mới tạo công nợ.

                    Thanh toán online:
                    hệ thống đã xử lý phí tự động.
                */

                if (
                    !isCOD(order)
                ) {

                    return;

                }


                const baseFee =

                    calculatePlatformFee(
                        order
                    );


                const completedDate =

                    order.completedAt ||

                    order.completedDate ||

                    order.updatedAt ||

                    order.createdAt;


                const overdueDays =

                    calculateOverdueDays(
                        completedDate
                    );


                const finalFee =

                    calculateFeeWithLateCharge(

                        baseFee,

                        overdueDays

                    );


                totalFee +=
                    finalFee;


                /*
                    Kiểm tra đã thanh toán chưa
                */

                const paid =

                    order.platformFeePaid === true ||

                    order.feePaid === true;


                if (!paid) {

                    outstandingFee +=
                        finalFee;


                    feeItems.push({

                        id:

                            order.id ||

                            order.orderId,


                        product:

                            order.productName ||

                            order.name ||

                            "Đơn hàng",


                        baseFee,


                        finalFee,


                        overdueDays,


                        completedDate

                    });

                }

            }

        );

    }


    /*
        VÍ IUH SHOP

        Dashboard và trang Ví sử dụng
        cùng một dữ liệu localStorage.
    */

    const walletBalance =

        getDashboardWalletBalance();


    /*
        TRẢ DỮ LIỆU DASHBOARD
    */

    return {

        revenue,

        totalOrders,

        completedOrders,

        processingOrders,

        totalFee,

        outstandingFee,

        walletBalance,

        feeItems

    };

}


/* =====================================================
   FORMAT TIỀN
===================================================== */

function formatMoney(value) {

    return Number(
        value || 0
    )
    .toLocaleString(
        "vi-VN"
    ) + "đ";

}


/* =====================================================
   ANIMATION ĐẾM SỐ
===================================================== */

function animateNumber(

    element,

    target,

    duration = 900,

    formatter = formatMoney

) {

    if (!element) {

        return;

    }


    const start = 0;


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
                )
                /
                duration,

                1

            );


        /*
            easeOut
        */

        const eased =

            1 -

            Math.pow(

                1 -
                progress,

                3

            );


        const value =

            start +

            (
                target -
                start
            ) *

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
   HIỂN THỊ SỐ
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


    if (processingElement) {

        processingElement.textContent =

            data.processingOrders;

    }


    /*
        SỐ DƯ VÍ
    */

    const walletElement =

        document.getElementById(
            "walletBalance"
        );


    if (walletElement) {

        walletElement.textContent =

            formatMoney(
                data.walletBalance
            );

    }


    /*
        PHÍ CẦN THANH TOÁN
    */

    animateNumber(

        document.getElementById(
            "outstandingFee"
        ),

        data.outstandingFee

    );


    const debtStatus =

        document.getElementById(
            "debtStatus"
        );


    if (debtStatus) {

        if (IS_PRIVILEGED) {

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


    /*
        Admin / quản trị viên:
        phí dashboard luôn = 0
    */

    if (IS_PRIVILEGED) {

        const feeDescription =

            document.getElementById(
                "feeDescription"
            );


        if (feeDescription) {

            feeDescription.textContent =

                "Tài khoản quản trị · Không tính phí sàn";

        }

    }

}


/* =====================================================
   RENDER FEE
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

    if (IS_PRIVILEGED) {

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

                    Admin và Quản trị viên tự xử lý
                    các khoản phí nội bộ. Dashboard
                    không ghi nhận công nợ phí sàn.

                </div>

            </div>

        `;

        return;

    }


    /*
        KHÔNG CÓ PHÍ
    */

    if (
        data.feeItems.length === 0
    ) {

        container.innerHTML = `

            <div class="fee-item">

                <strong>
                    Không có khoản phí cần thanh toán
                </strong>

                <div class="fee-detail">

                    Các khoản phí của bạn hiện đã được
                    xử lý đầy đủ.

                </div>

            </div>

        `;

        return;

    }


    /*
        CÓ PHÍ
    */

    container.innerHTML =

        data.feeItems

            .map(

                item => {

                    const overdue =

                        item.overdueDays > 0;


                    return `

                        <div
                            class="
                                fee-item
                                ${overdue
                                    ? "overdue"
                                    : ""}
                            "
                        >

                            <div
                                class="fee-top"
                            >

                                <strong>

                                    ${item.product}

                                </strong>


                                <span
                                    class="fee-amount"
                                >

                                    ${formatMoney(
                                        item.finalFee
                                    )}

                                </span>

                            </div>


                            <div
                                class="fee-detail"
                            >

                                Phí gốc:

                                ${formatMoney(
                                    item.baseFee
                                )}

                                <br>


                                ${
                                    overdue

                                    ?

                                    `

                                    Quá hạn:
                                    ${item.overdueDays}
                                    ngày · Đã áp dụng
                                    phí chậm thanh toán

                                    `

                                    :

                                    `

                                    Hạn thanh toán:
                                    07 ngày kể từ khi
                                    đơn hoàn thành

                                    `
                                }

                            </div>


                            <button

                                class="
                                    pay-fee-button
                                "

                                onclick="
                                    payPlatformFee(
                                        '${item.id}'
                                    )
                                "

                            >

                                Thanh toán phí

                            </button>

                        </div>

                    `;

                }

            )

            .join("");

}


/* =====================================================
   THANH TOÁN PHÍ - MỞ POPUP MÔ PHỎNG
===================================================== */

let currentPaymentOrderId =
    null;


function payPlatformFee(
    orderId
) {

    const order =

        orders.find(

            item =>

                String(
                    item.id ||
                    item.orderId
                )

                ===

                String(
                    orderId
                )

        );


    if (!order) {

        alert(
            "Không tìm thấy khoản phí cần thanh toán."
        );

        return;

    }


    currentPaymentOrderId =
        orderId;


    const baseFee =

        calculatePlatformFee(
            order
        );


    const completedDate =

        order.completedAt ||

        order.completedDate ||

        order.updatedAt ||

        order.createdAt;


    const overdueDays =

        calculateOverdueDays(
            completedDate
        );


    const finalFee =

        calculateFeeWithLateCharge(

            baseFee,

            overdueDays

        );


    /*
        Số tiền
    */

    const amountElement =

        document.getElementById(
            "paymentAmount"
        );


    if (amountElement) {

        amountElement.textContent =

            formatMoney(
                finalFee
            );

    }


    /*
        Mã giao dịch
    */

    const transactionElement =

        document.getElementById(
            "paymentTransaction"
        );


    if (transactionElement) {

        transactionElement.textContent =

            generateTransactionCode();

    }


    /*
        Mở popup
    */

    const modal =

        document.getElementById(
            "paymentModal"
        );


    if (modal) {

        modal.classList.add(
            "active"
        );


        document.body.style.overflow =
            "hidden";

    }

}


/* =====================================================
   TẠO MÃ GIAO DỊCH MÔ PHỎNG
===================================================== */

function generateTransactionCode() {

    const timestamp =

        Date.now()
            .toString()
            .slice(-8);


    const random =

        Math.floor(

            1000 +

            Math.random() *
            9000

        );


    return (

        `IUH${timestamp}${random}`

    );

}


/* =====================================================
   ĐÓNG POPUP
===================================================== */

function closePaymentModal() {

    const modal =

        document.getElementById(
            "paymentModal"
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
   XÁC NHẬN THANH TOÁN MÔ PHỎNG
===================================================== */

function confirmPayment() {

    if (
        currentPaymentOrderId === null
    ) {

        return;

    }


    const index =

        orders.findIndex(

            order =>

                String(
                    order.id ||
                    order.orderId
                )

                ===

                String(
                    currentPaymentOrderId
                )

        );


    if (
        index === -1
    ) {

        alert(
            "Không tìm thấy khoản phí."
        );

        return;

    }


    /*
        Tính lại khoản phí hiện tại
        trước khi trừ tiền.
    */

    const baseFee =

        calculatePlatformFee(
            orders[index]
        );


    const completedDate =

        orders[index].completedAt ||

        orders[index].completedDate ||

        orders[index].updatedAt ||

        orders[index].createdAt;


    const overdueDays =

        calculateOverdueDays(
            completedDate
        );


    const finalFee =

        calculateFeeWithLateCharge(

            baseFee,

            overdueDays

        );


    /*
        Lấy Ví IUH SHOP
    */

    const user =
        currentUser;


    const identity =

        user?.id ||

        user?.userId ||

        user?.email ||

        user?.username ||

        "guest";


    const walletKey =

        "iuhWallet_" +

        String(identity)
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "_"
            );


    let wallet;


    try {

        wallet =

            JSON.parse(

                localStorage.getItem(
                    walletKey
                )

            );

    }

    catch {

        wallet = null;

    }


    if (!wallet) {

        wallet = {

            balance: 0,

            pending: 0,

            totalReceived: 0,

            transactions: [],

            updatedAt:
                new Date().toISOString()

        };

    }


    wallet.balance =
        Number(
            wallet.balance || 0
        );


    /*
        Kiểm tra số dư Ví
    */

    if (
        wallet.balance <
        finalFee
    ) {

        alert(

            "Số dư Ví IUH SHOP không đủ để thanh toán khoản phí này."

        );

        return;

    }


    /*
        Trừ tiền khỏi Ví
    */

    wallet.balance -=
        finalFee;


    /*
        Ghi lịch sử giao dịch
    */

    if (
        !Array.isArray(
            wallet.transactions
        )
    ) {

        wallet.transactions = [];

    }


    wallet.transactions.unshift({

        id:
            generateTransactionCode(),

        type:
            "fee",

        title:
            "Thanh toán phí sàn",

        amount:
            finalFee,

        description:

            orders[index].productName ||

            orders[index].name ||

            "Đơn hàng",

        createdAt:
            new Date().toISOString()

    });


    wallet.transactions =
        wallet.transactions.slice(
            0,
            100
        );


    wallet.updatedAt =
        new Date().toISOString();


    /*
        Lưu Ví
    */

    localStorage.setItem(

        walletKey,

        JSON.stringify(
            wallet
        )

    );


    /*
        Đánh dấu đơn đã thanh toán
    */

    orders[index].platformFeePaid =
        true;


    orders[index].feePaid =
        true;


    orders[index].feePaidAt =
        new Date().toISOString();


    /*
        Lưu trạng thái đơn hàng
    */

    localStorage.setItem(

        "orders",

        JSON.stringify(
            orders
        )

    );


    /*
        Đóng popup
    */

    closePaymentModal();


    /*
        Thông báo mô phỏng
    */

    alert(

        "✓ Thanh toán mô phỏng thành công!\n\n" +

        "Khoản phí đã được trừ khỏi Ví IUH SHOP."

    );


    /*
        Cập nhật lại Dashboard
    */

    renderDashboard();


    currentPaymentOrderId =
        null;

}


/* =====================================================
   RENDER ORDERS
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
            .reverse()
            .slice(
                0,
                5
            );


    if (
        !recent.length
    ) {

        container.innerHTML = `

            <div class="order-item">

                <div class="order-info">

                    <strong>
                        Chưa có đơn hàng
                    </strong>

                    <span>
                        Các đơn hàng của bạn sẽ xuất hiện tại đây.
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

                    return `

                        <div
                            class="order-item"
                        >

                            <div
                                class="order-info"
                            >

                                <strong>

                                    ${
                                        order.productName ||

                                        order.name ||

                                        "Đơn hàng"
                                    }

                                </strong>


                                <span>

                                    ${
                                        order.status ||

                                        "Đang xử lý"
                                    }

                                </span>

                            </div>


                            <div
                                class="order-price"
                            >

                                ${formatMoney(
                                    getSellerPrice(
                                        order
                                    )
                                )}

                            </div>

                        </div>

                    `;

                }

            )

            .join("");

}


/* =====================================================
   CHART - DOANH THU THEO THÁNG
===================================================== */

let revenueChart =
    null;


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
        ).fill(0);


    orders.forEach(
        order => {

            if (
                !isCompleted(order)
            ) {

                return;

            }


            const date =

                new Date(

                    order.completedAt ||

                    order.completedDate ||

                    order.updatedAt ||

                    order.createdAt

                );


            if (
                isNaN(
                    date.getTime()
                )
            ) {

                return;

            }


            const month =

                date.getMonth();


            monthlyRevenue[month] +=

                getSellerPrice(
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


    if (revenueChart) {

        revenueChart.destroy();

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

                                        return

                                            Number(
                                                value
                                            )
                                            .toLocaleString(
                                                "vi-VN"
                                            ) +

                                            "đ";

                                    }

                            }

                        }

                    }

                }

            }

        );

}


/* =====================================================
   DATE
===================================================== */

function renderDate() {

    const element =

        document.getElementById(
            "dashboardDate"
        );


    if (!element) {

        return;

    }


    const now =
        new Date();


    element.textContent =

        now.toLocaleDateString(

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
   DASHBOARD
===================================================== */

function renderDashboard() {

    orders =
        getOrders();


    renderStats();


    renderFees();


    renderOrders();


    renderChart();


    renderDate();

}


/* =====================================================
   CẬP NHẬT THEO THỜI GIAN
===================================================== */

/*
    Không cần mở website liên tục.

    Khi người dùng mở lại Dashboard,
    hệ thống sẽ lấy thời gian hiện tại
    và tính lại số ngày quá hạn.

    Trong lúc trang đang mở,
    cập nhật mỗi 60 giây.
*/

setInterval(

    function() {

        orders =
            getOrders();


        renderStats();


        renderFees();

    },

    60 * 1000

);


/*
    Khi quay lại tab Dashboard,
    tính lại ngay lập tức.
*/

document.addEventListener(

    "visibilitychange",

    function() {

        if (
            !document.hidden
        ) {

            orders =
                getOrders();


            renderStats();


            renderFees();

        }

    }

);


/*
    Nếu trang Ví thay đổi localStorage,
    Dashboard cập nhật số dư.
*/

window.addEventListener(

    "storage",

    function(event) {

        if (
            event.key &&
            event.key.startsWith(
                "iuhWallet_"
            )
        ) {

            renderStats();

        }


        if (
            event.key ===
            "orders"
        ) {

            orders =
                getOrders();


            renderDashboard();

        }

    }

);


/* =====================================================
   INIT
===================================================== */

document.addEventListener(

    "DOMContentLoaded",

    function() {

        renderDashboard();

    }

);