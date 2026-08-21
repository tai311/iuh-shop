/* =========================================
   SUPABASE
========================================= */

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

let users = [];
let currentFilter = "all";

let products = [];
let currentProductFilter = "all";


/* =========================================
   KIỂM TRA ADMIN
========================================= */

async function checkAdmin() {

    const {
        data: { user },
        error: authError
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        window.location.href = "trangchu.html";
        return null;
    }

    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("users")
        .select("fullname, role")
        .eq("user_id", user.id)
        .maybeSingle();

    if (profileError) {

        console.error(
            "Lỗi lấy profile:",
            profileError
        );

        alert(
            "Không thể kiểm tra quyền Admin."
        );

        return null;
    }

    if (
        !profile ||
        profile.role !== "admin"
    ) {

        alert(
            "Bạn không có quyền truy cập trang quản trị."
        );

        window.location.href =
            "trangchu.html";

        return null;
    }

    const adminName =
        document.getElementById(
            "adminName"
        );

    if (adminName) {

        adminName.textContent =
            profile.fullname ||
            "Admin";
    }

    return user;
}


/* =========================================
   ĐĂNG XUẤT
========================================= */

function setupLogout() {

    const logoutButton =
        document.getElementById(
            "adminLogout"
        );

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async function () {

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
                    "Đăng xuất thất bại."
                );

                return;
            }

            window.location.href =
                "trangchu.html";
        }
    );
}

/* =========================================
   QUẢN LÝ TIN ĐĂNG
========================================= */

function setupProductManagement() {

    const manageProducts =
        document.getElementById(
            "manageProducts"
        );

    const productsSection =
        document.getElementById(
            "productsSection"
        );

    const closeProducts =
        document.getElementById(
            "closeProducts"
        );


    if (
        !manageProducts ||
        !productsSection
    ) {
        return;
    }


    /* =====================================
       MỞ QUẢN LÝ TIN
    ===================================== */

    manageProducts.addEventListener(
        "click",
        async function () {

            productsSection.classList.add(
                "show"
            );

            productsSection.setAttribute(
                "aria-hidden",
                "false"
            );


            productsSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });


            await loadProducts();

        }
    );


    /* =====================================
       ĐÓNG
    ===================================== */

    if (closeProducts) {

        closeProducts.addEventListener(
            "click",
            function () {

                productsSection.classList.remove(
                    "show"
                );

                productsSection.setAttribute(
                    "aria-hidden",
                    "true"
                );


                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

    }


    setupProductFilters();

}


/* =========================================
   TÌM KIẾM + LỌC TIN
========================================= */

function setupProductFilters() {

    const buttons =
        document.querySelectorAll(
            ".product-filter-button"
        );


    buttons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    buttons.forEach(
                        function (item) {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    currentProductFilter =
                        button.dataset.productFilter ||
                        "all";


                    renderProducts();

                    updateProductSummary();

                }
            );

        }
    );


    const searchInput =
        document.getElementById(
            "productsSearch"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function () {

                renderProducts();

                updateProductSummary();

            }
        );

    }

}


/* =========================================
   TẢI TIN ĐĂNG
========================================= */

