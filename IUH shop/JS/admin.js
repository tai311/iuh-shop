/* =========================================================
   IUH SHOP ADMIN
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


const DEFAULT_AVATAR =
    "../Images/default-avatar.svg";


/* =========================================================
   STATE
========================================================= */

let currentAdmin = null;

let users = [];
let products = [];
let orders = [];
let forumPosts = [];
let financeTransactions = [];

let servicePackages = [];
let packageFilter = "all";

let userFilter = "all";
let productFilter = "all";
let orderFilter = "all";
let forumFilter = "all";

let selectedUser = null;
let selectedOrder = null;

let consignments = [];
let consignmentFilter = "all";
let selectedConsignment = null;

let donations = [];
let donationShowAll = false;


/* =========================================================
   HELPERS
========================================================= */

function $(id) {
    return document.getElementById(id);
}


function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function formatMoney(value) {

    return (
        Number(value || 0)
            .toLocaleString("vi-VN")
        + "đ"
    );
}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString(
        "vi-VN"
    );
}


function isBoostActive(product) {

    if (
        product?.is_boosted !== true
    ) {
        return false;
    }

    if (!product.boost_expires_at) {
        return false;
    }

    return (
        new Date(
            product.boost_expires_at
        ).getTime()
        > Date.now()
    );
}


function roleText(role) {

    if (role === "admin") {
        return "Admin";
    }

    if (role === "moderator") {
        return "Quản trị viên";
    }

    return "Sinh viên";
}


function orderStatusText(status) {

    return {

        pending: "Chờ xử lý",

        confirmed: "Đã xác nhận",

        shipping: "Đang giao",

        delivered: "Đã giao",

        completed: "Hoàn thành",

        cancelled: "Đã hủy"

    }[status] || status || "Không xác định";
}


function paymentText(method) {

    return {

        qr: "QR",

        iuh_wallet: "IUH Wallet",

        cod: "COD"

    }[method] || method || "Không xác định";
}


/* =========================================================
   ADMIN CHECK
========================================================= */

async function checkAdmin() {

    console.log("========== CHECK ADMIN ==========");

    try {

        const {
            data: {
                user
            },
            error: authError
        } =
            await supabaseClient.auth.getUser();


        console.log(
            "Auth user:",
            user
        );


        /* =========================================
           CHƯA ĐĂNG NHẬP
        ========================================= */

        if (
            authError ||
            !user
        ) {

            console.error(
                "Không có phiên đăng nhập:",
                authError
            );

            alert(
                "Phiên đăng nhập không tồn tại. Vui lòng đăng nhập lại."
            );

            return null;
        }


        /* =========================================
           LẤY PROFILE ADMIN
        ========================================= */

        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("users")
                .select("*")
                .eq(
                    "user_id",
                    user.id
                )
                .maybeSingle();


        console.log(
            "User ID:",
            user.id
        );

        console.log(
            "Profile:",
            profile
        );

        console.log(
            "Profile error:",
            profileError
        );


        /* =========================================
           LỖI DATABASE / RLS
        ========================================= */

        if (profileError) {

            console.error(
                "Lỗi lấy profile:",
                profileError
            );

            alert(
                "Không lấy được thông tin quyền Admin.\n\n" +
                profileError.message
            );

            return null;
        }


        /* =========================================
           KHÔNG TÌM THẤY USER
        ========================================= */

        if (!profile) {

            console.error(
                "Không tìm thấy dòng users với user_id:",
                user.id
            );

            alert(
                "Tài khoản đăng nhập chưa có thông tin trong bảng users."
            );

            return null;
        }


        /* =========================================
           KIỂM TRA ROLE
        ========================================= */

        const role =
            String(
                profile.role || ""
            )
            .trim()
            .toLowerCase();


        console.log(
            "ROLE THỰC TẾ:",
            profile.role
        );


        if (
            role !== "admin"
        ) {

            alert(
                "Tài khoản này chưa có quyền Admin.\n\n" +
                "Role hiện tại: " +
                (
                    profile.role ||
                    "NULL"
                )
            );

            return null;
        }


        /* =========================================
           XÁC NHẬN ADMIN
        ========================================= */

        console.log(
            "✅ ADMIN ACCESS GRANTED"
        );


        const adminName =
            document.getElementById(
                "adminName"
            );


        if (adminName) {

            adminName.textContent =
                profile.fullname ||
                "Admin";

        }


        return {
            ...user,
            profile
        };

    }

    catch (error) {

        console.error(
            "CHECK ADMIN ERROR:",
            error
        );

        alert(
            "Có lỗi khi kiểm tra quyền Admin:\n\n" +
            error.message
        );

        return null;
    }
}


/* =========================================================
   LOGOUT
========================================================= */

$("adminLogout")
    ?.addEventListener(
        "click",
        async function () {

            const confirmed =
                confirm(
                    "Bạn có chắc muốn đăng xuất?"
                );

            if (!confirmed) {
                return;
            }

            const {
                error
            } =
                await supabaseClient
                    .auth
                    .signOut();

            if (error) {

                alert(
                    "Đăng xuất thất bại."
                );

                return;
            }

            window.location.href =
                "trangchu.html";
        }
    );


/* =========================================================
   NAVIGATION
========================================================= */

const pageTitles = {

    dashboard:
        "Tổng quan",

    users:
        "Người dùng",

    products:
        "Tin đăng",

    orders:
        "Đơn hàng",

    forum:
        "Diễn đàn",

    finance:
        "Tài chính",
    packages: "Gói dịch vụ",
    consignment: "Ký gửi",
    donations:
    "Donate",

};


function openPage(page) {

    document
        .querySelectorAll(".admin-page")
        .forEach(
            section => {

                section.classList.toggle(
                    "active",
                    section.id ===
                    `page-${page}`
                );

            }
        );


    document
        .querySelectorAll(".admin-nav-item[data-page]")
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.page === page
                );

            }
        );


    $("pageTitle").textContent =
        pageTitles[page] ||
        "Tổng quan";


    if (page === "dashboard") {
        loadDashboard();
    }

    if (page === "users") {
        loadUsers();
    }

    if (page === "products") {
        loadProducts();
    }

    if (page === "orders") {
        loadOrders();
    }

    if (page === "forum") {
        loadForumPosts();
    }

    if (page === "finance") {
        loadFinance();
    }

    if (page === "packages") {
    loadPackages();
}

    if (page === "consignment") {

    const section =
        document.getElementById(
            "page-consignment"
        );

    if (section) {

        section.setAttribute(
            "aria-hidden",
            "false"
        );

        loadConsignments();
    }
}

    if (page === "donations") {
    loadDonations();
}

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


document
    .querySelectorAll(
        "[data-page]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                function () {

                    if (
                        button.classList.contains(
                            "disabled"
                        )
                    ) {
                        return;
                    }

                    openPage(
                        button.dataset.page
                    );

                }
            );

        }
    );


/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {

    try {

        const [
            userResult,
            productResult,
            orderResult,
            boostedResult,
            forumResult,
            revenueResult
        ] =
        await Promise.all([

            supabaseClient
                .from("users")
                .select(
                    "user_id",
                    {
                        count: "exact",
                        head: true
                    }
                ),

            supabaseClient
                .from("products")
                .select(
                    "id,status",
                    {
                        count: "exact",
                        head: false
                    }
                ),

            supabaseClient
    .from("orders")
    .select(
        "id,status,created_at"
    ),

            supabaseClient
                .from("products")
                .select(
                    "id,is_boosted,boost_expires_at"
                ),

            supabaseClient
                .from("forum_posts")
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true
                    }
                ),

            loadAdminRevenue()

        ]);


        const totalUsers =
            userResult.count || 0;


        const allProducts =
            productResult.data || [];


        const activeProducts =
            allProducts.filter(
                item =>
                    item.status ===
                    "active"
            ).length;


        const allOrders =
            orderResult.data || [];


        const pendingOrders =
            allOrders.filter(
                item =>
                    [
                        "pending",
                        "confirmed",
                        "shipping"
                    ].includes(
                        item.status
                    )
            ).length;


        const boostedProducts =
            (boostedResult.data || [])
                .filter(
                    isBoostActive
                )
                .length;


        const revenue =
            revenueResult;


        $("statUsers").textContent =
            totalUsers.toLocaleString(
                "vi-VN"
            );

        $("statProducts").textContent =
            activeProducts.toLocaleString(
                "vi-VN"
            );

        $("statOrders").textContent =
            allOrders.length.toLocaleString(
                "vi-VN"
            );

        $("statPending").textContent =
            pendingOrders.toLocaleString(
                "vi-VN"
            );


        $("activityUsers").textContent =
            totalUsers;

        $("activityProducts").textContent =
            activeProducts;

        $("activityBoosted").textContent =
            boostedProducts;

        $("activityPosts").textContent =
            forumResult.count || 0;


        $("dashboardRevenue").textContent =
            formatMoney(
                revenue.total
            );

        $("revenuePlatform").textContent =
            formatMoney(
                revenue.platform
            );

        $("revenueBoost").textContent =
            formatMoney(
                revenue.boost
            );

        $("revenuePackage").textContent =
    formatMoney(
        revenue.package
    );

    const revenueConsignment =
    $("revenueConsignment");

if (revenueConsignment) {
    revenueConsignment.textContent =
        formatMoney(
            revenue.consignment
        );
}

const revenueDonation =
    $("revenueDonation");

if (revenueDonation) {
    revenueDonation.textContent =
        formatMoney(
            revenue.donation
        );
}

        $("financeTotal").textContent =
            formatMoney(
                revenue.total
            );

        renderAdminCharts(
    revenue.transactions || [],
    allOrders || []
);

renderRecentTransactions(
    revenue.transactions || []
);

    }

    catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

    }
}


/* =========================================================
   REVENUE
========================================================= */

async function loadAdminRevenue() {

    try {

        const {
            data: admins,
            error: adminError
        } =
            await supabaseClient
                .from("users")
                .select("user_id")
                .eq("role", "admin")
                .limit(1);


        if (adminError) {
            throw adminError;
        }


        if (!admins?.length) {

            return {
                total: 0,
                platform: 0,
                boost: 0,
                package: 0,
                transactions: []
            };

        }


        const {
            data: wallet,
            error: walletError
        } =
            await supabaseClient
                .from("iuh_wallets")
                .select("id")
                .eq(
                    "user_id",
                    admins[0].user_id
                )
                .maybeSingle();


        if (walletError) {
            throw walletError;
        }


        if (!wallet) {

            return {
                total: 0,
                platform: 0,
                boost: 0,
                package: 0,
                transactions: []
            };

        }


        const {
            data,
            error
        } =
            await supabaseClient
                .from("wallet_transactions")
                .select(`
                    id,
                    type,
                    title,
                    amount,
                    description,
                    created_at
                `)
                .eq(
                    "wallet_id",
                    wallet.id
                )
                .eq(
                    "type",
                    "fee"
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {
            throw error;
        }


        const transactions =
            data || [];


        let platform = 0;
        let boost = 0;
        let packageRevenue = 0;
        let consignment = 0;
        let donation = 0;


       transactions.forEach(transaction => {

    const text =
        String(transaction.title || "").toLowerCase() +
        " " +
        String(transaction.description || "").toLowerCase();

    const amount = Number(transaction.amount || 0);

     // DONATE
    if (
        text.includes("donate") ||
        text.includes("ủng hộ") ||
        text.includes("ung ho")
    ) {
        donation += amount;
    }
    

    // PHÍ KÝ GỬI
    if (
        text.includes("phí ký gửi") ||
        text.includes("ký gửi") ||
        text.includes("ky gui") ||
        text.includes("consignment")
    ) {
        consignment += amount;
    }

    // GÓI DỊCH VỤ
    else if (
        text.includes("gói dịch vụ") ||
        text.includes("gói cá nhân") ||
        text.includes("gói nhóm") ||
        (
            text.includes("gói") &&
            !text.includes("đẩy tin")
        )
    ) {
        packageRevenue += amount;
    }

    // ĐẨY TIN
    else if (
        text.includes("đẩy tin") ||
        text.includes("boost") ||
        text.includes("nổi bật")
    ) {
        boost += amount;
    }

    // PHÍ SÀN
    else {
        platform += amount;
    }

});


       return {
    total:
        platform +
        boost +
        packageRevenue +
        consignment +
        donation,

    platform,
    boost,
    package: packageRevenue,
    consignment,
    donation,
    transactions
};
    }


    catch (error) {

        console.error(
            "Revenue error:",
            error
        );


        return {

            total: 0,

            platform: 0,

            boost: 0,

            package: 0,

            transactions: []

        };

    }

}

let revenueChartInstance = null;
let ordersChartInstance = null;


/* =========================================================
   BIỂU ĐỒ DOANH THU - THEO NGÀY
   - Hiển thị doanh thu từng ngày
   - Ngày mới nhất ở bên phải
   - Có thể kéo ngang để xem ngày cũ
========================================================= */

function getDayKey(date) {
    const d = new Date(date);

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}


function formatDayLabel(dayKey) {
    const [year, month, day] = dayKey.split("-");

    return `${day}/${month}`;
}


/* Lấy toàn bộ ngày từ giao dịch đầu tiên → hôm nay */
function getAllDays(items) {

    const now = new Date();

    let firstDate = now;

    if (items && items.length > 0) {

        const dates = items
            .map(item => new Date(item.created_at))
            .filter(date => !isNaN(date.getTime()));

        if (dates.length > 0) {

            firstDate = new Date(
                Math.min(
                    ...dates.map(
                        date => date.getTime()
                    )
                )
            );

        }

    }


    const start = new Date(
        firstDate.getFullYear(),
        firstDate.getMonth(),
        firstDate.getDate()
    );


    const end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );


    const days = [];

    let current = new Date(start);


    while (current <= end) {

        days.push(getDayKey(current));

        current.setDate(
            current.getDate() + 1
        );

    }


    return days;
}


