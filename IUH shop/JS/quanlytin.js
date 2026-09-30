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
   STATE
===================================================== */

let currentUser = null;

let allProducts = [];

let currentStatus = "active";


/* =====================================================
   HELPER
===================================================== */

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


function formatPrice(price) {

    return new Intl.NumberFormat(
        "vi-VN"
    ).format(
        Number(price || 0)
    ) + " đ";

}


function getFirstImage(product) {

    if (
        Array.isArray(
            product.image_urls
        ) &&
        product.image_urls.length > 0
    ) {

        return product.image_urls[0];

    }


    return "../Images/default-product.png";

}


/* =====================================================
   TOAST
===================================================== */

function showToast(message) {

    const toast =
        $("toast");

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );


    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );

        },
        2500
    );

}

/* =====================================================
   LẤY TIN CỦA TÀI KHOẢN HIỆN TẠI
===================================================== */

async function loadProducts() {

    if (!currentUser) {

        window.location.href =
            "dangnhap.html";

        return;

    }


    $("loading")
        .style.display =
        "flex";

    $("productList")
        .innerHTML =
        "";

    $("emptyState")
        .style.display =
        "none";


    try {

        const {
            data,
            error
        } =
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
                .eq(
                    "seller_id",
                    currentUser.id
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


        allProducts =
            data || [];


        updateCounts();

        renderProducts();

    }

    catch (error) {

        console.error(
            "Lỗi tải tin:",
            error
        );


        showToast(
            "Không thể tải danh sách tin."
        );

    }

    finally {

        $("loading")
            .style.display =
            "none";

    }

}


/* =====================================================
   ĐẾM TRẠNG THÁI
===================================================== */

function updateCounts() {

    const active =
        allProducts.filter(
            product =>
                product.status ===
                "active"
        ).length;


    const hidden =
        allProducts.filter(
            product =>
                product.status ===
                "hidden"
        ).length;


    const deleted =
        allProducts.filter(
            product =>
                product.status ===
                "deleted"
        ).length;


    $("countActive")
        .textContent =
        active;


    $("countHidden")
        .textContent =
        hidden;


    $("countDeleted")
        .textContent =
        deleted;

}


/* =====================================================
   HIỂN THỊ SẢN PHẨM
===================================================== */

function renderProducts() {

    const list =
        $("productList");


    const filtered =
        allProducts.filter(
            product =>
                product.status ===
                currentStatus
        );


    list.innerHTML =
        "";


    if (
        filtered.length === 0
    ) {

        $("emptyState")
            .style.display =
            "block";


        updateEmptyState();

        return;

    }


    $("emptyState")
        .style.display =
        "none";


    filtered.forEach(
        product => {

            list.appendChild(
                createProductCard(
                    product
                )
            );

        }
    );

}


/* =====================================================
   CARD
===================================================== */

function createProductCard(
    product
) {

    const item =
        document.createElement(
            "article"
        );


    item.className =
        "product-item";


    const image =
        getFirstImage(
            product
        );


    item.innerHTML = `

        <img
            class="product-image"
            src="${escapeHTML(image)}"
            alt="${escapeHTML(product.name)}"
            onerror="
                this.src='../Images/default-product.png'
            "
        >


        <div class="product-info">

            <span class="product-category">
                ${escapeHTML(
                    product.category ||
                    "Khác"
                )}
            </span>


            <h3>
                ${escapeHTML(
                    product.name
                )}
            </h3>


            <p class="product-description">
                ${escapeHTML(
                    product.description ||
                    "Chưa có mô tả."
                )}
            </p>


            <div class="product-meta">

                <span>
                    Số lượng:
                    <strong>
                        ${product.quantity ?? 0}
                    </strong>
                </span>


                <span class="product-price">
                    ${formatPrice(
                        product.price
                    )}
                </span>

            </div>

        </div>


        <div class="product-actions">

            <a
                href="chitietsanpham.html?id=${encodeURIComponent(product.id)}"
                class="action-button view-button"
            >
                Xem tin
            </a>

            ${
                product.status === "active"

                ? `

                    <button
                        type="button"
                        class="action-button hide-button"
                        data-action="hide"
                        data-id="${product.id}"
                    >
                        Ẩn tin
                    </button>


                    <button
                        type="button"
                        class="action-button delete-button"
                        data-action="delete"
                        data-id="${product.id}"
                    >
                        Xóa tin
                    </button>

                `

                : ""
            }


            ${
                product.status === "hidden"

                ? `

                    <button
                        type="button"
                        class="action-button restore-button"
                        data-action="restore"
                        data-id="${product.id}"
                    >
                        Hiện tin
                    </button>


                    <button
                        type="button"
                        class="action-button delete-button"
                        data-action="delete"
                        data-id="${product.id}"
                    >
                        Xóa tin
                    </button>

                `

                : ""
            }


            ${
                product.status === "deleted"

                ? `

                    <button
                        type="button"
                        class="action-button restore-button"
                        data-action="restore"
                        data-id="${product.id}"
                    >
                        Khôi phục
                    </button>

                `

                : ""
            }

        </div>

    `;


    return item;

}


/* =====================================================
   CẬP NHẬT STATUS
===================================================== */

async function updateProductStatus(
    productId,
    newStatus
) {

    if (!currentUser) {

        showToast(
            "Bạn cần đăng nhập."
        );

        return;

    }


    try {

        /*
            Điều kiện seller_id
            giúp người dùng chỉ
            sửa được tin của chính mình.
        */

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
                )

                .eq(
                    "seller_id",
                    currentUser.id
                );


        if (error) {
            throw error;
        }


        const product =
            allProducts.find(
                item =>
                    String(
                        item.id
                    ) ===
                    String(
                        productId
                    )
            );


        if (product) {

            product.status =
                newStatus;

        }


        updateCounts();

        renderProducts();


        if (
            newStatus ===
            "hidden"
        ) {

            showToast(
                "Đã ẩn tin."
            );

        }

        else if (
            newStatus ===
            "deleted"
        ) {

            showToast(
                "Đã chuyển tin vào mục Đã xóa."
            );

        }

        else if (
            newStatus ===
            "active"
        ) {

            showToast(
                "Tin đã được hiển thị lại."
            );

        }

    }

    catch (error) {

        console.error(
            "Lỗi cập nhật tin:",
            error
        );


        showToast(
            error.message ||
            "Không thể cập nhật tin."
        );

    }

}