async function loadProducts() {

    const list =
        document.getElementById(
            "productsList"
        );


    if (!list) {
        return;
    }


    list.innerHTML = `
        <div class="products-loading">
            Đang tải tin đăng...
        </div>
    `;


    try {

        const {
            data: productData,
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


        if (productError) {
            throw productError;
        }


        products =
            productData || [];


        await attachProductSellers();


        updateTotalProducts();

        renderProducts();

        updateProductSummary();

    }

    catch (error) {

        console.error(
            "Lỗi tải tin đăng:",
            error
        );


        list.innerHTML = `

            <div class="products-error">

                Không thể tải danh sách tin đăng.

                <br><br>

                ${escapeHtml(
                    error.message || ""
                )}

            </div>

        `;

    }

}


/* =========================================
   LẤY THÔNG TIN NGƯỜI BÁN
========================================= */

async function attachProductSellers() {

    const sellerIds = [
        ...new Set(
            products
                .map(
                    product =>
                        product.seller_id
                )
                .filter(Boolean)
        )
    ];


    if (
        sellerIds.length === 0
    ) {

        products =
            products.map(
                product => ({
                    ...product,
                    seller: null
                })
            );

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
                avatar_url,
                role,
                student_verified
            `)
            .in(
                "user_id",
                sellerIds
            );


    if (error) {
        throw error;
    }


    const sellerMap =
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
                    sellerMap.get(
                        String(
                            product.seller_id
                        )
                    ) || null

            })
        );

}


/* =========================================
   LỌC TIN
========================================= */

function getFilteredProducts() {

    const searchInput =
        document.getElementById(
            "productsSearch"
        );


    const keyword =
        (
            searchInput?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    return products.filter(
        function (product) {

            const status =
                product.status ||
                "active";


            const filterMatch =
                currentProductFilter ===
                    "all" ||

                status ===
                    currentProductFilter;


            const productName =
                (
                    product.name ||
                    ""
                )
                    .toLowerCase();


            const sellerName =
                (
                    product.seller?.fullname ||
                    ""
                )
                    .toLowerCase();


            const sellerEmail =
                (
                    product.seller?.email ||
                    ""
                )
                    .toLowerCase();


            const searchMatch =
                !keyword ||

                productName.includes(
                    keyword
                ) ||

                sellerName.includes(
                    keyword
                ) ||

                sellerEmail.includes(
                    keyword
                );


            return (
                filterMatch &&
                searchMatch
            );

        }
    );

}


/* =========================================
   HIỂN THỊ TIN
========================================= */

function renderProducts() {

    const list =
        document.getElementById(
            "productsList"
        );


    if (!list) {
        return;
    }


    const filtered =
        getFilteredProducts();


    if (
        filtered.length === 0
    ) {

        list.innerHTML = `

            <div class="products-empty">

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


/* =========================================
   CARD TIN ĐĂNG
========================================= */

function createProductCard(
    product
) {

    const seller =
        product.seller || {};


    const image =
        getProductImage(
            product.image_urls
        );


    const status =
        product.status ||
        "active";


    const isActive =
        status === "active";


    const price =
        Number.isFinite(
            Number(
                product.price
            )
        )

            ?

            new Intl.NumberFormat(
                "vi-VN"
            ).format(
                Number(
                    product.price
                )
            ) + "đ"

            :

            "Liên hệ";


    const createdAt =
        product.created_at

            ?

            new Date(
                product.created_at
            ).toLocaleDateString(
                "vi-VN"
            )

            :

            "";


    return `

        <article
            class="product-admin-card"
        >

            <img
                class="product-admin-image"

                src="${escapeAttribute(
                    image
                )}"

                alt="Ảnh sản phẩm"

                onerror="
                    this.src='../Images/default-product.png'
                "
            >


            <div
                class="product-admin-info"
            >

                <div
                    class="product-admin-title-row"
                >

                    <strong
                        class="product-admin-name"
                    >

                        ${escapeHtml(
                            product.name ||
                            "Tin đăng không tên"
                        )}

                    </strong>


                    <span
                        class="product-admin-status ${
                            isActive
                                ? "is-active"
                                : "is-hidden"
                        }"
                    >

                        ${
                            isActive
                                ? "Đang hiển thị"
                                : "Đang ẩn"
                        }

                    </span>

                </div>


                <span
                    class="product-admin-meta"
                >

                    Người bán:

                    ${escapeHtml(
                        seller.fullname ||
                        "Không xác định"
                    )}

                </span>


                <span
                    class="product-admin-meta"
                >

                    ${escapeHtml(
                        product.category ||
                        "Chưa phân loại"
                    )}

                    · ${price}

                    ${
                        createdAt
                            ? `· ${createdAt}`
                            : ""
                    }

                </span>

            </div>


            <div
                class="product-admin-actions"
            >

                <button
                    type="button"

                    class="product-admin-action ${
                        isActive
                            ? "hide"
                            : "show"
                    }"

                    data-product-action="${
                        isActive
                            ? "hide"
                            : "show"
                    }"

                    data-product-id="${escapeAttribute(
                        product.id
                    )}"
                >

                    ${
                        isActive
                            ? "Ẩn tin"
                            : "Hiện tin"
                    }

                </button>


                <button
                    type="button"

                    class="product-admin-action delete"

                    data-product-action="delete"

                    data-product-id="${escapeAttribute(
                        product.id
                    )}"
                >

                    Xóa

                </button>

            </div>

        </article>

    `;

}


/* =========================================
   LẤY ẢNH SẢN PHẨM
========================================= */

function getProductImage(
    value
) {

    if (
        Array.isArray(value) &&
        value.length > 0
    ) {

        return value[0];

    }


    if (
        typeof value ===
        "string"
    ) {

        const trimmed =
            value.trim();


        if (!trimmed) {

            return "../Images/default-product.png";

        }


        try {

            const parsed =
                JSON.parse(
                    trimmed
                );


            if (
                Array.isArray(parsed) &&
                parsed.length > 0
            ) {

                return parsed[0];

            }

        }

        catch (error) {

            return trimmed;

        }

    }


    return "../Images/default-product.png";

}


/* =========================================
   CẬP NHẬT TỔNG SẢN PHẨM
========================================= */

function updateTotalProducts() {

    const totalProducts =
        document.getElementById(
            "totalProducts"
        );


    if (totalProducts) {

        totalProducts.textContent =
            products.length;

    }

}


/* =========================================
   THỐNG KÊ TIN
========================================= */

function updateProductSummary() {

    const summary =
        document.getElementById(
            "productsSummary"
        );


    if (!summary) {
        return;
    }


    const active =
        products.filter(
            product =>
                (
                    product.status ||
                    "active"
                ) === "active"
        ).length;


    const hidden =
        products.filter(
            product =>
                product.status ===
                "hidden"
        ).length;


    summary.textContent =

        `Có ${products.length} tin đăng · ` +

        `${active} đang hiển thị · ` +

        `${hidden} đang ẩn · ` +

        `Đang hiển thị ${
            getFilteredProducts().length
        }`;

}


/* =========================================
   ẨN / HIỆN TIN
========================================= */

async function changeProductStatus(
    productId,
    newStatus
) {

    const product =
        products.find(
            item =>
                String(item.id) ===
                String(productId)
        );


    if (!product) {
        return;
    }


    const message =
        newStatus === "hidden"

            ?

            `Bạn có chắc muốn ẩn tin "${
                product.name ||
                "này"
            }" không?`

            :

            `Bạn có muốn hiện lại tin "${
                product.name ||
                "này"
            }" không?`;


    if (
        !confirm(message)
    ) {
        return;
    }


    try {

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
                    product.id
                );


    if (error) {
        throw error;
    }


    product.status =
        newStatus;


    renderProducts();

    updateProductSummary();

    }

    catch (error) {

        console.error(
            "Lỗi cập nhật trạng thái tin:",
            error
        );


        alert(
            error.message ||
            "Không thể cập nhật trạng thái tin."
        );

    }

}


/* =========================================
   XÓA TIN
========================================= */

async function deleteProduct(
    productId
) {

    const product =
        products.find(
            item =>
                String(item.id) ===
                String(productId)
        );


    if (!product) {
        return;
    }


    const confirmed =
        confirm(
            `Bạn có chắc muốn XÓA tin "${
                product.name ||
                "này"
            }" không?\n\n` +
            `Hành động này không thể hoàn tác.`
        );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } =
            await supabaseClient
                .from("products")
                .delete()
                .eq(
                    "id",
                    product.id
                );


        if (error) {
            throw error;
        }


        products =
            products.filter(
                item =>
                    String(item.id) !==
                    String(product.id)
            );


        updateTotalProducts();

        renderProducts();

        updateProductSummary();


        alert(
            "Đã xóa tin đăng."
        );

    }

    catch (error) {

        console.error(
            "Lỗi xóa tin đăng:",
            error
        );


        alert(
            error.message ||
            "Không thể xóa tin đăng."
        );

    }

}


