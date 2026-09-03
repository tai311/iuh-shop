/* =========================================================
   IUH SHOP - GLOBAL CHAT NOTIFICATION
   Bóng chat + thông báo web + browser notification

   Chức năng:
   - Hoạt động trên mọi trang sau khi đăng nhập
   - Không hoạt động ở đăng nhập / đăng ký
   - Hiện avatar người gửi
   - Hiện số tin chưa đọc
   - Nhiều người nhắn → nhiều bóng
   - Hover → hiện tên + nội dung
   - Nút X → chỉ tắt bóng, KHÔNG đánh dấu đã đọc
   - Click bóng → mở đúng cuộc trò chuyện
   - Đang mở đúng cuộc trò chuyện → không hiện bóng
   - Load lại website → lấy lại tin chưa đọc từ database
   - Tin gửi khi tắt máy vẫn được phát hiện khi đăng nhập lại
   - Browser notification
   ========================================================= */

(() => {

    "use strict";


    /* =========================================================
       1. SUPABASE
       ========================================================= */

    const SUPABASE_URL =
        "https://xecxofmogvqysejjpxvl.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY =
        "sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC";


    if (!window.supabase) {

        console.error(
            "IUH SHOP Chat Notification: chưa load Supabase."
        );

        return;
    }


    const supabaseClient =
    window.IUH_SUPABASE ||
    (
        window.IUH_SUPABASE =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY
            )
    );


    /* =========================================================
       2. CONFIG
       ========================================================= */

    const CHAT_PAGE =
        "tinnhan.html";


    /*
     * Nếu bạn có ảnh avatar mặc định khác
     * thì sửa đường dẫn này.
     */
    const DEFAULT_AVATAR =
        "../Images/default-avatar.svg";

    function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


    let currentUser =
        null;


    /*
     * Conversation hiện đang được mở
     * trên trang tinnhan.html.
     */
    let currentConversationId =
        null;


    let realtimeChannel =
        null;


    /*
     * Lưu các bóng chat đang tồn tại.

     * conversationId
     *      ↓
     * DOM bubble
     */
    const notificationBubbles =
        new Map();


    /* =========================================================
       3. LƯU TRẠNG THÁI BẤM X
       ========================================================= */

    /*
     * Khi người dùng bấm X,
     * bóng sẽ biến mất.

     * Nhưng tin vẫn chưa đọc.

     * sessionStorage giúp khi chuyển trang,
     * cùng một tin đã tắt không lập tức hiện lại.
     *
     * Khi có tin mới → trạng thái cũ bị xóa.
     */

    const DISMISSED_KEY =
        "iuh_shop_dismissed_chat_notifications";


    function getDismissedMap() {

        try {

            return JSON.parse(
                sessionStorage.getItem(
                    DISMISSED_KEY
                ) || "{}"
            );

        }
        catch {

            return {};

        }

    }


    function saveDismissedMap(
        map
    ) {

        try {

            sessionStorage.setItem(
                DISMISSED_KEY,
                JSON.stringify(map)
            );

        }
        catch {

            /*
             * Không làm hỏng hệ thống
             * nếu storage bị chặn.
             */

        }

    }


    function isDismissed(
        conversationId,
        latestMessageId
    ) {

        const map =
            getDismissedMap();


        return (
            map[conversationId] ===
            latestMessageId
        );

    }


    function dismissNotification(
        conversationId,
        latestMessageId
    ) {

        const map =
            getDismissedMap();


        map[conversationId] =
            latestMessageId;


        saveDismissedMap(
            map
        );

    }


    /* =========================================================
       4. KIỂM TRA TRANG
       ========================================================= */

    function getPageName() {

        return (
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase()
        );

    }


    function isAuthPage() {

        const page =
            getPageName();


        return [

            "dangnhap.html",

            "dang-nhap.html",

            "dangky.html",

            "dang-ky.html"

        ].includes(page);

    }


    /* =========================================================
       5. LẤY CONVERSATION ĐANG MỞ
       ========================================================= */

    function readCurrentConversationFromUrl() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        return params.get(
            "conversation"
        );

    }


    /* =========================================================
       6. MỞ CHAT
       ========================================================= */

    function openConversation(
        otherUserId
    ) {

        if (!otherUserId) {

            return;

        }


        const url =
            `${CHAT_PAGE}?seller=${encodeURIComponent(
                otherUserId
            )}`;


        window.location.href =
            url;

    }


    /* =========================================================
       7. TẠO CONTAINER CHỨA BÓNG
       ========================================================= */

    function ensureNotificationRoot() {

        let root =
            document.getElementById(
                "iuhGlobalChatNotifications"
            );


        if (root) {

            return root;

        }


        root =
            document.createElement(
                "div"
            );


        root.id =
            "iuhGlobalChatNotifications";


        root.className =
            "iuh-global-chat-notifications";


        document.body.appendChild(
            root
        );


        return root;

    }


    /* =========================================================
       8. LẤY PREVIEW TIN NHẮN
       ========================================================= */

    function getMessagePreview(
        message
    ) {

        if (!message) {

            return "Bạn có tin nhắn mới";

        }


        if (
            message.recalled_at
        ) {

            return "Tin nhắn đã được thu hồi";

        }


        if (
            message.content
        ) {

            return message.content;

        }


        if (
            message.image_url
        ) {

            return "📷 Hình ảnh";

        }


        return "Bạn có tin nhắn mới";

    }

   /* =========================================================
   MINI CHAT
   ========================================================= */

