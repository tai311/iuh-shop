/* =========================================================
   IUH SHOP - TIN NHẮN
   SUPABASE + REALTIME + STORAGE
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
   CẤU HÌNH CHAT
   ========================================================= */

const CHAT_BUCKET =
    "chat-images";


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;

let currentUserProfile = null;

let currentConversationId = null;

let currentOtherUser = null;

let conversations = [];

let selectedImage = null;

let realtimeChannel = null;


/* =========================================================
   DOM
   ========================================================= */

const conversationList =
    document.getElementById(
        "conversationList"
    );

const messagesArea =
    document.getElementById(
        "messagesArea"
    );

const messageInput =
    document.getElementById(
        "messageInput"
    );

const imageInput =
    document.getElementById(
        "imageInput"
    );

const imagePreview =
    document.getElementById(
        "imagePreview"
    );

const previewImage =
    document.getElementById(
        "previewImage"
    );

const conversationSearch =
    document.getElementById(
        "conversationSearch"
    );

const sendButton =
    document.getElementById(
        "sendButton"
    );

const removePreview =
    document.getElementById(
        "removePreview"
    );

const mobileBack =
    document.getElementById(
        "mobileBack"
    );


/* =========================================================
   CẬP NHẬT HEADER KHI ĐĂNG NHẬP
   ========================================================= */

