/* =====================================================
   SUPABASE
===================================================== */

const SUPABASE_URL =
    "https://xecxofmogvqysejjpxvl.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

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
   IUH SHOP - TRANG SẢN PHẨM
   DỮ LIỆU LẤY TRỰC TIẾP TỪ SUPABASE
===================================================== */

let products = [];

let state = {
    search: "",
    category: "all",
    sort: "newest"
};


/* =====================================================
   HELPER
===================================================== */

const $ = id =>
    document.getElementById(id);


function esc(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =====================================================
   LẤY SẢN PHẨM + THÔNG TIN NGƯỜI BÁN
===================================================== */

async function loadProducts() {

    try {

        /* =========================================
           1. LẤY DANH SÁCH SẢN PHẨM
        ========================================= */

        const {
            data: productData,
            error: productError
        } = await supabaseClient

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

            .eq(
                "status",
                "active"
            )

            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (productError) {

            console.error(
                "Lỗi lấy products:",
                productError
            );

            throw productError;
        }


        /* =========================================
           Không có sản phẩm
        ========================================= */

        if (
            !productData ||
            productData.length === 0
        ) {

            products = [];

            renderProducts();

            return;
        }


        /* =========================================
           2. LẤY ID NGƯỜI BÁN
        ========================================= */

        const sellerIds = [
            ...new Set(
                productData
                    .map(
                        product =>
                            product.seller_id
                    )
                    .filter(Boolean)
            )
        ];


        /* =========================================
           3. LẤY THÔNG TIN TỪ BẢNG users
        ========================================= */

        let users = [];


        if (sellerIds.length > 0) {

            const {
                data: userData,
                error: userError
            } = await supabaseClient

                .from("users")

                .select(`
                    user_id,
                    fullname,
                    avatar_url,
                    student_verified,
                    role
                `)

                .in(
                    "user_id",
                    sellerIds
                );


            if (userError) {

                console.error(
                    "Lỗi lấy users:",
                    userError
                );

                throw userError;
            }


            users =
                userData || [];
        }


        /* =========================================
           4. GHÉP users VÀO products
        ========================================= */

        products =
            productData.map(
                product => {

                    const seller =
                        users.find(
                            user =>
                                String(
                                    user.user_id
                                ) ===
                                String(
                                    product.seller_id
                                )
                        );


                    return {

                        ...product,

                        users:
                            seller || null

                    };

                }
            );


        /* =========================================
           5. HIỂN THỊ
        ========================================= */

        console.log(
            "Danh sách sản phẩm:",
            products
        );


        renderProducts();

    }

    catch (error) {

        console.error(
            "Lỗi tải danh sách sản phẩm:",
            error
        );

        products = [];

        renderProducts();

    }

}

/* =====================================================
   HEADER - KIỂM TRA TÀI KHOẢN
===================================================== */

async function updateHeaderAccount() {

    const guestAccount =
        document.getElementById("guestAccount");

    const userAccount =
        document.getElementById("userAccount");

    const headerAvatar =
        document.getElementById("headerAvatar");

    const headerUserName =
        document.getElementById("headerUserName");

    try {

        /* Lấy tài khoản đang đăng nhập */
        const {
            data: {
                user
            }
        } = await supabaseClient.auth.getUser();


        /* =========================================
           CHƯA ĐĂNG NHẬP
        ========================================= */

        if (!user) {

            if (guestAccount) {
                guestAccount.style.display = "flex";
            }

            if (userAccount) {
                userAccount.style.display = "none";
            }

            return;
        }


        /* =========================================
           ĐÃ ĐĂNG NHẬP
        ========================================= */

        const {
            data: profile,
            error
        } = await supabaseClient
            .from("users")
            .select("fullname, avatar_url, role")
            .eq("user_id", user.id)
            .maybeSingle();


        if (error) {
            console.error(
                "Lỗi lấy thông tin users:",
                error
            );
        }


        /* =========================================
           TÊN HIỂN THỊ
        ========================================= */

        const fullname =
            profile?.fullname ||
            user.email?.split("@")[0] ||
            "Tài khoản";


        if (headerUserName) {

            headerUserName.textContent =
                fullname;

        }


        /* =========================================
           ẢNH ĐẠI DIỆN
        ========================================= */

        if (headerAvatar) {

            headerAvatar.src =
                profile?.avatar_url ||
                "../Images/default-avatar.svg";

            headerAvatar.onerror =
                function () {

                    this.src =
                        "../Images/default-avatar.svg";

                };

        }


        /* =========================================
           ẨN ĐĂNG NHẬP / ĐĂNG KÝ
        ========================================= */

        if (guestAccount) {
            guestAccount.style.display = "none";
        }


        /* =========================================
           HIỆN TÀI KHOẢN
        ========================================= */

        if (userAccount) {
            userAccount.style.display = "flex";
        }

    }
    catch (error) {

        console.error(
            "Lỗi cập nhật header:",
            error
        );

        /* Nếu có lỗi thì giữ trạng thái khách */

        if (guestAccount) {
            guestAccount.style.display = "flex";
        }

        if (userAccount) {
            userAccount.style.display = "none";
        }

    }

}


/* =====================================================
   THEO DÕI ĐĂNG NHẬP / ĐĂNG XUẤT
===================================================== */

supabaseClient.auth.onAuthStateChange(
    function (event, session) {

        console.log(
            "Auth event:",
            event
        );

        updateHeaderAccount();

    }
);


/* =====================================================
   FILTER
===================================================== */

function getFilteredProducts() {

    const keyword =
        state.search
            .trim()
            .toLowerCase();


    let result =
        products.filter(product => {

            const matchesSearch =

                !keyword ||

                product.name
                    ?.toLowerCase()
                    .includes(keyword) ||

                product.category
                    ?.toLowerCase()
                    .includes(keyword) ||

                product.description
                    ?.toLowerCase()
                    .includes(keyword);


            const matchesCategory =

                state.category === "all" ||

                product.category ===
                state.category;


            return (
                matchesSearch &&
                matchesCategory
            );

        });


    result.sort((a, b) => {

        if (state.sort === "newest") {

            return new Date(b.created_at)
                - new Date(a.created_at);

        }


        if (state.sort === "oldest") {

            return new Date(a.created_at)
                - new Date(b.created_at);

        }


        if (state.sort === "nameAZ") {

            return (a.name || "")
                .localeCompare(
                    b.name || "",
                    "vi"
                );

        }


        if (state.sort === "quantityHigh") {

            return Number(b.quantity)
                - Number(a.quantity);

        }


        if (state.sort === "quantityLow") {

            return Number(a.quantity)
                - Number(b.quantity);

        }


        return 0;

    });


    return result;

}


/* =====================================================
   CARD SẢN PHẨM
===================================================== */

function renderProductCard(product) {

    const seller =
        product.users || {};


    const images =
        Array.isArray(product.image_urls)
            ? product.image_urls
            : [];


    const firstImage =
        images.length > 0
            ? images[0]
            : "../Images/default-product.png";


    const verified =
    seller.student_verified === true ||
    seller.role === "admin" ||
    seller.role === "moderator";


    return `

        <article
            class="product-card"
            data-product-id="${product.id}"
        >

            <div
                class="product-image-wrap"
                data-detail-id="${product.id}"
            >

                <img
                    class="product-image"
                    src="${esc(firstImage)}"
                    alt="${esc(product.name)}"
                    loading="lazy"
                    onerror="
                        this.src='../Images/default-product.png'
                    "
                >


                <span class="product-category-badge">

                    ${esc(product.category)}

                </span>

            </div>


            <div class="product-card-body">


                <h3
                    class="product-name"
                    data-detail-id="${product.id}"
                >

                    ${esc(product.name)}

                </h3>


                <div class="product-meta">

                    <span class="product-quantity">

                        SL: ${Number(product.quantity)}

                    </span>


                    <span class="product-category-text">

                        ${esc(product.category)}

                    </span>

                </div>


                <p class="product-description">

                    ${esc(
                        product.description ||
                        "Chưa có mô tả."
                    )}

                </p>


                <div class="product-seller">


                    <img

                        class="seller-avatar"

                        src="${esc(
                            seller.avatar_url ||
                            "../Images/default-avatar.svg"
                        )}"

                        alt="Ảnh người bán"

                        onerror="
                            this.src='../Images/default-avatar.svg'
                        "

                    >


                    <div class="seller-info">

                        <span class="seller-name">

    ${esc(
        seller.fullname ||
        "Không xác định"
    )}

    ${
    verified
        ? `
            <span
                class="seller-verified-badge"
                title="Đã xác minh sinh viên IUH"
            >✓</span>
          `
        : ""
}

</span>


<span class="seller-status">

    Người đăng

</span>

                    </div>

                </div>


                <div class="product-actions">


                    <button
                        type="button"
                        class="chat-product-button"
                        data-chat-id="${product.id}"
                    >

                        Chat

                    </button>


                    <button
                        type="button"
                        class="report-product-button"
                        data-report-id="${product.id}"
                        title="Báo cáo"
                    >

                        ⚑

                    </button>


                </div>

            </div>

        </article>

    `;

}


/* =====================================================
   RENDER
===================================================== */

function renderProducts() {

    const result =
        getFilteredProducts();


    const grid =
        $("productGrid");


    const empty =
        $("emptyProducts");


    const summary =
        $("resultSummary");


    grid.innerHTML =
        result
            .map(renderProductCard)
            .join("");


    summary.textContent =
        `Đang hiển thị ${result.length} sản phẩm`;


    grid.hidden =
        result.length === 0;


    empty.hidden =
        result.length !== 0;


    updateCategoryCounts();

    bindProductEvents();

}


/* =====================================================
   CATEGORY COUNT
===================================================== */

function updateCategoryCounts() {

    const all =
        $("countAll");


    if (all) {

        all.textContent =
            products.length;

    }


    document
        .querySelectorAll("[data-count]")
        .forEach(element => {

            const category =
                element.dataset.count;


            const count =
                products.filter(
                    product =>
                        product.category ===
                        category
                ).length;


            element.textContent =
                count;

        });

}


/* =====================================================
   CLICK SẢN PHẨM
===================================================== */

function bindProductEvents() {


    document
        .querySelectorAll(
            "[data-detail-id]"
        )
        .forEach(element => {

            element.style.cursor =
                "pointer";


            element.addEventListener(
                "click",
                () => {

                    const productId =
                        element.dataset.detailId;


                    window.location.href =
                        `chitietsanpham.html?id=${encodeURIComponent(productId)}`;

                }
            );

        });


    document
        .querySelectorAll(
            "[data-chat-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    const product =
                        products.find(
                            item =>
                                String(item.id) ===
                                String(
                                    button.dataset.chatId
                                )
                        );


                    if (!product) {
                        return;
                    }


                    const seller =
                        product.users || {};


                    const params =
                        new URLSearchParams({

                            product:
                                product.id,

                            seller:
                                product.seller_id,

                            productName:
                                product.name

                        });


                    window.location.href =
                        `tinnhan.html?${params.toString()}`;

                }
            );

        });


    document
        .querySelectorAll(
            "[data-report-id]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    const product =
                        products.find(
                            item =>
                                String(item.id) ===
                                String(
                                    button.dataset.reportId
                                )
                        );


                    if (!product) {
                        return;
                    }


                    openReport(product);

                }
            );

        });

}


