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
   IUH SHOP - GIỎ HÀNG DATABASE
   =========================================================
   
   NGUỒN DỮ LIỆU:
   - cart_items       → giỏ hàng của người dùng
   - products         → thông tin sản phẩm

   KHÔNG dùng localStorage để lưu giỏ hàng nữa.

   Giỏ hàng sẽ tồn tại:
   - đóng trình duyệt
   - tắt máy
   - đăng nhập lại
   - đăng nhập trên thiết bị khác
   ========================================================= */


/* =========================================================
   ELEMENTS
   ========================================================= */

const cartItemsContainer =
    document.getElementById("cartItems");

const emptyCart =
    document.getElementById("emptyCart");

const selectAllCart =
    document.getElementById("selectAllCart");

const removeSelectedCart =
    document.getElementById("removeSelectedCart");

const proceedCheckout =
    document.getElementById("proceedCheckout");

const cartItemCount =
    document.getElementById("cartItemCount");

const cartSelectedText =
    document.getElementById("cartSelectedText");

const summaryProductCount =
    document.getElementById("summaryProductCount");

const cartSubtotal =
    document.getElementById("cartSubtotal");

const cartTotal =
    document.getElementById("cartTotal");


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;

let cartItems = [];


/* =========================================================
   FORMAT TIỀN
   ========================================================= */

function formatCurrency(value) {

    return new Intl.NumberFormat(
        "vi-VN",
        {
            style: "currency",
            currency: "VND"
        }
    ).format(Number(value) || 0);

}


/* =========================================================
   LẤY SỐ LƯỢNG TRONG GIỎ
   ========================================================= */

function getItemQuantity(item) {

    return Math.max(
        1,
        Number(item.quantity) || 1
    );

}


/* =========================================================
   KIỂM TRA SELECTED
   ========================================================= */

function isItemSelected(item) {

    return item.selected !== false;

}


/* =========================================================
   LOAD GIỎ HÀNG TỪ SUPABASE
   ========================================================= */