/* =========================================================
   RENDER DOANH THU THEO NGÀY
========================================================= */

function renderRevenueChart(transactions) {

    const canvas = $("revenueChart");

    if (!canvas) return;


    transactions = transactions || [];


    /* Lấy danh sách ngày */
    const days = getAllDays(
        transactions
    );


    /* Gom doanh thu theo ngày */
    const revenueByDay = days.map(
        dayKey => {

            return transactions
                .filter(
                    transaction =>
                        getDayKey(
                            transaction.created_at
                        ) === dayKey
                )
                .reduce(
                    (total, transaction) => {

                        return total +
                            Number(
                                transaction.amount || 0
                            );

                    },
                    0
                );

        }
    );


    /* Tổng doanh thu */
    const totalRevenue =
        transactions.reduce(
            (total, transaction) => {

                return total +
                    Number(
                        transaction.amount || 0
                    );

            },
            0
        );


    if ($("chartRevenueTotal")) {

        $("chartRevenueTotal").textContent =
            formatMoney(
                totalRevenue
            );

    }


    /* Hủy chart cũ */
    if (revenueChartInstance) {

        revenueChartInstance.destroy();

        revenueChartInstance = null;

    }


    const chartBox =
        canvas.parentElement;


    if (!chartBox) return;


    /* =====================================================
       TÍNH CHIỀU RỘNG BIỂU ĐỒ

       Mỗi ngày = 60px
       Có nhiều ngày thì biểu đồ dài ra
       → kéo ngang xem ngày cũ
    ===================================================== */

    const chartWidth =
        Math.max(
            days.length * 60,
            chartBox.clientWidth || 700
        );


    /* Cho phép kéo ngang */
    chartBox.style.overflowX =
        "auto";

    chartBox.style.overflowY =
        "hidden";


    /* Canvas có chiều rộng thật */
    canvas.style.setProperty(
        "width",
        chartWidth + "px",
        "important"
    );

    canvas.style.setProperty(
        "height",
        "280px",
        "important"
    );


    canvas.width =
        chartWidth;

    canvas.height =
        280;


    const ctx =
        canvas.getContext("2d");


    revenueChartInstance =
        new Chart(
            ctx,
            {

                type: "line",

                data: {

                    labels:
                        days.map(
                            formatDayLabel
                        ),

                    datasets: [

                        {

                            label:
                                "Doanh thu",

                            data:
                                revenueByDay,

                            borderWidth:
                                3,

                            tension:
                                0.35,

                            fill:
                                true,

                            pointRadius:
                                4,

                            pointHoverRadius:
                                6

                        }

                    ]

                },


                options: {

                    responsive:
                        false,

                    maintainAspectRatio:
                        false,


                    interaction: {

                        intersect:
                            false,

                        mode:
                            "index"

                    },


                    plugins: {

                        legend: {

                            display:
                                false

                        },


                        tooltip: {

                            callbacks: {

                                title:
                                    function(context) {

                                        const index =
                                            context[0]
                                                .dataIndex;

                                        const date =
                                            days[index];

                                        const [
                                            year,
                                            month,
                                            day
                                        ] =
                                            date.split("-");

                                        return `${day}/${month}/${year}`;

                                    },


                                label:
                                    function(context) {

                                        return " " +
                                            formatMoney(
                                                context.raw
                                            );

                                    }

                            }

                        }

                    },


                    scales: {

                        x: {

                            ticks: {

                                maxRotation:
                                    0,

                                autoSkip:
                                    true,

                                maxTicksLimit:
                                    20

                            }

                        },


                        y: {

                            beginAtZero:
                                true,

                            ticks: {

                                callback:
                                    function(value) {

                                        return formatMoney(
                                            value
                                        );

                                    }

                            }

                        }

                    }

                }

            }
        );


    /* =====================================================
       TỰ ĐỘNG ĐỨNG Ở NGÀY MỚI NHẤT

       Ngày cũ vẫn nằm bên trái,
       người dùng kéo thanh ngang để xem.
    ===================================================== */

    requestAnimationFrame(
        () => {

            chartBox.scrollLeft =
                chartBox.scrollWidth -
                chartBox.clientWidth;

        }
    );

}


/* =========================
   BIỂU ĐỒ ĐƠN HÀNG
========================= */

/* =========================
   BIỂU ĐỒ ĐƠN HÀNG THEO NGÀY
========================= */