/* =====================================================
   BÁO CÁO SẢN PHẨM
===================================================== */

let currentReportProduct = null;


/* ==============================
   MỞ MODAL BÁO CÁO
============================== */

function openReport(product) {

    if (!product) {
        return;
    }

    currentReportProduct = product;

    const modal =
        $("reportModal");

    const productName =
        $("reportProductName");

    const form =
        $("reportForm");

    const reason =
        $("reportReason");

    const description =
        $("reportDescription");


    if (!modal || !productName || !form) {
        console.error(
            "Không tìm thấy giao diện báo cáo."
        );

        return;
    }


    /* Hiển thị tên sản phẩm */

    productName.textContent =
        product.name || "Sản phẩm";


    /* Reset form */

    form.reset();

    if (reason) {
        reason.value = "";
    }

    if (description) {
        description.value = "";
    }


    /* Mở modal */

    modal.hidden = false;

    document.body.style.overflow = "hidden";

}


/* ==============================
   ĐÓNG MODAL
============================== */

function closeReport() {

    const modal =
        $("reportModal");

    if (modal) {
        modal.hidden = true;
    }

    document.body.style.overflow = "";

    currentReportProduct = null;

}


/* ==============================
   GỬI BÁO CÁO
============================== */

async function submitReport(event) {

    event.preventDefault();


    if (!currentReportProduct) {

        alert(
            "Không xác định được sản phẩm."
        );

        return;
    }


    /* ==========================
       KIỂM TRA ĐĂNG NHẬP
    ========================== */

    const {
        data: {
            user
        },
        error: userError
    } =
        await supabaseClient
            .auth
            .getUser();


    if (userError || !user) {

        alert(
            "Bạn cần đăng nhập để báo cáo sản phẩm."
        );

        window.location.href =
            "dangnhap.html";

        return;
    }


    /* ==========================
       LẤY DỮ LIỆU FORM
    ========================== */

    const reason =
        $("reportReason")?.value?.trim();


    const description =
        $("reportDescription")?.value?.trim() ||
        null;


    if (!reason) {

        alert(
            "Vui lòng chọn lý do báo cáo."
        );

        return;
    }


    /* ==========================
       KHÔNG CHO TỰ BÁO CÁO TIN
       CỦA CHÍNH MÌNH
    ========================== */

    if (
        String(currentReportProduct.seller_id) ===
        String(user.id)
    ) {

        alert(
            "Bạn không thể báo cáo sản phẩm của chính mình."
        );

        return;
    }


    /* ==========================
       NÚT GỬI
    ========================== */

    const submitButton =
        document.querySelector(
            ".report-submit"
        );


    const oldText =
        submitButton?.textContent ||
        "Gửi báo cáo";


    if (submitButton) {

        submitButton.disabled = true;

        submitButton.textContent =
            "Đang gửi...";

    }


    try {

        /* ======================
           KIỂM TRA ĐÃ BÁO CÁO
        ====================== */

        const {
            data: existingReport,
            error: checkError
        } =
            await supabaseClient

                .from("product_reports")

                .select("id, status")

                .eq(
                    "product_id",
                    currentReportProduct.id
                )

                .eq(
                    "reporter_id",
                    user.id
                )

                .eq(
                    "status",
                    "pending"
                )

                .maybeSingle();


        if (checkError) {
            throw checkError;
        }


        if (existingReport) {

            alert(
                "Bạn đã báo cáo sản phẩm này và báo cáo đang được xử lý."
            );

            closeReport();

            return;
        }


        /* ======================
           INSERT BÁO CÁO
        ====================== */

        const {
            error
        } =
            await supabaseClient

                .from("product_reports")

                .insert({

                    product_id:
                        currentReportProduct.id,

                    reporter_id:
                        user.id,

                    reason:
                        reason,

                    description:
                        description,

                    status:
                        "pending"

                });


        if (error) {
            throw error;
        }


        /* ======================
           THÀNH CÔNG
        ====================== */

        alert(
            "Đã gửi báo cáo sản phẩm. Cảm ơn bạn đã góp phần xây dựng IUH SHOP."
        );


        closeReport();

    }
    catch (error) {

        console.error(
            "Lỗi gửi báo cáo:",
            error
        );


        alert(
            "Không thể gửi báo cáo. Vui lòng thử lại."
        );

    }
    finally {

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                oldText;

        }

    }

}


