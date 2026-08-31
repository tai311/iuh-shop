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
   CẤU HÌNH
   ========================================================= */

const CHAT_BUCKET = "chat-images";

const ADMIN_GREETING =
    "Xin chào! 👋 Chào mừng bạn đến với IUH SHOP. Bạn cần hỗ trợ gì, cứ nhắn cho chúng tôi nhé!";


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
    document.getElementById("conversationList");

const messagesArea =
    document.getElementById("messagesArea");

const messageInput =
    document.getElementById("messageInput");

const imageInput =
    document.getElementById("imageInput");

const imagePreview =
    document.getElementById("imagePreview");

const previewImage =
    document.getElementById("previewImage");

const conversationSearch =
    document.getElementById("conversationSearch");

const sendButton =
    document.getElementById("sendButton");

const removePreview =
    document.getElementById("removePreview");

const mobileBack =
    document.getElementById("mobileBack");


/* =========================================================
   HÀM ESCAPE HTML
   ========================================================= */

function escapeHTML(value) {

    const div = document.createElement("div");

    div.textContent = value ?? "";

    return div.innerHTML;
}


/* =========================================================
   LẤY PROFILE NGƯỜI DÙNG
   ========================================================= */

async function getUserProfile(userId) {

    if (!userId) {
        return null;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("users")
        .select(
    "user_id, fullname, avatar_url, role, student_verified"
)
        .eq(
            "user_id",
            userId
        )
        .maybeSingle();

    if (error) {

        console.error(
            "Lỗi lấy profile:",
            error
        );

        return null;
    }

    if (!data) {
        return null;
    }

    const role =
    data.role || "user";

const studentVerified =
    data.student_verified === true;

const hasVerifiedBadge =
    role === "admin" ||
    role === "moderator" ||
    studentVerified;


return {
    id:
        data.user_id,

    fullname:
        data.fullname ||
        "Người dùng",

    avatar_url:
        data.avatar_url ||
        "",

    role:
        role,

    student_verified:
        studentVerified,

    hasVerifiedBadge:
        hasVerifiedBadge
};
}


/* =========================================================
   LẤY ADMIN
   ========================================================= */

async function getAdminUser() {

    const {
        data,
        error
    } = await supabaseClient
        .from("users")
        .select(
         "user_id, fullname, avatar_url, role, student_verified"
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

    if (!data || !data.length) {

        console.error(
            "Không có tài khoản role = admin."
        );

        return null;
    }

    const admin = data[0];

    /*
       QUAN TRỌNG:

       Dùng đúng tên field mà toàn bộ hệ thống
       phía dưới đang sử dụng:

       fullname
       avatar_url
    */

    return {
        id:
            admin.user_id,

        fullname:
            admin.fullname ||
            "Admin IUH SHOP",

        avatar_url:
            admin.avatar_url ||
            "",

        role:
            admin.role,
        student_verified:
        admin.student_verified === true,

    hasVerifiedBadge:
        true
    };
}


/* =========================================================
   HEADER TÀI KHOẢN
   ========================================================= */

async function updateUserMenu() {

    try {

        const {
            data: {
                user
            },
            error
        } =
            await supabaseClient.auth.getUser();

        if (error) {

            console.error(
                "Không lấy được tài khoản:",
                error
            );

            return;
        }

        const loginLink =
            document.querySelector(".login-link");

        const registerLink =
            document.querySelector(".register-link");

        const divider =
            document.querySelector(".top-divider");

        const userAccount =
            document.getElementById("userAccount");

        const headerAvatar =
            document.getElementById("headerAvatar");

        const headerUserName =
            document.getElementById("headerUserName");

        const adminLink =
            document.getElementById("adminLink");


        if (!user) {

            if (loginLink)
                loginLink.style.display = "";

            if (registerLink)
                registerLink.style.display = "";

            if (divider)
                divider.style.display = "";

            if (userAccount)
                userAccount.style.display = "none";

            if (adminLink)
                adminLink.style.display = "none";

            return;
        }


        const profile =
            await getUserProfile(user.id);

        currentUserProfile =
            profile;


        /* ADMIN LINK */

        if (adminLink) {

            adminLink.style.display =
                profile?.role === "admin"
                    ? "block"
                    : "none";
        }


        /* TÊN */

        const fullname =
            profile?.fullname ||
            user.email?.split("@")[0] ||
            "Tài khoản";

        if (headerUserName) {

            headerUserName.textContent =
                fullname;
        }


        /* AVATAR */

        if (headerAvatar) {

            headerAvatar.src =
                profile?.avatar_url ||
                "../Images/default-avatar.svg";
        }


        /* ẨN LOGIN */

        if (loginLink)
            loginLink.style.display = "none";

        if (registerLink)
            registerLink.style.display = "none";

        if (divider)
            divider.style.display = "none";

        if (userAccount)
            userAccount.style.display = "flex";

    }
    catch (error) {

        console.error(
            "Lỗi cập nhật tài khoản:",
            error
        );
    }
}


/* =========================================================
   ACCOUNT DROPDOWN
   ========================================================= */

function setupAccountDropdown() {

    const button =
        document.getElementById(
            "userAccountButton"
        );

    const dropdown =
        document.getElementById(
            "accountDropdown"
        );

    if (!button || !dropdown) {
        return;
    }

    button.addEventListener(
        "click",
        function(event) {

            event.stopPropagation();

            dropdown.classList.toggle(
                "show"
            );
        }
    );

    document.addEventListener(
        "click",
        function() {

            dropdown.classList.remove(
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
        async function() {

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
                        "Đăng xuất thất bại."
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

    const wrapper =
        document.querySelector(
            ".account-nav-wrapper"
        );

    const arrow =
        document.getElementById(
            "accountNavArrow"
        );

    const shortcuts =
        document.getElementById(
            "accountShortcuts"
        );

    if (
        !wrapper ||
        !arrow ||
        !shortcuts
    ) {
        return;
    }

    arrow.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

            wrapper.classList.toggle(
                "open"
            );
        }
    );

    shortcuts.addEventListener(
        "click",
        function(event) {

            event.stopPropagation();
        }
    );

    document.addEventListener(
        "click",
        function() {

            wrapper.classList.remove(
                "open"
            );
        }
    );
}


/* =========================================================
   ACTIVE MENU
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

                const href =
                    link.getAttribute("href");

                if (!href) {
                    return;
                }

                const linkPage =
                    href
                        .split("/")
                        .pop()
                        .toLowerCase();

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

    currentUserProfile =
        await getUserProfile(
            currentUser.id
        );

    return currentUser;
}


/* =========================================================
   TÌM CONVERSATION VỚI MỘT USER
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
            .from("conversation_members")
            .select("conversation_id")
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
            data: otherMember,
            error: memberError
        } =
            await supabaseClient
                .from("conversation_members")
                .select("user_id")
                .eq(
                    "conversation_id",
                    conversationId
                )
                .eq(
                    "user_id",
                    otherUserId
                )
                .maybeSingle();


        if (
            !memberError &&
            otherMember
        ) {

            return conversationId;
        }
    }

    return null;
}


/* =========================================================
   TẠO CONVERSATION
   ========================================================= */

async function createConversation(
    otherUserId,
    isAdminChat = false
) {

    if (!currentUser) {

        throw new Error(
            "Chưa đăng nhập."
        );
    }

    if (!otherUserId) {

        throw new Error(
            "Không xác định được người dùng."
        );
    }


    /* KIỂM TRA LẠI TRƯỚC KHI TẠO */

    const existing =
        await findConversationWithUser(
            otherUserId
        );

    if (existing) {

        return {
            id: existing
        };
    }


    const conversationId =
        crypto.randomUUID();


    /* TẠO CONVERSATION */

    const {
        error: conversationError
    } =
        await supabaseClient
            .from("conversations")
            .insert({
                id:
                    conversationId,

                is_admin_chat:
                    isAdminChat
            });


    if (conversationError) {

        console.error(
            "Lỗi tạo conversation:",
            conversationError
        );

        throw conversationError;
    }


    /* THÊM USER HIỆN TẠI */

    const {
        error: selfError
    } =
        await supabaseClient
            .from("conversation_members")
            .insert({
                conversation_id:
                    conversationId,

                user_id:
                    currentUser.id
            });


    if (selfError) {

        console.error(
            "Lỗi thêm thành viên hiện tại:",
            selfError
        );

        throw selfError;
    }


    /* THÊM USER CÒN LẠI */

    const {
        error: otherError
    } =
        await supabaseClient
            .from("conversation_members")
            .insert({
                conversation_id:
                    conversationId,

                user_id:
                    otherUserId
            });


    if (otherError) {

        console.error(
            "Lỗi thêm thành viên còn lại:",
            otherError
        );

        throw otherError;
    }


    return {
        id:
            conversationId,

        is_admin_chat:
            isAdminChat,

        created_at:
            new Date().toISOString(),

        updated_at:
            new Date().toISOString(),

        last_message:
            null,

        last_message_at:
            null
    };
}


/* =========================================================
   ĐẢM BẢO ADMIN LUÔN CÓ
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


    /* NẾU CHƯA CÓ → TẠO */

    if (!conversationId) {

        const conversation =
            await createConversation(
                admin.id,
                true
            );

        conversationId =
            conversation.id;
    }


    /*
       QUAN TRỌNG:

       Trả đúng field:
       fullname
       avatar_url

       Không dùng:
       name
       avatar
    */

    return {
    id:
        admin.id,

    fullname:
        admin.fullname,

    avatar_url:
        admin.avatar_url,

    role:
        "admin",

    student_verified:
        admin.student_verified === true,

    hasVerifiedBadge:
        true,

    conversationId:
        conversationId
};
}


/* =========================================================
   LẤY UNREAD
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
                    count: "exact",
                    head: true
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
   LẤY CONVERSATION
   ========================================================= */

async function getConversationById(
    conversationId
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("conversations")
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
   LẤY TIN NHẮN CUỐI CÙNG
========================================================= */

async function getLatestMessage(conversationId) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("messages")
            .select(
                "id, sender_id, content, image_url, recalled_at, created_at"
            )
            .eq(
                "conversation_id",
                conversationId
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(1)
            .maybeSingle();


    if (error) {

        console.error(
            "Lỗi lấy tin nhắn cuối:",
            error
        );

        return null;
    }


    return data || null;
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
            .from("conversation_members")
            .select("conversation_id")
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


    /* =========================================
       LOAD CÁC CHAT ĐÃ CÓ
       ========================================= */

    if (ids.length) {

        const {
            data: conversationData,
            error: conversationError
        } =
            await supabaseClient
                .from("conversations")
                .select("*")
                .in(
                    "id",
                    ids
                )
                .order(
                    "updated_at",
                    {
                        ascending: false
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
                data: members
            } =
                await supabaseClient
                    .from(
                        "conversation_members"
                    )
                    .select("user_id")
                    .eq(
                        "conversation_id",
                        conversation.id
                    )
                    .neq(
                        "user_id",
                        currentUser.id
                    );


            if (!members?.length) {
                continue;
            }


            const otherUserId =
                members[0].user_id;


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

            const latestMessage =
    await getLatestMessage(
        conversation.id
    );


            const isAdmin =
    profile.role === "admin";

const isPinned =
    profile.role === "admin" &&
    currentUserProfile?.role !== "admin";

    let preview = null;

if (latestMessage) {

    if (latestMessage.recalled_at) {

        preview =
            "Tin nhắn đã được thu hồi";

    } else {

        preview =
            latestMessage.content ||
            (
                latestMessage.image_url
                    ? "[Hình ảnh]"
                    : ""
            );
    }
}


if (
    latestMessage &&
    latestMessage.sender_id === currentUser.id
) {

    preview =
        `Bạn: ${preview}`;
}


            conversations.push({

    ...conversation,

    otherUser:
        profile,

    unreadCount:
        unreadCount,

    isAdmin:
        isAdmin,

    isPinned:
        isPinned,

    last_message:
        preview,

    last_message_at:
        latestMessage?.created_at ||
        conversation.last_message_at ||
        null,

    updated_at:
        latestMessage?.created_at ||
        conversation.updated_at,

    lastMessageIsMine:
        latestMessage?.sender_id ===
        currentUser.id

});
        }
    }


    /* =========================================
       ADMIN LUÔN CÓ
       ========================================= */

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

                    otherUser: {

    id:
        adminChat.id,

    fullname:
        adminChat.fullname,

    avatar_url:
        adminChat.avatar_url,

    role:
        "admin",

    student_verified:
        adminChat.student_verified === true,

    hasVerifiedBadge:
        true

},

                    unreadCount:
                        await getUnreadCount(
                            adminChat.conversationId
                        ),

                    isAdmin:
                        true,

                    isPinned:
                        true

                };


                conversations.push(
                    adminConversation
                );
            }

        }
        else {

            /*
               Cập nhật lại profile Admin
               để avatar + tên luôn chính xác.
            */

            adminConversation.otherUser = {

    id:
        adminChat.id,

    fullname:
        adminChat.fullname,

    avatar_url:
        adminChat.avatar_url,

    role:
        "admin",

    student_verified:
        adminChat.student_verified === true,

    hasVerifiedBadge:
        true

};

            adminConversation.isAdmin =
                true;

            adminConversation.isPinned =
                true;
        }
    }


    /* =========================================
       XÓA DUPLICATE
       ========================================= */

    const unique =
        new Map();


    conversations.forEach(
        conversation => {

            const otherId =
                conversation.otherUser?.id;

            if (!otherId) {
                return;
            }

            /*
               Một người chỉ có một đoạn chat.
            */

            if (!unique.has(otherId)) {

                unique.set(
                    otherId,
                    conversation
                );

            }
            else {

                const old =
                    unique.get(otherId);

                const oldTime =
                    new Date(
                        old.updated_at || 0
                    );

                const newTime =
                    new Date(
                        conversation.updated_at || 0
                    );

                if (
                    newTime > oldTime
                ) {

                    unique.set(
                        otherId,
                        conversation
                    );
                }
            }
        }
    );


    conversations =
        Array.from(
            unique.values()
        );


    /* =========================================
       ADMIN LUÔN ĐẦU
       ========================================= */

    conversations.sort(
        (
            a,
            b
        ) => {

            if (
                a.isPinned &&
                !b.isPinned
            ) {
                return -1;
            }

            if (
                !a.isPinned &&
                b.isPinned
            ) {
                return 1;
            }

            return (
                new Date(
                    b.updated_at || 0
                ) -
                new Date(
                    a.updated_at || 0
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


                    /*
                       KHÔNG hard-code tên Admin nữa.
                       Luôn lấy từ users.
                    */

                    const fullname =
                        user?.fullname ||
                        "Người dùng";


                    const avatarUrl =
                        user?.avatar_url ||
                        "";


                    const active =
                        conversation.id ===
                        currentConversationId
                            ? "active"
                            : "";


                    return `

                        <div
                            class="
                                conversation-item
                                ${isAdmin ? "admin-chat" : ""}
                                ${conversation.isPinned ? "pinned-chat" : ""}
                                ${active}
                            "
                            data-id="${escapeHTML(
                                conversation.id
                            )}"
                        >

                            <!-- AVATAR -->

                            <div class="conversation-avatar">

                                ${
                                    avatarUrl

                                        ?

                                        `
                                            <img
                                                src="${escapeHTML(
                                                    avatarUrl
                                                )}"
                                                alt="${escapeHTML(
                                                    fullname
                                                )}"
                                            >
                                        `

                                        :

                                        `
                                            <span class="avatar-letter">
                                                ${escapeHTML(
                                                    fullname
                                                        .charAt(0)
                                                        .toUpperCase()
                                                )}
                                            </span>
                                        `
                                }

                                <span
                                    class="online-dot"
                                ></span>

                            </div>


                            <!-- NỘI DUNG -->

                            <div class="conversation-content">

                                <div class="conversation-top">

                                    <div class="conversation-name-row">

    <span class="conversation-name">
        ${escapeHTML(fullname)}
    </span>

    ${
        user?.hasVerifiedBadge
            ?
            `
                <span
                    class="chat-verified-badge chat-verified-badge-small"
                    title="${
                        user?.role === "admin"
                            ? "Tài khoản Admin"
                            : user?.role === "moderator"
                                ? "Tài khoản Quản trị viên"
                                : "Đã xác thực sinh viên"
                    }"
                >
                    ✓
                </span>
            `
            :
            ""
    }

</div>


                                    <span class="conversation-time">

                                        ${
                                            formatChatDate(
                                                conversation.updated_at
                                            )
                                        }

                                    </span>

                                </div>


                                <div class="conversation-preview">

                                    <span class="last-message">

                                        ${escapeHTML(
    conversation.last_message ||
    (
        isAdmin
            ?
            "Xin chào! Chúng tôi có thể hỗ trợ gì cho bạn?"
            :
            "Chưa có tin nhắn"
    )
)}

                                    </span>


                                    ${
                                        conversation.unreadCount > 0

                                            ?

                                            `
                                                <span class="unread-badge">
                                                    ${conversation.unreadCount}
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
                    function() {

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
    
    if (
    window.IUHChatNotification &&
    typeof window.IUHChatNotification
        .setCurrentConversation === "function"
) {
    window.IUHChatNotification
        .setCurrentConversation(
            conversationId
        );
}


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


    renderConversationList(
        conversations
    );
}


