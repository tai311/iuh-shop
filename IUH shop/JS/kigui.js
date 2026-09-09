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




const CONSIGNMENT_FEE_RATE = 0.10;


// ========================================
// FORMAT TIỀN
// ========================================

function formatMoney(amount) {

    return Number(amount || 0)
        .toLocaleString("vi-VN") + "đ";
}


// ========================================
// TÍNH PHÍ
// ========================================

function calculateConsignmentFee(price) {

    return Math.round(
        Number(price || 0) * CONSIGNMENT_FEE_RATE
    );
}


function calculateSellerReceive(price) {

    const fee = calculateConsignmentFee(price);

    return Number(price || 0) - fee;
}


// ========================================
// CẬP NHẬT TÍNH TIỀN
// ========================================

const sellingPriceInput =
    document.getElementById("sellingPrice");

if (sellingPriceInput) {

    sellingPriceInput.addEventListener(
        "input",
        updateConsignmentCalculator
    );
}


function updateConsignmentCalculator() {

    const price =
        Number(sellingPriceInput?.value || 0);

    const fee =
        calculateConsignmentFee(price);

    const receive =
        calculateSellerReceive(price);


    document.getElementById(
        "displayPrice"
    ).textContent = formatMoney(price);


    document.getElementById(
        "displayFee"
    ).textContent = formatMoney(fee);


    document.getElementById(
        "displayReceive"
    ).textContent = formatMoney(receive);
}


// ========================================
// PREVIEW ẢNH
// ========================================

const imageInput =
    document.getElementById("productImages");

const imagePreview =
    document.getElementById("imagePreview");


if (imageInput) {

    imageInput.addEventListener(
        "change",
        function () {

            imagePreview.innerHTML = "";

            const files =
                Array.from(this.files).slice(0, 5);


            files.forEach(file => {

                if (!file.type.startsWith("image/")) {
                    return;
                }

                const reader =
                    new FileReader();

                reader.onload = function (e) {

                    const img =
                        document.createElement("img");

                    img.src = e.target.result;

                    imagePreview.appendChild(img);
                };

                reader.readAsDataURL(file);
            });

        }
    );
}


// ========================================
// SUBMIT
// ========================================

const consignmentForm =
    document.getElementById("consignmentForm");


if (consignmentForm) {

    consignmentForm.addEventListener(
        "submit",
        submitConsignment
    );
}