async function updateUserMenu() {

    try {

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

        const adminLink =
            document.getElementById(
                "adminLink"
            );


        /* -----------------------------------------
           CHƯA ĐĂNG NHẬP
           ----------------------------------------- */

        if (!user) {

            if (loginLink) {

                loginLink.style.display =
                    "";

            }


            if (registerLink) {

                registerLink.style.display =
                    "";

            }


            if (divider) {

                divider.style.display =
                    "";

            }


            if (userAccount) {

                userAccount.style.display =
                    "none";

            }


            if (adminLink) {

                adminLink.style.display =
                    "none";

            }


            return;

        }


        /* -----------------------------------------
           LẤY PROFILE
           ----------------------------------------- */

        const {
            data: profile,
            error
        } =
            await supabaseClient

                .from("users")

                .select(
                    "fullname, avatar_url, role"
                )

                .eq(
                    "user_id",
                    user.id
                )

                .maybeSingle();


        if (error) {

            console.error(
                "Lỗi lấy profile:",
                error
            );

        }


        currentUserProfile =
            profile || null;


        /* -----------------------------------------
           ADMIN LINK
           ----------------------------------------- */

        if (adminLink) {

            if (
                profile?.role ===
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
            profile?.fullname ||
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

            if (profile?.avatar_url) {

                headerAvatar.src =
                    profile.avatar_url;

            } else {

                headerAvatar.src =
                    "../Images/default-avatar.svg";

            }

        }


        /* -----------------------------------------
           ẨN ĐĂNG NHẬP / ĐĂNG KÝ
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
           HIỆN TÀI KHOẢN
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
   MENU TÀI KHOẢN
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
   MENU ACTIVE
   ========================================================= */

function setupActiveMenu() {

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
   GET CURRENT USER
   ========================================================= */

async function loadCurrentUser() {

    const {
        data,
        error
    } =
        await supabaseClient
            .auth
            .getUser();


    if (
        error ||
        !data?.user
    ) {

        window.location.href =
            "dang-nhap.html";

        return null;

    }


    currentUser =
        data.user;


    return currentUser;

}


/* =========================================================
   GET USER PROFILE
   ========================================================= */

async function getUserProfile(
    userId
) {

    if (!userId) {

        return null;

    }


    const {
        data,
        error
    } =
        await supabaseClient

            .from("users")

            .select(
                "user_id, fullname, avatar_url, role"
            )

            .eq(
                "user_id",
                userId
            )

            .maybeSingle();


    if (error) {

        console.error(
            "Lỗi lấy thông tin người dùng:",
            error
        );

        return null;

    }


    if (!data) {

        return null;

    }


    return {

        id:
            data.user_id,

        fullname:
            data.fullname,

        avatar_url:
            data.avatar_url,

        role:
            data.role

    };

}


/* =========================================================
   GET ADMIN
   ========================================================= */

async function getAdminUser() {

    const {
        data,
        error
    } =
        await supabaseClient

            .from("users")

            .select(
                "user_id, fullname, avatar_url, role"
            )

            .eq(
                "role",
                "admin"
            )

            .limit(1);


    if (error) {

        console.error(
            "Không thể tìm Admin:",
            error
        );

        return null;

    }


    if (
        !data ||
        !data.length
    ) {

        console.error(
            "Không có tài khoản role = admin."
        );

        return null;

    }


    const admin =
        data[0];


    return {

        id:
            admin.user_id,

        fullname:
            admin.fullname ||
            "Admin IUH SHOP",

        avatar_url:
            admin.avatar_url,

        role:
            admin.role

    };

}


/* =========================================================
   TÌM CUỘC TRÒ CHUYỆN
   ========================================================= */

async function findConversationWithUser(
    otherUserId
) {

    if (
        !currentUser ||
        !otherUserId
    ) {

        return null;

    }


    const {
        data: memberships,
        error
    } =
        await supabaseClient

            .from(
                "conversation_members"
            )

            .select(
                "conversation_id"
            )

            .eq(
                "user_id",
                currentUser.id
            );


    if (
        error ||
        !memberships?.length
    ) {

        return null;

    }


    for (
        const membership
        of memberships
    ) {

        const conversationId =
            membership.conversation_id;


        const {
            data: member
        } =
            await supabaseClient

                .from(
                    "conversation_members"
                )

                .select(
                    "user_id"
                )

                .eq(
                    "conversation_id",
                    conversationId
                )

                .eq(
                    "user_id",
                    otherUserId
                )

                .maybeSingle();


        if (member) {

            return conversationId;

        }

    }


    return null;

}


/* =========================================================
   TẠO CUỘC TRÒ CHUYỆN
   ========================================================= */

async function createConversation(
    otherUserId,
    isAdminChat = false
) {
    try {
        if (!currentUser) {
            throw new Error("Chưa đăng nhập.");
        }

        if (!otherUserId) {
            throw new Error("Không xác định được người dùng cần chat.");
        }

        // Tạo ID trước ở phía client
        const conversationId = crypto.randomUUID();

        // 1. Tạo conversation
        // KHÔNG dùng .select() ở đây vì RLS SELECT
        // yêu cầu user phải là member của conversation.
        const {
            error: conversationError
        } = await supabaseClient
            .from("conversations")
            .insert({
                id: conversationId,
                is_admin_chat: isAdminChat
            });

        if (conversationError) {
            console.error(
                "Lỗi tạo conversation:",
                conversationError
            );

            throw conversationError;
        }

       // 2. Thêm người đang đăng nhập trước
const { error: selfMemberError } = await supabaseClient
    .from("conversation_members")
    .insert({
        conversation_id: conversationId,
        user_id: currentUser.id
    });

if (selfMemberError) {
    console.error(
        "Lỗi thêm thành viên hiện tại:",
        selfMemberError
    );

    throw selfMemberError;
}


// 3. Sau khi đã là member → thêm người còn lại
const { error: otherMemberError } = await supabaseClient
    .from("conversation_members")
    .insert({
        conversation_id: conversationId,
        user_id: otherUserId
    });

if (otherMemberError) {
    console.error(
        "Lỗi thêm thành viên còn lại:",
        otherMemberError
    );

    throw otherMemberError;
}

        // 3. Trả object conversation về cho code phía dưới
        return {
            id: conversationId,
            is_admin_chat: isAdminChat,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message: null,
            last_message_at: null
        };

    } catch (error) {
        console.error(
            "Lỗi createConversation:",
            error
        );

        throw error;
    }
}


/* =========================================================
   ĐẢM BẢO CHAT ADMIN LUÔN CÓ
   ========================================================= */

async function ensureAdminChat() {

    const admin =
        await getAdminUser();


    if (
        !admin ||
        admin.id === currentUser.id
    ) {

        return null;

    }


    let conversationId =
        await findConversationWithUser(
            admin.id
        );


    /* -----------------------------------------
       CHƯA CÓ → TẠO MỚI
       ----------------------------------------- */

    if (!conversationId) {

        const conversation =
            await createConversation(
                admin.id,
                true
            );


        conversationId =
            conversation.id;


        /*
           Tạo tin nhắn chào mặc định.
        */

        const welcomeMessage =
            "Xin chào! IUH SHOP có thể hỗ trợ bạn về tài khoản, sản phẩm, đơn hàng, thanh toán, Ví IUH SHOP hoặc các vấn đề khác. Bạn cần hỗ trợ gì?";


        const {
            error: messageError
        } =
            await supabaseClient

                .from("messages")

                .insert({

                    conversation_id:
                        conversationId,

                    sender_id:
                        admin.id,

                    content:
                        welcomeMessage,

                    message_type:
                        "text",

                    is_read:
                        false

                });


        if (messageError) {

            console.error(
                "Lỗi tạo tin nhắn Admin:",
                messageError
            );

        }


        await updateConversationLastMessage(

            conversationId,

            welcomeMessage

        );

    }


    return {

        id:
            admin.id,

        name:
            admin.fullname ||
            "Admin IUH SHOP",

        email:
            null,

        avatar:
            admin.avatar_url,

        role:
            admin.role,

        conversationId

    };

}


/* =========================================================
   LẤY SỐ TIN CHƯA ĐỌC
   ========================================================= */

async function getUnreadCount(
    conversationId
) {

    if (!conversationId) {

        return 0;

    }


    const {
        count,
        error
    } =
        await supabaseClient

            .from("messages")

            .select(
                "*",
                {
                    count:
                        "exact",

                    head:
                        true
                }
            )

            .eq(
                "conversation_id",
                conversationId
            )

            .eq(
                "is_read",
                false
            )

            .neq(
                "sender_id",
                currentUser.id
            );


    if (error) {

        return 0;

    }


    return count || 0;

}


/* =========================================================
   LẤY CONVERSATION THEO ID
   ========================================================= */

async function getConversationById(
    conversationId
) {

    const {
        data,
        error
    } =
        await supabaseClient

            .from(
                "conversations"
            )

            .select("*")

            .eq(
                "id",
                conversationId
            )

            .maybeSingle();


    if (error) {

        console.error(
            "Lỗi lấy conversation:",
            error
        );

        return null;

    }


    return data;

}


/* =========================================================
   LOAD CONVERSATIONS
   ========================================================= */

async function loadConversations() {

    if (!conversationList) {

        return;

    }


    conversationList.innerHTML = `

        <div class="chat-loading">

            Đang tải cuộc trò chuyện...

        </div>

    `;


    const {
        data: memberships,
        error
    } =
        await supabaseClient

            .from(
                "conversation_members"
            )

            .select(
                "conversation_id"
            )

            .eq(
                "user_id",
                currentUser.id
            );


    if (error) {

        console.error(
            "Lỗi lấy conversations:",
            error
        );


        conversationList.innerHTML = `

            <div class="chat-error">

                Không thể tải tin nhắn.

            </div>

        `;


        return;

    }


    const ids =
        (memberships || [])
            .map(
                item =>
                    item.conversation_id
            );


    conversations = [];


    /* -----------------------------------------
       LOAD CÁC CONVERSATION HIỆN CÓ
       ----------------------------------------- */

    if (ids.length) {

        const {
            data: conversationData,
            error: conversationError
        } =
            await supabaseClient

                .from(
                    "conversations"
                )

                .select("*")

                .in(
                    "id",
                    ids
                )

                .order(
                    "updated_at",
                    {
                        ascending:
                            false
                    }
                );


        if (conversationError) {

            console.error(
                "Lỗi conversations:",
                conversationError
            );

        }


        for (
            const conversation
            of conversationData || []
        ) {

            const {
                data: otherMembers
            } =
                await supabaseClient

                    .from(
                        "conversation_members"
                    )

                    .select(
                        "user_id"
                    )

                    .eq(
                        "conversation_id",
                        conversation.id
                    )

                    .neq(
                        "user_id",
                        currentUser.id
                    );


            if (
                !otherMembers?.length
            ) {

                continue;

            }


            const otherUserId =
                otherMembers[0].user_id;


            const profile =
                await getUserProfile(
                    otherUserId
                );


            if (!profile) {

                continue;

            }


            const unreadCount =
                await getUnreadCount(
                    conversation.id
                );


            conversations.push({

                ...conversation,

                otherUser:
                    profile,

                unreadCount,

                isAdmin:
                    profile.role ===
                    "admin" ||
                    conversation.is_admin_chat ===
                    true

            });

        }

    }


    /* -----------------------------------------
       ADMIN LUÔN PHẢI CÓ
       ----------------------------------------- */

    const adminChat =
        await ensureAdminChat();


    if (adminChat) {

        let adminConversation =
            conversations.find(

                conversation =>

                    conversation.otherUser?.id ===
                    adminChat.id

            );


        if (!adminConversation) {

            const data =
                await getConversationById(
                    adminChat.conversationId
                );


            if (data) {

                adminConversation = {

                    ...data,

                    otherUser:
                        adminChat,

                    unreadCount:
                        await getUnreadCount(
                            adminChat.conversationId
                        ),

                    isAdmin:
                        true

                };


                conversations.push(
                    adminConversation
                );

            }

        } else {

            adminConversation.isAdmin =
                true;

        }

    }


    /* -----------------------------------------
       SẮP XẾP
       ADMIN LUÔN LÊN ĐẦU
       ----------------------------------------- */

    conversations.sort(
        (
            a,
            b
        ) => {

            if (
                a.isAdmin &&
                !b.isAdmin
            ) {

                return -1;

            }


            if (
                !a.isAdmin &&
                b.isAdmin
            ) {

                return 1;

            }


            return (

                new Date(
                    b.updated_at ||
                    0
                )

                -

                new Date(
                    a.updated_at ||
                    0
                )

            );

        }
    );


    renderConversationList(
        conversations
    );

}


/* =========================================================
   RENDER DANH SÁCH CHAT
   ========================================================= */

function renderConversationList(
    list
) {

    if (!conversationList) {

        return;

    }


    if (
        !list ||
        !list.length
    ) {

        conversationList.innerHTML = `

            <div class="chat-loading">

                Chưa có cuộc trò chuyện.

            </div>

        `;

        return;

    }


    conversationList.innerHTML =

        list
            .map(
                conversation => {

                    const user =
                        conversation.otherUser;


                    const isAdmin =
                        conversation.isAdmin;


                    const fullname =
                        isAdmin

                            ? "Admin IUH SHOP"

                            :

                            (
                                user?.fullname ||
                                "Người dùng"
                            );


                    const initial =
                        isAdmin

                            ? "A"

                            :

                            fullname
                                .charAt(0)
                                .toUpperCase();


                    const active =
                        conversation.id ===
                        currentConversationId
                            ? "active"
                            : "";


                    return `

                        <div
                            class="
                                conversation-item
                                ${
                                    isAdmin
                                        ? "admin-chat"
                                        : ""
                                }
                                ${active}
                            "
                            data-id="
                                ${conversation.id}
                            "
                        >

                            <div
                                class="
                                    conversation-avatar
                                "
                            >

                                ${initial}

                                <span
                                    class="online-dot"
                                ></span>

                            </div>


                            <div
                                class="
                                    conversation-content
                                "
                            >

                                <div
                                    class="
                                        conversation-top
                                    "
                                >

                                    <span
                                        class="
                                            conversation-name
                                        "
                                    >
                                        ${escapeHTML(
                                            fullname
                                        )}
                                    </span>


                                    <span
                                        class="
                                            conversation-time
                                        "
                                    >
                                        ${
                                            formatChatDate(
                                                conversation.updated_at
                                            )
                                        }
                                    </span>

                                </div>


                                <div
                                    class="
                                        conversation-preview
                                    "
                                >

                                    <span
                                        class="
                                            last-message
                                        "
                                    >
                                        ${
                                            escapeHTML(
                                                conversation.last_message ||
                                                "Chưa có tin nhắn"
                                            )
                                        }
                                    </span>


                                    ${
                                        conversation.unreadCount > 0

                                            ?

                                            `

                                            <span
                                                class="
                                                    unread-badge
                                                "
                                            >
                                                ${
                                                    conversation.unreadCount
                                                }
                                            </span>

                                            `

                                            :

                                            ""
                                    }

                                </div>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");


    document
        .querySelectorAll(
            ".conversation-item"
        )
        .forEach(
            item => {

                item.addEventListener(
                    "click",
                    function () {

                        openConversation(
                            this.dataset.id
                        );

                    }
                );

            }
        );

}


/* =========================================================
   OPEN CONVERSATION
   ========================================================= */

async function openConversation(
    conversationId
) {

    const conversation =
        conversations.find(
            item =>
                item.id ===
                conversationId
        );


    if (!conversation) {

        return;

    }


    currentConversationId =
        conversationId;


    currentOtherUser =
        conversation.otherUser;


    const chatEmpty =
        document.getElementById(
            "chatEmpty"
        );

    const activeChat =
        document.getElementById(
            "activeChat"
        );


    if (chatEmpty) {

        chatEmpty.style.display =
            "none";

    }


    if (activeChat) {

        activeChat.style.display =
            "flex";

    }


    const chatContainer =
        document.querySelector(
            ".chat-container"
        );


    if (chatContainer) {

        chatContainer.classList.add(
            "mobile-chat"
        );

    }


    renderActiveChatHeader(
        conversation
    );


    await loadMessages(
        conversationId
    );


    await markMessagesAsRead(
        conversationId
    );


    conversation.unreadCount =
        0;


    subscribeToMessages(
        conversationId
    );


    renderConversationList(
        conversations
    );

}


/* =========================================================
   ACTIVE CHAT HEADER
   ========================================================= */

function renderActiveChatHeader(
    conversation
) {

    const user =
        conversation.otherUser;


    const isAdmin =
        conversation.isAdmin;


    const fullname =
        isAdmin

            ? "Admin IUH SHOP"

            :

            (
                user?.fullname ||
                "Người dùng"
            );


    const avatar =
        document.getElementById(
            "chatAvatar"
        );


    const userName =
        document.getElementById(
            "chatUserName"
        );


    const userStatus =
        document.getElementById(
            "chatUserStatus"
        );


    if (avatar) {

        avatar.textContent =
            isAdmin

                ? "A"

                : fullname
                    .charAt(0)
                    .toUpperCase();

    }


    if (userName) {

        userName.textContent =
            fullname;

    }


    if (userStatus) {

        userStatus.textContent =

            isAdmin

                ? "Hỗ trợ khách hàng · IUH SHOP"

                : "Thành viên IUH SHOP";

    }

}


/* =========================================================
   LOAD MESSAGES
   ========================================================= */

async function loadMessages(
    conversationId
) {

    if (!messagesArea) {

        return;

    }


    messagesArea.innerHTML = `

        <div class="chat-loading">

            Đang tải tin nhắn...

        </div>

    `;


    const {
        data,
        error
    } =
        await supabaseClient

            .from("messages")

            .select("*")

            .eq(
                "conversation_id",
                conversationId
            )

            .order(
                "created_at",
                {
                    ascending:
                        true
                }
            );


    if (error) {

        console.error(
            "Lỗi tải tin nhắn:",
            error
        );


        messagesArea.innerHTML = `

            <div class="chat-error">

                Không thể tải tin nhắn.

            </div>

        `;


        return;

    }


    renderMessages(
        data || []
    );

}


/* =========================================================
   RENDER MESSAGES
   ========================================================= */

function renderMessages(
    messages
) {

    if (!messagesArea) {

        return;

    }


    messagesArea.innerHTML =
        "";


    if (!messages.length) {

        messagesArea.innerHTML = `

            <div class="chat-loading">

                Bắt đầu cuộc trò chuyện.

            </div>

        `;

        return;

    }


    messages.forEach(
        message => {

            renderSingleMessage(
                message
            );

        }
    );


    scrollToBottom();

}


/* =========================================================
   RENDER SINGLE MESSAGE
   ========================================================= */

function renderSingleMessage(
    message
) {

    if (!messagesArea) {

        return;

    }


    const existing =
        document.querySelector(
            `[data-message-id="${message.id}"]`
        );


    if (existing) {

        return;

    }


    const mine =
        message.sender_id ===
        currentUser.id;


    const row =
        document.createElement(
            "div"
        );


    row.dataset.messageId =
        message.id;


    row.className =
        "message-row " +
        (
            mine
                ? "mine"
                : "theirs"
        );


    const bubble =
        document.createElement(
            "div"
        );


    bubble.className =
        "message-bubble";


    /* -----------------------------------------
       ẢNH
       ----------------------------------------- */

    if (
        message.image_url
    ) {

        const image =
            document.createElement(
                "img"
            );


        image.className =
            "message-image";


        image.src =
            message.image_url;


        image.alt =
            "Hình ảnh";


        image.loading =
            "lazy";


        image.addEventListener(
            "click",
            function () {

                window.open(
                    message.image_url,
                    "_blank"
                );

            }
        );


        bubble.appendChild(
            image
        );

    }


    /* -----------------------------------------
       TEXT
       ----------------------------------------- */

    if (
        message.content
    ) {

        const text =
            document.createElement(
                "div"
            );


        text.className =
            "message-text";


        text.textContent =
            message.content;


        bubble.appendChild(
            text
        );

    }


    /* -----------------------------------------
       TIME
       ----------------------------------------- */

    const time =
        document.createElement(
            "div"
        );


    time.className =
        "message-time";


    time.textContent =
        formatMessageTime(
            message.created_at
        );


    bubble.appendChild(
        time
    );


    row.appendChild(
        bubble
    );


    messagesArea.appendChild(
        row
    );

}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

    if (
        !currentUser ||
        !currentConversationId
    ) {

        return;

    }


    const content =
        messageInput
            ?.value
            ?.trim() ||
        "";


    if (
        !content &&
        !selectedImage
    ) {

        return;

    }


    if (sendButton) {

        sendButton.disabled =
            true;

    }


    try {

        let imageUrl =
            null;


        /* -----------------------------------------
           UPLOAD ẢNH
           ----------------------------------------- */

        if (
            selectedImage
        ) {

            imageUrl =
                await uploadChatImage(
                    selectedImage
                );

        }


        /* -----------------------------------------
           INSERT MESSAGE
           ----------------------------------------- */

        const {
            data,
            error
        } =
            await supabaseClient

                .from("messages")

                .insert({

                    conversation_id:
                        currentConversationId,

                    sender_id:
                        currentUser.id,

                    content:
                        content ||
                        null,

                    message_type:
                        imageUrl
                            ? "image"
                            : "text",

                    image_url:
                        imageUrl,

                    is_read:
                        false

                })

                .select()

                .single();


        if (error) {

            throw error;

        }


        /* -----------------------------------------
           CẬP NHẬT CONVERSATION
           ----------------------------------------- */

        const preview =
            content ||
            "[Hình ảnh]";


        await updateConversationLastMessage(

            currentConversationId,

            preview

        );


        /* -----------------------------------------
           RESET INPUT
           ----------------------------------------- */

        if (messageInput) {

            messageInput.value =
                "";

        }


        removeSelectedImage();


        /* -----------------------------------------
           HIỂN THỊ NGAY
           ----------------------------------------- */

        if (data) {

            renderSingleMessage(
                data
            );

            scrollToBottom();

        }


        /* -----------------------------------------
           CẬP NHẬT LOCAL LIST
           ----------------------------------------- */

        const conversation =
            conversations.find(
                item =>
                    item.id ===
                    currentConversationId
            );


        if (conversation) {

            conversation.last_message =
                preview;

            conversation.last_message_at =
                new Date().toISOString();

            conversation.updated_at =
                new Date().toISOString();

        }


        conversations.sort(
            (
                a,
                b
            ) => {

                if (
                    a.isAdmin &&
                    !b.isAdmin
                ) {

                    return -1;

                }


                if (
                    !a.isAdmin &&
                    b.isAdmin
                ) {

                    return 1;

                }


                return new Date(
                    b.updated_at ||
                    0
                ) -
                new Date(
                    a.updated_at ||
                    0
                );

            }
        );


        renderConversationList(
            conversations
        );

    }

    catch (error) {

        console.error(
            "Lỗi gửi tin nhắn:",
            error
        );


        alert(
            error?.message ||
            "Không thể gửi tin nhắn. Vui lòng thử lại."
        );

    }

    finally {

        if (sendButton) {

            sendButton.disabled =
                false;

        }


        if (messageInput) {

            messageInput.focus();

        }

    }

}


/* =========================================================
   UPLOAD CHAT IMAGE
   ========================================================= */

async function uploadChatImage(
    file
) {

    if (!file) {

        return null;

    }


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        throw new Error(
            "File được chọn không phải hình ảnh."
        );

    }


    if (
        file.size >
        10 * 1024 * 1024
    ) {

        throw new Error(
            "Ảnh không được vượt quá 10MB."
        );

    }


    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    const safeExtension =
        extension || "jpg";


    const filename =
        `${Date.now()}_${crypto.randomUUID()}.${safeExtension}`;


    const path =
        `${currentUser.id}/${currentConversationId}/${filename}`;


    const {
        error
    } =
        await supabaseClient.storage

            .from(
                CHAT_BUCKET
            )

            .upload(
                path,
                file,
                {

                    cacheControl:
                        "3600",

                    upsert:
                        false

                }
            );


    if (error) {

        throw error;

    }


    const {
        data
    } =
        supabaseClient.storage

            .from(
                CHAT_BUCKET
            )

            .getPublicUrl(
                path
            );


    return data.publicUrl;

}


/* =========================================================
   UPDATE LAST MESSAGE
   ========================================================= */

async function updateConversationLastMessage(

    conversationId,

    message

) {

    const now =
        new Date()
            .toISOString();


    const {
        error
    } =
        await supabaseClient

            .from(
                "conversations"
            )

            .update({

                last_message:
                    message,

                last_message_at:
                    now,

                updated_at:
                    now

            })

            .eq(
                "id",
                conversationId
            );


    if (error) {

        console.error(
            "Lỗi cập nhật conversation:",
            error
        );

    }

}


/* =========================================================
   MARK MESSAGES AS READ
   ========================================================= */

async function markMessagesAsRead(
    conversationId
) {

    if (!conversationId) {

        return;

    }


    const {
        error
    } =
        await supabaseClient

            .from("messages")

            .update({

                is_read:
                    true

            })

            .eq(
                "conversation_id",
                conversationId
            )

            .neq(
                "sender_id",
                currentUser.id
            )

            .eq(
                "is_read",
                false
            );


    if (error) {

        console.error(
            "Lỗi đánh dấu đã đọc:",
            error
        );

    }

}


/* =========================================================
   REALTIME
   ========================================================= */

function subscribeToMessages(
    conversationId
) {

    if (
        realtimeChannel
    ) {

        supabaseClient
            .removeChannel(
                realtimeChannel
            );

        realtimeChannel =
            null;

    }


    realtimeChannel =

        supabaseClient

            .channel(
                `chat-${conversationId}`
            )

            .on(

                "postgres_changes",

                {

                    event:
                        "INSERT",

                    schema:
                        "public",

                    table:
                        "messages",

                    filter:
                        `conversation_id=eq.${conversationId}`

                },

                async payload => {

                    const message =
                        payload.new;


                    /*
                       Nếu tin nhắn đã có
                       thì không render lại.
                    */

                    const existing =
                        document.querySelector(
                            `[data-message-id="${message.id}"]`
                        );


                    if (existing) {

                        return;

                    }


                    renderSingleMessage(
                        message
                    );


                    /*
                       Nếu người khác gửi
                       → đánh dấu đã đọc.
                    */

                    if (
                        message.sender_id !==
                        currentUser.id
                    ) {

                        await markMessagesAsRead(
                            conversationId
                        );

                    }


                    scrollToBottom();


                    /*
                       Cập nhật preview.
                    */

                    const conversation =
                        conversations.find(
                            item =>
                                item.id ===
                                conversationId
                        );


                    if (conversation) {

                        conversation.last_message =
                            message.content ||
                            "[Hình ảnh]";

                        conversation.last_message_at =
                            message.created_at;

                        conversation.updated_at =
                            message.created_at;


                        if (
                            message.sender_id !==
                            currentUser.id
                        ) {

                            conversation.unreadCount =
                                currentConversationId ===
                                conversationId
                                    ? 0
                                    : (
                                        conversation.unreadCount +
                                        1
                                    );

                        }

                    }


                    renderConversationList(
                        conversations
                    );

                }

            )

            .subscribe(
                status => {

                    console.log(
                        "Realtime chat:",
                        status
                    );

                }
            );

}


/* =========================================================
   SEARCH CHAT
   ========================================================= */

if (conversationSearch) {

    conversationSearch.addEventListener(
        "input",
        function () {

            const keyword =
                this.value
                    .toLowerCase()
                    .trim();


            if (!keyword) {

                renderConversationList(
                    conversations
                );

                return;

            }


            const filtered =
                conversations.filter(
                    conversation => {

                        const user =
                            conversation.otherUser;


                        const name =
                            (
                                user?.fullname ||
                                ""
                            )
                                .toLowerCase();


                        const last =
                            (
                                conversation.last_message ||
                                ""
                            )
                                .toLowerCase();


                        return (

                            name.includes(
                                keyword
                            )

                            ||

                            last.includes(
                                keyword
                            )

                        );

                    }
                );


            renderConversationList(
                filtered
            );

        }
    );

}


/* =========================================================
   CHỌN ẢNH
   ========================================================= */

if (imageInput) {

    imageInput.addEventListener(
        "change",
        function () {

            const file =
                this.files?.[0];


            if (!file) {

                return;

            }


            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                alert(
                    "Vui lòng chọn file hình ảnh."
                );

                this.value =
                    "";

                return;

            }


            if (
                file.size >
                10 * 1024 * 1024
            ) {

                alert(
                    "Ảnh không được vượt quá 10MB."
                );

                this.value =
                    "";

                return;

            }


            selectedImage =
                file;


            if (
                previewImage &&
                imagePreview
            ) {

                const reader =
                    new FileReader();


                reader.onload =
                    function (event) {

                        previewImage.src =
                            event.target.result;

                        imagePreview.style.display =
                            "block";

                    };


                reader.readAsDataURL(
                    file
                );

            }

        }
    );

}


/* =========================================================
   XÓA ẢNH ĐANG CHỌN
   ========================================================= */

function removeSelectedImage() {

    selectedImage =
        null;


    if (imageInput) {

        imageInput.value =
            "";

    }


    if (imagePreview) {

        imagePreview.style.display =
            "none";

    }


    if (previewImage) {

        previewImage.src =
            "";

    }

}


if (removePreview) {

    removePreview.addEventListener(
        "click",
        removeSelectedImage
    );

}


/* =========================================================
   NÚT GỬI
   ========================================================= */

if (sendButton) {

    sendButton.addEventListener(
        "click",
        sendMessage
    );

}


/* =========================================================
   ENTER ĐỂ GỬI
   ========================================================= */

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        function (event) {

            if (

                event.key ===
                "Enter"

                &&

                !event.shiftKey

            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );

}


/* =========================================================
   MOBILE BACK
   ========================================================= */

if (mobileBack) {

    mobileBack.addEventListener(
        "click",
        function () {

            const chatContainer =
                document.querySelector(
                    ".chat-container"
                );


            if (chatContainer) {

                chatContainer.classList.remove(
                    "mobile-chat"
                );

            }


            const activeChat =
                document.getElementById(
                    "activeChat"
                );


            const chatEmpty =
                document.getElementById(
                    "chatEmpty"
                );


            if (activeChat) {

                activeChat.style.display =
                    "none";

            }


            if (chatEmpty) {

                chatEmpty.style.display =
                    "flex";

            }


            currentConversationId =
                null;


            currentOtherUser =
                null;


            if (
                realtimeChannel
            ) {

                supabaseClient
                    .removeChannel(
                        realtimeChannel
                    );

                realtimeChannel =
                    null;

            }


            renderConversationList(
                conversations
            );

        }
    );

}


/* =========================================================
   SCROLL
   ========================================================= */

function scrollToBottom() {

    if (!messagesArea) {

        return;

    }


    requestAnimationFrame(
        function () {

            messagesArea.scrollTop =
                messagesArea.scrollHeight;

        }
    );

}


/* =========================================================
   FORMAT CHAT DATE
   ========================================================= */

function formatChatDate(
    date
) {

    if (!date) {

        return "";

    }


    const d =
        new Date(date);


    const now =
        new Date();


    const sameDay =
        d.toDateString() ===
        now.toDateString();


    if (sameDay) {

        return d.toLocaleTimeString(

            "vi-VN",

            {

                hour:
                    "2-digit",

                minute:
                    "2-digit"

            }

        );

    }


    return d.toLocaleDateString(

        "vi-VN",

        {

            day:
                "2-digit",

            month:
                "2-digit"

        }

    );

}


/* =========================================================
   FORMAT MESSAGE TIME
   ========================================================= */

function formatMessageTime(
    date
) {

    if (!date) {

        return "";

    }


    const d =
        new Date(date);


    return d.toLocaleTimeString(

        "vi-VN",

        {

            hour:
                "2-digit",

            minute:
                "2-digit"

        }

    );

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value ?? "";


    return div.innerHTML;

}


/* =========================================================
   AUTH STATE CHANGE
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
    function (
        event,
        session
    ) {

        console.log(
            "Auth event:",
            event
        );


        if (
            event ===
            "SIGNED_OUT"
        ) {

            window.location.href =
                "dang-nhap.html";

        }

    }
);


/* =========================================================
   INIT CHAT
   ========================================================= */

async function initChat() {

    try {

        /*
           Header
        */

        await updateUserMenu();


        /*
           Lấy user hiện tại
        */

        const user =
            await loadCurrentUser();


        if (!user) {

            return;

        }


        /*
           Load toàn bộ chat
        */

        await loadConversations();


        /*
           Tự động mở Admin
        */

        const adminConversation =
            conversations.find(

                conversation =>
                    conversation.isAdmin

            );


        if (
            adminConversation
        ) {

            await openConversation(
                adminConversation.id
            );

        }

    }

    catch (error) {

        console.error(
            "Chat initialization error:",
            error
        );


        if (conversationList) {

            conversationList.innerHTML = `

                <div class="chat-error">

                    Không thể khởi động hệ thống trò chuyện.

                </div>

            `;

        }

    }

}


/* =========================================================
   DOM READY
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        setupAccountDropdown();

        setupAccountShortcuts();

        setupActiveMenu();

        await initChat();

    }
);