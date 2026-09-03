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

/* =========================================================
   IUH SHOP - PHẦN XỬ LÝ VÍ IUH
   ---------------------------------------------------------
   LƯU TRỮ:
   - Số dư ví       -> Supabase: iuh_wallets
   - Giao dịch      -> Supabase: wallet_transactions
   - Nạp tiền       -> mô phỏng
   - Rút tiền       -> mô phỏng
   ========================================================= */


/* =========================================================
   BIẾN VÍ
   ========================================================= */

let currentWallet = null;


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
   TẠO / LẤY VÍ
   ---------------------------------------------------------
   RPC ensure_iuh_wallet sẽ:
   - kiểm tra ví của user
   - nếu chưa có thì tạo
   - trả về thông tin ví
   ========================================================= */

async function loadWallet() {

    if (!currentUser) {

        currentWallet = null;

        return false;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .rpc("ensure_iuh_wallet");


        if (error) {

            console.error(
                "Lỗi tải Ví IUH:",
                error
            );

            alert(
                "Không thể tải Ví IUH.\n\n" +
                error.message
            );

            currentWallet = null;

            return false;
        }


        /*
         * RPC có thể trả về object hoặc
         * mảng tùy cấu hình PostgreSQL.
         */

        if (Array.isArray(data)) {

            currentWallet =
                data.length > 0
                    ? data[0]
                    : null;

        }
        else {

            currentWallet = data;

        }


        if (!currentWallet) {

            console.error(
                "Không nhận được dữ liệu ví."
            );

            return false;
        }


        return true;

    }
    catch (error) {

        console.error(
            "Lỗi loadWallet:",
            error
        );

        currentWallet = null;

        return false;
    }

}


/* =========================================================
   HIỂN THỊ SỐ DƯ VÍ
   ========================================================= */

function renderWallet() {

    if (!currentWallet) {
        return;
    }


    const balance =
        Number(
            currentWallet.balance || 0
        );


    const pending =
        Number(
            currentWallet.pending || 0
        );


    const totalReceived =
        Number(
            currentWallet.total_received || 0
        );


    /* -----------------------------------------------------
       SỐ DƯ CHÍNH
       ----------------------------------------------------- */

    const balanceElement =
        document.getElementById(
            "walletBalance"
        );


    if (balanceElement) {

        balanceElement.textContent =
            formatMoney(balance);

    }


    /* -----------------------------------------------------
       TIỀN ĐANG CHỜ
       ----------------------------------------------------- */

    const pendingElement =
        document.getElementById(
            "pendingBalance"
        );


    if (pendingElement) {

        pendingElement.textContent =
            formatMoney(pending);

    }


    /* -----------------------------------------------------
       TỔNG TIỀN ĐÃ NHẬN
       ----------------------------------------------------- */

    const receivedElement =
        document.getElementById(
            "totalReceived"
        );


    if (receivedElement) {

        receivedElement.textContent =
            formatMoney(totalReceived);

    }


    /* -----------------------------------------------------
       SỐ DƯ TRONG POPUP RÚT
       ----------------------------------------------------- */

    updateWithdrawBalance();


    /* -----------------------------------------------------
       LỊCH SỬ
       ----------------------------------------------------- */

    loadTransactions();

}


/* =========================================================
   CẬP NHẬT SỐ DƯ KHẢ DỤNG TRONG POPUP RÚT
   ========================================================= */

function updateWithdrawBalance() {

    const element =
        document.getElementById(
            "withdrawAvailable"
        );


    if (!element) {
        return;
    }


    element.textContent =
        formatMoney(
            currentWallet?.balance || 0
        );

}


/* =========================================================
   NẠP TIỀN
   ---------------------------------------------------------
   Đây là NẠP TIỀN MÔ PHỎNG.

   Không kết nối ngân hàng thật.

   Khi người dùng xác nhận:
   - gọi RPC deposit_iuh_wallet
   - cộng tiền vào database
   - tạo lịch sử giao dịch
   ========================================================= */