async function submitConsignment(event) {

    event.preventDefault();


    const submitButton =
        document.getElementById(
            "submitConsignment"
        );


    // ------------------------------------
    // KIỂM TRA ĐĂNG NHẬP
    // ------------------------------------

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();


    if (!user) {

        alert(
            "Vui lòng đăng nhập trước khi ký gửi sản phẩm."
        );

        return;
    }


    // ------------------------------------
    // LẤY DỮ LIỆU
    // ------------------------------------

    const productName =
        document.getElementById(
            "productName"
        ).value.trim();


    const category =
        document.getElementById(
            "category"
        ).value;


    const condition =
        document.getElementById(
            "condition"
        ).value;


    const price =
        Number(
            document.getElementById(
                "sellingPrice"
            ).value
        );


    const description =
        document.getElementById(
            "description"
        ).value.trim();


    const deliveryMethod =
        document.querySelector(
            'input[name="deliveryMethod"]:checked'
        )?.value;


    const agreeTerms =
        document.getElementById(
            "agreeTerms"
        ).checked;


    // ------------------------------------
    // VALIDATE
    // ------------------------------------

    if (!productName ||
        !category ||
        !condition ||
        !price ||
        !description ||
        !deliveryMethod) {

        alert(
            "Vui lòng nhập đầy đủ thông tin sản phẩm."
        );

        return;
    }


    if (price < 1000) {

        alert(
            "Giá sản phẩm phải từ 1.000đ."
        );

        return;
    }


    if (!agreeTerms) {

        alert(
            "Vui lòng đồng ý với chính sách ký gửi."
        );

        return;
    }


    // ------------------------------------
    // PHÍ
    // ------------------------------------

    const serviceFee =
        calculateConsignmentFee(price);


    const sellerReceive =
        calculateSellerReceive(price);


    // ------------------------------------
    // ẢNH
    // ------------------------------------

    const files =
        Array.from(
            imageInput?.files || []
        ).slice(0, 5);


    if (files.length === 0) {

        alert(
            "Vui lòng thêm ít nhất 1 hình ảnh sản phẩm."
        );

        return;
    }


    // ------------------------------------
    // DISABLE BUTTON
    // ------------------------------------

    submitButton.disabled = true;

    submitButton.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';


    try {

        // --------------------------------
        // LƯU THÔNG TIN ẢNH
        // --------------------------------

        /*
         * Giai đoạn đầu lưu tên file.
         * Sau này có thể kết nối Supabase Storage
         * để upload ảnh thật.
         */

        const imageNames =
            files.map(file => file.name);


        // --------------------------------
        // INSERT DATABASE
        // --------------------------------

        const {
            data,
            error
        } = await supabaseClient
            .from("consignment_requests")
            .insert({

                user_id: user.id,

                product_name:
                    productName,

                category:
                    category,

                condition:
                    condition,

                description:
                    description,

                selling_price:
                    price,

                service_fee:
                    serviceFee,

                seller_receive:
                    sellerReceive,

                delivery_method:
                    deliveryMethod,

                image_names:
                    imageNames,

                status:
                    "pending"

            })
            .select()
            .single();


        if (error) {
            throw error;
        }


        // --------------------------------
        // THÀNH CÔNG
        // --------------------------------

        alert(
            "Gửi yêu cầu ký gửi thành công!\n\n" +
            "IUH SHOP sẽ kiểm tra sản phẩm của bạn."
        );


        consignmentForm.reset();

        imagePreview.innerHTML = "";

        updateConsignmentCalculator();


    } catch (error) {

        console.error(
            "Lỗi gửi ký gửi:",
            error
        );

        alert(
            "Không thể gửi yêu cầu ký gửi.\n\n" +
            error.message
        );


    } finally {

        submitButton.disabled = false;

        submitButton.innerHTML =
            '<i class="fa-solid fa-paper-plane"></i> Gửi yêu cầu ký gửi';
    }
}

/* =========================================================
   KÝ GỬI - TAB
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const tabs =
        document.querySelectorAll(".consignment-tab");

    const newTab =
        document.getElementById("consignmentNewTab");

    const historyTab =
        document.getElementById("consignmentHistoryTab");


    tabs.forEach(tab => {

    tab.addEventListener("click", function () {

        const target = this.dataset.tab;

        // Đổi trạng thái nút tab
        tabs.forEach(item => {
            item.classList.remove("active");
        });

        this.classList.add("active");


        // =========================
        // TAB GỬI SẢN PHẨM
        // =========================

        if (target === "new") {

            newTab?.classList.add("active");
            historyTab?.classList.remove("active");

        }


        // =========================
        // TAB YÊU CẦU CỦA TÔI
        // =========================

        if (target === "history") {

            newTab?.classList.remove("active");
            historyTab?.classList.add("active");

            loadMyConsignmentRequests();

        }

    });

});

// =========================================================
// NÚT "GỬI SẢN PHẨM" KHI CHƯA CÓ YÊU CẦU
// =========================================================

document.addEventListener("click", function (event) {

    const button = event.target.closest(
        "#emptyCreateConsignment"
    );

    if (!button) return;


    const newTabButton =
        document.getElementById("newConsignmentTab");

    const historyTabButton =
        document.getElementById("historyConsignmentTab");

    const newTab =
        document.getElementById("consignmentNewTab");

    const historyTab =
        document.getElementById("consignmentHistoryTab");


    // Đổi nút tab
    newTabButton?.classList.add("active");
    historyTabButton?.classList.remove("active");


    // Đổi nội dung tab
    newTab?.classList.add("active");
    historyTab?.classList.remove("active");


    // Cuộn về đầu phần gửi sản phẩm
    newTab?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

});


    const refreshButton =
        document.getElementById(
            "refreshConsignment"
        );


    refreshButton?.addEventListener(
        "click",
        loadMyConsignmentRequests
    );

});


/* =========================================================
   LẤY YÊU CẦU KÝ GỬI CỦA USER
========================================================= */

