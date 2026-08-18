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


/* =========================================================
   IUH SHOP - ĐĂNG TIN
   ========================================================= */


const DEFAULT_AVATAR =
    "../Images/default-avatar.svg";


const MAX_IMAGES = 5;

const MAX_IMAGE_SIZE =
    5 * 1024 * 1024;


let currentUser = null;

let selectedFiles = [];


/* =========================================================
   DOM
   ========================================================= */

const productForm =
    document.getElementById(
        "productForm"
    );


const productImages =
    document.getElementById(
        "productImages"
    );


const chooseImages =
    document.getElementById(
        "chooseImages"
    );


const imageDropzone =
    document.getElementById(
        "imageDropzone"
    );


const imagePreviewGrid =
    document.getElementById(
        "imagePreviewGrid"
    );


const submitProduct =
    document.getElementById(
        "submitProduct"
    );


const submitText =
    document.getElementById(
        "submitText"
    );


const submitLoading =
    document.getElementById(
        "submitLoading"
    );


const description =
    document.getElementById(
        "productDescription"
    );


const descriptionCount =
    document.getElementById(
        "descriptionCount"
    );


const toast =
    document.getElementById(
        "toast"
    );


/* =========================================================
   THÔNG BÁO
   ========================================================= */

function showToast(
    message,
    type = "success"
) {

    toast.textContent =
        message;


    toast.className =
        `toast show ${type}`;


    clearTimeout(
        showToast.timer
    );


    showToast.timer =
        setTimeout(
            () => {

                toast.className =
                    "toast";

            },
            3500
        );

}


/* =========================================================
   KIỂM TRA USER
   ========================================================= */

async function loadCurrentUser() {

    const {
        data,
        error
    } =
        await supabaseClient
            .auth
            .getUser();


    if (error) {

        console.error(error);

        return null;

    }


    return data?.user || null;

}


/* =========================================================
   KIỂM TRA ẢNH
   ========================================================= */

function validateFile(file) {

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        return "Chỉ chấp nhận JPG, PNG hoặc WEBP.";

    }


    if (
        file.size >
        MAX_IMAGE_SIZE
    ) {

        return "Mỗi ảnh không được vượt quá 5MB.";

    }


    return null;

}


/* =========================================================
   THÊM ẢNH
   ========================================================= */

function addFiles(fileList) {

    const incoming =
        Array.from(fileList);


    if (
        selectedFiles.length +
        incoming.length >
        MAX_IMAGES
    ) {

        showToast(
            "Bạn chỉ được tải tối đa 5 ảnh.",
            "error"
        );

        return;

    }


    for (
        const file
        of incoming
    ) {

        const error =
            validateFile(file);


        if (error) {

            showToast(
                error,
                "error"
            );

            return;

        }

    }


    selectedFiles.push(
        ...incoming
    );


    renderPreviews();

}


/* =========================================================
   HIỂN THỊ ẢNH PREVIEW
   ========================================================= */

function renderPreviews() {

    imagePreviewGrid.innerHTML =
        "";


    selectedFiles.forEach(
        (file, index) => {

            const wrapper =
                document.createElement(
                    "div"
                );


            wrapper.className =
                "image-preview";


            const image =
                document.createElement(
                    "img"
                );


            const remove =
                document.createElement(
                    "button"
                );


            remove.type =
                "button";


            remove.className =
                "remove-image";


            remove.textContent =
                "×";


            remove.addEventListener(
                "click",
                () => {

                    selectedFiles.splice(
                        index,
                        1
                    );


                    renderPreviews();

                }
            );


            image.src =
                URL.createObjectURL(
                    file
                );


            wrapper.appendChild(
                image
            );


            wrapper.appendChild(
                remove
            );


            imagePreviewGrid.appendChild(
                wrapper
            );

        }
    );

}


/* =========================================================
   CHỌN ẢNH
   ========================================================= */

chooseImages.addEventListener(
    "click",
    event => {

        event.stopPropagation();

        productImages.click();

    }
);


imageDropzone.addEventListener(
    "click",
    event => {

        if (
            event.target.closest(
                "#chooseImages"
            )
        ) {

            return;

        }


        productImages.click();

    }
);


productImages.addEventListener(
    "change",
    event => {

        addFiles(
            event.target.files
        );


        productImages.value =
            "";

    }
);


/* =========================================================
   DRAG DROP
   ========================================================= */

imageDropzone.addEventListener(
    "dragover",
    event => {

        event.preventDefault();

        imageDropzone.classList.add(
            "dragover"
        );

    }
);


imageDropzone.addEventListener(
    "dragleave",
    () => {

        imageDropzone.classList.remove(
            "dragover"
        );

    }
);


imageDropzone.addEventListener(
    "drop",
    event => {

        event.preventDefault();


        imageDropzone.classList.remove(
            "dragover"
        );


        addFiles(
            event.dataTransfer.files
        );

    }
);