/* =====================================================
   EMPTY STATE
===================================================== */

function updateEmptyState() {

    const title =
        $("emptyTitle");

    const description =
        $("emptyDescription");


    if (
        currentStatus ===
        "active"
    ) {

        title.textContent =
            "Bạn chưa có tin đang bán";

        description.textContent =
            "Hãy đăng sản phẩm để bắt đầu bán trên IUH SHOP.";

    }

    else if (
        currentStatus ===
        "hidden"
    ) {

        title.textContent =
            "Không có tin đã ẩn";

        description.textContent =
            "Các tin bạn ẩn sẽ xuất hiện ở đây.";

    }

    else {

        title.textContent =
            "Không có tin đã xóa";

        description.textContent =
            "Các tin đã xóa sẽ được lưu ở đây để bạn có thể khôi phục.";

    }

}


/* =====================================================
   EVENT
===================================================== */

document.addEventListener(
    "click",
    async event => {

        const button =
            event.target.closest(
                "[data-action]"
            );


        if (!button) {
            return;
        }


        const action =
            button.dataset.action;

        const id =
            button.dataset.id;


        if (
            action ===
            "hide"
        ) {

            if (
                !confirm(
                    "Bạn có chắc muốn ẩn tin này?"
                )
            ) {

                return;

            }


            await updateProductStatus(
                id,
                "hidden"
            );

        }


        else if (
            action ===
            "delete"
        ) {

            if (
                !confirm(
                    "Tin sẽ được chuyển vào mục Đã xóa. Bạn vẫn có thể khôi phục sau đó. Tiếp tục?"
                )
            ) {

                return;

            }


            await updateProductStatus(
                id,
                "deleted"
            );

        }


        else if (
            action ===
            "restore"
        ) {

            await updateProductStatus(
                id,
                "active"
            );

        }

    }
);


/* =====================================================
   TAB
===================================================== */

document
    .querySelectorAll(
        ".status-tab"
    )
    .forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".status-tab"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "active"
                                )
                        );


                    tab.classList.add(
                        "active"
                    );


                    currentStatus =
                        tab.dataset.status;


                    renderProducts();

                }
            );

        }
    );


/* =====================================================
   INIT
===================================================== */
async function loadHeaderUser() {

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();

    const guestAccount =
        document.getElementById("guestAccount");

    const userAccount =
        document.getElementById("userAccount");


    // CHƯA ĐĂNG NHẬP
    if (!user) {

        if (guestAccount) {
            guestAccount.style.display = "flex";
        }

        if (userAccount) {
            userAccount.style.display = "none";
        }

        currentUser = null;

        return;

    }


    // ĐÃ ĐĂNG NHẬP
    currentUser = user;


    if (guestAccount) {
        guestAccount.style.display = "none";
    }

    if (userAccount) {
        userAccount.style.display = "block";
    }


    // Lấy thông tin user
    const {
        data: profile,
        error
    } = await supabaseClient
        .from("users")
        .select(`
            fullname,
            avatar_url,
            role
        `)
        .eq("user_id", user.id)
        .maybeSingle();


    if (error) {

        console.error(
            "Lỗi lấy thông tin người dùng:",
            error
        );

    }


    const nameElement =
        document.getElementById(
            "headerUserName"
        );

    const avatarElement =
        document.getElementById(
            "headerAvatar"
        );


    if (nameElement) {

        nameElement.textContent =
            profile?.fullname ||
            user.email ||
            "Tài khoản";

    }


    if (avatarElement) {

        avatarElement.src =
            profile?.avatar_url ||
            "../Images/default-avatar.svg";

    }


    // Hiện menu quản trị nếu là admin
    const adminLink =
        document.getElementById(
            "adminLink"
        );


    if (
        adminLink &&
        (
            profile?.role === "admin" ||
            profile?.role === "moderator"
        )
    ) {

        adminLink.style.display =
            "flex";

    }

}

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            await loadHeaderUser();

            setupAccountDropdown();

            await loadProducts();

        }

        catch (error) {

            console.error(
                "Lỗi khởi tạo:",
                error
            );

        }

    }
);