async function loadMyConsignmentRequests() {

    const list =
        document.getElementById(
            "consignmentHistoryList"
        );


    if (!list) return;


    list.innerHTML = `
        <div class="history-loading">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Đang tải yêu cầu...</span>
        </div>
    `;


    try {

        const {
            data: {
                user
            }
        } =
            await supabaseClient.auth.getUser();


        if (!user) {

            list.innerHTML = `
                <div class="history-empty">
                    <i class="fa-solid fa-user-lock"></i>

                    <h3>Vui lòng đăng nhập</h3>

                    <p>
                        Bạn cần đăng nhập để xem
                        các yêu cầu ký gửi.
                    </p>
                </div>
            `;

            return;
        }


        const {
            data,
            error
        } =
            await supabaseClient
                .from("consignment_requests")
                .select(`
                    id,
                    product_name,
                    category,
                    condition,
                    description,
                    selling_price,
                    service_fee,
                    seller_receive,
                    delivery_method,
                    status,
                    admin_note,
                    created_at,
                    reviewed_at
                `)
                .eq("user_id", user.id)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {
            throw error;
        }


        updateConsignmentStats(data || []);

        renderConsignmentHistory(data || []);


    } catch (error) {

        console.error(
            "Lỗi tải yêu cầu ký gửi:",
            error
        );


        list.innerHTML = `
            <div class="history-error">

                <i class="fa-solid fa-triangle-exclamation"></i>

                <h3>
                    Không thể tải dữ liệu
                </h3>

                <p>
                    ${escapeConsignmentHtml(
                        error.message
                    )}
                </p>

                <button
                    type="button"
                    onclick="loadMyConsignmentRequests()"
                >
                    Thử lại
                </button>

            </div>
        `;
    }
}


/* =========================================================
   THỐNG KÊ
========================================================= */

function updateConsignmentStats(requests) {

    const total =
        requests.length;


    const pending =
        requests.filter(
            item => item.status === "pending"
        ).length;


    const selling =
        requests.filter(
            item =>
                item.status === "approved" ||
                item.status === "selling"
        ).length;


    const sold =
        requests.filter(
            item =>
                item.status === "sold" ||
                item.status === "completed"
        ).length;


    const totalElement =
        document.getElementById(
            "totalRequests"
        );

    const pendingElement =
        document.getElementById(
            "pendingRequests"
        );

    const sellingElement =
        document.getElementById(
            "sellingRequests"
        );

    const soldElement =
        document.getElementById(
            "soldRequests"
        );


    if (totalElement) {
        totalElement.textContent = total;
    }

    if (pendingElement) {
        pendingElement.textContent = pending;
    }

    if (sellingElement) {
        sellingElement.textContent = selling;
    }

    if (soldElement) {
        soldElement.textContent = sold;
    }
}

/* =========================================================
   HIỂN THỊ DANH SÁCH
========================================================= */

function renderConsignmentHistory(requests) {

    const list =
        document.getElementById(
            "consignmentHistoryList"
        );


    if (!list) return;


    if (!requests.length) {
    list.innerHTML = `
        <div class="history-empty">

            <div class="empty-icon">
                <i class="fa-solid fa-box-open"></i>
            </div>

            <h3>
                Chưa có yêu cầu ký gửi
            </h3>

            <p>
                Bạn chưa gửi sản phẩm nào.
                Hãy bắt đầu ký gửi sản phẩm đầu tiên.
            </p>

            <button
                type="button"
                class="empty-create-btn"
                id="emptyCreateConsignment"
            >
                <i class="fa-solid fa-plus"></i>
                Gửi sản phẩm
            </button>

        </div>
    `;

    return;
}


    list.innerHTML =
        requests
            .map(renderConsignmentCard)
            .join("");
}