async function confirmDeposit() {

    if (!currentUser) {

        alert(
            "Vui lòng đăng nhập trước."
        );

        return;
    }


    const amount =
        Number(
            document.getElementById(
                "depositAmount"
            )?.value
        );


    const bank =
        document.getElementById(
            "depositBank"
        )?.value || "";


    /* -----------------------------------------------------
       KIỂM TRA SỐ TIỀN
       ----------------------------------------------------- */

    if (
        !amount ||
        amount < 1000
    ) {

        alert(
            "Số tiền nạp tối thiểu là 1.000đ."
        );

        return;
    }


    if (!Number.isFinite(amount)) {

        alert(
            "Số tiền không hợp lệ."
        );

        return;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .rpc(
                "deposit_iuh_wallet",
                {
                    p_amount: amount,
                    p_bank: bank
                }
            );


        if (error) {

            console.error(
                "Lỗi nạp tiền:",
                error
            );

            alert(
                "Nạp tiền thất bại.\n\n" +
                error.message
            );

            return;
        }


        /*
         * RPC trả về số dư mới.
         */

        const newBalance =
            Array.isArray(data)
                ? data[0]
                : data;


        currentWallet.balance =
            Number(
                newBalance || 0
            );


        /* -------------------------------------------------
           ĐÓNG POPUP
           ------------------------------------------------- */

        closeWalletModal(
            "depositModal"
        );


        /* -------------------------------------------------
           CẬP NHẬT GIAO DIỆN
           ------------------------------------------------- */

        renderWallet();


        /* -------------------------------------------------
           THÔNG BÁO
           ------------------------------------------------- */

        alert(
            "✓ Nạp tiền mô phỏng thành công!\n\n" +
            "Số tiền: " +
            formatMoney(amount) +
            "\n" +
            "Ngân hàng: " +
            (bank || "Không xác định")
        );

    }
    catch (error) {

        console.error(
            "Lỗi confirmDeposit:",
            error
        );

        alert(
            "Không thể thực hiện giao dịch."
        );

    }

}


/* =========================================================
   RÚT TIỀN
   ---------------------------------------------------------
   Đây là RÚT TIỀN MÔ PHỎNG.

   Không chuyển tiền thật về ngân hàng.

   Khi xác nhận:
   - kiểm tra số dư
   - gọi RPC withdraw_iuh_wallet
   - trừ tiền trong database
   - lưu lịch sử giao dịch
   ========================================================= */

async function confirmWithdraw() {

    if (!currentUser) {

        alert(
            "Vui lòng đăng nhập trước."
        );

        return;
    }


    /* -----------------------------------------------------
       LẤY DỮ LIỆU FORM
       ----------------------------------------------------- */

    const amount =
        Number(
            document.getElementById(
                "withdrawAmount"
            )?.value
        );


    const bank =
        document.getElementById(
            "withdrawBank"
        )?.value || "";


    const account =
        document.getElementById(
            "withdrawAccount"
        )?.value
            ?.trim() || "";


    /* -----------------------------------------------------
       KIỂM TRA TÀI KHOẢN NGÂN HÀNG
       ----------------------------------------------------- */

    if (!account) {

        alert(
            "Vui lòng nhập số tài khoản."
        );

        return;
    }


    /* -----------------------------------------------------
       KIỂM TRA SỐ TIỀN
       ----------------------------------------------------- */

    if (
        !amount ||
        amount < 1000
    ) {

        alert(
            "Số tiền rút tối thiểu là 1.000đ."
        );

        return;
    }


    if (!Number.isFinite(amount)) {

        alert(
            "Số tiền không hợp lệ."
        );

        return;
    }


    /* -----------------------------------------------------
       KIỂM TRA SỐ DƯ
       ----------------------------------------------------- */

    const balance =
        Number(
            currentWallet?.balance || 0
        );


    if (amount > balance) {

        alert(
            "Số dư khả dụng không đủ."
        );

        return;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .rpc(
                "withdraw_iuh_wallet",
                {
                    p_amount: amount,
                    p_bank: bank,
                    p_account: account
                }
            );


        if (error) {

            console.error(
                "Lỗi rút tiền:",
                error
            );

            alert(
                "Rút tiền thất bại.\n\n" +
                error.message
            );

            return;
        }


        /*
         * RPC trả về số dư mới.
         */

        const newBalance =
            Array.isArray(data)
                ? data[0]
                : data;


        currentWallet.balance =
            Number(
                newBalance || 0
            );


        /* -------------------------------------------------
           ĐÓNG POPUP
           ------------------------------------------------- */

        closeWalletModal(
            "withdrawModal"
        );


        /* -------------------------------------------------
           CẬP NHẬT GIAO DIỆN
           ------------------------------------------------- */

        renderWallet();


        /* -------------------------------------------------
           THÔNG BÁO
           ------------------------------------------------- */

        alert(
            "✓ Rút tiền mô phỏng thành công!\n\n" +
            "Số tiền: " +
            formatMoney(amount) +
            "\n" +
            "Ngân hàng: " +
            (bank || "Không xác định") +
            "\n" +
            "Số tài khoản: " +
            account
        );

    }
    catch (error) {

        console.error(
            "Lỗi confirmWithdraw:",
            error
        );

        alert(
            "Không thể thực hiện giao dịch."
        );

    }

}