/* =========================================================
   ĐẾM KÝ TỰ
   ========================================================= */

description.addEventListener(
    "input",
    () => {

        descriptionCount.textContent =
            description.value.length;

    }
);


/* =========================================================
   UPLOAD ẢNH
   ========================================================= */

async function uploadImages(
    userId
) {

    const imageUrls = [];


    for (
        let index = 0;
        index < selectedFiles.length;
        index++
    ) {

        const file =
            selectedFiles[index];


        const extension =
            file.name
                .split(".")
                .pop()
                .toLowerCase();


        const fileName =
            `${crypto.randomUUID()}.${extension}`;


        const filePath =
            `${userId}/${fileName}`;


        const {
            error
        } =
            await supabaseClient

                .storage

                .from("products")

                .upload(
                    filePath,
                    file,
                    {
                        cacheControl:
                            "3600",

                        upsert:
                            false,

                        contentType:
                            file.type
                    }
                );


        if (error) {

            throw error;

        }


        const {
            data
        } =
            supabaseClient

                .storage

                .from("products")

                .getPublicUrl(
                    filePath
                );


        imageUrls.push(
            data.publicUrl
        );

    }


    return imageUrls;

}


/* =========================================================
   TẠO SẢN PHẨM
   ========================================================= */

async function createProduct() {

    if (!currentUser) {

        throw new Error(
            "Bạn chưa đăng nhập."
        );

    }


    const name =
        document
            .getElementById(
                "productName"
            )
            .value
            .trim();


    const category =
        document
            .getElementById(
                "productCategory"
            )
            .value;


    const quantity =
        Number(
            document
                .getElementById(
                    "productQuantity"
                )
                .value
        );

    const price =
    Number(
        document
            .getElementById(
                "productPrice"
            )
            .value
    );

    if (
    !Number.isFinite(price) ||
    price < 0
) {

    throw new Error(
        "Giá bán không hợp lệ."
    );

}


    const productDescription =
        description.value.trim();


    if (!name) {

        throw new Error(
            "Vui lòng nhập tên sản phẩm."
        );

    }


    if (!category) {

        throw new Error(
            "Vui lòng chọn danh mục."
        );

    }


    if (
        !Number.isInteger(quantity) ||
        quantity < 1
    ) {

        throw new Error(
            "Số lượng phải lớn hơn 0."
        );

    }


    if (!productDescription) {

        throw new Error(
            "Vui lòng nhập mô tả sản phẩm."
        );

    }


    if (
        selectedFiles.length === 0
    ) {

        throw new Error(
            "Vui lòng thêm ít nhất 1 ảnh."
        );

    }


    /* Upload ảnh */

    const imageUrls =
        await uploadImages(
            currentUser.id
        );


    /* Lưu sản phẩm */

    const {
        data: product,
        error
    } =
        await supabaseClient

            .from("products")

            .insert({

                seller_id:
                    currentUser.id,

                name:
                    name,

                category:
                    category,

                quantity:
                    quantity,

                price:
                    price,

                description:
                    productDescription,

                image_urls:
                    imageUrls,

                status:
                    "active"

            })

            .select("id")

            .single();


    if (error) {

        throw error;

    }


    return product;

}


/* =========================================================
   SUBMIT
   ========================================================= */

productForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        if (!currentUser) {

            showToast(
                "Bạn cần đăng nhập.",
                "error"
            );

            return;

        }


        submitProduct.disabled =
            true;


        submitText.hidden =
            true;


        submitLoading.hidden =
            false;


        try {

            const product =
                await createProduct();


            showToast(
                "Đăng sản phẩm thành công!"
            );


            /*
                Sau khi đăng thành công
                chuyển sang trang chi tiết
                của chính sản phẩm đó.
            */

            setTimeout(
                () => {

                    window.location.href =
                        `chitietsanpham.html?id=${product.id}`;

                },
                900
            );


        } catch (error) {

            console.error(error);


            showToast(
                error.message ||
                "Không thể đăng sản phẩm.",
                "error"
            );


            submitProduct.disabled =
                false;


            submitText.hidden =
                false;


            submitLoading.hidden =
                true;

        }

    }
);


/* =========================================================
   INIT - KHỞI TẠO TRANG ĐĂNG TIN
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            // Lấy tài khoản Supabase đang đăng nhập
            currentUser = await loadCurrentUser();

            if (currentUser) {
                console.log(
                    "Đã đăng nhập:",
                    currentUser.email
                );
            } else {
                console.log(
                    "Chưa có tài khoản đăng nhập."
                );
            }

        } catch (error) {

            console.error(
                "Lỗi kiểm tra đăng nhập:",
                error
            );

            currentUser = null;
        }

    }
);