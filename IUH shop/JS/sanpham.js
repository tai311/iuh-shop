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
   LẤY SẢN PHẨM TỪ SUPABASE
===================================================== */

async function loadProducts() {

    try {

        const {
            data,
            error
        } = await supabaseClient

            .from("products")

            .select(`
                id,
                seller_id,
                name,
                category,
                quantity,
                description,
                image_urls,
                status,
                created_at,
                users (
                    fullname,
                    avatar_url,
                    student_verified,
                    role
                )
            `)

            .eq("status", "active")

            .order(
                "created_at",
                {
                    ascending: false
                }
            );


        if (error) {

            console.error(
                "Lỗi lấy sản phẩm:",
                error
            );

            alert(
                "Không thể tải danh sách sản phẩm."
            );

            return;

        }


        products = data || [];


        renderProducts();


    } catch (error) {

        console.error(
            "Lỗi hệ thống:",
            error
        );

    }

}


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
                                "Sinh viên IUH"
                            )}

                            ${
                                verified
                                    ? " ✓"
                                    : ""
                            }

                        </span>


                        <span class="seller-status">

                            ${
                                verified
                                    ? "Tài khoản đã xác thực"
                                    : "Sinh viên IUH"
                            }

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
    () => {

        loadProducts();

    }
);