/* =========================================
   XỬ LÝ NÚT ẨN / HIỆN / XÓA
========================================= */

document.addEventListener(
    "click",
    async function (event) {

        const button =
            event.target.closest(
                ".product-admin-action"
            );


        if (!button) {
            return;
        }


        const productId =
            button.dataset.productId;


        const action =
            button.dataset.productAction;


        if (
            !productId ||
            !action
        ) {

            return;

        }


        button.disabled =
            true;


        try {

            if (
                action === "hide"
            ) {

                await changeProductStatus(
                    productId,
                    "hidden"
                );

            }

            else if (
                action === "show"
            ) {

                await changeProductStatus(
                    productId,
                    "active"
                );

            }

            else if (
                action === "delete"
            ) {

                await deleteProduct(
                    productId
                );

            }

        }

        finally {

            button.disabled =
                false;

        }

    }
);


/* =========================================
   MỞ / ĐÓNG QUẢN LÝ NGƯỜI DÙNG
========================================= */

function setupUserManagement() {

    const manageUsers =
        document.getElementById(
            "manageUsers"
        );

    const verificationSection =
        document.getElementById(
            "verificationSection"
        );

    const closeVerification =
        document.getElementById(
            "closeVerification"
        );


    /* Không tìm thấy nút */

    if (!manageUsers) {

        console.error(
            "Không tìm thấy #manageUsers"
        );

        return;
    }


    /* Không tìm thấy khu vực xác thực */

    if (!verificationSection) {

        console.error(
            "Không tìm thấy #verificationSection"
        );

        return;
    }


    /* =====================================
       BẤM QUẢN LÝ NGƯỜI DÙNG
    ===================================== */

    manageUsers.addEventListener(
        "click",
        async function () {

            /*
               Hiện phần xác thực
            */

            verificationSection.classList.add(
                "show"
            );

            verificationSection.setAttribute(
                "aria-hidden",
                "false"
            );


            /*
               Cuộn xuống phần xác thực
            */

            verificationSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });


            /*
               Tải danh sách tài khoản
            */

            await loadUsers();
        }
    );


    /* =====================================
       BẤM ĐÓNG
    ===================================== */

    if (closeVerification) {

        closeVerification.addEventListener(
            "click",
            function () {

                verificationSection.classList.remove(
                    "show"
                );

                verificationSection.setAttribute(
                    "aria-hidden",
                    "true"
                );


                /*
                   Cuộn về đầu trang
                */

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        );
    }
}