async function loadCart() {

    if (!currentUser) {
        return;
    }


    try {

        /*
         * Lấy cart_items của chính user đang đăng nhập
         *
         * RLS của Supabase sẽ tiếp tục bảo vệ dữ liệu.
         */

        const {
            data: cartData,
            error: cartError
        } =
            await supabaseClient
                .from("cart_items")
                .select(`
                    id,
                    user_id,
                    product_id,
                    quantity,
                    selected,
                    created_at,
                    updated_at
                `)
                .eq(
                    "user_id",
                    currentUser.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (cartError) {
            throw cartError;
        }


        /*
         * Không có sản phẩm trong giỏ
         */

        if (!cartData || cartData.length === 0) {

            cartItems = [];

            renderCart();

            return;
        }


        /*
         * Lấy danh sách product_id
         */

        const productIds =
            cartData
                .map(
                    item =>
                        item.product_id
                )
                .filter(Boolean);


        if (!productIds.length) {

            cartItems = [];

            renderCart();

            return;
        }


        /*
         * Lấy thông tin sản phẩm mới nhất
         */

        const {
            data: products,
            error: productError
        } =
            await supabaseClient
                .from("products")
                .select(`
                    id,
                    seller_id,
                    name,
                    category,
                    price,
                    quantity,
                    image_urls,
                    status
                `)
                .in(
                    "id",
                    productIds
                );


        if (productError) {
            throw productError;
        }


        /*
         * Map sản phẩm theo ID
         */

        const productMap =
            new Map(
                (products || []).map(
                    product => [
                        product.id,
                        product
                    ]
                )
            );


        const validCartItems = [];


        /*
         * Ghép cart_items + products
         */

        for (
            const cartItem
            of cartData
        ) {

            const product =
                productMap.get(
                    cartItem.product_id
                );


            /*
             * Sản phẩm không còn tồn tại
             */

            if (!product) {

                await deleteCartItem(
                    cartItem.id
                );

                continue;
            }


            const stock =
                Number(
                    product.quantity
                ) || 0;


            /*
             * Sản phẩm hết hàng
             *
             * Không xóa ngay khỏi database.
             *
             * Để người dùng vẫn có thể thấy:
             * "Sản phẩm đã hết hàng"
             *
             * Nhưng không cho đặt hàng.
             */

            let safeQuantity =
                Number(
                    cartItem.quantity
                ) || 1;


            /*
             * Nếu số lượng trong giỏ
             * lớn hơn tồn kho
             *
             * tự động hạ xuống bằng tồn kho.
             */

            if (
                stock > 0 &&
                safeQuantity > stock
            ) {

                safeQuantity =
                    stock;


                await updateCartQuantity(
                    cartItem.id,
                    safeQuantity
                );
            }


            validCartItems.push({

                cartId:
                    cartItem.id,

                userId:
                    cartItem.user_id,

                productId:
                    product.id,

                seller_id:
                    product.seller_id,

                name:
                    product.name,

                category:
                    product.category,

                price:
                    Number(
                        product.price
                    ) || 0,

                stock:
                    stock,

                image_urls:
                    product.image_urls || [],

                quantity:
                    safeQuantity,

                selected:
                    cartItem.selected !== false,

                status:
                    product.status

            });

        }


        cartItems =
            validCartItems;


        renderCart();

    }

    catch (error) {

        console.error(
            "IUH SHOP - Lỗi tải giỏ hàng:",
            error
        );

        showCartMessage(
            "Không thể tải giỏ hàng."
        );

        cartItems = [];

        renderCart();
    }

}


/* =========================================================
   UPDATE CART QUANTITY
   ========================================================= */

async function updateCartQuantity(
    cartId,
    quantity
) {

    const {
        error
    } =
        await supabaseClient
            .from("cart_items")
            .update({

                quantity:
                    quantity,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                cartId
            )
            .eq(
                "user_id",
                currentUser.id
            );


    if (error) {

        console.error(
            "Lỗi cập nhật số lượng:",
            error
        );

        throw error;
    }

}


/* =========================================================
   UPDATE SELECTED
   ========================================================= */

async function updateCartSelected(
    cartId,
    selected
) {

    const {
        error
    } =
        await supabaseClient
            .from("cart_items")
            .update({

                selected:
                    selected,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                cartId
            )
            .eq(
                "user_id",
                currentUser.id
            );


    if (error) {

        console.error(
            "Lỗi cập nhật trạng thái chọn:",
            error
        );

        throw error;
    }

}


/* =========================================================
   DELETE CART ITEM
   ========================================================= */

async function deleteCartItem(
    cartId
) {

    const {
        error
    } =
        await supabaseClient
            .from("cart_items")
            .delete()
            .eq(
                "id",
                cartId
            )
            .eq(
                "user_id",
                currentUser.id
            );


    if (error) {

        console.error(
            "Lỗi xóa sản phẩm:",
            error
        );

        throw error;
    }

}


/* =========================================================
   RENDER CART
   ========================================================= */

function renderCart() {

    if (!cartItemsContainer) {
        return;
    }


    /*
     * GIỎ HÀNG TRỐNG
     */

    if (!cartItems.length) {

        cartItemsContainer.innerHTML = "";

        if (emptyCart) {
            emptyCart.hidden = false;
        }

        updateSummary();

        return;
    }


    if (emptyCart) {
        emptyCart.hidden = true;
    }


    cartItemsContainer.innerHTML =
        cartItems
            .map(
                (
                    item,
                    index
                ) =>
                    createCartItemHTML(
                        item,
                        index
                    )
            )
            .join("");


    bindCartEvents();

    updateSummary();

}


/* =========================================================
   CART ITEM HTML
   ========================================================= */

function createCartItemHTML(
    item,
    index
) {

    const quantity =
        getItemQuantity(item);

    const price =
        Number(item.price) || 0;

    const itemTotal =
        quantity * price;

    const selected =
        isItemSelected(item);


    /*
     * LẤY ẢNH
     */

    let imageUrl =
        "../Images/default-product.png";


    if (
        Array.isArray(
            item.image_urls
        ) &&
        item.image_urls.length > 0
    ) {

        imageUrl =
            item.image_urls[0];

    }


    /*
     * HẾT HÀNG
     */

    const outOfStock =
        Number(item.stock) <= 0;


    return `

        <article
            class="
                cart-item
                ${selected ? "selected" : ""}
                ${outOfStock ? "out-of-stock" : ""}
            "
            data-index="${index}"
        >

            <!-- CHECKBOX -->

            <input
                type="checkbox"
                class="cart-item-checkbox"
                data-index="${index}"
                ${selected && !outOfStock ? "checked" : ""}
                ${outOfStock ? "disabled" : ""}
            >


            <!-- IMAGE -->

            <div class="cart-item-image">

                <img
                    src="${escapeHTML(imageUrl)}"
                    alt="${escapeHTML(
                        item.name ||
                        "Sản phẩm"
                    )}"
                    onerror="
                        this.src='../Images/default-product.png'
                    "
                >

            </div>


            <!-- INFO -->

            <div class="cart-item-info">

                <h3
                    title="${escapeHTML(
                        item.name || ""
                    )}"
                >
                    ${escapeHTML(
                        item.name ||
                        "Sản phẩm"
                    )}
                </h3>


                <span class="cart-item-category">
                    ${escapeHTML(
                        item.category ||
                        "Khác"
                    )}
                </span>


                <span class="cart-item-price">
                    ${formatCurrency(price)}
                </span>


                ${
                    outOfStock
                        ? `
                            <span
                                class="cart-stock-warning"
                            >
                                Sản phẩm đã hết hàng
                            </span>
                        `
                        : `
                            <span
                                class="cart-stock-info"
                            >
                                Còn ${item.stock} sản phẩm
                            </span>
                        `
                }

            </div>


            <!-- RIGHT -->

            <div class="cart-item-right">


                <!-- QUANTITY -->

                <div class="quantity-control">

                    <button
                        type="button"
                        class="quantity-minus"
                        data-index="${index}"
                        aria-label="Giảm số lượng"
                        ${quantity <= 1 || outOfStock
                            ? "disabled"
                            : ""}
                    >
                        <i
                            class="fa-solid fa-minus"
                        ></i>
                    </button>


                    <span>
                        ${quantity}
                    </span>


                    <button
                        type="button"
                        class="quantity-plus"
                        data-index="${index}"
                        aria-label="Tăng số lượng"
                        ${
                            outOfStock ||
                            quantity >= Number(item.stock)
                                ? "disabled"
                                : ""
                        }
                    >
                        <i
                            class="fa-solid fa-plus"
                        ></i>
                    </button>

                </div>


                <!-- TOTAL -->

                <span class="cart-item-total">

                    ${
                        outOfStock
                            ? "--"
                            : formatCurrency(
                                itemTotal
                            )
                    }

                </span>


                <!-- DELETE -->

                <button
                    type="button"
                    class="cart-item-delete"
                    data-index="${index}"
                    title="Xóa sản phẩm"
                >

                    <i
                        class="fa-regular fa-trash-can"
                    ></i>

                    Xóa

                </button>

            </div>

        </article>

    `;

}


/* =========================================================
   BIND EVENTS
   ========================================================= */

function bindCartEvents() {


    /*
     * CHECKBOX
     */

    document
        .querySelectorAll(
            ".cart-item-checkbox"
        )
        .forEach(
            function (checkbox) {

                checkbox.addEventListener(
                    "change",
                    async function () {

                        const index =
                            Number(
                                this.dataset.index
                            );

                        const item =
                            cartItems[index];

                        if (!item) {
                            return;
                        }


                        try {

                            item.selected =
                                this.checked;


                            await updateCartSelected(
                                item.cartId,
                                this.checked
                            );


                            renderCart();

                        }

                        catch (error) {

                            console.error(
                                error
                            );

                            showCartMessage(
                                "Không thể cập nhật lựa chọn."
                            );

                        }

                    }
                );

            }
        );


    /*
     * PLUS
     */

    document
        .querySelectorAll(
            ".quantity-plus"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    async function () {

                        const index =
                            Number(
                                this.dataset.index
                            );

                        await increaseQuantity(
                            index
                        );

                    }
                );

            }
        );


    /*
     * MINUS
     */

    document
        .querySelectorAll(
            ".quantity-minus"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    async function () {

                        const index =
                            Number(
                                this.dataset.index
                            );

                        await decreaseQuantity(
                            index
                        );

                    }
                );

            }
        );


    /*
     * DELETE
     */

    document
        .querySelectorAll(
            ".cart-item-delete"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    async function () {

                        const index =
                            Number(
                                this.dataset.index
                            );

                        await removeCartItem(
                            index
                        );

                    }
                );

            }
        );

}