/* =========================================================
   MỞ POPUP NẠP TIỀN
   ========================================================= */

function openDepositModal() {

    const input =
        document.getElementById(
            "depositAmount"
        );


    if (input) {

        input.value = "";

    }


    const modal =
        document.getElementById(
            "depositModal"
        );


    if (modal) {

        modal.classList.add(
            "active"
        );

    }


    document.body.style.overflow =
        "hidden";

}


/* =========================================================
   MỞ POPUP RÚT TIỀN
   ========================================================= */

function openWithdrawModal() {

    if (!currentWallet) {

        alert(
            "Không thể tải thông tin ví."
        );

        return;
    }


    updateWithdrawBalance();


    const amount =
        document.getElementById(
            "withdrawAmount"
        );


    const account =
        document.getElementById(
            "withdrawAccount"
        );


    if (amount) {

        amount.value = "";

    }


    if (account) {

        account.value = "";

    }


    const modal =
        document.getElementById(
            "withdrawModal"
        );


    if (modal) {

        modal.classList.add(
            "active"
        );

    }


    document.body.style.overflow =
        "hidden";

}


/* =========================================================
   ĐÓNG POPUP
   ========================================================= */

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


/* =========================================================
   LỊCH SỬ GIAO DỊCH
   ========================================================= */

async function loadTransactions() {

    const container =
        document.getElementById(
            "transactionList"
        );


    if (
        !container ||
        !currentUser
    ) {

        return;
    }


    container.innerHTML = `
        <div class="empty-transaction">
            Đang tải giao dịch...
        </div>
    `;


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("wallet_transactions")
            .select(
                `
                    id,
                    type,
                    title,
                    amount,
                    description,
                    bank,
                    account,
                    created_at
                `
            )
            .eq(
                "user_id",
                currentUser.id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(100);


        if (error) {

            console.error(
                "Lỗi tải lịch sử:",
                error
            );

            container.innerHTML = `
                <div class="empty-transaction">
                    Không thể tải lịch sử giao dịch.
                </div>
            `;

            return;
        }


        /* -------------------------------------------------
           CHƯA CÓ GIAO DỊCH
           ------------------------------------------------- */

        if (
            !data ||
            data.length === 0
        ) {

            container.innerHTML = `
                <div class="empty-transaction">
                    Chưa có giao dịch nào.
                </div>
            `;

            return;
        }


        /* -------------------------------------------------
           HIỂN THỊ GIAO DỊCH
           ------------------------------------------------- */

        container.innerHTML =
            data
                .map(
                    function(transaction) {

                        /*
                         * deposit + sale
                         * là tiền VÀO.
                         *
                         * withdraw + payment + fee
                         * là tiền RA.
                         */

                        const incoming =
                            transaction.type ===
                                "deposit" ||
                            transaction.type ===
                                "sale";


                        const sign =
                            incoming
                                ? "+"
                                : "-";


                        const icon =
                            incoming
                                ? "↓"
                                : "↑";


                        return `
                            <div class="transaction-item">

                                <div class="transaction-left">

                                    <div class="
                                        transaction-icon
                                        ${incoming ? "in" : "out"}
                                    ">
                                        ${icon}
                                    </div>


                                    <div class="transaction-info">

                                        <strong>
                                            ${escapeHtml(
                                                transaction.title ||
                                                getTransactionTitle(
                                                    transaction.type
                                                )
                                            )}
                                        </strong>


                                        <span>

                                            ${escapeHtml(
                                                transaction.description ||
                                                ""
                                            )}

                                            ${
                                                transaction.description
                                                    ? " · "
                                                    : ""
                                            }

                                            ${formatDate(
                                                transaction.created_at
                                            )}

                                        </span>

                                    </div>

                                </div>


                                <div class="
                                    transaction-amount
                                    ${incoming ? "in" : "out"}
                                ">

                                    ${sign}

                                    ${formatMoney(
                                        transaction.amount
                                    )}

                                </div>

                            </div>
                        `;

                    }
                )
                .join("");

    }
    catch (error) {

        console.error(
            "Lỗi loadTransactions:",
            error
        );

        container.innerHTML = `
            <div class="empty-transaction">
                Không thể tải lịch sử giao dịch.
            </div>
        `;

    }

}