let activeMiniChat = null;


/* =========================================================
   RENDER REACTION SUMMARY
   ========================================================= */

function renderMiniReactionSummary(
    message,
    wrapper
) {

    const reactions =
        message.reactions || [];


    if (!reactions.length) {
        return;
    }


    const grouped = {};


    reactions.forEach(
        item => {

            grouped[item.reaction] =
                (
                    grouped[item.reaction] ||
                    0
                ) + 1;

        }
    );


    const summary =
        document.createElement("div");

    summary.className =
        "iuh-mini-reaction-summary";


    Object.entries(grouped)
        .forEach(
            ([emoji, count]) => {

                const chip =
                    document.createElement("span");

                chip.className =
                    "iuh-mini-reaction-chip";

                chip.textContent =
                    count > 1
                        ? `${emoji} ${count}`
                        : emoji;

                summary.appendChild(
                    chip
                );

            }
        );


    wrapper.appendChild(
        summary
    );

}


/* =========================================================
   ACTIONS CỦA TIN NHẮN
   ========================================================= */

function createMiniMessageActions(
    message,
    mine,
    container
) {

    if (
        message.recalled_at
    ) {

        return null;

    }


    const actions =
        document.createElement("div");

    actions.className =
        "iuh-mini-message-actions";


    /* ===============================
       REACTION
       =============================== */

    const reactionButton =
        document.createElement("button");

    reactionButton.type =
        "button";

    reactionButton.className =
        "iuh-mini-action-btn";

    reactionButton.textContent =
        "☺";

    reactionButton.title =
        "Thả cảm xúc";


    const picker =
        document.createElement("div");

    picker.className =
        "iuh-mini-reaction-picker";


    [
        "👍",
        "❤️",
        "😂",
        "😮",
        "😢"
    ].forEach(
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
                async event => {

                    event.stopPropagation();

                    await toggleMiniReaction(
                        message,
                        emoji
                    );

                    picker.classList.remove(
                        "show"
                    );

                }
            );


            picker.appendChild(
                button
            );

        }
    );


    reactionButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            picker.classList.toggle(
                "show"
            );

        }
    );


    actions.appendChild(
        reactionButton
    );

    actions.appendChild(
        picker
    );


    /* ===============================
       TIN CỦA MÌNH
       =============================== */

    if (mine) {

        /* CHỈNH SỬA */

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
                "iuh-mini-action-btn";

            editButton.textContent =
                "✎";

            editButton.title =
                "Chỉnh sửa";


            editButton.addEventListener(
                "click",
                async event => {

                    event.stopPropagation();

                    await editMiniMessage(
                        message
                    );

                }
            );


            actions.appendChild(
                editButton
            );

        }


        /* THU HỒI */

        const recallButton =
            document.createElement(
                "button"
            );

        recallButton.type =
            "button";

        recallButton.className =
            "iuh-mini-action-btn";

        recallButton.textContent =
            "↩";

        recallButton.title =
            "Thu hồi";


        recallButton.addEventListener(
            "click",
            async event => {

                event.stopPropagation();

                await recallMiniMessage(
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


/* =========================================================
   RENDER 1 MESSAGE
   ========================================================= */

async function renderMiniMessage(
    message,
    container
) {

    const mine =
        message.sender_id ===
        currentUser.id;


    const row =
        document.createElement(
            "div"
        );

    row.className =
        "iuh-mini-message-row " +
        (
            mine
                ? "mine"
                : "other"
        );


    row.dataset.messageId =
        message.id;


    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "iuh-mini-message-wrapper";


    const bubble =
        document.createElement(
            "div"
        );

    bubble.className =
        "iuh-mini-message " +
        (
            mine
                ? "mine"
                : "other"
        );


    /* ===============================
       THU HỒI
       =============================== */

    if (
        message.recalled_at
    ) {

        bubble.classList.add(
            "recalled"
        );

        bubble.textContent =
            "Tin nhắn đã được thu hồi";

    }

    else {

        /* IMAGE */

        if (
            message.image_url
        ) {

            const image =
                document.createElement(
                    "img"
                );

            image.className =
                "iuh-mini-message-image";

            image.src =
                message.image_url;

            image.alt =
                "Hình ảnh";

            image.loading =
                "lazy";


            image.addEventListener(
                "click",
                () => {

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

        if (
            message.content
        ) {

            const text =
                document.createElement(
                    "div"
                );

            text.className =
                "iuh-mini-message-text";

            text.textContent =
                message.content;


            bubble.appendChild(
                text
            );

        }


        /* ĐÃ CHỈNH SỬA */

        if (
            message.edited_at
        ) {

            const edited =
                document.createElement(
                    "span"
                );

            edited.className =
                "iuh-mini-edited";

            edited.textContent =
                "Đã chỉnh sửa";


            bubble.appendChild(
                edited
            );

        }

    }


    wrapper.appendChild(
        bubble
    );


    /* REACTION SUMMARY */

    if (
        !message.recalled_at
    ) {

        renderMiniReactionSummary(
            message,
            wrapper
        );

    }


    /* ACTIONS */

    if (
        !message.recalled_at
    ) {

        const actions =
            createMiniMessageActions(
                message,
                mine,
                container
            );


        if (actions) {

            wrapper.appendChild(
                actions
            );

        }

    }


    row.appendChild(
        wrapper
    );


    container.appendChild(
        row
    );

}


/* =========================================================
   LOAD REACTIONS
   ========================================================= */

async function loadMiniReactions(
    messages
) {

    if (
        !messages?.length
    ) {

        return messages || [];

    }


    const ids =
        messages.map(
            message =>
                message.id
        );


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "message_reactions"
            )
            .select(
                "message_id, user_id, reaction"
            )
            .in(
                "message_id",
                ids
            );


    if (error) {

        console.error(
            "Lỗi reaction mini:",
            error
        );

        return messages;

    }


    const map =
        new Map();


    (data || []).forEach(
        reaction => {

            if (
                !map.has(
                    reaction.message_id
                )
            ) {

                map.set(
                    reaction.message_id,
                    []
                );

            }


            map.get(
                reaction.message_id
            ).push(
                reaction
            );

        }
    );


    return messages.map(
        message => ({

            ...message,

            reactions:
                map.get(
                    message.id
                ) || []

        })
    );

}


/* =========================================================
   LOAD MINI CHAT
   ========================================================= */

async function loadMiniChatMessages(
    conversationId,
    container
) {

    container.innerHTML = `
        <div class="iuh-mini-empty">
            Đang tải tin nhắn...
        </div>
    `;


    const {
        data,
        error
    } =
        await supabaseClient
            .from("messages")
            .select(
              "id, sender_id, product_id, content, image_url, recalled_at, edited_at, created_at, message_type"
            )
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
            "Lỗi load mini chat:",
            error
        );

        container.innerHTML = `
            <div class="iuh-mini-empty">
                Không thể tải tin nhắn.
            </div>
        `;

        return;

    }


    const messages =
        await loadMiniReactions(
            data || []
        );


    container.innerHTML =
        "";


    if (!messages.length) {

        container.innerHTML = `
            <div class="iuh-mini-empty">
                Chưa có tin nhắn.
            </div>
        `;

        return;

    }


    let miniProductCardShown =
    new Set();


for (
    const message
    of messages
) {

    if (
        message.product_id &&
        !miniProductCardShown.has(
            message.product_id
        )
    ) {

        await renderMiniProductCard(
            message.product_id,
            container
        );

        miniProductCardShown.add(
            message.product_id
        );
    }


    await renderMiniMessage(
        message,
        container
    );
}


    container.scrollTop =
        container.scrollHeight;

}


/* =========================================================
   REACTION
   ========================================================= */

async function toggleMiniReaction(
    message,
    emoji
) {

    const existing =
        message.reactions?.find(
            item =>
                item.user_id ===
                currentUser.id
        );


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
                "Lỗi xóa reaction:",
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
                "Lỗi reaction:",
                error
            );

            return;

        }

    }


    if (
        activeMiniChat
    ) {

        await loadMiniChatMessages(
            activeMiniChat.conversationId,
            activeMiniChat.messages
        );

    }

}