function renderOrdersChart(allOrders) {
    const canvas = $("ordersChart");
    if (!canvas) return;

    allOrders = allOrders || [];

    /* Lấy các ngày có đơn */
    const validOrders = allOrders.filter(order => {
        return order.created_at && !isNaN(new Date(order.created_at).getTime());
    });

    const days = [];

    validOrders.forEach(order => {
        const date = new Date(order.created_at);

        const dayKey =
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

        if (!days.includes(dayKey)) {
            days.push(dayKey);
        }
    });

    /* Nếu có đơn thì sắp xếp ngày từ cũ → mới */
    days.sort();

    /* Đếm số đơn từng ngày */
    const ordersByDay = days.map(dayKey => {
        return validOrders.filter(order => {
            const date = new Date(order.created_at);

            const orderDay =
                `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

            return orderDay === dayKey;
        }).length;
    });

    /* Tổng số đơn */
    const totalOrders = validOrders.length;

    if ($("chartOrdersTotal")) {
        $("chartOrdersTotal").textContent =
            totalOrders.toLocaleString("vi-VN");
    }

    /* Xóa chart cũ */
    if (ordersChartInstance) {
        ordersChartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");

    ordersChartInstance = new Chart(ctx, {
        type: "bar",

        data: {
            labels: days.map(dayKey => {
                const [year, month, day] = dayKey.split("-");
                return `${day}/${month}`;
            }),

            datasets: [{
                label: "Đơn hàng",
                data: ordersByDay,
                borderWidth: 0,
                borderRadius: 8,
                maxBarThickness: 45
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            const [year, month, day] =
                                days[index].split("-");

                            return `${day}/${month}/${year}`;
                        },

                        label: function(context) {
                            return ` ${context.raw} đơn`;
                        }
                    }
                }
            },

            scales: {
                x: {
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 15
                    }
                },

                y: {
                    beginAtZero: true,

                    ticks: {
                        precision: 0,
                        stepSize: 1
                    }
                }
            }
        }
    });
}


/* =========================
   RENDER CẢ 2 BIỂU ĐỒ
========================= */

function renderAdminCharts(transactions, allOrders) {

    renderRevenueChart(transactions || []);

    renderOrdersChart(allOrders || []);

}


/* =========================
   GIAO DỊCH PHÁT SINH
========================= */

function renderRecentTransactions(transactions) {

    const container = $("dashboardTransactions");

    if (!container) return;

    transactions = transactions || [];


    /* Mới nhất trước */
    const sortedTransactions = [...transactions]
        .sort((a, b) => {

            return new Date(b.created_at) -
                   new Date(a.created_at);

        });


    if (sortedTransactions.length === 0) {

        container.innerHTML = `
            <div class="empty-transaction">
                Chưa có giao dịch phát sinh
            </div>
        `;

        return;
    }


    /* Hiển thị 10 giao dịch gần nhất */
    container.innerHTML = sortedTransactions
        .slice(0, 10)
        .map(transaction => {

            const date = new Date(transaction.created_at);

            const dateText = date.toLocaleString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });


            const amount = Number(transaction.amount || 0);


            const description =
                transaction.description ||
                transaction.title ||
                "Giao dịch hệ thống";


            let typeText = "Phí sàn";
            let icon = "💰";


            const content =
                `${transaction.title || ""} ${description}`
                    .toLowerCase();


            if (
                content.includes("đẩy tin") ||
                content.includes("boost") ||
                content.includes("nổi bật")
            ) {

                typeText = "Đẩy tin";
                icon = "🔥";

            }


            return `

                <div class="dashboard-transaction-item">

                    <div class="transaction-icon">
                        ${icon}
                    </div>

                    <div class="transaction-info">

                        <strong>
                            ${typeText}
                        </strong>

                        <span>
                            ${description}
                        </span>

                        <small>
                            ${dateText}
                        </small>

                    </div>

                    <div class="transaction-amount">
                        +${formatMoney(amount)}
                    </div>

                </div>

            `;

        })
        .join("");
}


/* =========================================================
   USERS
========================================================= */

async function loadUsers() {

    const list =
        $("usersList");


    list.innerHTML = `
        <div class="loading-box">
            Đang tải người dùng...
        </div>
    `;


    try {

        /*
         * Dùng select("*") để không bị giới hạn
         * khi bảng users có thêm MSSV, khoa, ngành...
         */

        const {
            data,
            error
        } =
            await supabaseClient
                .from("users")
                .select("*")
                .order(
                    "fullname",
                    {
                        ascending: true
                    }
                );


        if (error) {
            throw error;
        }


        users =
            data || [];


        renderUsers();

    }

    catch (error) {

        console.error(
            "Load users:",
            error
        );

        list.innerHTML = `
            <div class="error-box">
                Không thể tải danh sách người dùng.
                <br><br>
                ${escapeHTML(
                    error.message
                )}
            </div>
        `;
    }
}


function getFilteredUsers() {

    const keyword =
        (
            $("userSearch")?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    return users.filter(
        user => {

            const verified =
                user.student_verified === true;


            const filterMatch =
                userFilter === "all" ||

                (
                    userFilter === "verified" &&
                    verified
                ) ||

                (
                    userFilter === "unverified" &&
                    !verified
                );


            const searchable =
                [
                    user.fullname,
                    user.email,

                    user.student_id,
                    user.student_code,
                    user.mssv,

                    user.faculty,
                    user.department,
                    user.major,
                    user.class,
                    user.class_code

                ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return (
                filterMatch &&
                (
                    !keyword ||
                    searchable.includes(keyword)
                )
            );

        }
    );
}


function renderUsers() {

    const list =
        $("usersList");


    const filtered =
        getFilteredUsers();


    $("userSummary").textContent =
        `${filtered.length} người dùng đang hiển thị · ` +
        `${users.filter(
            u => u.student_verified === true
        ).length} tài khoản đã xác thực`;


    if (!filtered.length) {

        list.innerHTML = `
            <div class="empty-box">
                Không tìm thấy người dùng phù hợp.
            </div>
        `;

        return;
    }


    list.innerHTML = `

        <div class="user-table-head">

            <span>NGƯỜI DÙNG</span>
            <span>VAI TRÒ</span>
            <span>XÁC THỰC</span>
            <span></span>

        </div>

        ${
            filtered
                .map(
                    createUserRow
                )
                .join("")
        }

    `;
}


function createUserRow(user) {

    const verified =
        user.student_verified === true;


    const badge =
        verified ||
        user.role === "admin" ||
        user.role === "moderator"

            ? "✓"

            : "";


    let action = `
        <button
            class="small-button view"
            type="button"
            data-user-view="${escapeHTML(
                user.user_id
            )}"
        >
            Xem
        </button>
    `;


    if (
        user.role === "user"
    ) {

        action += verified

            ?

            `
                <button
                    class="small-button revoke"
                    type="button"
                    data-user-verify="false"
                    data-user-id="${escapeHTML(
                        user.user_id
                    )}"
                >
                    Thu hồi
                </button>
            `

            :

            `
                <button
                    class="small-button grant"
                    type="button"
                    data-user-verify="true"
                    data-user-id="${escapeHTML(
                        user.user_id
                    )}"
                >
                    Cấp ✓
                </button>
            `;
    }


    return `

        <div class="user-row">

            <div class="user-info">

                <img
                    class="user-avatar"
                    src="${escapeHTML(
                        user.avatar_url ||
                        DEFAULT_AVATAR
                    )}"
                    alt="Avatar"
                    onerror="this.src='${DEFAULT_AVATAR}'"
                >

                <div class="user-name">

                    <strong>

                        ${escapeHTML(
                            user.fullname ||
                            "Chưa cập nhật"
                        )}

                        ${
                            badge
                                ? `
                                    <span class="verify-ok">
                                        ✓
                                    </span>
                                `
                                : ""
                        }

                    </strong>

                    <span>
                        ${escapeHTML(
                            user.email ||
                            "Chưa có email"
                        )}
                    </span>

                </div>

            </div>


            <div class="user-role">
                ${roleText(
                    user.role
                )}
            </div>


            <div
                class="user-verify ${
                    verified
                        ? "verify-ok"
                        : "verify-no"
                }"
            >
                ${
                    verified
                        ? "Đã xác thực"
                        : "Chưa xác thực"
                }
            </div>


            <div class="user-actions">
                ${action}
            </div>

        </div>

    `;
}


/* =========================================================
   USER EVENTS
========================================================= */

document.addEventListener(
    "click",
    async function(event) {

        const viewButton =
            event.target.closest(
                "[data-user-view]"
            );


        if (viewButton) {

            const userId =
                viewButton.dataset.userView;

            openUserDetail(
                userId
            );

            return;
        }


        const verifyButton =
            event.target.closest(
                "[data-user-verify]"
            );


        if (verifyButton) {

            const userId =
                verifyButton.dataset.userId;

            const verified =
                verifyButton.dataset.userVerify ===
                "true";


            await setUserVerification(
                userId,
                verified
            );

        }

    }
);


async function setUserVerification(
    userId,
    verified
) {

    const message =
        verified

            ? "Cấp tích xác thực cho tài khoản này?"

            : "Thu hồi tích xác thực của tài khoản này?";


    if (!confirm(message)) {
        return;
    }


    try {

        const {
            error
        } =
            await supabaseClient
                .rpc(
                    "admin_set_student_verified",
                    {
                        target_user_id:
                            userId,

                        verified:
                            verified
                    }
                );


        if (error) {
            throw error;
        }


        alert(
            verified
                ? "Đã cấp tích xác thực."
                : "Đã thu hồi tích xác thực."
        );


        await loadUsers();
        await loadDashboard();

    }

    catch (error) {

        console.error(
            error
        );

        alert(
            error.message ||
            "Không thể cập nhật xác thực."
        );
    }
}


/* =========================================================
   USER DETAIL
========================================================= */

function getUserField(
    user,
    keys
) {

    for (
        const key of keys
    ) {

        if (
            user[key] !== undefined &&
            user[key] !== null &&
            String(user[key]).trim() !== ""
        ) {

            return user[key];

        }

    }

    return null;
}


function getUserDetailFields(user) {

    const fields = [];


    function add(
        label,
        keys,
        full = false
    ) {

        const value =
            getUserField(
                user,
                keys
            );


        if (
            value !== null
        ) {

            fields.push({
                label,
                value,
                full
            });

        }

    }


    /*
     * Các tên cột phổ biến.
     * Nếu database của bạn dùng tên nào
     * trong số này thì Admin sẽ tự hiển thị.
     */

    add(
        "Mã số sinh viên",
        [
            "student_id",
            "student_code",
            "mssv",
            "student_number"
        ]
    );


    add(
        "Khoa",
        [
            "faculty",
            "department",
            "faculty_name"
        ]
    );


    add(
        "Ngành",
        [
            "major",
            "major_name",
            "program",
            "program_name"
        ]
    );


    add(
        "Lớp",
        [
            "class_code",
            "class_name",
            "class"
        ]
    );


    add(
        "Email",
        [
            "email"
        ]
    );


    add(
        "Số điện thoại",
        [
            "phone",
            "phone_number"
        ]
    );


    add(
        "Vai trò",
        [
            "role"
        ]
    );


    add(
        "Trạng thái xác thực",
        [
            "verification_status"
        ]
    );


    add(
        "Phương thức xác thực",
        [
            "verification_method"
        ]
    );


    add(
        "Ngày xác thực",
        [
            "verified_at"
        ]
    );


    add(
        "Ngày tạo tài khoản",
        [
            "created_at"
        ]
    );


    return fields;
}


function openUserDetail(
    userId
) {

    const user =
        users.find(
            item =>
                String(item.user_id) ===
                String(userId)
        );


    if (!user) {
        return;
    }


    selectedUser =
        user;


    $("detailAvatar").src =
        user.avatar_url ||
        DEFAULT_AVATAR;


    $("detailName").textContent =
        user.fullname ||
        "Chưa cập nhật";


    $("detailEmail").textContent =
        user.email ||
        "Chưa có email";


    const verified =
        user.student_verified === true;


    $("detailStatus").innerHTML =

        verified

            ?

            `
                <span class="status-pill status-active">
                    ✓ Đã xác thực sinh viên
                </span>
            `

            :

            `
                <span class="status-pill status-hidden">
                    Chưa xác thực sinh viên
                </span>
            `;


    const fields =
        getUserDetailFields(
            user
        );


    $("userDetailGrid").innerHTML =
        fields.length

            ?

            fields.map(
                field => `
                    <div class="detail-item ${
                        field.full
                            ? "full"
                            : ""
                    }">

                        <span>
                            ${escapeHTML(
                                field.label
                            )}
                        </span>

                        <strong>
                            ${escapeHTML(
                                field.value
                            )}
                        </strong>

                    </div>
                `
            ).join("")

            :

            `
                <div class="detail-item full">
                    <span>Thông tin sinh viên</span>
                    <strong>
                        Chưa có thông tin MSSV/khoa/ngành
                        trong dữ liệu tài khoản.
                    </strong>
                </div>
            `;


    const button =
        $("detailVerificationButton");


    if (
        user.role === "user"
    ) {

        button.style.display =
            "inline-flex";

        button.textContent =
            verified
                ? "Thu hồi xác thực"
                : "Cấp xác thực";

        button.dataset.userId =
            user.user_id;

        button.dataset.verified =
            verified
                ? "false"
                : "true";

        button.className =
            verified
                ? "secondary-button"
                : "primary-button";

    }

    else {

        button.style.display =
            "none";
    }


    $("userModal").hidden =
        false;
}


/* =========================================================
   PRODUCTS
========================================================= */

async function loadProducts() {

    const list =
        $("productsList");


    list.innerHTML = `
        <div class="loading-box">
            Đang tải tin đăng...
        </div>
    `;


    try {

        let result =
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
                    status,
                    created_at,
                    is_boosted,
                    boost_started_at,
                    boost_expires_at
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        /*
         * Nếu database chưa có cột boost,
         * vẫn cho Admin xem tin bình thường.
         */

        if (result.error) {

            result =
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
                        status,
                        created_at
                    `)
                    .order(
                        "created_at",
                        {
                            ascending: false
                        }
                    );

        }


        if (result.error) {
            throw result.error;
        }


        products =
            result.data || [];


        await attachProductSellers();


        renderProducts();

    }

    catch (error) {

        console.error(
            "Products error:",
            error
        );

        list.innerHTML = `
            <div class="error-box">
                Không thể tải tin đăng.
                <br><br>
                ${escapeHTML(
                    error.message
                )}
            </div>
        `;
    }
}


async function attachProductSellers() {

    const sellerIds =
        [
            ...new Set(
                products
                    .map(
                        item =>
                            item.seller_id
                    )
                    .filter(Boolean)
            )
        ];


    if (!sellerIds.length) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("users")
            .select(`
                user_id,
                fullname,
                email,
                avatar_url
            `)
            .in(
                "user_id",
                sellerIds
            );


    if (error) {
        throw error;
    }


    const map =
        new Map(
            (data || []).map(
                user => [
                    String(
                        user.user_id
                    ),
                    user
                ]
            )
        );


    products =
        products.map(
            product => ({
                ...product,

                seller:
                    map.get(
                        String(
                            product.seller_id
                        )
                    ) || null
            })
        );
}


function getFilteredProducts() {

    const keyword =
        (
            $("productSearch")?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    return products.filter(
        product => {

            const status =
                product.status ||
                "active";


            const boosted =
                isBoostActive(
                    product
                );


            let filterMatch =
                productFilter ===
                "all";


            if (
                productFilter ===
                "active"
            ) {
                filterMatch =
                    status === "active";
            }


            if (
                productFilter ===
                "hidden"
            ) {
                filterMatch =
                    status === "hidden";
            }


            if (
                productFilter ===
                "boosted"
            ) {
                filterMatch =
                    boosted;
            }


            const text =
                [
                    product.name,
                    product.category,
                    product.seller?.fullname,
                    product.seller?.email
                ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return (
                filterMatch &&
                (
                    !keyword ||
                    text.includes(keyword)
                )
            );

        }
    );
}


function getProductImage(
    imageUrls
) {

    if (
        Array.isArray(imageUrls) &&
        imageUrls.length
    ) {

        return imageUrls[0];

    }


    if (
        typeof imageUrls === "string" &&
        imageUrls.trim()
    ) {

        return imageUrls;

    }


    return "";
}


function renderProducts() {

    const list =
        $("productsList");


    const filtered =
        getFilteredProducts();


    const boostedCount =
        products.filter(
            isBoostActive
        ).length;


    $("productSummary").textContent =
        `${filtered.length} tin đang hiển thị · ` +
        `${boostedCount} tin nổi bật đang hoạt động`;


    if (!filtered.length) {

        list.innerHTML = `
            <div class="empty-box">
                Không tìm thấy tin đăng phù hợp.
            </div>
        `;

        return;
    }


    list.innerHTML =
        filtered
            .map(
                createProductCard
            )
            .join("");
}


function createProductCard(
    product
) {

    const active =
        (
            product.status ||
            "active"
        ) === "active";


    const boosted =
        isBoostActive(
            product
        );


    const image =
        getProductImage(
            product.image_urls
        );


    return `

        <article class="product-admin-card">

            <div class="product-image">

                ${
                    image

                        ?

                        `
                            <img
                                src="${escapeHTML(
                                    image
                                )}"
                                alt="${escapeHTML(
                                    product.name ||
                                    "Sản phẩm"
                                )}"
                            >
                        `

                        :

                        `
                            <div
                                style="
                                    width:100%;
                                    height:100%;
                                    display:flex;
                                    align-items:center;
                                    justify-content:center;
                                    font-size:40px;
                                "
                            >
                                📦
                            </div>
                        `
                }


                ${
                    boosted

                        ?

                        `
                            <span class="product-featured">
                                🔥 NỔI BẬT
                            </span>
                        `

                        : ""
                }


                ${
                    !active

                        ?

                        `
                            <span class="product-hidden">
                                ĐANG ẨN
                            </span>
                        `

                        : ""
                }

            </div>


            <div class="product-body">

                <div class="product-title">
                    ${escapeHTML(
                        product.name ||
                        "Không có tên"
                    )}
                </div>


                <div class="product-price">
                    ${formatMoney(
                        Number(
                            product.price
                        ) || 0
                    )}
                </div>


                <div class="product-meta">

                    <span>
                        Người bán:
                        ${escapeHTML(
                            product.seller?.fullname ||
                            "Không xác định"
                        )}
                    </span>

                    <span>
                        Danh mục:
                        ${escapeHTML(
                            product.category ||
                            "Chưa phân loại"
                        )}
                    </span>

                    <span>
                        Số lượng:
                        ${escapeHTML(
                            product.quantity ??
                            "0"
                        )}
                    </span>

                    ${
                        boosted

                            ?

                            `
                                <span>
                                    Hết nổi bật:
                                    ${formatDate(
                                        product.boost_expires_at
                                    )}
                                </span>
                            `

                            : ""
                    }

                </div>


                <div class="product-status-line">

                    <span class="status-pill ${
                        active
                            ? "status-active"
                            : "status-hidden"
                    }">

                        ${
                            active
                                ? "Đang hiển thị"
                                : "Đang ẩn"
                        }

                    </span>

                </div>


                <div class="product-actions">

                    <button
                        class="toggle"
                        type="button"
                        data-product-action="${
                            active
                                ? "hide"
                                : "show"
                        }"
                        data-product-id="${escapeHTML(
                            product.id
                        )}"
                    >

                        ${
                            active
                                ? "Ẩn tin"
                                : "Hiện tin"
                        }

                    </button>


                    <button
                        class="delete"
                        type="button"
                        data-product-action="delete"
                        data-product-id="${escapeHTML(
                            product.id
                        )}"
                    >
                        Xóa
                    </button>

                </div>

            </div>

        </article>

    `;
}