/* =========================================================
   CARD YÊU CẦU
========================================================= */

function renderConsignmentCard(item) {

    const status =
        getConsignmentStatus(item.status);


    const createdDate =
        formatConsignmentDate(
            item.created_at
        );


    return `
        <article
            class="consignment-history-card"
        >

            <div class="history-card-main">

                <div class="history-product-icon">
                    <i class="fa-solid fa-box"></i>
                </div>


                <div class="history-product-info">

                    <h3>
                        ${escapeConsignmentHtml(
                            item.product_name
                        )}
                    </h3>

                    <div class="history-product-meta">

                        <span>
                            ${escapeConsignmentHtml(
                                item.category
                            )}
                        </span>

                        <span>•</span>

                        <span>
                            ${escapeConsignmentHtml(
                                item.condition
                            )}
                        </span>

                    </div>

                    <div class="history-price">
                        ${formatMoney(
                            item.selling_price
                        )}
                    </div>

                </div>

            </div>


            <div class="history-card-status">

                <span
                    class="
                        consignment-status
                        ${status.className}
                    "
                >
                    <i class="${status.icon}"></i>

                    ${status.label}

                </span>

                <small>
                    Gửi ngày ${createdDate}
                </small>

            </div>


            <div class="history-card-action">

                <button
                    type="button"
                    onclick="showConsignmentDetail(
                        ${Number(item.id)}
                    )"
                >
                    Xem chi tiết
                    <i class="fa-solid fa-chevron-right"></i>
                </button>

            </div>

        </article>
    `;
}


/* =========================================================
   TRẠNG THÁI
========================================================= */

function getConsignmentStatus(status) {

    const statuses = {

        pending: {
            label: "Chờ duyệt",
            className: "status-pending",
            icon: "fa-solid fa-clock"
        },

        approved: {
            label: "Đã duyệt",
            className: "status-approved",
            icon: "fa-solid fa-circle-check"
        },

        selling: {
            label: "Đang bán",
            className: "status-selling",
            icon: "fa-solid fa-shop"
        },

        sold: {
            label: "Đã bán",
            className: "status-sold",
            icon: "fa-solid fa-money-bill-transfer"
        },

        completed: {
            label: "Đã hoàn tất",
            className: "status-completed",
            icon: "fa-solid fa-circle-check"
        },

        rejected: {
            label: "Bị từ chối",
            className: "status-rejected",
            icon: "fa-solid fa-circle-xmark"
        },

        cancelled: {
            label: "Đã hủy",
            className: "status-cancelled",
            icon: "fa-solid fa-ban"
        }

    };


    return statuses[status] || {
        label: "Không xác định",
        className: "status-unknown",
        icon: "fa-solid fa-question"
    };
}


/* =========================================================
   CHI TIẾT
========================================================= */