/* =========================================================
   CHỈNH SỬA
   ========================================================= */

async function editMiniMessage(
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


    if (
        newContent === null
    ) {

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


    await syncMiniConversationPreview(
        activeMiniChat.conversationId
    );


    await loadMiniChatMessages(
        activeMiniChat.conversationId,
        activeMiniChat.messages
    );

}


/* =========================================================
   THU HỒI
   ========================================================= */

async function recallMiniMessage(
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


    await syncMiniConversationPreview(
        activeMiniChat.conversationId
    );


    await loadMiniChatMessages(
        activeMiniChat.conversationId,
        activeMiniChat.messages
    );

}


/* =========================================================
   SYNC PREVIEW
   ========================================================= */

async function syncMiniConversationPreview(
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
                    ascending: false
                }
            )
            .limit(1)
            .maybeSingle();


    if (error) {

        console.error(
            "Lỗi sync preview:",
            error
        );

        return;

    }


    let preview =
        null;


    if (data) {

        if (
            data.recalled_at
        ) {

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
                data?.created_at ||
                now

        })
        .eq(
            "id",
            conversationId
        );

}


/* =========================================================
   MỞ MINI CHAT
   ========================================================= */

async function openMiniChat(
    conversationData
) {

    const {

        conversationId,

        user

    } = conversationData;


    closeMiniChat();


    const miniChat =
        document.createElement(
            "div"
        );

    miniChat.className =
        "iuh-mini-chat";


    /* =====================================================
       HEADER
       ===================================================== */

    const header =
        document.createElement(
            "div"
        );

    header.className =
        "iuh-mini-chat-header";


    /* USER */

    const userInfo =
        document.createElement(
            "div"
        );

    userInfo.className =
        "iuh-mini-chat-user";


    const avatar =
        document.createElement(
            "img"
        );

    avatar.src =
        user?.avatar_url ||
        DEFAULT_AVATAR;

    avatar.onerror =
        function() {

            this.src =
                DEFAULT_AVATAR;

        };


    const name =
    document.createElement(
        "div"
    );

name.className =
    "iuh-mini-chat-name";


const nameText =
    document.createElement(
        "span"
    );

nameText.className =
    "iuh-mini-chat-name-text";

nameText.textContent =
    user?.fullname ||
    "Người dùng";


name.appendChild(
    nameText
);


/* TÍCH XANH */

if (
    user?.hasVerifiedBadge
) {

    const badge =
        document.createElement(
            "span"
        );

    badge.className =
        "iuh-mini-chat-verified";

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


    name.appendChild(
        badge
    );

}


    /*
     * CHỈ TÊN được click
     * → mở trang tinnhan.html
     */

    name.title =
        "Mở trang tin nhắn";


    name.addEventListener(
        "click",
        () => {

            openConversation(
                user?.id
            );

        }
    );


    userInfo.appendChild(
        avatar
    );

    userInfo.appendChild(
        name
    );


    /* =====================================================
       HEADER BUTTONS
       ===================================================== */

    const headerButtons =
        document.createElement(
            "div"
        );

    headerButtons.className =
        "iuh-mini-chat-header-buttons";


    /* THU NHỎ */

    const minimizeButton =
        document.createElement(
            "button"
        );

    minimizeButton.type =
        "button";

    minimizeButton.className =
        "iuh-mini-chat-minimize";

    minimizeButton.innerHTML =
        "−";

    minimizeButton.title =
        "Thu nhỏ thành bong bóng";


    minimizeButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            /*
             * Lấy tin cuối để khi thu nhỏ
             * bóng vẫn có preview đúng.
             */

            minimizeMiniChat(
                conversationData
            );

        }
    );


    /* ĐÓNG */

    const closeButton =
        document.createElement(
            "button"
        );

    closeButton.type =
        "button";

    closeButton.className =
        "iuh-mini-chat-close";

    closeButton.innerHTML =
        "×";

    closeButton.title =
        "Đóng";


    closeButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            closeMiniChat();

        }
    );


    headerButtons.appendChild(
        minimizeButton
    );

    headerButtons.appendChild(
        closeButton
    );


    header.appendChild(
        userInfo
    );

    header.appendChild(
        headerButtons
    );


    /* =====================================================
       MESSAGE AREA
       ===================================================== */

    const messages =
        document.createElement(
            "div"
        );

    messages.className =
        "iuh-mini-chat-messages";


    /* =====================================================
       INPUT
       ===================================================== */

    const inputArea =
        document.createElement(
            "div"
        );

    inputArea.className =
        "iuh-mini-chat-input-area";


    const input =
        document.createElement(
            "input"
        );

    input.type =
        "text";

    input.className =
        "iuh-mini-chat-input";

    input.placeholder =
        "Nhập tin nhắn...";


    const sendButton =
        document.createElement(
            "button"
        );

    sendButton.type =
        "button";

    sendButton.className =
        "iuh-mini-chat-send";

    sendButton.innerHTML =
        "➤";


    inputArea.appendChild(
        input
    );

    inputArea.appendChild(
        sendButton
    );


    /* =====================================================
       GẮN MINI CHAT
       ===================================================== */

    miniChat.appendChild(
        header
    );

    miniChat.appendChild(
        messages
    );

    miniChat.appendChild(
        inputArea
    );


    document.body.appendChild(
        miniChat
    );


    activeMiniChat = {

        element:
            miniChat,

        conversationId:
            conversationId,

        user:
            user,

        messages:
            messages,

        input:
            input

    };


    requestAnimationFrame(
        () => {

            miniChat.classList.add(
                "show"
            );

        }
    );


    /* LOAD */

    await loadMiniChatMessages(
        conversationId,
        messages
    );


    /* MARK READ */

    await markMiniChatAsRead(
        conversationId
    );


    /* BÓNG BIẾN MẤT */

    removeBubble(
        conversationId
    );


    /* SEND */

    sendButton.addEventListener(
        "click",
        () => {

            sendMiniChatMessage(
                conversationId,
                input,
                messages
            );

        }
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                sendMiniChatMessage(
                    conversationId,
                    input,
                    messages
                );

            }

        }
    );


    input.focus();

}