/* =========================================================
   INCREASE
   ========================================================= */

async function increaseQuantity(
    index
) {

    const item =
        cartItems[index];

    if (!item) {
        return;
    }


    const currentQuantity =
        getItemQuantity(item);

    const stock =
        Number(item.stock) || 0;


    if (stock <= 0) {

        showCartMessage(
            "Sản phẩm đã hết hàng."
        );

        return;
    }


    if (
        currentQuantity >= stock
    ) {

        showCartMessage(
            "Số lượng đã đạt mức tồn kho."
        );

        return;
    }


    const newQuantity =
        currentQuantity + 1;


    try {

        await updateCartQuantity(
            item.cartId,
            newQuantity
        );


        item.quantity =
            newQuantity;


        renderCart();

    }

    catch (error) {

        showCartMessage(
            "Không thể cập nhật số lượng."
        );

    }

}


/* =========================================================
   DECREASE
   ========================================================= */

async function decreaseQuantity(
    index
) {

    const item =
        cartItems[index];

    if (!item) {
        return;
    }


    const currentQuantity =
        getItemQuantity(item);


    if (currentQuantity <= 1) {
        return;
    }


    const newQuantity =
        currentQuantity - 1;


    try {

        await updateCartQuantity(
            item.cartId,
            newQuantity
        );


        item.quantity =
            newQuantity;


        renderCart();

    }

    catch (error) {

        showCartMessage(
            "Không thể cập nhật số lượng."
        );

    }

}