/* =========================================
   TẢI DANH SÁCH TÀI KHOẢN
========================================= */

async function loadUsers() {

    const verificationList =
        document.getElementById(
            "verificationList"
        );

    if (!verificationList) {
        return;
    }


    verificationList.innerHTML = `
        <div class="verification-loading">
            Đang tải tài khoản...
        </div>
    `;


    try {

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
                    avatar_url,
                    role,
                    student_verified,
                    verification_status,
                    verification_method,
                    verified_at
                `)
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


        /*
           Cập nhật tổng số người dùng
        */

        updateTotalUsers();


        /*
           Hiển thị danh sách
        */

        renderUsers();


        /*
           Cập nhật thống kê xác thực
        */

        updateSummary();

    }

    catch (error) {

        console.error(
            "Lỗi tải danh sách tài khoản:",
            error
        );


        verificationList.innerHTML = `

            <div class="verification-error">

                Không thể tải danh sách tài khoản.

                <br><br>

                ${escapeHtml(
                    error.message || ""
                )}

            </div>

        `;
    }
}


/* =========================================
   CẬP NHẬT TỔNG USER
========================================= */

function updateTotalUsers() {

    const totalUsers =
        document.getElementById(
            "totalUsers"
        );

    if (totalUsers) {

        totalUsers.textContent =
            users.length;
    }
}


/* =========================================
   FILTER + SEARCH
========================================= */

function setupFilters() {

    const filterButtons =
        document.querySelectorAll(
            ".filter-button"
        );


    /*
       Bộ lọc
    */

    filterButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    filterButtons.forEach(
                        function (item) {

                            item.classList.remove(
                                "active"
                            );
                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    currentFilter =
                        button.dataset.filter ||
                        "all";


                    renderUsers();

                    updateSummary();
                }
            );
        }
    );


    /*
       Tìm kiếm
    */

    const searchInput =
        document.getElementById(
            "verificationSearch"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function () {

                renderUsers();

                updateSummary();
            }
        );
    }
}


/* =========================================
   LỌC USER
========================================= */

function getFilteredUsers() {

    const searchInput =
        document.getElementById(
            "verificationSearch"
        );


    const keyword =
        (
            searchInput?.value ||
            ""
        )
            .trim()
            .toLowerCase();


    return users.filter(
        function (user) {

            const verified =
                user.student_verified === true;


            /*
               Kiểm tra bộ lọc
            */

            const filterMatch =

                currentFilter === "all"

                ||

                (
                    currentFilter === "verified" &&
                    verified
                )

                ||

                (
                    currentFilter === "unverified" &&
                    !verified
                );


            /*
               Tên
            */

            const name =
                (
                    user.fullname ||
                    ""
                )
                    .toLowerCase();


            /*
               Email
            */

            const email =
                (
                    user.email ||
                    ""
                )
                    .toLowerCase();


            /*
               Kiểm tra từ khóa
            */

            const searchMatch =

                !keyword

                ||

                name.includes(
                    keyword
                )

                ||

                email.includes(
                    keyword
                );


            return (
                filterMatch &&
                searchMatch
            );
        }
    );
}


/* =========================================
   HIỂN THỊ USER
========================================= */

function renderUsers() {

    const verificationList =
        document.getElementById(
            "verificationList"
        );


    if (!verificationList) {
        return;
    }


    const filteredUsers =
        getFilteredUsers();


    /*
       Không có tài khoản
    */

    if (
        filteredUsers.length === 0
    ) {

        verificationList.innerHTML = `

            <div class="verification-empty">

                Không tìm thấy tài khoản phù hợp.

            </div>

        `;

        return;
    }


    /*
       Tạo danh sách card
    */

    verificationList.innerHTML =
        filteredUsers
            .map(
                createUserCard
            )
            .join("");
}


/* =========================================
   TẠO CARD USER
========================================= */

function createUserCard(
    user
) {

    const verified =
        user.student_verified === true;


    const role =
        user.role ||
        "user";


    /* =====================================
       CHỨC DANH
    ===================================== */

    let roleText =
        "Sinh viên";


    if (
        role === "admin"
    ) {

        roleText =
            "Admin";

    }

    else if (
        role === "moderator"
    ) {

        roleText =
            "Quản trị viên";
    }


    /* =====================================
       TRẠNG THÁI
    ===================================== */

    let stateText =
        "Chưa có tích xác thực";


    if (verified) {

        if (
            user.verification_method ===
            "admin_grant"
        ) {

            stateText =
                "Được Admin cấp tích";

        }

        else {

            stateText =
                "Đã xác thực sinh viên";
        }
    }


    /* =====================================
       NÚT
    ===================================== */

    let action = "";


    /*
       Admin và Quản trị viên:

       - Mặc định có tích
       - Không cần cấp
       - Không hiện nút thu hồi
    */

    if (
        role === "admin" ||
        role === "moderator"
    ) {

        action = `

            <span
                class="verification-state is-verified"
            >
                Quyền hệ thống
            </span>

        `;

    }


    /*
       Sinh viên đã có tích
    */

    else if (verified) {

        action = `

            <button
                type="button"
                class="verification-action revoke"
                data-action="revoke"
                data-user-id="${escapeAttribute(
                    user.user_id
                )}"
            >

                Thu hồi tích

            </button>

        `;

    }


    /*
       Sinh viên chưa có tích
    */

    else {

        action = `

            <button
                type="button"
                class="verification-action grant"
                data-action="grant"
                data-user-id="${escapeAttribute(
                    user.user_id
                )}"
            >

                Cấp tích ✓

            </button>

        `;
    }


    /* =====================================
       TÍCH XANH
    ===================================== */

    const badge =

        verified ||

        role === "admin" ||

        role === "moderator"

            ?

            `

                <span
                    class="student-verified-badge"
                    title="Đã xác thực"
                >

                    ✓

                </span>

            `

            :

            "";


    /* =====================================
       CARD
    ===================================== */

    return `

        <article
            class="verification-card"
        >

            <img
                class="verification-avatar"
                src="${escapeAttribute(
                    user.avatar_url ||
                    DEFAULT_AVATAR
                )}"
                alt="Avatar"
                onerror="this.src='${DEFAULT_AVATAR}'"
            >


            <div
                class="verification-user"
            >

                <div
                    class="verification-name"
                >

                    <strong>

                        ${escapeHtml(
                            user.fullname ||
                            "Chưa cập nhật tên"
                        )}

                    </strong>


                    ${badge}

                </div>


                <span
                    class="verification-email"
                >

                    ${escapeHtml(
                        user.email ||
                        ""
                    )}

                </span>


                <span
                    class="verification-role"
                >

                    ${roleText}

                </span>


                <span
                    class="verification-state ${
                        verified
                            ? "is-verified"
                            : ""
                    }"
                >

                    ${stateText}

                </span>

            </div>


            <div>

                ${action}

            </div>

        </article>

    `;
}


/* =========================================
   CẤP / THU HỒI TÍCH
========================================= */

document.addEventListener(
    "click",
    async function (event) {

        const button =
            event.target.closest(
                ".verification-action"
            );


        if (!button) {
            return;
        }


        const userId =
            button.dataset.userId;


        const verified =
            button.dataset.action ===
            "grant";


        if (!userId) {
            return;
        }


        const message =

            verified

                ?

                "Bạn có chắc muốn cấp tích cho tài khoản này không?"

                :

                "Bạn có chắc muốn thu hồi tích của tài khoản này không?";


        if (
            !confirm(message)
        ) {
            return;
        }


        button.disabled =
            true;


        try {

            const {
                data,
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


            if (
                !data ||
                data.success !== true
            ) {

                throw new Error(
                    "Máy chủ không trả về kết quả hợp lệ."
                );
            }


            alert(

                verified

                    ?

                    "Đã cấp tích xác thực."

                    :

                    "Đã thu hồi tích xác thực."

            );


            /*
               Tải lại danh sách
            */

            await loadUsers();

        }

        catch (error) {

            console.error(
                "Lỗi cập nhật tích:",
                error
            );


            alert(
                error.message ||
                "Không thể cập nhật trạng thái xác thực."
            );


            button.disabled =
                false;
        }
    }
);


/* =========================================
   THỐNG KÊ XÁC THỰC
========================================= */

function updateSummary() {

    const summary =
        document.getElementById(
            "verificationSummary"
        );


    if (!summary) {
        return;
    }


    /*
       Chỉ tính tài khoản sinh viên
    */

    const students =
        users.filter(
            function (user) {

                return (
                    user.role ===
                    "user"
                );
            }
        );


    /*
       Sinh viên đã có tích
    */

    const verified =
        students.filter(
            function (user) {

                return (
                    user.student_verified ===
                    true
                );
            }
        ).length;


    /*
       Số tài khoản đang hiển thị
    */

    const visible =
        getFilteredUsers().length;


    summary.textContent =

        `Có ${students.length} tài khoản sinh viên · ` +

        `${verified} đã có tích · ` +

        `${students.length - verified} chưa có tích · ` +

        `Đang hiển thị ${visible}`;
}


/* =========================================
   ESCAPE HTML
========================================= */

function escapeHtml(
    value
) {

    return String(value)

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


function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );
}


/* =========================================
   KHỞI ĐỘNG
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "IUH SHOP ADMIN JS đã chạy."
        );


        /*
           Kiểm tra tài khoản Admin
        */

        const user =
            await checkAdmin();


        if (!user) {
            return;
        }


        /*
           Khởi tạo các chức năng
        */

        setupLogout();

setupProductManagement();

setupUserManagement();

setupFilters();


        /*
           KHÔNG tải danh sách xác thực
           ngay khi mở trang.

           Chỉ tải khi Admin bấm:
           "Quản lý người dùng".
        */
    }
);