/* =========================================================
   THU NHỎ → TRỞ LẠI BÓNG
   ========================================================= */

async function minimizeMiniChat(
    conversationData
) {

    closeMiniChat();


    /*
     * Chat đã đọc hết nên unread = 0.
     * Bóng vẫn tồn tại nhưng không có chấm đỏ.
     */

    createBubble({

        ...conversationData,

        unreadCount:
            0

    });

}


/* =========================================================
   ĐÓNG MINI CHAT
   ========================================================= */

function closeMiniChat() {

    if (
        !activeMiniChat
    ) {

        return;

    }


    const element =
        activeMiniChat.element;


    element.classList.remove(
        "show"
    );


    setTimeout(
        () => {

            element.remove();

        },
        180
    );


    activeMiniChat =
        null;

}


/* =========================================================
   MARK READ
   ========================================================= */

async function markMiniChatAsRead(
    conversationId
) {

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
            "Lỗi mark read:",
            error
        );

    }

}


/* =========================================================
   GỬI TIN
   ========================================================= */

async function sendMiniChatMessage(
    conversationId,
    input,
    container
) {

    const content =
        input.value.trim();


    if (!content) {

        return;

    }


    input.disabled =
        true;


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("messages")
                .insert({

                    conversation_id:
                        conversationId,

                    sender_id:
                        currentUser.id,

                    content:
                        content,

                    message_type:
                        "text",

                    image_url:
                        null,

                    is_read:
                        false

                })
                .select()
                .single();


        if (error) {

            console.error(
                "Lỗi gửi mini chat:",
                error
            );

            alert(
                "Không thể gửi tin nhắn."
            );

            return;

        }


        input.value =
            "";


        /*
         * Tự render ngay.
         * Không phải chờ Realtime.
         */

        await loadMiniChatMessages(
            conversationId,
            container
        );


        await syncMiniConversationPreview(
            conversationId
        );


        container.scrollTop =
            container.scrollHeight;

    }

    finally {

        input.disabled =
            false;

        input.focus();

    }

}