/* =========================================================
   PRODUCT ACTION
========================================================= */

document.addEventListener(
    "click",
    async function(event) {

        const button =
            event.target.closest(
                "[data-product-action]"
            );


        if (!button) {
            return;
        }


        const productId =
            button.dataset.productId;


        const action =
            button.dataset.productAction;


        const product =
            products.find(
                item =>
                    String(item.id) ===
                    String(productId)
            );


        if (!product) {
            return;
        }


        if (
            action === "delete"
        ) {

            if (
                !confirm(
                    `Xóa tin "${product.name}"?\n\nHành động này không thể hoàn tác.`
                )
            ) {
                return;
            }

        }

        else {

            const newStatus =
                action === "hide"
                    ? "hidden"
                    : "active";


            if (
                !confirm(
                    newStatus === "hidden"
                        ? `Ẩn tin "${product.name}"?`
                        : `Hiện lại tin "${product.name}"?`
                )
            ) {
                return;
            }

        }


        button.disabled =
            true;


        try {

            if (
                action === "delete"
            ) {

                const {
                    error
                } =
                    await supabaseClient
                        .from("products")
                        .delete()
                        .eq(
                            "id",
                            productId
                        );


                if (error) {
                    throw error;
                }


                products =
                    products.filter(
                        item =>
                            String(item.id) !==
                            String(productId)
                    );

            }

            else {

                const newStatus =
                    action === "hide"
                        ? "hidden"
                        : "active";


                const {
                    error
                } =
                    await supabaseClient
                        .from("products")
                        .update({
                            status:
                                newStatus
                        })
                        .eq(
                            "id",
                            productId
                        );


                if (error) {
                    throw error;
                }


                product.status =
                    newStatus;

            }


            renderProducts();
            await loadDashboard();

        }

        catch (error) {

            console.error(
                error
            );

            alert(
                error.message ||
                "Không thể cập nhật tin đăng."
            );

        }

        finally {

            button.disabled =
                false;

        }

    }
);


/* =========================================================
   ORDERS
========================================================= */

async function loadOrders() {

    const list =
        $("ordersList");


    list.innerHTML = `
        <div class="loading-box">
            Đang tải đơn hàng...
        </div>
    `;


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("orders")
                .select(`
                    id,
                    order_code,
                    buyer_id,
                    recipient_name,
                    recipient_phone,
                    recipient_address,
                    note,
                    shipping_method,
                    shipping_fee,
                    payment_method,
                    subtotal,
                    total_amount,
                    status,
                    created_at,
                    updated_at
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {
            throw error;
        }


        orders =
            data || [];


        await attachOrderBuyers();
        await attachOrderItems();


        renderOrders();

    }

    catch (error) {

        console.error(
            "Orders error:",
            error
        );

        list.innerHTML = `
            <div class="error-box">
                Không thể tải đơn hàng.
                <br><br>
                ${escapeHTML(
                    error.message
                )}
            </div>
        `;
    }
}


async function attachOrderBuyers() {

    const ids =
        [
            ...new Set(
                orders
                    .map(
                        order =>
                            order.buyer_id
                    )
                    .filter(Boolean)
            )
        ];


    if (!ids.length) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("users")
            .select("*")
            .in(
                "user_id",
                ids
            );


    if (error) {
        throw error;
    }


    const map =
        new Map(
            (data || []).map(
                user => [
                    String(
                        user.user_id
                    ),
                    user
                ]
            )
        );


    orders =
        orders.map(
            order => ({
                ...order,

                buyer:
                    map.get(
                        String(
                            order.buyer_id
                        )
                    ) || null
            })
        );
}


async function attachOrderItems() {

    const orderIds =
        orders.map(
            order =>
                order.id
        );


    if (!orderIds.length) {
        return;
    }


    const {
        data: items,
        error
    } =
        await supabaseClient
            .from("order_items")
            .select(`
                id,
                order_id,
                product_id,
                seller_id,
                product_name,
                product_image,
                price,
                quantity,
                subtotal
            `)
            .in(
                "order_id",
                orderIds
            );


    if (error) {
        throw error;
    }


    const productIds =
        [
            ...new Set(
                (items || [])
                    .map(
                        item =>
                            item.product_id
                    )
                    .filter(Boolean)
            )
        ];


    let productMap =
        new Map();


    if (productIds.length) {

        /*
         * Có boost columns
         */

        let result =
            await supabaseClient
                .from("products")
                .select(`
                    id,
                    is_boosted,
                    boost_started_at,
                    boost_expires_at
                `)
                .in(
                    "id",
                    productIds
                );


        /*
         * Fallback nếu DB chưa có boost columns.
         */

        if (result.error) {

            result =
                await supabaseClient
                    .from("products")
                    .select("id")
                    .in(
                        "id",
                        productIds
                    );

        }


        if (
            !result.error
        ) {

            productMap =
                new Map(
                    (result.data || [])
                        .map(
                            product => [
                                String(
                                    product.id
                                ),
                                product
                            ]
                        )
                );

        }

    }


    const enrichedItems =
        (items || []).map(
            item => {

                const product =
                    productMap.get(
                        String(
                            item.product_id
                        )
                    );


                let boosted =
                    false;


                /*
                 * Kiểm tra tin nổi bật tại thời điểm
                 * đơn hàng được tạo.
                 */

                if (
                    product?.boost_started_at &&
                    product?.boost_expires_at
                ) {

                    const order =
                        orders.find(
                            itemOrder =>
                                String(
                                    itemOrder.id
                                ) ===
                                String(
                                    item.order_id
                                )
                        );


                    if (order) {

                        const time =
                            new Date(
                                order.created_at
                            ).getTime();


                        boosted =
                            time >=
                                new Date(
                                    product.boost_started_at
                                ).getTime()

                            &&

                            time <=
                                new Date(
                                    product.boost_expires_at
                                ).getTime();

                    }

                }

                else {

                    boosted =
                        product?.is_boosted === true;

                }


                return {
                    ...item,
                    product,
                    boosted
                };

            }
        );


    orders =
        orders.map(
            order => ({

                ...order,

                items:
                    enrichedItems.filter(
                        item =>
                            String(
                                item.order_id
                            ) ===
                            String(
                                order.id
                            )
                    )

            })
        );
}


function getFilteredOrders() {

    const keyword =
        (
            $("orderSearch")?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    return orders.filter(
        order => {

            let filterMatch =
                orderFilter === "all";


            if (
                orderFilter !== "all"
            ) {

                if (
                    orderFilter === "pending"
                ) {

                    filterMatch =
                        [
                            "pending",
                            "confirmed"
                        ].includes(
                            order.status
                        );

                }

                else {

                    filterMatch =
                        order.status ===
                        orderFilter;

                }

            }


            const text =
                [
                    order.order_code,
                    order.buyer?.fullname,
                    order.buyer?.email,
                    order.recipient_name
                ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return (
                filterMatch &&
                (
                    !keyword ||
                    text.includes(keyword)
                )
            );

        }
    );
}


function renderOrders() {

    const list =
        $("ordersList");


    const filtered =
        getFilteredOrders();


    const boostedOrders =
        filtered.filter(
            order =>
                order.items?.some(
                    item =>
                        item.boosted
                )
        ).length;


    $("orderSummary").textContent =
        `${filtered.length} đơn hàng · ` +
        `${boostedOrders} đơn có sản phẩm nổi bật`;


    if (!filtered.length) {

        list.innerHTML = `
            <div class="empty-box">
                Không tìm thấy đơn hàng.
            </div>
        `;

        return;
    }


    list.innerHTML =
        filtered
            .map(
                createOrderCard
            )
            .join("");
}


function createOrderCard(
    order
) {

    const boostedItems =
        (order.items || [])
            .filter(
                item =>
                    item.boosted
            );


    return `

        <article class="order-card">

            <div>

                <div class="order-code">
                    Đơn ${
                        escapeHTML(
                            order.order_code ||
                            "#" + order.id
                        )
                    }
                </div>


                <div class="order-buyer">

                    Người mua:
                    ${escapeHTML(
                        order.buyer?.fullname ||
                        order.recipient_name ||
                        "Không xác định"
                    )}

                </div>


                <div class="order-meta">

                    ${escapeHTML(
                        formatDate(
                            order.created_at
                        )
                    )}

                    ·

                    ${escapeHTML(
                        paymentText(
                            order.payment_method
                        )
                    )}

                </div>


                ${
                    boostedItems.length

                        ?

                        `
                            <span class="boost-order-badge">
                                🔥 ${boostedItems.length}
                                sản phẩm nổi bật
                            </span>
                        `

                        : ""
                }

            </div>


            <div>

                <span class="order-status ${
                    order.status || "pending"
                }">

                    ${escapeHTML(
                        orderStatusText(
                            order.status
                        )
                    )}

                </span>


                <div class="order-meta">

                    ${(
                        order.items ||
                        []
                    ).length}

                    sản phẩm

                </div>

            </div>


            <div>

                <div class="order-total">
                    ${formatMoney(
                        order.total_amount
                    )}
                </div>


                <div class="order-buttons">

                    <button
                        class="order-view"
                        type="button"
                        data-order-view="${escapeHTML(
                            order.id
                        )}"
                    >
                        Chi tiết
                    </button>


                    <select
                        class="order-status-select"
                        data-order-status-id="${escapeHTML(
                            order.id
                        )}"
                    >

                        ${
                            [
                                "pending",
                                "confirmed",
                                "shipping",
                                "delivered",
                                "completed",
                                "cancelled"
                            ]
                            .map(
                                status => `
                                    <option
                                        value="${status}"
                                        ${
                                            order.status ===
                                            status
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        ${orderStatusText(
                                            status
                                        )}
                                    </option>
                                `
                            )
                            .join("")
                        }

                    </select>

                </div>

            </div>

        </article>

    `;
}


/* =========================================================
   ORDER EVENTS
========================================================= */

document.addEventListener(
    "click",
    function(event) {

        const button =
            event.target.closest(
                "[data-order-view]"
            );


        if (!button) {
            return;
        }


        openOrderDetail(
            button.dataset.orderView
        );
    }
);


document.addEventListener(
    "change",
    async function(event) {

        const select =
            event.target.closest(
                "[data-order-status-id]"
            );


        if (!select) {
            return;
        }


        const orderId =
            select.dataset.orderStatusId;


        const newStatus =
            select.value;


        try {

            select.disabled =
                true;


            const {
                error
            } =
                await supabaseClient
                    .rpc(
                        "update_order_status",
                        {
                            p_order_id:
                                Number(
                                    orderId
                                ),

                            p_new_status:
                                newStatus
                        }
                    );


            if (error) {
                throw error;
            }


            await loadOrders();
            await loadDashboard();

        }

        catch (error) {

            console.error(
                error
            );

            alert(
                error.message ||
                "Không thể cập nhật trạng thái đơn."
            );

            await loadOrders();

        }

        finally {

            select.disabled =
                false;
        }

    }
);


/* =========================================================
   ORDER DETAIL
========================================================= */

function openOrderDetail(
    orderId
) {

    const order =
        orders.find(
            item =>
                String(item.id) ===
                String(orderId)
        );


    if (!order) {
        return;
    }


    selectedOrder =
        order;


    $("orderDetailCode").textContent =
        order.order_code ||
        "#" + order.id;


    $("orderDetailDate").textContent =
        formatDate(
            order.created_at
        );


    $("orderDetailInfo").innerHTML = `

        <div class="order-info-item">

            <span>Người mua</span>

            <strong>
                ${escapeHTML(
                    order.buyer?.fullname ||
                    order.recipient_name ||
                    "-"
                )}
            </strong>

        </div>


        <div class="order-info-item">

            <span>Email</span>

            <strong>
                ${escapeHTML(
                    order.buyer?.email ||
                    "-"
                )}
            </strong>

        </div>


        <div class="order-info-item">

            <span>Số điện thoại</span>

            <strong>
                ${escapeHTML(
                    order.recipient_phone ||
                    "-"
                )}
            </strong>

        </div>


        <div class="order-info-item">

            <span>Thanh toán</span>

            <strong>
                ${escapeHTML(
                    paymentText(
                        order.payment_method
                    )
                )}
            </strong>

        </div>


        <div class="order-info-item">

            <span>Giao hàng</span>

            <strong>
                ${escapeHTML(
                    order.shipping_method ||
                    "-"
                )}
            </strong>

        </div>


        <div class="order-info-item">

            <span>Trạng thái</span>

            <strong>
                ${escapeHTML(
                    orderStatusText(
                        order.status
                    )
                )}
            </strong>

        </div>


        <div class="order-info-item"
             style="grid-column:1/-1">

            <span>Địa chỉ nhận</span>

            <strong>
                ${escapeHTML(
                    order.recipient_address ||
                    "-"
                )}
            </strong>

        </div>

    `;


    const items =
        order.items || [];


    $("orderDetailItems").innerHTML =
        items.length

            ?

            items.map(
                item => `

                    <div class="order-item">

                        ${
                            item.product_image

                                ?

                                `
                                    <img
                                        src="${escapeHTML(
                                            item.product_image
                                        )}"
                                        alt=""
                                    >
                                `

                                :

                                `
                                    <div
                                        style="
                                            width:46px;
                                            height:46px;
                                            display:flex;
                                            align-items:center;
                                            justify-content:center;
                                            background:#f1f4f8;
                                            border-radius:7px;
                                            font-size:20px;
                                        "
                                    >
                                        📦
                                    </div>
                                `
                        }


                        <div class="order-item-info">

                            <strong>
                                ${escapeHTML(
                                    item.product_name ||
                                    "Sản phẩm"
                                )}
                            </strong>


                            <span>
                                SL:
                                ${escapeHTML(
                                    item.quantity
                                )}

                                ·

                                Đơn giá:
                                ${formatMoney(
                                    item.price
                                )}
                            </span>


                            ${
                                item.boosted

                                    ?

                                    `
                                        <span class="order-boost">
                                            🔥 TIN NỔI BẬT
                                        </span>
                                    `

                                    : ""
                            }

                        </div>


                        <div class="order-item-price">
                            ${formatMoney(
                                item.subtotal
                            )}
                        </div>

                    </div>

                `
            ).join("")

            :

            `
                <div class="empty-box">
                    Đơn hàng chưa có sản phẩm.
                </div>
            `;


    $("orderDetailTotal").textContent =
        formatMoney(
            order.total_amount
        );


    $("orderModal").hidden =
        false;
}


/* =========================================================
   FORUM
========================================================= */

async function loadForumPosts() {

    const list =
        $("forumList");


    list.innerHTML = `
        <div class="loading-box">
            Đang tải bài viết...
        </div>
    `;


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("forum_posts")
                .select(`
                    id,
                    author_id,
                    content,
                    post_type,
                    created_at,
                    moderation_status
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {

            /*
             * Báo rõ nếu Admin chưa thêm
             * moderation_status.
             */

            if (
                String(
                    error.message
                ).includes(
                    "moderation_status"
                )
            ) {

                throw new Error(
                    "Bảng forum_posts chưa có cột moderation_status. Hãy chạy SQL mình đưa ở phía trên."
                );

            }

            throw error;
        }


        forumPosts =
            data || [];


        await attachForumAuthors();


        renderForumPosts();

    }

    catch (error) {

        console.error(
            "Forum error:",
            error
        );

        list.innerHTML = `
            <div class="error-box">
                ${escapeHTML(
                    error.message
                )}
            </div>
        `;
    }
}