/* =========================================================
   REMOVE ITEM
   ========================================================= */

async function removeCartItem(
    index
) {

    const item =
        cartItems[index];

    if (!item) {
        return;
    }


    try {

        await deleteCartItem(
            item.cartId
        );


        cartItems.splice(
            index,
            1
        );


        renderCart();


        showCartMessage(
            "Đã xóa sản phẩm khỏi giỏ hàng."
        );

    }

    catch (error) {

        showCartMessage(
            "Không thể xóa sản phẩm."
        );

    }

}


/* =========================================================
   SELECT ALL
   ========================================================= */

if (selectAllCart) {

    selectAllCart.addEventListener(
        "change",
        async function () {

            const checked =
                this.checked;


            try {

                /*
                 * Update database
                 */

                for (
                    const item
                    of cartItems
                ) {

                    if (
                        Number(item.stock) <= 0
                    ) {
                        continue;
                    }


                    item.selected =
                        checked;


                    await updateCartSelected(
                        item.cartId,
                        checked
                    );

                }


                renderCart();

            }

            catch (error) {

                console.error(
                    error
                );

                showCartMessage(
                    "Không thể cập nhật giỏ hàng."
                );

            }

        }
    );

}


/* =========================================================
   UPDATE SELECT ALL
   ========================================================= */

function updateSelectAllState() {

    if (!selectAllCart) {
        return;
    }


    const selectableItems =
        cartItems.filter(
            item =>
                Number(item.stock) > 0
        );


    if (!selectableItems.length) {

        selectAllCart.checked =
            false;

        selectAllCart.indeterminate =
            false;

        return;
    }


    const selectedCount =
        selectableItems.filter(
            isItemSelected
        ).length;


    selectAllCart.checked =
        selectedCount ===
        selectableItems.length;


    selectAllCart.indeterminate =
        selectedCount > 0 &&
        selectedCount <
        selectableItems.length;

}


/* =========================================================
   REMOVE SELECTED
   ========================================================= */

if (removeSelectedCart) {

    removeSelectedCart.addEventListener(
        "click",
        async function () {

            const selectedItems =
                cartItems.filter(
                    item =>
                        isItemSelected(item)
                );


            if (!selectedItems.length) {

                showCartMessage(
                    "Bạn chưa chọn sản phẩm nào."
                );

                return;
            }


            try {

                /*
                 * Xóa từng dòng trong database
                 */

                for (
                    const item
                    of selectedItems
                ) {

                    await deleteCartItem(
                        item.cartId
                    );

                }


                /*
                 * Xóa khỏi state
                 */

                cartItems =
                    cartItems.filter(
                        item =>
                            !isItemSelected(item)
                    );


                renderCart();


                showCartMessage(
                    `Đã xóa ${selectedItems.length} sản phẩm.`
                );

            }

            catch (error) {

                console.error(
                    error
                );

                showCartMessage(
                    "Không thể xóa sản phẩm."
                );

            }

        }
    );

}


/* =========================================================
   UPDATE SUMMARY
   ========================================================= */

function updateSummary() {

    /*
     * Tổng số lượng trong giỏ
     */

    const totalProducts =
        cartItems.reduce(
            function (
                sum,
                item
            ) {

                return (
                    sum +
                    getItemQuantity(item)
                );

            },
            0
        );


    /*
     * Sản phẩm được chọn
     *
     * Không tính sản phẩm hết hàng.
     */

    const selectedItems =
        cartItems.filter(
            item =>
                isItemSelected(item) &&
                Number(item.stock) > 0
        );


    /*
     * Tổng số lượng đã chọn
     */

    const selectedQuantity =
        selectedItems.reduce(
            function (
                sum,
                item
            ) {

                return (
                    sum +
                    getItemQuantity(item)
                );

            },
            0
        );


    /*
     * Tổng tiền
     */

    const subtotal =
        selectedItems.reduce(
            function (
                sum,
                item
            ) {

                return (
                    sum +
                    (
                        getItemQuantity(item) *
                        (
                            Number(item.price) ||
                            0
                        )
                    )
                );

            },
            0
        );


    /*
     * Header cart count
     */

    if (cartItemCount) {

        cartItemCount.textContent =
            `${totalProducts} sản phẩm`;

    }


    /*
     * Số sản phẩm đã chọn
     */

    if (cartSelectedText) {

        cartSelectedText.textContent =
            `Đã chọn ${selectedQuantity} sản phẩm`;

    }


    /*
     * Summary
     */

    if (summaryProductCount) {

        summaryProductCount.textContent =
            `${selectedQuantity} sản phẩm`;

    }


    if (cartSubtotal) {

        cartSubtotal.textContent =
            formatCurrency(
                subtotal
            );

    }


    if (cartTotal) {

        cartTotal.textContent =
            formatCurrency(
                subtotal
            );

    }


    /*
     * Nút đặt hàng
     */

    if (proceedCheckout) {

        proceedCheckout.disabled =
            selectedItems.length === 0;

    }


    updateSelectAllState();

}