/* =====================================================
   GẮN SỰ KIỆN MODAL BÁO CÁO
===================================================== */

function initReportModal() {

    const modal =
        $("reportModal");

    const closeButton =
        $("closeReportModal");

    const cancelButton =
        $("cancelReport");

    const form =
        $("reportForm");


    /* Nút X */

    closeButton?.addEventListener(
        "click",
        closeReport
    );


    /* Nút Hủy */

    cancelButton?.addEventListener(
        "click",
        closeReport
    );


    /* Submit */

    form?.addEventListener(
        "submit",
        submitReport
    );


    /* Click ra ngoài modal */

    modal?.addEventListener(
        "click",
        function (event) {

            if (
                event.target === modal
            ) {

                closeReport();

            }

        }
    );


    /* ESC để đóng */

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape" &&
                modal &&
                !modal.hidden
            ) {

                closeReport();

            }

        }
    );

}


/* =====================================================
   SEARCH
===================================================== */

$("productSearch")?.addEventListener(
    "input",
    event => {

        state.search =
            event.target.value;

        renderProducts();

    }
);


/* =====================================================
   CATEGORY
===================================================== */

document
    .querySelectorAll(
        'input[name="category"]'
    )
    .forEach(input => {

        input.addEventListener(
            "change",
            event => {

                state.category =
                    event.target.value;

                renderProducts();

            }
        );

    });