async function attachForumAuthors() {

    const ids =
        [
            ...new Set(
                forumPosts
                    .map(
                        post =>
                            post.author_id
                    )
                    .filter(Boolean)
            )
        ];


    if (!ids.length) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("users")
            .select(`
                user_id,
                fullname,
                avatar_url
            `)
            .in(
                "user_id",
                ids
            );


    if (error) {
        throw error;
    }


    const map =
        new Map(
            (data || []).map(
                user => [
                    String(
                        user.user_id
                    ),
                    user
                ]
            )
        );


    forumPosts =
        forumPosts.map(
            post => ({
                ...post,

                author:
                    map.get(
                        String(
                            post.author_id
                        )
                    ) || null
            })
        );
}


function getFilteredForumPosts() {

    const keyword =
        (
            $("forumSearch")?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    return forumPosts.filter(
        post => {

            const status =
                post.moderation_status ||
                "active";


            const filterMatch =
                forumFilter === "all" ||
                status === forumFilter;


            const text =
                [
                    post.content,
                    post.author?.fullname
                ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return (
                filterMatch &&
                (
                    !keyword ||
                    text.includes(keyword)
                )
            );
        }
    );
}


function renderForumPosts() {

    const list =
        $("forumList");


    const filtered =
        getFilteredForumPosts();


    $("forumSummary").textContent =
        `${filtered.length} bài viết đang hiển thị`;


    if (!filtered.length) {

        list.innerHTML = `
            <div class="empty-box">
                Không có bài viết phù hợp.
            </div>
        `;

        return;
    }


    list.innerHTML =
        filtered
            .map(
                createForumCard
            )
            .join("");
}


function createForumCard(
    post
) {

    const hidden =
        post.moderation_status ===
        "hidden";


    return `

        <article class="forum-card">

            <div class="forum-card-head">

                <div>

                    <div class="forum-author">

                        ${escapeHTML(
                            post.author?.fullname ||
                            "Người dùng IUH"
                        )}

                    </div>

                    <div class="forum-date">

                        ${formatDate(
                            post.created_at
                        )}

                    </div>

                </div>


                <span class="status-pill ${
                    hidden
                        ? "status-hidden"
                        : "status-active"
                }">

                    ${
                        hidden
                            ? "Đang ẩn"
                            : "Đang hiển thị"
                    }

                </span>

            </div>


            <div class="forum-content">

                ${escapeHTML(
                    post.content ||
                    ""
                )}

            </div>


            <div class="forum-actions">

                <button
                    class="${
                        hidden
                            ? "forum-show"
                            : "forum-hide"
                    }"
                    type="button"
                    data-forum-action="${
                        hidden
                            ? "show"
                            : "hide"
                    }"
                    data-forum-id="${escapeHTML(
                        post.id
                    )}"
                >

                    ${
                        hidden
                            ? "Hiện bài"
                            : "Ẩn bài"
                    }

                </button>

            </div>

        </article>

    `;
}


document.addEventListener(
    "click",
    async function(event) {

        const button =
            event.target.closest(
                "[data-forum-action]"
            );


        if (!button) {
            return;
        }


        const post =
            forumPosts.find(
                item =>
                    String(item.id) ===
                    String(
                        button.dataset.forumId
                    )
            );


        if (!post) {
            return;
        }


        const action =
            button.dataset.forumAction;


        const newStatus =
            action === "hide"
                ? "hidden"
                : "active";


        if (
            !confirm(
                newStatus === "hidden"
                    ? "Ẩn bài viết này?"
                    : "Hiện lại bài viết này?"
            )
        ) {
            return;
        }


        try {

            const {
                error
            } =
                await supabaseClient
                    .from("forum_posts")
                    .update({
                        moderation_status:
                            newStatus
                    })
                    .eq(
                        "id",
                        post.id
                    );


            if (error) {
                throw error;
            }


            await loadForumPosts();
            await loadDashboard();

        }

        catch (error) {

            console.error(
                error
            );

            alert(
                error.message ||
                "Không thể cập nhật bài viết."
            );
        }
    }
);

/* =========================================================
   QUẢN LÝ GÓI DỊCH VỤ
========================================================= */

const SERVICE_PACKAGES = {
    1: {
        name: "Gói Cá nhân",
        price: 19000,
        duration: 30,
        type: "personal"
    },

    2: {
        name: "Gói Nhóm",
        price: 29000,
        duration: 30,
        type: "group"
    }
};


/* =========================================================
   TẢI GÓI DỊCH VỤ
========================================================= */

async function loadPackages() {

    const list = $("packagesList");

    if (!list) {
        return;
    }

    list.innerHTML = `
        <div class="loading-box">
            Đang tải gói dịch vụ...
        </div>
    `;

    try {

        /* =====================================================
           1. LẤY MEMBERSHIP
        ===================================================== */

        const {
            data: memberships,
            error: membershipError
        } = await supabaseClient
            .from("service_package_members")
            .select(`
                id,
                package_id,
                user_id,
                member_role,
                joined_at
            `);

        if (membershipError) {
            throw membershipError;
        }


        /* =====================================================
           2. LẤY THÔNG TIN GÓI
        ===================================================== */

        const packageIds = [
            ...new Set(
                (memberships || [])
                    .map(item => item.package_id)
                    .filter(Boolean)
            )
        ];

        let packageMap = new Map();

        if (packageIds.length) {

            const {
                data: packageData,
                error: packageError
            } = await supabaseClient
                .from("service_packages")
                .select(`
                    id,
                    owner_id,
                    plan_type,
                    price,
                    payment_method,
                    transaction_code,
                    status,
                    starts_at,
                    expires_at,
                    created_at
                `)
                .in("id", packageIds);

            if (packageError) {
                throw packageError;
            }

            packageMap = new Map(
                (packageData || []).map(pkg => [
                    String(pkg.id),
                    pkg
                ])
            );
        }


        /* =====================================================
           3. LẤY USER
        ===================================================== */

        const userIds = [
            ...new Set(
                (memberships || [])
                    .map(item => item.user_id)
                    .filter(Boolean)
            )
        ];

        let userMap = new Map();

        if (userIds.length) {

            const {
                data: userData,
                error: userError
            } = await supabaseClient
                .from("users")
                .select(`
                    user_id,
                    fullname,
                    email,
                    avatar_url
                `)
                .in("user_id", userIds);

            if (userError) {
                throw userError;
            }

            userMap = new Map(
                (userData || []).map(user => [
                    String(user.user_id),
                    user
                ])
            );
        }


        /* =====================================================
           4. GHÉP DỮ LIỆU
        ===================================================== */

        servicePackages = (memberships || []).map(item => {

            const pkg =
                packageMap.get(
                    String(item.package_id)
                ) || null;

            const user =
                userMap.get(
                    String(item.user_id)
                ) || null;

            return {
                ...item,

                package: pkg,
                user: user
            };

        });


        /* =====================================================
           5. CẬP NHẬT GIAO DIỆN
        ===================================================== */

        updatePackageOverview();

        renderPackages();

    }

    catch (error) {

        console.error(
            "Packages error:",
            error
        );

        list.innerHTML = `
            <div class="error-box">
                Không thể tải danh sách
                gói dịch vụ.

                <br><br>

                ${escapeHTML(
                    error.message || ""
                )}
            </div>
        `;
    }
}


/* =========================================================
   LẤY THÔNG TIN GÓI
========================================================= */

function getServicePackage(packageId) {

    const item = servicePackages.find(
        item =>
            String(item.package_id) ===
            String(packageId)
    );

    if (item?.package) {

        const pkg = item.package;

        return {
            name:
                pkg.plan_type === "personal"
                    ? "Gói Cá nhân"
                    : pkg.plan_type === "group"
                        ? "Gói Nhóm"
                        : "Gói dịch vụ",

            price:
                Number(pkg.price || 0),

            duration: 30,

            type:
                pkg.plan_type || "unknown",

            status:
                pkg.status || "unknown",

            starts_at:
                pkg.starts_at || null,

            expires_at:
                pkg.expires_at || null
        };
    }


    return {
        name: "Gói dịch vụ",
        price: 0,
        duration: 30,
        type: "unknown",
        status: "unknown",
        starts_at: null,
        expires_at: null
    };
}


/* =========================================================
   LẤY NGÀY BẮT ĐẦU
========================================================= */

function getPackageStartDate(item) {

    if (item?.package?.starts_at) {
        const date =
            new Date(
                item.package.starts_at
            );

        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    if (item?.joined_at) {
        const date =
            new Date(item.joined_at);

        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    return null;
}


/* =========================================================
   LẤY NGÀY HẾT HẠN
========================================================= */

function getPackageExpireDate(item) {

    if (item?.package?.expires_at) {

        const date =
            new Date(
                item.package.expires_at
            );

        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    return null;
}


/* =========================================================
   TRẠNG THÁI GÓI
========================================================= */

function getPackageStatus(item) {

    const expire =
        getPackageExpireDate(item);


    if (!expire) {
        return "unknown";
    }


    return expire.getTime() > Date.now()
        ? "active"
        : "expired";
}


/* =========================================================
   LỌC GÓI
========================================================= */

function getFilteredPackages() {

    const keyword =
        (
            $("packageSearch")?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    return servicePackages.filter(item => {

        const info =
            getServicePackage(
                item.package_id
            );


        const status =
            getPackageStatus(item);


        const user =
            item.user || {};


        const searchable = [

            user.fullname,

            user.email,

            info.name

        ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();


        const searchMatch =
            !keyword ||
            searchable.includes(keyword);


        let filterMatch = true;


        if (
            packageFilter === "personal"
        ) {

            filterMatch =
                info.type === "personal";

        }


        if (
            packageFilter === "group"
        ) {

            filterMatch =
                info.type === "group";

        }


        if (
            packageFilter === "active"
        ) {

            filterMatch =
                status === "active";

        }


        if (
            packageFilter === "expired"
        ) {

            filterMatch =
                status === "expired";

        }


        return (
            searchMatch &&
            filterMatch
        );

    });
}


/* =========================================================
   THỐNG KÊ GÓI
========================================================= */

function updatePackageOverview() {

    const total =
        servicePackages.length;


    const personal =
        servicePackages.filter(item =>
            getServicePackage(
                item.package_id
            ).type === "personal"
        ).length;


    const group =
        servicePackages.filter(item =>
            getServicePackage(
                item.package_id
            ).type === "group"
        ).length;


    /*
     * Doanh thu gói lấy từ giao dịch
     * wallet Admin, không lấy membership
     * để tránh tính sai doanh thu.
     */

    let packageRevenue = 0;


    financeTransactions.forEach(
        transaction => {

            const text =
                (
                    transaction.title ||
                    ""
                ).toLowerCase()
                +
                " "
                +
                (
                    transaction.description ||
                    ""
                ).toLowerCase();


            if (
                text.includes("gói") ||
                text.includes("dịch vụ")
            ) {

                packageRevenue +=
                    Number(
                        transaction.amount || 0
                    );

            }

        }
    );


    if ($("packageTotal")) {
        $("packageTotal").textContent =
            total.toLocaleString("vi-VN");
    }


    if ($("packagePersonal")) {
        $("packagePersonal").textContent =
            personal.toLocaleString("vi-VN");
    }


    if ($("packageGroup")) {
        $("packageGroup").textContent =
            group.toLocaleString("vi-VN");
    }


    if ($("packageRevenue")) {
        $("packageRevenue").textContent =
            formatMoney(
                packageRevenue
            );
    }

}


/* =========================================================
   HIỂN THỊ GÓI
========================================================= */

function renderPackages() {

    const list =
        $("packagesList");


    if (!list) {
        return;
    }


    const filtered =
        getFilteredPackages();


    if ($("packageSummary")) {

        $("packageSummary").textContent =
            `${filtered.length} gói đang hiển thị · ` +
            `${servicePackages.length} lượt đăng ký`;

    }


    if (!filtered.length) {

        list.innerHTML = `
            <div class="empty-box">
                Không tìm thấy gói dịch vụ phù hợp.
            </div>
        `;

        return;
    }


    list.innerHTML = `

        <div class="package-table-head">

            <span>NGƯỜI DÙNG</span>

            <span>GÓI</span>

            <span>THỜI HẠN</span>

            <span>TRẠNG THÁI</span>

            <span>GIÁ</span>

        </div>


        ${
            filtered
                .map(
                    createPackageRow
                )
                .join("")
        }

    `;
}


/* =========================================================
   CARD GÓI
========================================================= */

function createPackageRow(item) {

    const info =
        getServicePackage(
            item.package_id
        );


    const user =
        item.user || {};


    const start =
        getPackageStartDate(item);


    const expire =
        getPackageExpireDate(item);


    const status =
        getPackageStatus(item);


    const statusText =
        status === "active"
            ? "Đang hoạt động"
            : status === "expired"
                ? "Hết hạn"
                : "Chưa xác định";


    const statusClass =
        status === "active"
            ? "package-status-active"
            : "package-status-expired";


    return `

        <div class="package-row">

            <div class="package-user">

                <img
                    src="${escapeHTML(
                        user.avatar_url ||
                        DEFAULT_AVATAR
                    )}"
                    alt="Avatar"
                    onerror="
                        this.src='${DEFAULT_AVATAR}'
                    "
                >

                <div>

                    <strong>
                        ${escapeHTML(
                            user.fullname ||
                            "Chưa cập nhật"
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(
                            user.email ||
                            "Chưa có email"
                        )}
                    </span>

                </div>

            </div>


            <div class="package-name">

                <strong>
                    ${escapeHTML(
                        info.name
                    )}
                </strong>

                <span>
                    ${info.duration} ngày
                </span>

            </div>


            <div class="package-dates">

                <span>
                    Bắt đầu:
                    ${
                        start
                            ? start.toLocaleDateString(
                                "vi-VN"
                            )
                            : "-"
                    }
                </span>

                <span>
                    Hết hạn:
                    ${
                        expire
                            ? expire.toLocaleDateString(
                                "vi-VN"
                            )
                            : "-"
                    }
                </span>

            </div>


            <div>

                <span
                    class="${statusClass}"
                >
                    ${statusText}
                </span>

            </div>


            <div class="package-price">

                ${formatMoney(
                    info.price
                )}

            </div>

        </div>

    `;
}

/* =========================================================
   PACKAGE EVENTS
========================================================= */

document
    .querySelectorAll(
        ".package-filter"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            function() {

                document
                    .querySelectorAll(
                        ".package-filter"
                    )
                    .forEach(item =>
                        item.classList.remove(
                            "active"
                        )
                    );


                button.classList.add(
                    "active"
                );


                packageFilter =
                    button.dataset.packageFilter;


                renderPackages();

            }
        );

    });


$("packageSearch")
    ?.addEventListener(
        "input",
        renderPackages
    );

    /* =========================================================
   DONATIONS
========================================================= */

async function loadDonations() {

    const list =
        $("donationList");

    const summary =
        $("donationSummary");

    const viewAllButton =
        $("donationViewAllBtn");


    if (!list) {
        return;
    }


    list.innerHTML = `
        <div class="loading-box">
            Đang tải Donate...
        </div>
    `;


    try {

        const fromDate =
            $("donationFromDate")?.value || "";

        const toDate =
            $("donationToDate")?.value || "";


        /* =========================================
           KIỂM TRA KHOẢNG NGÀY
        ========================================= */

        if (
            fromDate &&
            toDate &&
            fromDate > toDate
        ) {

            alert(
                "Ngày bắt đầu không được lớn hơn ngày kết thúc."
            );

            return;
        }


        let query =
            supabaseClient
                .from("donations")
                .select(`
                    id,
                    donor_id,
                    donor_name,
                    amount,
                    payment_method,
                    transfer_code,
                    status,
                    note,
                    bank_name,
                    transfer_content,
                    created_at
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        /* =========================================
           LỌC TỪ NGÀY
        ========================================= */

        if (fromDate) {

            const start =
                new Date(
                    `${fromDate}T00:00:00`
                );

            query =
                query.gte(
                    "created_at",
                    start.toISOString()
                );
        }


        /* =========================================
           LỌC ĐẾN NGÀY
           → lấy hết ngày được chọn
        ========================================= */

        if (toDate) {

            const end =
                new Date(
                    `${toDate}T00:00:00`
                );

            end.setDate(
                end.getDate() + 1
            );

            query =
                query.lt(
                    "created_at",
                    end.toISOString()
                );
        }


        const {
            data,
            error
        } =
            await query;


        if (error) {
            throw error;
        }


        donations =
            data || [];


        donationShowAll = false;


        renderDonations();


    }
    catch (error) {

        console.error(
            "Donation error:",
            error
        );


        list.innerHTML = `
            <div class="error-box">
                Không thể tải dữ liệu Donate.
                <br><br>
                ${escapeHTML(
                    error.message
                )}
            </div>
        `;


        if (summary) {
            summary.textContent =
                "Không thể tải dữ liệu.";
        }


        if (viewAllButton) {
            viewAllButton.style.display =
                "none";
        }

    }

}


/* =========================================================
   RENDER DONATIONS
========================================================= */

function renderDonations() {

    const list =
        $("donationList");

    const summary =
        $("donationSummary");

    const viewAllButton =
        $("donationViewAllBtn");


    if (!list) {
        return;
    }


    const total =
        donations.length;


    const displayItems =
        donationShowAll
            ? donations
            : donations.slice(0, 10);


    /* =========================================
       KHÔNG CÓ DONATE
    ========================================= */

    if (!displayItems.length) {

        list.innerHTML = `
            <div class="empty-box">
                Chưa có khoản Donate nào
                trong khoảng thời gian đã chọn.
            </div>
        `;


        if (summary) {

            summary.textContent =
                "0 lượt Donate";
        }


        if (viewAllButton) {

            viewAllButton.style.display =
                "none";
        }


        return;
    }


    /* =========================================
       TỔNG TIỀN
    ========================================= */

    const totalAmount =
        donations.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.amount || 0
                ),
            0
        );


    if (summary) {

        summary.textContent =
            donationShowAll
                ? `Đang hiển thị tất cả ${total} lượt Donate • Tổng ${formatMoney(totalAmount)}`
                : `Đang hiển thị ${Math.min(total, 10)} / ${total} lượt Donate • Tổng ${formatMoney(totalAmount)}`;
    }


    /* =========================================
       BẢNG
    ========================================= */

    list.innerHTML =
        displayItems
            .map(
                donation => {

                    const status =
                        String(
                            donation.status ||
                            ""
                        ).toLowerCase();


                    let statusText =
                        "Không xác định";

                    if (
                        status ===
                        "completed"
                    ) {
                        statusText =
                            "Hoàn tất";
                    }
                    else if (
                        status ===
                        "pending"
                    ) {
                        statusText =
                            "Chờ xử lý";
                    }
                    else if (
                        status ===
                        "cancelled"
                    ) {
                        statusText =
                            "Đã hủy";
                    }


                    return `
                        <div class="donation-row">

                            <div class="donation-date">
                                ${formatDate(
                                    donation.created_at
                                )}
                            </div>


                            <div class="donation-donor">

                                <strong>
                                    ${escapeHTML(
                                        donation.donor_name ||
                                        "Ẩn danh"
                                    )}
                                </strong>

                            </div>


                            <div class="donation-bank">

                                ${escapeHTML(
                                    donation.bank_name ||
                                    "-"
                                )}

                            </div>


                            <div class="donation-amount">

                                ${formatMoney(
                                    donation.amount
                                )}

                            </div>


                            <div class="donation-content">

                                ${escapeHTML(
                                    donation.transfer_content ||
                                    "-"
                                )}

                            </div>


                            <div class="donation-code">

                                ${escapeHTML(
                                    donation.transfer_code ||
                                    "-"
                                )}

                            </div>


                            <div>

                                <span
                                    class="donation-status ${status}"
                                >
                                    ${statusText}
                                </span>

                            </div>

                        </div>
                    `;
                }
            )
            .join("");


    /* =========================================
       NÚT XEM TẤT CẢ
    ========================================= */

    if (viewAllButton) {

        if (total > 10) {

            viewAllButton.style.display =
                "inline-flex";

            viewAllButton.textContent =
                donationShowAll
                    ? "Thu gọn"
                    : `Xem tất cả (${total})`;

        }
        else {

            viewAllButton.style.display =
                "none";
        }

    }

}

/* =========================================================
   FINANCE
========================================================= */

async function loadFinance() {

    const list =
        $("financeList");


    list.innerHTML = `
        <div class="loading-box">
            Đang tải giao dịch...
        </div>
    `;


    const revenue =
        await loadAdminRevenue();


    financeTransactions =
        revenue.transactions || [];


    $("financeTotal").textContent =
        formatMoney(
            revenue.total
        );


    if (!financeTransactions.length) {

        list.innerHTML = `
            <div class="empty-box">
                Chưa có giao dịch phí.
            </div>
        `;

        return;
    }


    list.innerHTML =
        financeTransactions
            .map(
                transaction => {

                    const text =
                        (
                            transaction.title ||
                            ""
                        ).toLowerCase();


                    let type = "Phí sàn";


if (
    text.includes("donate") ||
    text.includes("ủng hộ") ||
    text.includes("ung ho")
) {
    type = "Donate";
}


else if (
    text.includes("gói dịch vụ") ||
    text.includes("gói cá nhân") ||
    text.includes("gói nhóm") ||
    (
        text.includes("gói") &&
        !text.includes("đẩy tin")
    )
) {
    type = "Gói dịch vụ";
}


else if (
    text.includes("đẩy tin") ||
    text.includes("nổi bật")
) {
    type = "Phí đẩy tin";
}


else if (
    text.includes("phí ký gửi") ||
    text.includes("ký gửi") ||
    text.includes("ky gui") ||
    text.includes("consignment")
) {
    type = "Phí ký gửi";
}


                    return `

                        <div class="finance-row">

                            <span>
                                ${formatDate(
                                    transaction.created_at
                                )}
                            </span>


                            <span>
                                ${escapeHTML(
                                    transaction.title ||
                                    transaction.description ||
                                    "-"
                                )}
                            </span>


                            <span>
                                ${type}
                            </span>


                            <span class="amount">
                                +${formatMoney(
                                    transaction.amount
                                )}
                            </span>

                        </div>

                    `;

                }
            )
            .join("");
}


/* =========================================================
   FILTER EVENTS
========================================================= */

document
    .querySelectorAll(
        ".user-filter"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                function() {

                    document
                        .querySelectorAll(
                            ".user-filter"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    button.classList.add(
                        "active"
                    );


                    userFilter =
                        button.dataset.userFilter;


                    renderUsers();
                }
            );

        }
    );


$("userSearch")
    ?.addEventListener(
        "input",
        renderUsers
    );


document
    .querySelectorAll(
        ".product-filter"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                function() {

                    document
                        .querySelectorAll(
                            ".product-filter"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    button.classList.add(
                        "active"
                    );


                    productFilter =
                        button.dataset.productFilter;


                    renderProducts();
                }
            );

        }
    );


$("productSearch")
    ?.addEventListener(
        "input",
        renderProducts
    );


document
    .querySelectorAll(
        ".order-filter"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                function() {

                    document
                        .querySelectorAll(
                            ".order-filter"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    button.classList.add(
                        "active"
                    );


                    orderFilter =
                        button.dataset.orderFilter;


                    renderOrders();
                }
            );

        }
    );


$("orderSearch")
    ?.addEventListener(
        "input",
        renderOrders
    );


document
    .querySelectorAll(
        ".forum-filter"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                function() {

                    document
                        .querySelectorAll(
                            ".forum-filter"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    button.classList.add(
                        "active"
                    );


                    forumFilter =
                        button.dataset.forumFilter;


                    renderForumPosts();
                }
            );

        }
    );


$("forumSearch")
    ?.addEventListener(
        "input",
        renderForumPosts
    );


/* =========================================================
   MODAL EVENTS
========================================================= */

document.addEventListener(
    "click",
    function(event) {

        const close =
            event.target.closest(
                "[data-close-modal]"
            );


        if (!close) {
            return;
        }


        const modalId =
            close.dataset.closeModal;


        if ($(modalId)) {
            $(modalId).hidden =
                true;
        }
    }
);


document.addEventListener(
    "click",
    function(event) {

        if (
            event.target.classList.contains(
                "modal-overlay"
            )
        ) {

            event.target.hidden =
                true;
        }
    }
);


document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key !== "Escape"
        ) {
            return;
        }


        document
            .querySelectorAll(
                ".modal-overlay"
            )
            .forEach(
                modal =>
                    modal.hidden = true
            );
    }
);


/* =========================================================
   DETAIL USER VERIFICATION
========================================================= */

$("detailVerificationButton")
    ?.addEventListener(
        "click",
        async function() {

            if (!selectedUser) {
                return;
            }


            const verified =
                this.dataset.verified ===
                "true";


            await setUserVerification(
                selectedUser.user_id,
                verified
            );


            $("userModal").hidden =
                true;
        }
    );

    /* =========================================================
   QUẢN LÝ KÝ GỬI
========================================================= */

const consignmentStatusText = {
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    selling: "Đang ký gửi",
    sold: "Đã bán",
    completed: "Hoàn thành",
    rejected: "Từ chối",
    cancelled: "Đã hủy"
};


function consignmentStatusLabel(status) {
    return (
        consignmentStatusText[status] ||
        status ||
        "Không xác định"
    );
}


function getFilteredConsignments() {

    const keyword =
        (
            $("consignmentSearch")?.value ||
            ""
        )
        .trim()
        .toLowerCase();


    return consignments.filter(
        item => {

            const filterMatch =
                consignmentFilter === "all" ||
                item.status === consignmentFilter;


            const text =
                [
                    item.product_name,
                    item.category,
                    item.condition,
                    item.sender?.fullname,
                    item.sender?.email
                ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return (
                filterMatch &&
                (
                    !keyword ||
                    text.includes(keyword)
                )
            );

        }
    );
}


/* =========================================================
   LOAD DANH SÁCH KÝ GỬI
========================================================= */

async function loadConsignments() {

    const list =
        $("consignmentList");

    if (!list) {
        return;
    }


    list.innerHTML = `
        <div class="products-loading">
            Đang tải yêu cầu ký gửi...
        </div>
    `;


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("consignment_requests")
                .select(`
                    id,
                    user_id,
                    product_name,
                    category,
                    condition,
                    description,
                    selling_price,
                    service_fee,
                    seller_receive,
                    delivery_method,
                    image_names,
                    product_id,
                    status,
                    admin_note,
                    reviewed_by,
                    reviewed_at,
                    created_at,
                    updated_at
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {
            throw error;
        }


        consignments =
            data || [];


        await attachConsignmentUsers();

        renderConsignments();

    }

    catch (error) {

        console.error(
            "Consignment error:",
            error
        );


        list.innerHTML = `
            <div class="error-box">
                Không thể tải yêu cầu ký gửi.
                <br><br>
                ${escapeHTML(
                    error.message
                )}
            </div>
        `;
    }
}


/* =========================================================
   LẤY THÔNG TIN NGƯỜI GỬI
========================================================= */

async function attachConsignmentUsers() {

    const ids =
        [
            ...new Set(
                consignments
                    .map(
                        item =>
                            item.user_id
                    )
                    .filter(Boolean)
            )
        ];


    if (!ids.length) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("users")
            .select(`
                user_id,
                fullname,
                email,
                avatar_url
            `)
            .in(
                "user_id",
                ids
            );


    if (error) {
        throw error;
    }


    const userMap =
        new Map(
            (data || []).map(
                user => [
                    String(
                        user.user_id
                    ),
                    user
                ]
            )
        );


    consignments =
        consignments.map(
            item => ({
                ...item,

                sender:
                    userMap.get(
                        String(
                            item.user_id
                        )
                    ) || null
            })
        );
}


/* =========================================================
   RENDER
========================================================= */

function renderConsignments() {

    const list =
        $("consignmentList");

    if (!list) {
        return;
    }


    const filtered =
        getFilteredConsignments();


    const total =
        consignments.length;

    const pending =
        consignments.filter(
            item =>
                item.status === "pending"
        ).length;

    const selling =
        consignments.filter(
            item =>
                [
                    "approved",
                    "selling"
                ].includes(
                    item.status
                )
        ).length;

    const sold =
        consignments.filter(
            item =>
                [
                    "sold",
                    "completed"
                ].includes(
                    item.status
                )
        ).length;


    const summary =
        $("consignmentSummary");


    if (summary) {

        summary.textContent =
            `${filtered.length} yêu cầu đang hiển thị · ` +
            `${total} tổng yêu cầu · ` +
            `${pending} chờ duyệt · ` +
            `${selling} đang ký gửi · ` +
            `${sold} đã bán`;

    }


    if (!filtered.length) {

        list.innerHTML = `
            <div class="empty-box">
                Không có yêu cầu ký gửi phù hợp.
            </div>
        `;

        return;
    }


    list.innerHTML =
        filtered
            .map(
                createConsignmentCard
            )
            .join("");
}


/* =========================================================
   CARD KÝ GỬI
========================================================= */

function createConsignmentCard(item) {

    const status =
        item.status || "pending";


    const sender =
        item.sender || {};


    return `

        <article
            class="product-admin-card consignment-admin-card"
        >

            <div class="product-image">

                <div
                    style="
                        width:100%;
                        height:100%;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:42px;
                    "
                >
                    📦
                </div>

            </div>


            <div class="product-body">

                <div class="product-title">

                    ${escapeHTML(
                        item.product_name ||
                        "Không có tên sản phẩm"
                    )}

                </div>


                <div class="product-price">

                    ${formatMoney(
                        item.selling_price
                    )}

                </div>


                <div class="product-meta">

                    <span>
                        Người gửi:
                        ${escapeHTML(
                            sender.fullname ||
                            "Không xác định"
                        )}
                    </span>


                    <span>
                        Email:
                        ${escapeHTML(
                            sender.email ||
                            "-"
                        )}
                    </span>


                    <span>
                        Danh mục:
                        ${escapeHTML(
                            item.category ||
                            "-"
                        )}
                    </span>


                    <span>
                        Tình trạng:
                        ${escapeHTML(
                            item.condition ||
                            "-"
                        )}
                    </span>


                    <span>
                        Ngày gửi:
                        ${formatDate(
                            item.created_at
                        )}
                    </span>

                </div>


                <div class="product-status-line">

                    <span
                        class="status-pill ${
                            status === "pending"
                                ? "status-pending"
                                :
                            [
                                "approved",
                                "selling"
                            ].includes(status)
                                ? "status-active"
                                :
                            [
                                "sold",
                                "completed"
                            ].includes(status)
                                ? "status-completed"
                                :
                                "status-hidden"
                        }"
                    >

                        ${consignmentStatusLabel(
                            status
                        )}

                    </span>

                </div>


                <div class="product-actions">

                    <button
                        type="button"
                        class="toggle"
                        data-consignment-view="${
                            item.id
                        }"
                    >
                        Xem chi tiết
                    </button>

                    <button
    type="button"
    class="delete"
    data-consignment-action="delete"
    data-consignment-id="${item.id}"
>
    Xóa
</button>


                    ${
                        status === "pending"

                            ?

                            `
                                <button
                                    type="button"
                                    class="toggle"
                                    data-consignment-action="approve"
                                    data-consignment-id="${item.id}"
                                >
                                    Duyệt
                                </button>

                                <button
                                    type="button"
                                    class="delete"
                                    data-consignment-action="reject"
                                    data-consignment-id="${item.id}"
                                >
                                    Từ chối
                                </button>
                            `

                            :

                            ""
                    }

                </div>

            </div>

        </article>

    `;
}


/* =========================================================
   CHI TIẾT KÝ GỬI
========================================================= */

function openConsignmentDetail(id) {

    const item =
        consignments.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!item) {
        return;
    }


    selectedConsignment =
        item;


    const sender =
        item.sender || {};


    const existing =
        document.getElementById(
            "consignmentAdminModal"
        );


    if (existing) {
        existing.remove();
    }


    const modal =
        document.createElement("div");


    modal.id =
        "consignmentAdminModal";


    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:999999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:20px;
        background:rgba(15,27,52,.58);
    `;


    modal.innerHTML = `

        <div
            style="
                position:relative;
                width:min(680px,100%);
                max-height:90vh;
                overflow:auto;
                background:#fff;
                border-radius:18px;
                padding:28px;
                box-sizing:border-box;
                box-shadow:0 25px 70px rgba(0,0,0,.25);
            "
        >

            <button
                type="button"
                onclick="document.getElementById('consignmentAdminModal')?.remove()"
                style="
                    position:absolute;
                    top:14px;
                    right:14px;
                    width:34px;
                    height:34px;
                    border:0;
                    border-radius:50%;
                    background:#f1f4f8;
                    cursor:pointer;
                    font-size:18px;
                "
            >
                ×
            </button>


            <span
                style="
                    color:#193f9e;
                    font-size:11px;
                    font-weight:800;
                    letter-spacing:1px;
                "
            >
                YÊU CẦU KÝ GỬI
            </span>


            <h2
                style="
                    margin:8px 40px 20px 0;
                    color:#17233c;
                "
            >
                ${escapeHTML(
                    item.product_name ||
                    "Sản phẩm"
                )}
            </h2>


            <div
                style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:12px;
                "
            >

                <div>
                    <small>Người gửi</small>
                    <strong>
                        ${escapeHTML(
                            sender.fullname ||
                            "-"
                        )}
                    </strong>
                </div>


                <div>
                    <small>Email</small>
                    <strong>
                        ${escapeHTML(
                            sender.email ||
                            "-"
                        )}
                    </strong>
                </div>


                <div>
                    <small>Danh mục</small>
                    <strong>
                        ${escapeHTML(
                            item.category ||
                            "-"
                        )}
                    </strong>
                </div>


                <div>
                    <small>Tình trạng</small>
                    <strong>
                        ${escapeHTML(
                            item.condition ||
                            "-"
                        )}
                    </strong>
                </div>


                <div>
                    <small>Giá mong muốn</small>
                    <strong>
                        ${formatMoney(
                            item.selling_price
                        )}
                    </strong>
                </div>


                <div>
                    <small>Phí ký gửi</small>
                    <strong>
                        ${formatMoney(
                            item.service_fee
                        )}
                    </strong>
                </div>


                <div>
                    <small>Dự kiến nhận</small>
                    <strong>
                        ${formatMoney(
                            item.seller_receive
                        )}
                    </strong>
                </div>


                <div>
                    <small>Ngày gửi</small>
                    <strong>
                        ${formatDate(
                            item.created_at
                        )}
                    </strong>
                </div>

            </div>


            <div
                style="
                    margin-top:20px;
                    padding:16px;
                    background:#f7f9fc;
                    border-radius:10px;
                "
            >

                <strong>
                    Mô tả
                </strong>

                <p
                    style="
                        margin:8px 0 0;
                        line-height:1.7;
                        color:#59657a;
                        white-space:pre-wrap;
                    "
                >
                    ${escapeHTML(
                        item.description ||
                        "Không có mô tả."
                    )}
                </p>

            </div>


            ${
                item.admin_note

                    ?

                    `
                        <div
                            style="
                                margin-top:14px;
                                padding:16px;
                                background:#fff8df;
                                border-radius:10px;
                            "
                        >

                            <strong>
                                Phản hồi Admin
                            </strong>

                            <p>
                                ${escapeHTML(
                                    item.admin_note
                                )}
                            </p>

                        </div>
                    `

                    :

                    ""
            }


            <button
                type="button"
                onclick="document.getElementById('consignmentAdminModal')?.remove()"
                style="
                    width:100%;
                    margin-top:20px;
                    height:44px;
                    border:0;
                    border-radius:9px;
                    background:#193f9e;
                    color:#fff;
                    font-weight:700;
                    cursor:pointer;
                "
            >
                Đóng
            </button>

        </div>

    `;


    document.body.appendChild(
        modal
    );
}


/* =========================================================
   ACTION KÝ GỬI
========================================================= */

async function updateConsignmentStatus(
    id,
    newStatus
) {

    const item =
        consignments.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!item) {
        return;
    }

    const actionText =
        newStatus === "approved"
            ? "duyệt"
            : "từ chối";

    if (
        !confirm(
            `Bạn có chắc muốn ${actionText} yêu cầu "${item.product_name}"?`
        )
    ) {
        return;
    }

    try {

        const {
            data: {
                user
            }
        } =
            await supabaseClient.auth.getUser();


        /* =================================================
           TỪ CHỐI
        ================================================= */

        if (newStatus === "rejected") {

            const { error } =
                await supabaseClient
                    .from("consignment_requests")
                    .update({
                        status: "rejected",

                        reviewed_by:
                            user?.id || null,

                        reviewed_at:
                            new Date().toISOString(),

                        updated_at:
                            new Date().toISOString(),

                        admin_note:
                            "Yêu cầu ký gửi chưa được IUH SHOP chấp nhận."
                    })
                    .eq(
                        "id",
                        id
                    );


            if (error) {
                throw error;
            }


            alert(
                "Đã từ chối yêu cầu ký gửi."
            );

            await loadConsignments();

            return;
        }


        /* =================================================
           DUYỆT → TẠO TIN ĐĂNG
        ================================================= */

        if (newStatus === "approved") {

            /* ---------------------------------------------
               Kiểm tra đã tạo tin chưa
            --------------------------------------------- */

            if (item.product_id) {

                alert(
                    "Yêu cầu này đã có tin đăng."
                );

                return;
            }


            /* ---------------------------------------------
               Tạo tin đăng
            --------------------------------------------- */

            const {
                data: product,
                error: productError
            } =
                await supabaseClient
                    .from("products")
                    .insert({
                        seller_id: user.id,

                        name:
                            item.product_name,

                        category:
                            item.category,

                        quantity:
                            1,

                        price:
                            Number(
                                item.selling_price
                            ) || 0,

                        description:
                            item.description,

                        image_urls:
                            Array.isArray(
                                item.image_names
                            )
                                ? item.image_names
                                : [],

                        status:
                            "active",

                        is_boosted:
                            false,

                        is_consignment:
                            true,
                        
                        consignment_request_id: item.id,
                    })
                    .select("id")
                    .single();


            if (productError) {
                throw productError;
            }


            /* ---------------------------------------------
               Nối yêu cầu ký gửi với tin đăng
            --------------------------------------------- */

            const {
                error: updateError
            } =
                await supabaseClient
                    .from("consignment_requests")
                    .update({

                        status:
                            "selling",

                        product_id:
                            product.id,

                        reviewed_by:
                            user?.id || null,

                        reviewed_at:
                            new Date().toISOString(),

                        updated_at:
                            new Date().toISOString(),

                        admin_note:
                            "Đã duyệt. Sản phẩm đã được đưa lên IUH SHOP."
                    })
                    .eq(
                        "id",
                        id
                    );


            if (updateError) {

                /*
                 * Nếu nối thất bại thì xóa tin
                 * vừa tạo để tránh tin mồ côi.
                 */

                await supabaseClient
                    .from("products")
                    .delete()
                    .eq(
                        "id",
                        product.id
                    );

                throw updateError;
            }


            alert(
                "Đã duyệt ký gửi và tạo tin đăng thành công!"
            );


            await loadConsignments();

            await loadProducts();

            await loadDashboard();

        }

    }

    catch (error) {

        console.error(
            "Update consignment error:",
            error
        );


        alert(
            error.message ||
            "Không thể xử lý yêu cầu ký gửi."
        );
    }
}


/* =========================================================
   EVENTS KÝ GỬI
========================================================= */

document.addEventListener(
    "click",
    async function(event) {

        const viewButton =
            event.target.closest(
                "[data-consignment-view]"
            );


        if (viewButton) {

            openConsignmentDetail(
                viewButton.dataset
                    .consignmentView
            );

            return;
        }


        const actionButton =
            event.target.closest(
                "[data-consignment-action]"
            );


        if (actionButton) {

            const id =
                actionButton.dataset
                    .consignmentId;


            const action =
                actionButton.dataset
                    .consignmentAction;

            if (action === "delete") {

    const item =
        consignments.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!item) {
        return;
    }

    if (
        !confirm(
            `Xóa yêu cầu ký gửi "${item.product_name}"?\n\nDữ liệu này sẽ bị xóa.`
        )
    ) {
        return;
    }

    try {

        // Nếu yêu cầu đã tạo product thì xóa product trước
        if (item.product_id) {

            const {
                error: productError
            } =
                await supabaseClient
                    .from("products")
                    .delete()
                    .eq(
                        "id",
                        item.product_id
                    );

            if (productError) {
                throw productError;
            }
        }

        // Xóa yêu cầu ký gửi
        const {
            error
        } =
            await supabaseClient
                .from("consignment_requests")
                .delete()
                .eq(
                    "id",
                    id
                );

        if (error) {
            throw error;
        }

        alert("Đã xóa yêu cầu ký gửi.");

        await loadConsignments();
        await loadProducts();
        await loadDashboard();

    }
    catch (error) {

        console.error(
            "Delete consignment:",
            error
        );

        alert(
            error.message ||
            "Không thể xóa yêu cầu ký gửi."
        );
    }

    return;
}


            if (
                action === "approve"
            ) {

                await updateConsignmentStatus(
                    id,
                    "approved"
                );

            }


            if (
                action === "reject"
            ) {

                await updateConsignmentStatus(
                    id,
                    "rejected"
                );

            }

        }

    }
);


/* =========================================================
   FILTER + SEARCH
========================================================= */

document.addEventListener(
    "click",
    function(event) {

        const button =
            event.target.closest(
                "[data-consignment-filter]"
            );


        if (!button) {
            return;
        }


        consignmentFilter =
            button.dataset
                .consignmentFilter;


        document
            .querySelectorAll(
                "[data-consignment-filter]"
            )
            .forEach(
                item => {
                    item.classList.toggle(
                        "active",
                        item === button
                    );
                }
            );


        renderConsignments();
    }
);


$("consignmentSearch")
    ?.addEventListener(
        "input",
        function() {
            renderConsignments();
        }
    );


$("closeConsignment")
    ?.addEventListener(
        "click",
        function() {

            const section =
                $("consignmentSection");

            if (section) {
                section.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }

        }
    );

    /* =========================================================
   DONATION FILTER / REFRESH
========================================================= */

$("donationFilterBtn")
    ?.addEventListener(
        "click",
        function() {

            donationShowAll = false;

            loadDonations();

        }
    );


$("donationRefreshBtn")
    ?.addEventListener(
        "click",
        function() {

            loadDonations();

        }
    );


$("donationViewAllBtn")
    ?.addEventListener(
        "click",
        function() {

            donationShowAll =
                !donationShowAll;

            renderDonations();

        }
    );


/* =========================================================
   REALTIME
========================================================= */

function setupRealtime() {

    supabaseClient
        .channel(
            "admin-dashboard-realtime"
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "users"
            },
            async function() {

                if (
                    $("page-users")
                        .classList
                        .contains("active")
                ) {

                    await loadUsers();

                }

                await loadDashboard();

            }
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "products"
            },
            async function() {

                if (
                    $("page-products")
                        .classList
                        .contains("active")
                ) {

                    await loadProducts();

                }

                await loadDashboard();

            }
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "orders"
            },
            async function() {

                if (
                    $("page-orders")
                        .classList
                        .contains("active")
                ) {

                    await loadOrders();

                }

                await loadDashboard();

            }
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "wallet_transactions"
            },
            async function() {

                await loadDashboard();

                if (
                    $("page-finance")
                        .classList
                        .contains("active")
                ) {

                    await loadFinance();

                }

            }
        )

        .on(
    "postgres_changes",
    {
        event: "*",
        schema: "public",
        table: "consignment_requests"
    },
    async function() {

        if (
            $("consignmentSection") &&
            $("consignmentSection")
                .getAttribute("aria-hidden") !== "true"
        ) {
            await loadConsignments();
        }

        await loadDashboard();

    }
)

.on(
    "postgres_changes",
    {
        event: "*",
        schema: "public",
        table: "donations"
    },
    async function() {

        if (
            $("page-donations") &&
            $("page-donations")
                .classList
                .contains("active")
        ) {
            await loadDonations();
        }

        await loadDashboard();

    }
)

        .subscribe();

}


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "🚀 IUH SHOP ADMIN START"
        );


        const admin =
            await checkAdmin();


        if (!admin) {

            console.error(
                "❌ ADMIN CHECK FAILED"
            );

            return;
        }


        console.log(
            "✅ ADMIN PAGE READY"
        );


        await loadDashboard();

        setupRealtime();

    }
);