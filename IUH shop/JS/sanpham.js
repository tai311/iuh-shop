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
    seller.student_verified === true;


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
   LOAD
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await updateHeaderAccount();

        loadProducts();

    }
);