/* =========================================================
   REALTIME → MINI CHAT
   ========================================================= */

async function appendIncomingMiniMessage(
    message
) {

    if (
        !activeMiniChat
    ) {

        return false;

    }


    if (
        activeMiniChat.conversationId !==
        message.conversation_id
    ) {

        return false;

    }


    /*
     * Lấy reaction của tin mới.
     */

    const {
        data:
            reactions
    } =
        await supabaseClient
            .from(
                "message_reactions"
            )
            .select(
                "message_id, user_id, reaction"
            )
            .eq(
                "message_id",
                message.id
            );


    const fullMessage = {

        ...message,

        reactions:
            reactions || []

    };


    const existing =
        activeMiniChat.messages
            .querySelector(
                `[data-message-id="${message.id}"]`
            );


    if (!existing) {

        await renderMiniMessage(
            fullMessage,
            activeMiniChat.messages
        );

    }


    activeMiniChat.messages.scrollTop =
        activeMiniChat.messages.scrollHeight;


    /*
     * Mini chat đang mở → đọc ngay.
     */

    await markMiniChatAsRead(
        message.conversation_id
    );


    return true;

}


/* =========================================================
   ĐÓNG MINI CHAT
   ========================================================= */

function closeMiniChat() {

    if (
        !activeMiniChat
    ) {

        return;

    }


    const element =
        activeMiniChat.element;


    element.classList.remove(
        "show"
    );


    setTimeout(
        () => {

            element.remove();

        },
        180
    );


    activeMiniChat =
        null;

}


    /* =========================================================
       9. TẠO BÓNG CHAT
       ========================================================= */

    function createBubble(
        conversationData
    ) {

        const {

            conversationId,

            user,

            unreadCount,

            latestMessage

        } = conversationData;


        const root =
            ensureNotificationRoot();


        /*
         * Nếu bóng đã tồn tại
         * → chỉ cập nhật.
         */

        const oldBubble =
            notificationBubbles.get(
                conversationId
            );


        if (oldBubble) {

            updateBubble(
                oldBubble,
                conversationData
            );

            return;

        }


        const bubble =
            document.createElement(
                "div"
            );


        bubble.className =
            "iuh-chat-bubble";


        bubble.dataset.conversationId =
            conversationId;


        /* =====================================================
           AVATAR
           ===================================================== */

        const avatarWrap =
            document.createElement(
                "div"
            );


        avatarWrap.className =
            "iuh-chat-bubble-avatar";


        const img =
            document.createElement(
                "img"
            );


        img.src =
            user?.avatar_url ||
            DEFAULT_AVATAR;


        img.alt =
            user?.fullname ||
            "Người dùng";


        img.onerror =
            function() {

                if (
                    this.src.includes(
                        DEFAULT_AVATAR
                    )
                ) {

                    return;

                }


                this.src =
                    DEFAULT_AVATAR;

            };


        avatarWrap.appendChild(
            img
        );


        /* =====================================================
           BADGE
           ===================================================== */

        const badge =
            document.createElement(
                "span"
            );


        badge.className =
            "iuh-chat-bubble-badge";


        if (unreadCount > 0) {

    badge.textContent =
        unreadCount > 99
            ? "99+"
            : String(unreadCount);

    if (unreadCount >= 10) {
        badge.classList.add("wide");
    }

}
else {

    badge.style.display =
        "none";

}


        avatarWrap.appendChild(
            badge
        );


        /* =====================================================
           NÚT X
           ===================================================== */

        const closeButton =
            document.createElement(
                "button"
            );


        closeButton.type =
            "button";


        closeButton.className =
            "iuh-chat-bubble-close";


        closeButton.setAttribute(
            "aria-label",
            "Tắt thông báo chat"
        );


        closeButton.innerHTML =
            "×";


        /* =====================================================
           TÊN NGƯỜI GỬI
           ===================================================== */

        const tooltip =
            document.createElement(
                "div"
            );


        tooltip.className =
            "iuh-chat-bubble-tooltip";


        tooltip.textContent =
            user?.fullname ||
            "Tin nhắn mới";


        /* =====================================================
           PREVIEW
           ===================================================== */

        const messagePreview =
            document.createElement(
                "div"
            );


        messagePreview.className =
            "iuh-chat-bubble-preview";


        messagePreview.textContent =
            getMessagePreview(
                latestMessage
            );


        /* =====================================================
           GẮN VÀO BÓNG
           ===================================================== */

        bubble.appendChild(
            avatarWrap
        );


        bubble.appendChild(
            tooltip
        );


        bubble.appendChild(
            messagePreview
        );


        bubble.appendChild(
            closeButton
        );


        /* =====================================================
           CLICK X
           ===================================================== */

        closeButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                /*
                 * Chỉ tắt bóng.
                 *
                 * KHÔNG mark read.
                 */

                dismissNotification(
                    conversationId,
                    latestMessage?.id || ""
                );


                removeBubble(
                    conversationId
                );

            }
        );


        /* =====================================================
           CLICK BÓNG
           ===================================================== */

        bubble.addEventListener(
    "click",
    event => {

        if (
            event.target.closest(
                ".iuh-chat-bubble-close"
            )
        ) {
            return;
        }

        openMiniChat(
            conversationData
        );

    }
);


        root.appendChild(
            bubble
        );


        notificationBubbles.set(
            conversationId,
            bubble
        );


        /*
         * Browser notification.
         */

        maybeSendBrowserNotification(
            conversationData
        );


        reorderBubbles();

    }


    /* =========================================================
       10. UPDATE BÓNG
       ========================================================= */

    function updateBubble(
        bubble,
        conversationData
    ) {

        const {

            user,

            unreadCount,

            latestMessage

        } = conversationData;


        const badge =
            bubble.querySelector(
                ".iuh-chat-bubble-badge"
            );


        if (badge) {

           if (badge) {

    if (unreadCount > 0) {

        badge.style.display =
            "flex";

        badge.textContent =
            unreadCount > 99
                ? "99+"
                : String(unreadCount);

        badge.classList.toggle(
            "wide",
            unreadCount >= 10
        );

    }
    else {

        badge.style.display =
            "none";

    }

}

        }


        const tooltip =
            bubble.querySelector(
                ".iuh-chat-bubble-tooltip"
            );


        if (tooltip) {

            tooltip.textContent =
                user?.fullname ||
                "Tin nhắn mới";

        }


        const preview =
            bubble.querySelector(
                ".iuh-chat-bubble-preview"
            );


        if (preview) {

            preview.textContent =
                getMessagePreview(
                    latestMessage
                );

        }


        const img =
            bubble.querySelector(
                ".iuh-chat-bubble-avatar img"
            );


        if (
            img &&
            user?.avatar_url
        ) {

            img.src =
                user.avatar_url;

        }


        maybeSendBrowserNotification(
            conversationData
        );


        reorderBubbles();

    }


    /* =========================================================
       11. XÓA BÓNG
       ========================================================= */

    function removeBubble(
        conversationId
    ) {

        const bubble =
            notificationBubbles.get(
                conversationId
            );


        if (!bubble) {

            return;

        }


        bubble.classList.remove(
            "show"
        );


        setTimeout(
            () => {

                bubble.remove();

            },
            180
        );


        notificationBubbles.delete(
            conversationId
        );

    }


    /* =========================================================
       12. XÓA TẤT CẢ
       ========================================================= */

    function removeAllBubbles() {

        notificationBubbles.forEach(
            bubble => {

                bubble.remove();

            }
        );


        notificationBubbles.clear();

    }


    /* =========================================================
       13. SẮP XẾP BÓNG
       ========================================================= */

    function reorderBubbles() {

        const root =
            document.getElementById(
                "iuhGlobalChatNotifications"
            );


        if (!root) {

            return;

        }


        Array.from(
            notificationBubbles.values()
        ).forEach(
            bubble => {

                root.appendChild(
                    bubble
                );

            }
        );

    }


    /* =========================================================
       14. LẤY USER HIỆN TẠI
       ========================================================= */

    async function getCurrentUser() {

        const {

            data,

            error

        } =
            await supabaseClient.auth.getUser();


        if (error) {

            console.error(
                "IUH SHOP notification auth:",
                error
            );

            return null;

        }


        return data?.user ||
            null;

    }


    /* =========================================================
       15. LẤY PROFILE
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
    "user_id, fullname, avatar_url, role, student_verified"
)
                .eq(
                    "user_id",
                    userId
                )
                .maybeSingle();


        if (error) {

            console.error(
                "IUH SHOP notification profile:",
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
       16. LẤY CONVERSATION CỦA USER
       ========================================================= */

    async function getConversationIds() {

        const {

            data,

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
                "IUH SHOP notification memberships:",
                error
            );

            return [];

        }


        return (
            data || []
        ).map(
            item =>
                item.conversation_id
        );

    }


    /* =========================================================
       17. LẤY TIN CHƯA ĐỌC
       ========================================================= */

    async function getUnreadMessages() {

        const ids =
            await getConversationIds();


        if (!ids.length) {

            return [];

        }


        /*
         * Chỉ lấy:
         *
         * is_read = false
         * sender_id != currentUser
         */

        const {

            data,

            error

        } =
            await supabaseClient
                .from("messages")
                .select(
                    "id, conversation_id, sender_id, content, image_url, recalled_at, created_at, is_read"
                )
                .in(
                    "conversation_id",
                    ids
                )
                .eq(
                    "is_read",
                    false
                )
                .neq(
                    "sender_id",
                    currentUser.id
                )
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );


        if (error) {

            console.error(
                "IUH SHOP notification unread:",
                error
            );

            return [];

        }


        return data || [];

    }


    /* =========================================================
       18. NHÓM TIN THEO CONVERSATION
       ========================================================= */

    async function buildNotificationData(
        messages
    ) {

        const grouped =
            new Map();


        for (
            const message
            of messages
        ) {

            if (
                !grouped.has(
                    message.conversation_id
                )
            ) {

                grouped.set(
                    message.conversation_id,
                    []
                );

            }


            grouped
                .get(
                    message.conversation_id
                )
                .push(
                    message
                );

        }


        const result =
            [];


        for (
            const [
                conversationId,
                conversationMessages
            ]
            of grouped.entries()
        ) {

            const latestMessage =
                conversationMessages[
                    conversationMessages.length - 1
                ];


            const senderId =
                latestMessage.sender_id;


            const user =
                await getUserProfile(
                    senderId
                );


            if (!user) {

                continue;

            }


            result.push({

                conversationId,

                user,

                unreadCount:
                    conversationMessages.length,

                latestMessage

            });

        }


        return result;

    }


    /* =========================================================
       19. XIN QUYỀN BROWSER NOTIFICATION
       ========================================================= */

    async function requestBrowserNotificationPermission() {

        if (
            !("Notification" in window)
        ) {

            return false;

        }


        if (
            Notification.permission ===
            "granted"
        ) {

            return true;

        }


        if (
            Notification.permission ===
            "denied"
        ) {

            return false;

        }


        try {

            const permission =
                await Notification.requestPermission();


            return (
                permission ===
                "granted"
            );

        }
        catch {

            return false;

        }

    }


    /* =========================================================
       20. BROWSER NOTIFICATION
       ========================================================= */

    async function maybeSendBrowserNotification(
        data
    ) {

        if (
            !("Notification" in window)
        ) {

            return;

        }


        /*
         * Nếu đang ở đúng trang chat
         * thì không spam browser notification.
         */

        if (

            document.visibilityState ===
                "visible"

            &&

            getPageName() ===
                "tinnhan.html"

        ) {

            return;

        }


        const granted =
            await requestBrowserNotificationPermission();


        if (!granted) {

            return;

        }


        const name =
            data.user?.fullname ||
            "Người dùng";


        const body =
            data.unreadCount > 1

                ? `${data.unreadCount} tin nhắn mới`

                : getMessagePreview(
                    data.latestMessage
                );


        const notification =
            new Notification(
                name,
                {

                    body,

                    icon:
                        data.user?.avatar_url ||
                        DEFAULT_AVATAR,

                    tag:
                        "iuh-shop-chat-" +
                        data.conversationId,

                    renotify:
                        true

                }
            );


        notification.onclick =
            () => {

                window.focus();


                openConversation(
                    data.user?.id
                );


                notification.close();

            };

    }


    /* =========================================================
       21. LOAD TIN OFFLINE
       ========================================================= */

    async function loadOfflineNotifications() {

        if (!currentUser) {

            return;

        }


        const unread =
            await getUnreadMessages();


        if (!unread.length) {

            return;

        }


        const notificationData =
            await buildNotificationData(
                unread
            );


        for (
            const data
            of notificationData
        ) {

            /*
             * Nếu user đã bấm X cho tin cuối
             * thì không hiện lại trong session hiện tại.
             */

            if (
                isDismissed(
                    data.conversationId,
                    data.latestMessage?.id
                )
            ) {

                continue;

            }


            /*
             * Nếu đang mở đúng conversation
             * thì không hiện bóng.
             */

            if (
                currentConversationId &&
                currentConversationId ===
                    data.conversationId
            ) {

                continue;

            }


            createBubble(
                data
            );

        }

    }


    /* =========================================================
       22. REALTIME
       ========================================================= */

    function subscribeRealtime() {

        if (
            realtimeChannel
        ) {

            supabaseClient.removeChannel(
                realtimeChannel
            );

        }


        realtimeChannel =
            supabaseClient
                .channel(
                    "global-chat-notification-" +
                    currentUser.id
                )


                .on(
                    "postgres_changes",

                    {

                        event:
                            "INSERT",

                        schema:
                            "public",

                        table:
                            "messages"

                    },


                    async payload => {

                        const message =
                            payload.new;


                        /*
                         * Không báo tin của chính mình.
                         */

                        if (
                            message.sender_id ===
                            currentUser.id
                        ) {

                            return;

                        }


                        /*
                         * Kiểm tra user có thuộc
                         * conversation này không.
                         */

                        const {

                            data: membership,

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
                                    "conversation_id",
                                    message.conversation_id
                                )
                                .eq(
                                    "user_id",
                                    currentUser.id
                                )
                                .maybeSingle();


                        if (
                            error ||
                            !membership
                        ) {

                            return;

                        }


                        /*
                         * Nếu đang mở đúng chat
                         * → không hiện bóng.
                         */

                        if (

                            currentConversationId

                            &&

                            currentConversationId ===
                                message.conversation_id

                        ) {

                            return;

                        }


                        /*
                         * Lấy toàn bộ tin chưa đọc
                         * của conversation.
                         */

                        const {

                            data:
                                unreadMessages

                        } =
                            await supabaseClient
                                .from(
                                    "messages"
                                )
                                .select(
                                    "id, conversation_id, sender_id, content, image_url, recalled_at, created_at"
                                )
                                .eq(
                                    "conversation_id",
                                    message.conversation_id
                                )
                                .eq(
                                    "is_read",
                                    false
                                )
                                .neq(
                                    "sender_id",
                                    currentUser.id
                                )
                                .order(
                                    "created_at",
                                    {
                                        ascending:
                                            true
                                    }
                                );


                        const unreadList =
                            unreadMessages ||
                            [message];


                        const latest =
                            unreadList[
                                unreadList.length - 1
                            ];


                        const user =
                            await getUserProfile(
                                latest.sender_id
                            );


                        if (!user) {

                            return;

                        }


                        /*
                         * Tin mới → tin cũ đã X
                         * không còn được xem là dismissed.
                         */

                        const map =
                            getDismissedMap();


                        if (
                            map[
                                message.conversation_id
                            ]
                        ) {

                            delete map[
                                message.conversation_id
                            ];


                            saveDismissedMap(
                                map
                            );

                        }


                        createBubble({

                            conversationId:
                                message.conversation_id,

                            user,

                            unreadCount:
                                unreadList.length,

                            latestMessage:
                                latest

                        });

                    }

                )


                .subscribe(
                    status => {

                        console.log(
                            "IUH SHOP Global Chat Notification:",
                            status
                        );

                    }
                );

    }


    /* =========================================================
       23. KHI USER QUAY LẠI TAB
       ========================================================= */

    document.addEventListener(
        "visibilitychange",
        async () => {

            if (
                document.visibilityState ===
                "visible"
            ) {

                await loadOfflineNotifications();

            }

        }
    );


    /* =========================================================
       24. INIT
       ========================================================= */

    async function init() {

        /*
         * Không chạy ở đăng nhập / đăng ký.
         */

        if (
            isAuthPage()
        ) {

            return;

        }


        currentUser =
            await getCurrentUser();


        /*
         * Chưa đăng nhập
         * → không hiện bóng.
         */

        if (!currentUser) {

            return;

        }


        currentConversationId =
            readCurrentConversationFromUrl();


        /*
         * Tạo container.
         */

        ensureNotificationRoot();


        /*
         * QUAN TRỌNG:
         *
         * Đọc database trước.
         *
         * Nhờ vậy:
         *
         * tắt máy
         * ↓
         * có người gửi tin
         * ↓
         * is_read = false
         * ↓
         * mở lại IUH SHOP
         * ↓
         * bóng xuất hiện
         */

        await loadOfflineNotifications();


        /*
         * Sau đó mới nghe Realtime.
         */

        subscribeRealtime();

    }


    /* =========================================================
       25. DOM READY
       ========================================================= */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    }
    else {

        init();

    }


    /* =========================================================
       26. API CHO TINNHAN.JS
       ========================================================= */

    window.IUHChatNotification = {

        /*
         * tinnhan.js gọi khi mở conversation.
         */

        setCurrentConversation(
            conversationId
        ) {

            currentConversationId =
                conversationId;


            /*
             * Nếu vừa mở conversation
             * thì bóng của conversation đó
             * biến mất.
             */

            if (
                conversationId
            ) {

                removeBubble(
                    conversationId
                );

            }

        },


        /*
         * Cho phép ẩn bóng cụ thể.
         */

        hideConversationBubble(
            conversationId
        ) {

            removeBubble(
                conversationId
            );

        },


        /*
         * Load lại unread.
         */

        reloadUnread() {

            return loadOfflineNotifications();

        },


        /*
         * Xóa tất cả bóng.
         */

        removeAll() {

            removeAllBubbles();

        }

    };

    async function renderMiniProductCard(
    productId,
    container
) {

    if (
        !productId ||
        !container
    ) {
        return;
    }


    const {
        data: product,
        error
    } =
        await supabaseClient
            .from("products")
            .select(`
                id,
                name,
                price,
                image_urls
            `)
            .eq(
                "id",
                productId
            )
            .maybeSingle();


    if (
        error ||
        !product
    ) {
        console.error(
            "Không tải được sản phẩm:",
            error
        );

        return;
    }


    let imageUrl =
        DEFAULT_AVATAR;


    if (
        Array.isArray(
            product.image_urls
        ) &&
        product.image_urls.length
    ) {

        imageUrl =
            product.image_urls[0];

    }


    const card =
        document.createElement(
            "div"
        );

    card.className =
        "iuh-mini-product-card";


    card.innerHTML = `

        <div class="iuh-mini-product-image">
            <img
                src="${escapeHTML(imageUrl)}"
                alt="${escapeHTML(
                    product.name ||
                    "Sản phẩm"
                )}"
            >
        </div>

        <div class="iuh-mini-product-info">

            <div class="iuh-mini-product-label">
                SẢN PHẨM
            </div>

            <div class="iuh-mini-product-name">
                ${escapeHTML(
                    product.name ||
                    "Sản phẩm"
                )}
            </div>

            <div class="iuh-mini-product-price">
                ${
                    Number.isFinite(
                        Number(product.price)
                    )
                        ? Number(
                            product.price
                        ).toLocaleString(
                            "vi-VN"
                        ) + "đ"
                        : "Liên hệ"
                }
            </div>

            <button
                type="button"
                class="iuh-mini-product-button"
            >
                Xem sản phẩm →
            </button>

        </div>
    `;


    card
        .querySelector(
            ".iuh-mini-product-button"
        )
        .addEventListener(
            "click",
            function() {

                window.location.href =
                    `chitietsanpham.html?id=${encodeURIComponent(
                        product.id
                    )}`;

            }
        );


    container.appendChild(
        card
    );
}

})();