async function showConsignmentDetail(id) {

    const {
        data: {
            user
        }
    } =
        await supabaseClient.auth.getUser();


    if (!user) return;


    const {
        data,
        error
    } =
        await supabaseClient
            .from("consignment_requests")
            .select("*")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();


    if (error) {

        alert(
            "Không thể tải thông tin yêu cầu."
        );

        return;
    }


    const status =
        getConsignmentStatus(
            data.status
        );


    const existingModal =
        document.getElementById(
            "consignmentDetailModal"
        );


    if (existingModal) {
        existingModal.remove();
    }


    const modal =
        document.createElement("div");


    modal.id =
        "consignmentDetailModal";


    modal.className =
        "consignment-modal";


    modal.innerHTML = `

        <div
            class="consignment-modal-overlay"
            onclick="closeConsignmentDetail()"
        ></div>


        <div class="consignment-modal-box">

            <button
                type="button"
                class="consignment-modal-close"
                onclick="closeConsignmentDetail()"
            >
                <i class="fa-solid fa-xmark"></i>
            </button>


            <span class="modal-label">
                YÊU CẦU KÝ GỬI
            </span>


            <h2>
                ${escapeConsignmentHtml(
                    data.product_name
                )}
            </h2>


            <div class="modal-status">

                <span
                    class="
                        consignment-status
                        ${status.className}
                    "
                >
                    <i class="${status.icon}"></i>

                    ${status.label}
                </span>

            </div>


            <div class="modal-info-grid">

                <div>
                    <span>Danh mục</span>
                    <strong>
                        ${escapeConsignmentHtml(
                            data.category
                        )}
                    </strong>
                </div>

                <div>
                    <span>Tình trạng</span>
                    <strong>
                        ${escapeConsignmentHtml(
                            data.condition
                        )}
                    </strong>
                </div>

                <div>
                    <span>Giá mong muốn</span>
                    <strong>
                        ${formatMoney(
                            data.selling_price
                        )}
                    </strong>
                </div>

                <div>
                    <span>Phí ký gửi</span>
                    <strong>
                        ${formatMoney(
                            data.service_fee
                        )}
                    </strong>
                </div>

                <div>
                    <span>Dự kiến nhận</span>
                    <strong class="receive">
                        ${formatMoney(
                            data.seller_receive
                        )}
                    </strong>
                </div>

                <div>
                    <span>Ngày gửi</span>
                    <strong>
                        ${formatConsignmentDate(
                            data.created_at
                        )}
                    </strong>
                </div>

            </div>


            <div class="modal-description">

                <span>MÔ TẢ</span>

                <p>
                    ${escapeConsignmentHtml(
                        data.description
                    )}
                </p>

            </div>


            ${
                data.admin_note
                    ? `
                        <div class="admin-note">

                            <span>
                                PHẢN HỒI TỪ IUH SHOP
                            </span>

                            <p>
                                ${escapeConsignmentHtml(
                                    data.admin_note
                                )}
                            </p>

                        </div>
                    `
                    : ""
            }


            <button
                type="button"
                class="modal-close-btn"
                onclick="closeConsignmentDetail()"
            >
                Đóng
            </button>

        </div>
    `;


    document.body.appendChild(modal);
}


function closeConsignmentDetail() {

    const modal =
        document.getElementById(
            "consignmentDetailModal"
        );


    if (modal) {
        modal.remove();
    }
}


/* =========================================================
   HELPER
========================================================= */

function formatMoney(amount) {

    return Number(amount || 0)
        .toLocaleString("vi-VN") + "đ";
}


function formatConsignmentDate(date) {

    if (!date) return "--";

    return new Date(date)
        .toLocaleDateString(
            "vi-VN",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );
}


function escapeConsignmentHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =========================================================
// NÚT "GỬI SẢN PHẨM" TRONG TAB YÊU CẦU CỦA TÔI
// =========================================================

document.addEventListener("click", function (event) {

    const createButton = event.target.closest(".empty-create-btn");

    if (!createButton) return;

    // Chuyển sang tab Gửi sản phẩm
    const newTab = document.getElementById("newConsignmentTab");
    const historyTab = document.getElementById("historyConsignmentTab");

    const newContent = document.getElementById("consignmentNewTab");
    const historyContent = document.getElementById("consignmentHistoryTab");

    if (!newTab || !historyTab || !newContent || !historyContent) {
        return;
    }

    // Đổi trạng thái tab
    newTab.classList.add("active");
    historyTab.classList.remove("active");

    // Đổi nội dung
    newContent.classList.add("active");
    historyContent.classList.remove("active");

    // Cuộn lên phần form
    newContent.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});