/* =========================================================
   HEADER CHAT
   ========================================================= */

function renderActiveChatHeader(
    conversation
) {

    const user =
        conversation.otherUser;


    const fullname =
        user?.fullname ||
        "Người dùng";


    const avatarUrl =
        user?.avatar_url ||
        "";


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


    /* =========================================
       TÊN
       ========================================= */

    if (userName) {

    userName.innerHTML = "";

    const nameText =
        document.createElement(
            "span"
        );

    nameText.className =
        "chat-header-name-text";

    nameText.textContent =
        fullname;

    userName.appendChild(
        nameText
    );


    if (
        user?.hasVerifiedBadge
    ) {

        const badge =
            document.createElement(
                "span"
            );

        badge.className =
            "chat-verified-badge chat-verified-badge-header";

        badge.textContent =
            "✓";


        if (
            user.role === "admin"
        ) {

            badge.title =
                "Tài khoản Admin";

        }
        else if (
            user.role === "moderator"
        ) {

            badge.title =
                "Tài khoản Quản trị viên";

        }
        else {

            badge.title =
                "Đã xác thực sinh viên";

        }


        userName.appendChild(
            badge
        );

    }

}


    /* =========================================
       AVATAR

       Dùng background để không phá CSS
       avatar hình tròn hiện tại.
       ========================================= */

    if (avatar) {

        avatar.textContent = "";

        avatar.innerHTML = "";


        if (avatarUrl) {

            const img =
                document.createElement(
                    "img"
                );

            img.src =
                avatarUrl;

            img.alt =
                fullname;

            img.style.width =
                "100%";

            img.style.height =
                "100%";

            img.style.objectFit =
                "cover";

            img.style.borderRadius =
                "50%";

            avatar.appendChild(
                img
            );

        }
        else {

            avatar.textContent =
                fullname
                    .charAt(0)
                    .toUpperCase();
        }
    }


    /* =========================================
       STATUS
       ========================================= */

    if (userStatus) {

    userStatus.textContent =
        user?.role === "admin"
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
                    ascending: true
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


    const messages =
        data || [];


    /* =========================================
       LẤY REACTION
       ========================================= */

    if (messages.length) {

        const messageIds =
            messages.map(
                item =>
                    item.id
            );


        const {
            data: reactions,
            error: reactionError
        } =
            await supabaseClient
                .from(
                    "message_reactions"
                )
                .select(
                    "id, message_id, user_id, reaction"
                )
                .in(
                    "message_id",
                    messageIds
                );


        if (!reactionError) {

            const reactionMap =
                {};


            for (
                const reaction
                of reactions || []
            ) {

                if (
                    !reactionMap[
                        reaction.message_id
                    ]
                ) {

                    reactionMap[
                        reaction.message_id
                    ] = [];
                }


                reactionMap[
                    reaction.message_id
                ].push(
                    reaction
                );
            }


            for (
                const message
                of messages
            ) {

                message.reactions =
                    reactionMap[
                        message.id
                    ] ||
                    [];
            }
        }

    }


    /* =========================================
       RENDER MESSAGES
       ========================================= */

    await renderMessages(
        messages
    );

}


/* =========================================================
   RENDER TOÀN BỘ MESSAGES
   ========================================================= */

async function renderMessages(
    messages
) {

    if (!messagesArea) {
        return;
    }


    messagesArea.innerHTML = "";


    /*
       Nếu là Admin và chưa có tin nhắn
       → hiện lời chào mặc định.
    */

    const currentConversation =
        conversations.find(
            conversation =>
                conversation.id ===
                currentConversationId
        );


    if (
        currentConversation?.is_admin_chat === true &&
        (!messages || !messages.length)
    ) {

        renderAdminGreeting();

        return;
    }


    if (
        !messages ||
        !messages.length
    ) {

        messagesArea.innerHTML = `
            <div class="chat-loading">
                Bắt đầu cuộc trò chuyện.
            </div>
        `;

        return;
    }


    /*
       Nếu Admin:
       lời chào luôn nằm đầu đoạn chat.
    */

    if (
        currentConversation?.is_admin_chat === true
    ) {

        renderAdminGreeting();
    }


    for (
        const message
        of messages
    ) {

        await renderSingleMessage(
            message
        );
    }


    scrollToBottom();
}

function createMessageAvatar(
    profile
) {

    const avatar =
        document.createElement(
            "div"
        );

    avatar.className =
        "message-avatar";


    if (profile?.avatar_url) {

        const img =
            document.createElement(
                "img"
            );

        img.src =
            profile.avatar_url;

        img.alt =
            profile.fullname ||
            "Người dùng";

        avatar.appendChild(img);

    }

    else {

        avatar.textContent =
            (
                profile?.fullname ||
                "N"
            )
                .charAt(0)
                .toUpperCase();
    }


    return avatar;
}

/* =========================================================
   LỜI CHÀO ADMIN
   ========================================================= */

function renderAdminGreeting() {

    if (!messagesArea) {
        return;
    }

    const conversation =
        conversations.find(
            item =>
                item.id ===
                currentConversationId
        );

    if (!conversation) {
        return;
    }


    /*
       Lời chào luôn là do Admin gửi.
    */

    const amIAdmin =
        currentUserProfile?.role ===
        "admin";


    const row =
        document.createElement(
            "div"
        );

    row.className =
        "message-row " +
        (
            amIAdmin
                ? "mine"
                : "theirs"
        ) +
        " admin-greeting";


    const stack =
        document.createElement(
            "div"
        );

    stack.className =
        "message-stack";


    const bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "message-bubble";


    const text =
        document.createElement(
            "div"
        );

    text.className =
        "message-text";

    text.textContent =
        ADMIN_GREETING;

    bubble.appendChild(text);

    stack.appendChild(bubble);


    /*
       ADMIN ĐANG XEM
       → đây là tin của mình
       → KHÔNG avatar.
    */

    if (amIAdmin) {

        row.appendChild(stack);

    }

    /*
       USER ĐANG XEM
       → Admin là người bên kia
       → CÓ avatar Admin.
    */

    else {

        const adminProfile =
            conversation.otherUser;

        const avatar =
            createMessageAvatar(
                adminProfile
            );

        row.appendChild(avatar);

        row.appendChild(stack);
    }


    messagesArea.appendChild(row);
}


/* =========================================================
   RENDER 1 MESSAGE
   ========================================================= */

async function renderSingleMessage(
    message
) {

    if (
        !messagesArea ||
        !message?.id
    ) {
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


    const senderProfile =
        mine
            ? currentUserProfile
            : await getUserProfile(
                message.sender_id
            );


    /* ===============================
       ROW
       =============================== */

    const row =
        document.createElement(
            "div"
        );

    row.dataset.messageId =
        message.id;

    row.className =
        `message-row ${
            mine
                ? "mine"
                : "theirs"
        }`;


    /* ===============================
       STACK
       =============================== */

    const stack =
        document.createElement(
            "div"
        );

    stack.className =
        "message-stack";


    /* ===============================
       BUBBLE
       =============================== */

    const bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "message-bubble";


    /*
       ĐÃ THU HỒI
    */

    if (message.recalled_at) {

        bubble.classList.add(
            "recalled"
        );

        const recalled =
            document.createElement(
                "div"
            );

        recalled.className =
            "message-recalled";

        recalled.textContent =
            "Tin nhắn đã được thu hồi";

        bubble.appendChild(
            recalled
        );
    }

    else {

        /* IMAGE */

        if (message.image_url) {

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
                function() {

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


        /* TEXT */

        if (message.content) {

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


        /*
           ĐÃ CHỈNH SỬA
        */

        if (message.edited_at) {

            const edited =
                document.createElement(
                    "span"
                );

            edited.className =
                "edited-label";

            edited.textContent =
                "Đã chỉnh sửa";

            bubble.appendChild(
                edited
            );
        }
    }


    /* TIME */

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

    bubble.appendChild(time);

    stack.appendChild(bubble);


    /* ===============================
       REACTIONS
       =============================== */

    if (
        !message.recalled_at
    ) {

        renderReactionSummary(
            message,
            stack
        );
    }


    /* ===============================
       ACTION BUTTONS
       =============================== */

    if (
        !message.recalled_at
    ) {

        const actions =
            createMessageActions(
                message,
                mine
            );

        stack.appendChild(
            actions
        );
    }


    /*
       TIN CỦA MÌNH
       → chỉ bubble
       → KHÔNG avatar.
    */

    if (mine) {

        row.appendChild(
            stack
        );
    }

    /*
       TIN NGƯỜI KIA
       → avatar + bubble.
    */

    else {

        const avatar =
            createMessageAvatar(
                senderProfile
            );

        row.appendChild(
            avatar
        );

        row.appendChild(
            stack
        );
    }


    messagesArea.appendChild(
        row
    );
}

function createMessageActions(
    message,
    mine
) {

    const actions =
        document.createElement(
            "div"
        );

    actions.className =
        "message-actions";


    /* REACTION */

    const reactionButton =
        document.createElement(
            "button"
        );

    reactionButton.type =
        "button";

    reactionButton.className =
        "message-action-button";

    reactionButton.innerHTML =
        "☺";

    reactionButton.title =
        "Thả cảm xúc";


    const reactionPicker =
        document.createElement(
            "div"
        );

    reactionPicker.className =
        "reaction-picker";


    const emojis =
        [
            "👍",
            "❤️",
            "😂",
            "😮",
            "😢"
        ];


    emojis.forEach(
        emoji => {

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.textContent =
                emoji;


            button.addEventListener(
                "click",
                async function(event) {

                    event.stopPropagation();

                    await toggleReaction(
                        message,
                        emoji
                    );

                    reactionPicker.classList.remove(
                        "show"
                    );
                }
            );


            reactionPicker.appendChild(
                button
            );
        }
    );


    reactionButton.addEventListener(
        "click",
        function(event) {

            event.stopPropagation();

            reactionPicker.classList.toggle(
                "show"
            );
        }
    );


    actions.appendChild(
        reactionButton
    );

    actions.appendChild(
        reactionPicker
    );


    /* CHỈ TIN CỦA MÌNH */

    if (mine) {

        /* EDIT */

        if (
            message.content &&
            !message.image_url
        ) {

            const editButton =
                document.createElement(
                    "button"
                );

            editButton.type =
                "button";

            editButton.className =
                "message-action-button";

            editButton.textContent =
                "✎";

            editButton.title =
                "Chỉnh sửa";


            editButton.addEventListener(
                "click",
                async function() {

                    await editMessage(
                        message
                    );
                }
            );


            actions.appendChild(
                editButton
            );
        }


        /* RECALL */

        const recallButton =
            document.createElement(
                "button"
            );

        recallButton.type =
            "button";

        recallButton.className =
            "message-action-button";

        recallButton.textContent =
            "↩";

        recallButton.title =
            "Thu hồi";


        recallButton.addEventListener(
            "click",
            async function() {

                await recallMessage(
                    message
                );
            }
        );


        actions.appendChild(
            recallButton
        );
    }


    return actions;
}

async function toggleReaction(
    message,
    emoji
) {

    const existing =
        message.reactions?.find(
            item =>
                item.user_id ===
                currentUser.id
        );


    /*
       Bấm lại cùng reaction
       → xóa reaction.
    */

    if (
        existing &&
        existing.reaction ===
        emoji
    ) {

        const {
            error
        } =
            await supabaseClient
                .from(
                    "message_reactions"
                )
                .delete()
                .eq(
                    "message_id",
                    message.id
                )
                .eq(
                    "user_id",
                    currentUser.id
                );


        if (error) {

            console.error(
                "Lỗi xóa cảm xúc:",
                error
            );

            return;
        }
    }

    else {

        const {
            error
        } =
            await supabaseClient
                .from(
                    "message_reactions"
                )
                .upsert(
                    {

                        message_id:
                            message.id,

                        user_id:
                            currentUser.id,

                        reaction:
                            emoji

                    },
                    {
                        onConflict:
                            "message_id,user_id"
                    }
                );


        if (error) {

            console.error(
                "Lỗi thả cảm xúc:",
                error
            );

            return;
        }
    }


    await loadMessages(
        currentConversationId
    );
}

function renderReactionSummary(
    message,
    stack
) {

    const reactions =
        message.reactions ||
        [];


    if (!reactions.length) {
        return;
    }


    const grouped =
        {};


    reactions.forEach(
        item => {

            grouped[
                item.reaction
            ] =
                (
                    grouped[
                        item.reaction
                    ] ||
                    0
                ) + 1;
        }
    );


    const container =
        document.createElement(
            "div"
        );

    container.className =
        "reaction-summary";


    Object.entries(
        grouped
    )
        .forEach(
            (
                [
                    emoji,
                    count
                ]
            ) => {

                const chip =
                    document.createElement(
                        "span"
                    );

                chip.className =
                    "reaction-chip";

                chip.textContent =
                    count > 1
                        ? `${emoji} ${count}`
                        : emoji;


                container.appendChild(
                    chip
                );
            }
        );


    stack.appendChild(
        container
    );
}

async function editMessage(
    message
) {

    if (
        message.sender_id !==
        currentUser.id
    ) {
        return;
    }


    const newContent =
        prompt(
            "Chỉnh sửa tin nhắn:",
            message.content || ""
        );


    if (newContent === null) {
        return;
    }


    const value =
        newContent.trim();


    if (!value) {

        alert(
            "Tin nhắn không được để trống."
        );

        return;
    }


    if (
        value ===
        message.content
    ) {
        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from("messages")
            .update({

                content:
                    value,

                edited_at:
                    new Date()
                        .toISOString()

            })
            .eq(
                "id",
                message.id
            )
            .eq(
                "sender_id",
                currentUser.id
            );


    if (error) {

        console.error(
            "Lỗi chỉnh sửa:",
            error
        );

        alert(
            "Không thể chỉnh sửa tin nhắn."
        );

        return;
    }


    await syncConversationPreview(
        currentConversationId
    );


    await loadMessages(
        currentConversationId
    );
}

async function recallMessage(
    message
) {

    if (
        message.sender_id !==
        currentUser.id
    ) {
        return;
    }


    const accepted =
        confirm(
            "Bạn có chắc muốn thu hồi tin nhắn này?"
        );


    if (!accepted) {
        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from("messages")
            .update({

                content:
                    null,

                image_url:
                    null,

                recalled_at:
                    new Date()
                        .toISOString()

            })
            .eq(
                "id",
                message.id
            )
            .eq(
                "sender_id",
                currentUser.id
            );


    if (error) {

        console.error(
            "Lỗi thu hồi:",
            error
        );

        alert(
            "Không thể thu hồi tin nhắn."
        );

        return;
    }


    await syncConversationPreview(
        currentConversationId
    );


    await loadMessages(
        currentConversationId
    );
}

async function syncConversationPreview(
    conversationId
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("messages")
            .select(
    "content, image_url, recalled_at, created_at, sender_id"
)
            .eq(
                "conversation_id",
                conversationId
            )
            .order(
                "created_at",
                {
                    ascending:
                        false
                }
            )
            .limit(1)
            .maybeSingle();


    if (error) {

        console.error(
            "Lỗi đồng bộ preview:",
            error
        );

        return;
    }


    let preview =
        null;


    if (data) {

        if (data.recalled_at) {

            preview =
                "Tin nhắn đã được thu hồi";

        }

        else {

            preview =
    data.content ||
    (
        data.image_url
            ? "[Hình ảnh]"
            : ""
    );


if (
    data.sender_id ===
    currentUser.id
) {

    preview =
        `Bạn: ${preview}`;
}
        }
    }


    const now =
        new Date()
            .toISOString();


    await supabaseClient
        .from("conversations")
        .update({

            last_message:
                preview,

            last_message_at:
                data?.created_at ||
                null,

            updated_at:
    data?.created_at || now

        })
        .eq(
            "id",
            conversationId
        );


    const local =
        conversations.find(
            item =>
                item.id ===
                conversationId
        );


    if (local) {

        local.last_message =
            preview;

        local.updated_at =
            now;
    }


    renderConversationList(
        conversations
    );
}

/* =========================================================
   GỬI MESSAGE
   ========================================================= */

async function sendMessage() {

    if (
        !currentUser ||
        !currentConversationId
    ) {
        return;
    }


    const content =
        messageInput?.value
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


        /* UPLOAD IMAGE */

        if (selectedImage) {

            imageUrl =
                await uploadChatImage(
                    selectedImage
                );
        }


        /* INSERT MESSAGE */

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


        /* UPDATE CONVERSATION */

        const preview =
            content ||
            "[Hình ảnh]";


        await updateConversationLastMessage(
            currentConversationId,
            preview
        );


        /* CLEAR INPUT */

        if (messageInput) {
            messageInput.value = "";
        }


        removeSelectedImage();


        /*
           Hiển thị ngay.

           Realtime cũng nhận được message
           nhưng renderSingleMessage sẽ kiểm tra
           data-message-id nên không bị trùng.
        */

        if (data) {

            await renderSingleMessage(
                data
            );

            scrollToBottom();
        }


        /* UPDATE LOCAL */

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


        /*
           ADMIN vẫn ghim đầu.
        */

        conversations.sort(
            (
                a,
                b
            ) => {

                if (
                    a.isPinned &&
                    !b.isPinned
                ) {
                    return -1;
                }

                if (
                    !a.isPinned &&
                    b.isPinned
                ) {
                    return 1;
                }

                return (
                    new Date(
                        b.updated_at || 0
                    ) -
                    new Date(
                        a.updated_at || 0
                    )
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
            "Không thể gửi tin nhắn."
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
   UPLOAD ẢNH
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
        extension ||
        "jpg";


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
        new Date().toISOString();


    const {
        error
    } =
        await supabaseClient
            .from("conversations")
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
   MARK AS READ
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

/* =========================================================
   REALTIME - NHẬN TIN NHẮN MỚI
========================================================= */

function subscribeToMessages() {

    if (realtimeChannel) {

        supabaseClient.removeChannel(
            realtimeChannel
        );

        realtimeChannel = null;
    }


    realtimeChannel =
        supabaseClient
            .channel(
                "all-chat-messages"
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages"
                },
                async payload => {

                    const message =
                        payload.new;


                    /*
                        Không xử lý tin
                        do chính mình gửi.
                    */

                    const isMine =
                        message.sender_id ===
                        currentUser.id;


                    /*
                        Tìm cuộc trò chuyện
                    */

                    const conversation =
                        conversations.find(
                            item =>
                                item.id ===
                                message.conversation_id
                        );


                    if (!conversation) {

                        /*
                            Có thể là conversation
                            vừa mới tạo.
                            Tải lại danh sách.
                        */

                        await loadConversations();

                        return;
                    }


                    /*
                        Cập nhật tin cuối
                    */

                    let preview =
    message.content ||
    "[Hình ảnh]";


if (
    message.sender_id ===
    currentUser.id
) {

    preview =
        `Bạn: ${preview}`;
}


conversation.last_message =
    preview;

conversation.last_message_at =
    message.created_at;

conversation.updated_at =
    message.created_at;

conversation.lastMessageIsMine =
    message.sender_id ===
    currentUser.id;

                    conversation.last_message_at =
                        message.created_at;

                    conversation.updated_at =
                        message.created_at;


                    /*
                        Nếu người khác gửi
                    */

                    if (!isMine) {

                        /*
                            Nếu đang mở đúng cuộc chat
                            → coi là đã đọc.
                        */

                        if (
                            currentConversationId ===
                            message.conversation_id
                        ) {

                            await markMessagesAsRead(
                                message.conversation_id
                            );

                            conversation.unreadCount =
                                0;

                        }

                        /*
                            Nếu KHÔNG mở cuộc chat
                            → tăng chưa đọc ngay.
                        */

                        else {

                            conversation.unreadCount =
                                (
                                    conversation.unreadCount ||
                                    0
                                ) + 1;
                        }
                    }


                    /*
                        Nếu đang mở đúng chat
                        thì render tin nhắn.
                    */

                    if (
                        currentConversationId ===
                        message.conversation_id
                    ) {

                        const existing =
                            document.querySelector(
                                `[data-message-id="${message.id}"]`
                            );


                        if (!existing) {

                            await renderSingleMessage(
                                message
                            );
                        }


                        scrollToBottom();
                    }


                    /*
                        Admin vẫn đứng đầu.
                    */

                    conversations.sort(
                        (a, b) => {

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
                                ) -
                                new Date(
                                    a.updated_at ||
                                    0
                                )
                            );
                        }
                    );


                    /*
                        Render lại danh sách
                        ngay lập tức.
                    */

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
   TÌM KIẾM CHAT
   ========================================================= */

if (conversationSearch) {

    conversationSearch.addEventListener(
        "input",
        function() {

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
                            ) ||
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
        function() {

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
                    function(event) {

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
   XÓA ẢNH
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
        function(event) {

            if (
                event.key === "Enter" &&
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
        function() {

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

            /*
    Mặc định khi vừa vào trang:
    chưa chọn cuộc trò chuyện nào.
*/

currentConversationId = null;
currentOtherUser = null;


if (chatEmpty) {

    chatEmpty.style.display =
        "flex";
}


if (activeChat) {

    activeChat.style.display =
        "none";
}


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


            if (realtimeChannel) {

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
        function() {

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
   AUTH STATE
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
    function(
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

        /* =========================================
           HEADER
           ========================================= */

        await updateUserMenu();


        /* =========================================
           USER HIỆN TẠI
           ========================================= */

        const user =
            await loadCurrentUser();

        if (!user) {
            return;
        }


        /* =========================================
           ĐỌC THAM SỐ TỪ URL
           
           Ví dụ:
           tinnhan.html?
           product=123&
           seller=456&
           productName=Áo
           ========================================= */

        const params =
            new URLSearchParams(
                window.location.search
            );

        const sellerId =
            params.get("seller");

        const productId =
            params.get("product");

        const productName =
            params.get("productName");


        /* =========================================
           LOAD DANH SÁCH CHAT
           ========================================= */

        await loadConversations();


        /* =================================================
           TRƯỜNG HỢP ĐI TỪ NÚT "CHAT NGƯỜI BÁN"
           ================================================= */

        if (sellerId) {

            console.log(
                "IUH SHOP - Mở chat người bán:",
                {
                    sellerId,
                    productId,
                    productName
                }
            );


            /* -----------------------------------------
               KHÔNG CHO CHAT VỚI CHÍNH MÌNH
               ----------------------------------------- */

            if (
                String(sellerId) ===
                String(currentUser.id)
            ) {

                showToast(
                    "Bạn không thể nhắn tin cho chính mình."
                );

                return;
            }


            /* -----------------------------------------
               TÌM CHAT ĐÃ CÓ
               ----------------------------------------- */

            let conversationId =
                await findConversationWithUser(
                    sellerId
                );


            /* -----------------------------------------
               CHƯA CÓ CHAT → TẠO CHAT MỚI
               ----------------------------------------- */

            if (!conversationId) {

                console.log(
                    "IUH SHOP - Chưa có chat, đang tạo..."
                );


                const newConversation =
                    await createConversation(
                        sellerId,
                        false
                    );


                if (
                    !newConversation ||
                    !newConversation.id
                ) {

                    throw new Error(
                        "Không thể tạo cuộc trò chuyện với người bán."
                    );
                }


                conversationId =
                    newConversation.id;


                console.log(
                    "IUH SHOP - Đã tạo conversation:",
                    conversationId
                );


                /*
                   Load lại danh sách để
                   conversation mới xuất hiện
                   trong danh sách bên trái.
                */

                await loadConversations();

              /* -----------------------------------------
   TÌM LẠI TRONG MẢNG conversations
----------------------------------------- */

const targetConversation =
    conversations.find(
        conversation =>
            String(
                conversation.id
            ) ===
            String(
                conversationId
            )
    );


if (targetConversation) {

    await openConversation(
        targetConversation.id
    );

}
else {

    console.error(
        "Không tìm thấy conversation vừa tạo:",
        conversationId
    );

    showToast(
        "Không thể mở cuộc trò chuyện."
    );
}


return;
            }


            /* -----------------------------------------
               TÌM LẠI TRONG MẢNG conversations
               ----------------------------------------- */

            const targetConversation =
                conversations.find(
                    conversation =>
                        String(
                            conversation.id
                        ) ===
                        String(
                            conversationId
                        )
                );


            if (targetConversation) {

                /*
                   MỞ ĐÚNG ĐOẠN CHAT NGƯỜI BÁN
                */

                await openConversation(
                    targetConversation.id
                );

            }
            else {

                console.error(
                    "Không tìm thấy conversation vừa tạo:",
                    conversationId
                );

                showToast(
                    "Không thể mở cuộc trò chuyện."
                );
            }


            /*
               QUAN TRỌNG:

               Có sellerId thì KHÔNG mở Admin.
            */

            return;
        }


        /* =================================================
           KHÔNG CÓ sellerId
           
           → KHÔNG TỰ ĐỘNG MỞ CHAT NÀO
           
           → Hiện màn hình chờ
           
           Đây chính là hành vi bạn yêu cầu trước đó.
           ================================================= */

        console.log(
            "IUH SHOP - Không có chat được chọn."
        );


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
    async function() {

        setupAccountDropdown();

        setupLogout();

        setupAccountShortcuts();

        setupActiveMenu();

        await initChat();
    }
);