/* =========================================================
   TÊN GIAO DỊCH DỰ PHÒNG
   ========================================================= */

function getTransactionTitle(type) {

    switch (type) {

        case "deposit":
            return "Nạp tiền";

        case "withdraw":
            return "Rút tiền";

        case "payment":
            return "Thanh toán";

        case "fee":
            return "Thanh toán phí";

        case "sale":
            return "Tiền bán hàng";

        default:
            return "Giao dịch";

    }

}


/* =========================================================
   ESCAPE HTML
   ---------------------------------------------------------
   Tránh dữ liệu giao dịch chèn HTML/JS vào giao diện.
   ========================================================= */

function escapeHtml(value) {

    return String(value ?? "")
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


/* =========================================================
   LÀM MỚI VÍ
   ========================================================= */

async function refreshWallet() {

    if (!currentUser) {

        return;
    }


    const success =
        await loadWallet();


    if (success) {

        renderWallet();

    }

}


/* =========================================================
   ĐÓNG POPUP KHI CLICK BÊN NGOÀI
   ---------------------------------------------------------
   Không bắt buộc HTML phải có thêm code.
   ========================================================= */

function setupWalletModals() {

    const depositModal =
        document.getElementById(
            "depositModal"
        );


    const withdrawModal =
        document.getElementById(
            "withdrawModal"
        );


    if (depositModal) {

        depositModal.addEventListener(
            "click",
            function(event) {

                if (
                    event.target ===
                    depositModal
                ) {

                    closeWalletModal(
                        "depositModal"
                    );

                }

            }
        );

    }


    if (withdrawModal) {

        withdrawModal.addEventListener(
            "click",
            function(event) {

                if (
                    event.target ===
                    withdrawModal
                ) {

                    closeWalletModal(
                        "withdrawModal"
                    );

                }

            }
        );

    }

}


/* =========================================================
   REALTIME / TỰ ĐỘNG LÀM MỚI
   ---------------------------------------------------------
   Kiểm tra lại số dư mỗi 60 giây.
   ========================================================= */

function startWalletRefresh() {

    setInterval(
        async function() {

            if (
                document.hidden
            ) {

                return;
            }


            await refreshWallet();

        },
        60000
    );


    document.addEventListener(
        "visibilitychange",
        async function() {

            if (
                !document.hidden
            ) {

                await refreshWallet();

            }

        }
    );

}


/* =========================================================
   KHỞI ĐỘNG PHẦN VÍ
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        /*
         * currentUser được lấy từ phần code
         * phía trên của file.
         *
         * KHÔNG tạo lại header,
         * KHÔNG tạo lại menu,
         * KHÔNG tạo lại user.
         */


        if (!currentUser) {

            console.warn(
                "Ví IUH: chưa đăng nhập."
            );

            return;
        }


        /* -------------------------------------------------
           TẢI VÍ
           ------------------------------------------------- */

        const success =
            await loadWallet();


        if (success) {

            renderWallet();

        }


        /* -------------------------------------------------
           SETUP POPUP
           ------------------------------------------------- */

        setupWalletModals();


        /* -------------------------------------------------
           TỰ ĐỘNG REFRESH
           ------------------------------------------------- */

        startWalletRefresh();

    }
);


/* =========================================================
   THEO DÕI ĐĂNG NHẬP / ĐĂNG XUẤT
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
    async function(event) {

        /* -------------------------------------------------
           ĐĂNG NHẬP
           ------------------------------------------------- */

        if (
            event === "SIGNED_IN" ||
            event === "TOKEN_REFRESHED"
        ) {

            /*
             * Không gọi lại toàn bộ phần header.
             * Chỉ cập nhật biến user nếu cần.
             */

            try {

                const {
                    data
                } =
                    await supabaseClient
                        .auth
                        .getSession();


                currentUser =
                    data?.session?.user ||
                    currentUser;


            }
            catch (error) {

                console.error(
                    "Lỗi cập nhật user cho ví:",
                    error
                );

            }


            if (currentUser) {

                const success =
                    await loadWallet();


                if (success) {

                    renderWallet();

                }

            }

        }


        /* -------------------------------------------------
           ĐĂNG XUẤT
           ------------------------------------------------- */

        if (
            event === "SIGNED_OUT"
        ) {

            currentUser = null;

            currentWallet = null;

        }

    }
);