/* =====================================================
   SORT
===================================================== */

$("sortProducts")?.addEventListener(
    "change",
    event => {

        state.sort =
            event.target.value;

        renderProducts();

    }
);


/* =====================================================
   RESET
===================================================== */

function resetFilters() {

    state = {

        search: "",

        category: "all",

        sort: "newest"

    };


    $("productSearch").value = "";

    $("sortProducts").value =
        "newest";


    const all =
        document.querySelector(
            'input[name="category"][value="all"]'
        );


    if (all) {

        all.checked =
            true;

    }


    renderProducts();

}


$("clearFilters")?.addEventListener(
    "click",
    resetFilters
);


$("emptyClearButton")?.addEventListener(
    "click",
    resetFilters
);


/* =====================================================
   DROPDOWN TÀI KHOẢN
===================================================== */

function initAccountDropdown() {

    const wrapper =
        document.querySelector(".account-nav-wrapper");

    const arrow =
        document.getElementById("accountNavArrow");

    const dropdown =
        document.getElementById("accountShortcuts");

    if (!wrapper || !arrow || !dropdown) {
        return;
    }

    // Bấm mũi tên
    arrow.addEventListener("click", function (event) {

        event.stopPropagation();

        wrapper.classList.toggle("open");

    });

    // Bấm bên ngoài thì đóng
    document.addEventListener("click", function (event) {

        if (!wrapper.contains(event.target)) {

            wrapper.classList.remove("open");

        }

    });

}

/* =====================================================
   LOAD
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        initAccountDropdown();

        initReportModal();

        await updateHeaderAccount();

        loadProducts();

    }
);