/* =========================================================
   TIẾN HÀNH ĐẶT HÀNG
   ========================================================= */

if (proceedCheckout) {

    proceedCheckout.addEventListener(
        "click",
        function () {

            const selectedItems =
                cartItems.filter(
                    item =>
                        isItemSelected(item) &&
                        Number(item.stock) > 0
                );


            if (!selectedItems.length) {

                showCartMessage(
                    "Vui lòng chọn ít nhất một sản phẩm."
                );

                return;
            }


            /*
             * Không lưu sản phẩm vào localStorage.
             *
             * Chỉ truyền ID của các dòng cart_items
             * được chọn.
             */

            const cartIds =
                selectedItems.map(
                    item =>
                        item.cartId
                );


            const query =
                encodeURIComponent(
                    cartIds.join(",")
                );


            /*
             * Chuyển sang trang đặt hàng
             *
             * Ví dụ:
             *
             * dathang.html?cart=1,2,5
             */

            window.location.href =
                `dathang.html?cart=${query}`;

        }
    );

}


/* =========================================================
   TOAST
   ========================================================= */

function showCartMessage(
    message
) {

    let toast =
        document.getElementById(
            "cartToast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id =
            "cartToast";

        toast.className =
            "cart-toast";

        document.body.appendChild(
            toast
        );

    }


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        showCartMessage.timer
    );


    showCartMessage.timer =
        setTimeout(
            function () {

                toast.classList.remove(
                    "show"
                );

            },
            2200
        );

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   TOAST CSS
   ========================================================= */

const cartToastStyle =
    document.createElement(
        "style"
    );

cartToastStyle.textContent = `

    .cart-toast {

        position: fixed;

        left: 50%;

        bottom: 28px;

        transform:
            translate(-50%, 15px);

        opacity: 0;

        padding:
            11px 17px;

        border-radius: 999px;

        background:
            rgba(23, 35, 60, 0.94);

        color: #fff;

        font-family:
            "Be Vietnam Pro",
            sans-serif;

        font-size: 11px;

        font-weight: 600;

        box-shadow:
            0 10px 30px
            rgba(0,0,0,0.15);

        transition:
            .22s ease;

        z-index: 9999;

        pointer-events: none;

    }


    .cart-toast.show {

        opacity: 1;

        transform:
            translate(-50%, 0);

    }


    .cart-stock-warning {

        display: block;

        margin-top: 5px;

        color: #d93025;

        font-size: 11px;

        font-weight: 600;

    }


    .cart-stock-info {

        display: block;

        margin-top: 5px;

        color: #687386;

        font-size: 11px;

    }


    .cart-item.out-of-stock {

        opacity: .72;

    }

`;

document.head.appendChild(
    cartToastStyle
);


/* =========================================================
   KHỞI TẠO
   ========================================================= */

async function initializeCart() {

    try {

        const {
            data: {
                user
            },
            error
        } =
            await supabaseClient
                .auth
                .getUser();


        if (error) {
            throw error;
        }


        /*
         * Chưa đăng nhập
         */

        if (!user) {

            showCartMessage(
                "Bạn cần đăng nhập để xem giỏ hàng."
            );


            setTimeout(
                function () {

                    window.location.href =
                        "dangnhap.html";

                },
                1000
            );


            return;
        }


        /*
         * Lưu user hiện tại
         */

        currentUser =
            user;


        /*
         * Load database cart
         */

        await loadCart();

    }

    catch (error) {

        console.error(
            "Lỗi khởi tạo giỏ hàng:",
            error
        );

        cartItems = [];

        renderCart();

    }

}


/* =========================================================
   CHẠY
   ========================================================= */

initializeCart();