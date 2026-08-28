/* =========================================================
   IUH SHOP - DANG TIN
   PHÍ SÀN 5% + ĐIỀU KHOẢN + XÁC NHẬN
========================================================= */


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
   CẤU HÌNH
========================================================= */

const DEFAULT_AVATAR =
    "../Images/default-avatar.svg";

const MAX_IMAGES = 5;

const MAX_IMAGE_SIZE =
    5 * 1024 * 1024;

const PLATFORM_FEE_RATE = 0.05;

const TERMS_VERSION = "1.0";


/* =========================================================
   BIẾN TOÀN CỤC
========================================================= */

let currentUser = null;

let currentProfile = null;

let selectedFiles = [];


/* =========================================================
   HEADER - CẬP NHẬT TÀI KHOẢN
========================================================= */

async function updateUserMenu() {

    try {

        const {
            data: {
                user
            },
            error: userError
        } =
            await supabaseClient
                .auth
                .getUser();


        if (userError) {

            console.error(
                "Không lấy được tài khoản:",
                userError
            );

            return;
        }


        const loginLink =
            document.querySelector(
                ".login-link"
            );

        const registerLink =
            document.querySelector(
                ".register-link"
            );

        const divider =
            document.querySelector(
                ".top-divider"
            );

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


        /* -----------------------------------------
           CHƯA ĐĂNG NHẬP
        ----------------------------------------- */

        if (!user) {

            currentUser = null;

            currentProfile = null;


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


        /* -----------------------------------------
           ĐÃ ĐĂNG NHẬP
        ----------------------------------------- */

        currentUser = user;


        const {
            data: profile,
            error: profileError
        } =
            await supabaseClient
                .from("users")
                .select(
                    "fullname, avatar_url, role, terms_accepted, terms_accepted_at, terms_version"
                )
                .eq(
                    "user_id",
                    user.id
                )
                .maybeSingle();


        if (profileError) {

            console.error(
                "Không lấy được profile:",
                profileError
            );

        }


        currentProfile =
            profile || null;


        /* -----------------------------------------
           ADMIN LINK
        ----------------------------------------- */

        const adminLink =
            document.getElementById(
                "adminLink"
            );


        if (adminLink) {

            if (
                currentProfile?.role ===
                "admin"
            ) {

                adminLink.style.display =
                    "block";

            } else {

                adminLink.style.display =
                    "none";

            }

        }


        /* -----------------------------------------
           TÊN
        ----------------------------------------- */

        const fullname =
            currentProfile?.fullname ||
            user.email?.split("@")[0] ||
            "Tài khoản";


        if (headerUserName) {

            headerUserName.textContent =
                fullname;

        }


        /* -----------------------------------------
           AVATAR
        ----------------------------------------- */

        if (headerAvatar) {

            headerAvatar.src =
                currentProfile?.avatar_url ||
                DEFAULT_AVATAR;

        }


        /* -----------------------------------------
           ẨN LOGIN / REGISTER
        ----------------------------------------- */

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


        /* -----------------------------------------
           HIỆN ACCOUNT
        ----------------------------------------- */

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


    if (
        !userAccountButton ||
        !accountDropdown
    ) {

        return;

    }


    userAccountButton.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            accountDropdown.classList.toggle(
                "show"
            );

        }
    );


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
   DROPDOWN ACCOUNT - MŨI TÊN
========================================================= */

function setupAccountShortcuts() {

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


    accountShortcuts.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

        }
    );


    document.addEventListener(
        "click",
        function () {

            accountWrapper.classList.remove(
                "open"
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
   ACTIVE NAVIGATION
========================================================= */

function setupActiveNavigation() {

    const currentPage =
        window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();


    document
        .querySelectorAll(
            ".navigation a.nav-item"
        )
        .forEach(
            link => {

                const linkPage =
                    link
                        .getAttribute("href")
                        ?.split("/")
                        .pop()
                        .toLowerCase();


                if (!linkPage) {
                    return;
                }


                if (
                    linkPage ===
                    currentPage
                ) {

                    link.classList.add(
                        "active"
                    );

                }

            }
        );

}


/* =========================================================
   AUTH STATE
========================================================= */

supabaseClient.auth.onAuthStateChange(
    function (event) {

        console.log(
            "Auth event:",
            event
        );

        updateUserMenu();

    }
);


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
   GIÁ
========================================================= */

const productPriceInput =
    document.getElementById(
        "productPrice"
    );

const sellerPricePreview =
    document.getElementById(
        "sellerPricePreview"
    );

const platformFeePreview =
    document.getElementById(
        "platformFeePreview"
    );

const buyerPricePreview =
    document.getElementById(
        "buyerPricePreview"
    );


/* =========================================================
   MODAL
========================================================= */

const termsModal =
    document.getElementById(
        "termsModal"
    );

const confirmModal =
    document.getElementById(
        "confirmModal"
    );

const termsAgreement =
    document.getElementById(
        "termsAgreement"
    );

const continueTerms =
    document.getElementById(
        "continueTerms"
    );

const cancelTerms =
    document.getElementById(
        "cancelTerms"
    );

const closeTermsModal =
    document.getElementById(
        "closeTermsModal"
    );

const backToTerms =
    document.getElementById(
        "backToTerms"
    );

const finalConfirmPost =
    document.getElementById(
        "finalConfirmPost"
    );


/* =========================================================
   FORMAT TIỀN
========================================================= */

function formatVND(value) {

    return (
        new Intl.NumberFormat(
            "vi-VN"
        ).format(
            Number(value) || 0
        ) +
        "đ"
    );

}


/* =========================================================
   TÍNH PHÍ SÀN
========================================================= */

function calculatePlatformFee(
    price
) {

    return Math.round(
        (
            Number(price) || 0
        ) *
        PLATFORM_FEE_RATE
    );

}


/* =========================================================
   HIỂN THỊ GIÁ
========================================================= */

function updatePricePreview() {

    const sellerPrice =
        Number(
            productPriceInput?.value
        ) || 0;


    const platformFee =
        calculatePlatformFee(
            sellerPrice
        );


    const buyerPrice =
        sellerPrice +
        platformFee;


    if (sellerPricePreview) {

        sellerPricePreview.textContent =
            formatVND(
                sellerPrice
            );

    }


    if (platformFeePreview) {

        platformFeePreview.textContent =
            formatVND(
                platformFee
            );

    }


    if (buyerPricePreview) {

        buyerPricePreview.textContent =
            formatVND(
                buyerPrice
            );

    }

}


if (productPriceInput) {

    productPriceInput.addEventListener(
        "input",
        updatePricePreview
    );

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "success"
) {

    if (!toast) {

        alert(message);

        return;

    }


    toast.textContent =
        message;


    toast.className =
        `toast show ${type}`;


    clearTimeout(
        showToast.timer
    );


    showToast.timer =
        setTimeout(
            function () {

                toast.className =
                    "toast";

            },
            3500
        );

}


/* =========================================================
   LẤY USER HIỆN TẠI
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

        console.error(
            "Lỗi lấy user:",
            error
        );

        return null;

    }


    return data?.user || null;

}


/* =========================================================
   VALIDATE ẢNH
========================================================= */

function validateFile(
    file
) {

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

        return (
            "Chỉ chấp nhận JPG, PNG hoặc WEBP."
        );

    }


    if (
        file.size >
        MAX_IMAGE_SIZE
    ) {

        return (
            "Mỗi ảnh không được vượt quá 5MB."
        );

    }


    return null;

}


/* =========================================================
   THÊM ẢNH
========================================================= */

function addFiles(
    fileList
) {

    const incoming =
        Array.from(
            fileList || []
        );


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
            validateFile(
                file
            );


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
   PREVIEW ẢNH
========================================================= */

function renderPreviews() {

    if (!imagePreviewGrid) {
        return;
    }


    imagePreviewGrid.innerHTML =
        "";


    selectedFiles.forEach(
        function (
            file,
            index
        ) {

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


            image.src =
                URL.createObjectURL(
                    file
                );


            image.alt =
                `Ảnh ${index + 1}`;


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
                function () {

                    selectedFiles.splice(
                        index,
                        1
                    );


                    renderPreviews();

                }
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

if (chooseImages) {

    chooseImages.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            productImages?.click();

        }
    );

}


if (imageDropzone) {

    imageDropzone.addEventListener(
        "click",
        function (event) {

            if (
                event.target.closest(
                    "#chooseImages"
                )
            ) {

                return;

            }


            productImages?.click();

        }
    );

}


if (productImages) {

    productImages.addEventListener(
        "change",
        function (event) {

            addFiles(
                event.target.files
            );


            productImages.value =
                "";

        }
    );

}


/* =========================================================
   DRAG & DROP
========================================================= */

if (imageDropzone) {

    imageDropzone.addEventListener(
        "dragover",
        function (event) {

            event.preventDefault();

            imageDropzone.classList.add(
                "dragover"
            );

        }
    );


    imageDropzone.addEventListener(
        "dragleave",
        function () {

            imageDropzone.classList.remove(
                "dragover"
            );

        }
    );


    imageDropzone.addEventListener(
        "drop",
        function (event) {

            event.preventDefault();


            imageDropzone.classList.remove(
                "dragover"
            );


            addFiles(
                event.dataTransfer.files
            );

        }
    );

}


/* =========================================================
   ĐẾM KÝ TỰ MÔ TẢ
========================================================= */

if (
    description &&
    descriptionCount
) {

    description.addEventListener(
        "input",
        function () {

            descriptionCount.textContent =
                description.value.length;

        }
    );

}


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
            ?.value
            ?.trim();


    const category =
        document
            .getElementById(
                "productCategory"
            )
            ?.value;


    const quantity =
        Number(
            document
                .getElementById(
                    "productQuantity"
                )
                ?.value
        );


    const price =
        Number(
            productPriceInput?.value
        );


    const productDescription =
        description
            ?.value
            ?.trim();


    /* -----------------------------------------
       VALIDATE
    ----------------------------------------- */

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
        !Number.isInteger(
            quantity
        ) ||
        quantity < 1
    ) {

        throw new Error(
            "Số lượng phải lớn hơn 0."
        );

    }


    if (
        !Number.isFinite(
            price
        ) ||
        price < 0
    ) {

        throw new Error(
            "Giá bán không hợp lệ."
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


    /* -----------------------------------------
       UPLOAD ẢNH
    ----------------------------------------- */

    const imageUrls =
        await uploadImages(
            currentUser.id
        );


    /* -----------------------------------------
       TÍNH PHÍ
    ----------------------------------------- */

    const platformFee =
        calculatePlatformFee(
            price
        );


    const buyerPrice =
        price +
        platformFee;


    /* -----------------------------------------
       LƯU SẢN PHẨM
    ----------------------------------------- */

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

                /*
                 * price = giá người bán đặt
                 */
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


    console.log(
        "Giá người bán:",
        formatVND(price)
    );

    console.log(
        "Phí sàn 5%:",
        formatVND(platformFee)
    );

    console.log(
        "Giá người mua:",
        formatVND(buyerPrice)
    );


    return product;

}


/* =========================================================
   ĐĂNG SẢN PHẨM THẬT
   Chỉ được gọi sau popup xác nhận cuối
========================================================= */

async function submitProductForReal() {

    if (!currentUser) {

        showToast(
            "Bạn cần đăng nhập.",
            "error"
        );

        return;

    }


    if (!submitProduct) {
        return;
    }


    submitProduct.disabled =
        true;


    if (submitText) {

        submitText.hidden =
            true;

    }


    if (submitLoading) {

        submitLoading.hidden =
            false;

    }


    try {

        const product =
            await createProduct();


        showToast(
            "Đăng sản phẩm thành công!"
        );


        setTimeout(
            function () {

                window.location.href =
                    `chitietsanpham.html?id=${product.id}`;

            },
            900
        );

    }

    catch (error) {

        console.error(
            "Lỗi đăng sản phẩm:",
            error
        );


        showToast(
            error?.message ||
            "Không thể đăng sản phẩm.",
            "error"
        );


        submitProduct.disabled =
            false;


        if (submitText) {

            submitText.hidden =
                false;

        }


        if (submitLoading) {

            submitLoading.hidden =
                true;

        }

    }

}


/* =========================================================
   MODAL
========================================================= */

function openModal(
    modal
) {

    if (!modal) {
        return;
    }


    modal.classList.add(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow =
        "hidden";

}


function closeModal(
    modal
) {

    if (!modal) {
        return;
    }


    modal.classList.remove(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    const termsOpen =
        termsModal?.classList.contains(
            "show"
        );


    const confirmOpen =
        confirmModal?.classList.contains(
            "show"
        );


    if (
        !termsOpen &&
        !confirmOpen
    ) {

        document.body.style.overflow =
            "";

    }

}


/* =========================================================
   ROLE ĐẶC QUYỀN
========================================================= */

function isPrivilegedUser() {

    const role =
        String(
            currentProfile?.role ||
            ""
        )
            .trim()
            .toLowerCase();


    return [

        "admin",

        "administrator",

        "moderator",

        "quản trị viên",

        "quan tri vien"

    ].includes(
        role
    );

}


/* =========================================================
   REFRESH PROFILE
========================================================= */

async function refreshCurrentProfile() {

    if (!currentUser) {

        return null;

    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("users")
            .select(
                "fullname, avatar_url, role, terms_accepted, terms_accepted_at, terms_version"
            )
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        console.error(
            "Không lấy được profile:",
            error
        );

        return currentProfile;

    }


    currentProfile =
        data || null;


    return currentProfile;

}


/* =========================================================
   KIỂM TRA ĐIỀU KHOẢN
========================================================= */

async function showTermsIfNeeded() {

    if (!currentUser) {

        showToast(
            "Bạn cần đăng nhập.",
            "error"
        );

        return;

    }


    await refreshCurrentProfile();


    /*
     * ADMIN / QUẢN TRỊ VIÊN
     * KHÔNG CẦN ĐIỀU KHOẢN
     */

    if (
        isPrivilegedUser()
    ) {

        openFinalConfirmation();

        return;

    }


    /*
     * ĐÃ ĐỒNG Ý TRƯỚC ĐÓ
     *
     * Xem như hợp đồng đã được chấp nhận.
     */

    if (
        currentProfile?.terms_accepted ===
        true
    ) {

        openFinalConfirmation();

        return;

    }


    /*
     * TÀI KHOẢN THƯỜNG
     * CHƯA ĐỒNG Ý
     */

    if (termsAgreement) {

        termsAgreement.checked =
            false;

    }


    if (continueTerms) {

        continueTerms.disabled =
            true;

    }


    openModal(
        termsModal
    );

}


/* =========================================================
   CHECKBOX ĐIỀU KHOẢN
========================================================= */

if (termsAgreement) {

    termsAgreement.addEventListener(
        "change",
        function () {

            if (continueTerms) {

                continueTerms.disabled =
                    !termsAgreement.checked;

            }

        }
    );

}


/* =========================================================
   FORM SUBMIT DUY NHẤT
========================================================= */

if (productForm) {

    productForm.addEventListener(
        "submit",
        async function (event) {

            /*
             * QUAN TRỌNG:
             * Không đăng sản phẩm ở đây.
             * Chỉ bắt đầu quy trình xác nhận.
             */

            event.preventDefault();


            if (!currentUser) {

                showToast(
                    "Bạn cần đăng nhập.",
                    "error"
                );

                return;

            }


            /*
             * Kiểm tra required của HTML
             */

            if (
                !productForm.checkValidity()
            ) {

                productForm.reportValidity();

                return;

            }


            updatePricePreview();


            await showTermsIfNeeded();

        }
    );

}


/* =========================================================
   ĐỒNG Ý ĐIỀU KHOẢN
========================================================= */

if (continueTerms) {

    continueTerms.addEventListener(
        "click",
        async function () {

            if (
                !termsAgreement?.checked
            ) {

                return;

            }


            if (!currentUser) {

                return;

            }


            continueTerms.disabled =
                true;


            try {

                /*
                 * Admin / quản trị viên
                 * không cần lưu điều khoản.
                 */

                if (
                    !isPrivilegedUser()
                ) {

                    const acceptedAt =
                        new Date()
                            .toISOString();


                    /*
                     * LƯU THEO user_id
                     *
                     * Không dùng .eq("id", ...)
                     */

                    const {
                        error
                    } =
                        await supabaseClient
                            .from("users")
                            .update({

                                terms_accepted:
                                    true,

                                terms_accepted_at:
                                    acceptedAt,

                                terms_version:
                                    TERMS_VERSION

                            })
                            .eq(
                                "user_id",
                                currentUser.id
                            );


                    if (error) {

                        throw error;

                    }


                    /*
                     * Cập nhật ngay trong bộ nhớ
                     */

                    currentProfile = {

                        ...(currentProfile || {}),

                        terms_accepted:
                            true,

                        terms_accepted_at:
                            acceptedAt,

                        terms_version:
                            TERMS_VERSION

                    };

                }


                /*
                 * Đóng popup điều khoản
                 */

                closeModal(
                    termsModal
                );


                /*
                 * Sang popup nhắc nhở
                 */

                openFinalConfirmation();

            }

            catch (error) {

                console.error(
                    "Lỗi lưu điều khoản:",
                    error
                );


                showToast(
                    "Không thể lưu xác nhận điều khoản. Vui lòng thử lại.",
                    "error"
                );


                continueTerms.disabled =
                    false;

            }

        }
    );

}


/* =========================================================
   POPUP XÁC NHẬN CUỐI
========================================================= */

function openFinalConfirmation() {

    const productName =
        document
            .getElementById(
                "productName"
            )
            ?.value
            ?.trim() ||
        "Sản phẩm";


    const sellerPrice =
        Number(
            productPriceInput?.value
        ) || 0;


    const platformFee =
        calculatePlatformFee(
            sellerPrice
        );


    const buyerPrice =
        sellerPrice +
        platformFee;


    const confirmProductName =
        document.getElementById(
            "confirmProductName"
        );

    const confirmSellerPrice =
        document.getElementById(
            "confirmSellerPrice"
        );

    const confirmPlatformFee =
        document.getElementById(
            "confirmPlatformFee"
        );

    const confirmBuyerPrice =
        document.getElementById(
            "confirmBuyerPrice"
        );


    if (
        confirmProductName
    ) {

        confirmProductName.textContent =
            productName;

    }


    if (
        confirmSellerPrice
    ) {

        confirmSellerPrice.textContent =
            formatVND(
                sellerPrice
            );

    }


    if (
        confirmPlatformFee
    ) {

        confirmPlatformFee.textContent =
            formatVND(
                platformFee
            );

    }


    if (
        confirmBuyerPrice
    ) {

        confirmBuyerPrice.textContent =
            formatVND(
                buyerPrice
            );

    }


    openModal(
        confirmModal
    );

}


/* =========================================================
   XÁC NHẬN ĐĂNG THẬT
========================================================= */

if (finalConfirmPost) {

    finalConfirmPost.addEventListener(
        "click",
        async function () {

            /*
             * Chỉ tại đây mới thực sự
             * upload ảnh + insert products.
             */

            closeModal(
                confirmModal
            );


            await submitProductForReal();

        }
    );

}


/* =========================================================
   QUAY LẠI ĐIỀU KHOẢN
========================================================= */

if (backToTerms) {

    backToTerms.addEventListener(
        "click",
        function () {

            closeModal(
                confirmModal
            );


            if (
                !isPrivilegedUser()
            ) {

                openModal(
                    termsModal
                );

            }

        }
    );

}


/* =========================================================
   HỦY ĐIỀU KHOẢN
========================================================= */

if (cancelTerms) {

    cancelTerms.addEventListener(
        "click",
        function () {

            closeModal(
                termsModal
            );

        }
    );

}


/* =========================================================
   ĐÓNG POPUP ĐIỀU KHOẢN
========================================================= */

if (closeTermsModal) {

    closeTermsModal.addEventListener(
        "click",
        function () {

            closeModal(
                termsModal
            );

        }
    );

}


/* =========================================================
   CLICK BACKDROP - TERMS
========================================================= */

const closeTermsBackdrop =
    document.querySelector(
        "[data-close-terms]"
    );


if (closeTermsBackdrop) {

    closeTermsBackdrop.addEventListener(
        "click",
        function () {

            closeModal(
                termsModal
            );

        }
    );

}


/* =========================================================
   CLICK BACKDROP - CONFIRM
========================================================= */

const closeConfirmBackdrop =
    document.querySelector(
        "[data-close-confirm]"
    );


if (closeConfirmBackdrop) {

    closeConfirmBackdrop.addEventListener(
        "click",
        function () {

            closeModal(
                confirmModal
            );

        }
    );

}


/* =========================================================
   KHỞI TẠO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        try {

            /*
             * Lấy user trước
             */

            currentUser =
                await loadCurrentUser();


            /*
             * Nếu có user thì lấy profile
             */

            if (currentUser) {

                await refreshCurrentProfile();


                console.log(
                    "Đã đăng nhập:",
                    currentUser.email
                );

            } else {

                console.log(
                    "Chưa có tài khoản đăng nhập."
                );

            }


            /*
             * Header
             */

            await updateUserMenu();


            /*
             * Các chức năng khác
             */

            setupAccountDropdown();

            setupAccountShortcuts();

            setupLogout();

            setupActiveNavigation();


            /*
             * Giá ban đầu
             */

            updatePricePreview();

        }

        catch (error) {

            console.error(
                "Lỗi khởi tạo trang đăng tin:",
                error
            );

        }

    }
);