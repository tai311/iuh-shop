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
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY
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

let activeMiniChat =
    null;


async function openMiniChat(
    conversationData
) {

    const {

        conversationId,

        user

    } = conversationData;


    /*
     * Nếu đang mở mini chat khác
     * thì đóng trước.
     */

    closeMiniChat();


    const miniChat =
        document.createElement(
            "div"
        );


    miniChat.className =
        "iuh-mini-chat";


    miniChat.id =
        "iuhMiniChat";


    /* =====================================================
       HEADER
       ===================================================== */

    const header =
        document.createElement(
            "div"
        );


    header.className =
        "iuh-mini-chat-header";


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


    name.textContent =
        user?.fullname ||
        "Người dùng";


    userInfo.appendChild(
        avatar
    );


    userInfo.appendChild(
        name
    );


    const closeButton =
        document.createElement(
            "button"
        );


    closeButton.className =
        "iuh-mini-chat-close";


    closeButton.type =
        "button";


    closeButton.innerHTML =
        "×";


    closeButton.addEventListener(
        "click",
        closeMiniChat
    );


    header.appendChild(
        userInfo
    );


    header.appendChild(
        closeButton
    );


    /* =====================================================
       MESSAGES
       ===================================================== */

    const messages =
        document.createElement(
            "div"
        );


    messages.className =
        "iuh-mini-chat-messages";


    messages.innerHTML = `
        <div class="iuh-mini-empty">
            Đang tải tin nhắn...
        </div>
    `;


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


    input.className =
        "iuh-mini-chat-input";


    input.type =
        "text";


    input.placeholder =
        "Nhập tin nhắn...";


    const sendButton =
        document.createElement(
            "button"
        );


    sendButton.className =
        "iuh-mini-chat-send";


    sendButton.type =
        "button";


    sendButton.innerHTML =
        "➤";


    inputArea.appendChild(
        input
    );


    inputArea.appendChild(
        sendButton
    );


    /* =====================================================
       GẮN CỬA SỔ
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

        conversationId,

        user,

        messages,

        input

    };


    requestAnimationFrame(
        () => {

            miniChat.classList.add(
                "show"
            );

        }
    );


    /* =====================================================
       LOAD TIN
       ===================================================== */

    await loadMiniChatMessages(
        conversationId,
        messages
    );


    /*
     * Đánh dấu đã đọc khi thực sự mở chat.
     */

    await markMiniChatAsRead(
        conversationId
    );


    /*
     * Bóng của conversation này biến mất.
     */

    removeBubble(
        conversationId
    );


    /*
     * Gửi bằng nút.
     */

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


    /*
     * Enter để gửi.
     */

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
   LOAD TIN NHẮN
   ========================================================= */

async function loadMiniChatMessages(
    conversationId,
    container
) {

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
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "Load mini chat:",
            error
        );


        container.innerHTML = `
            <div class="iuh-mini-empty">
                Không thể tải tin nhắn.
            </div>
        `;

        return;

    }


    container.innerHTML =
        "";


    if (
        !data ||
        !data.length
    ) {

        container.innerHTML = `
            <div class="iuh-mini-empty">
                Chưa có tin nhắn.
            </div>
        `;

        return;

    }


    data.forEach(
        message => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "iuh-mini-message " +
                (
                    message.sender_id ===
                    currentUser.id
                        ? "mine"
                        : "other"
                );


            if (
                message.recalled_at
            ) {

                item.textContent =
                    "Tin nhắn đã được thu hồi";

            }
            else if (
                message.content
            ) {

                item.textContent =
                    message.content;

            }
            else if (
                message.image_url
            ) {

                item.textContent =
                    "📷 Hình ảnh";

            }


            container.appendChild(
                item
            );

        }
    );


    container.scrollTop =
        container.scrollHeight;

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
                is_read: true
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
            "Mark mini chat read:",
            error
        );

    }

}


/* =========================================================
   GỬI TIN NHẮN
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

                    is_read:
                        false

                })
                .select()
                .single();


        if (error) {

            console.error(
                "Send mini chat:",
                error
            );

            alert(
                "Không thể gửi tin nhắn."
            );

            return;

        }


        const item =
            document.createElement(
                "div"
            );


        item.className =
            "iuh-mini-message mine";


        item.textContent =
            data.content;


        container.appendChild(
            item
        );


        container.scrollTop =
            container.scrollHeight;


        input.value =
            "";

    }
    finally {

        input.disabled =
            false;

        input.focus();

    }

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


        badge.textContent =
            unreadCount > 99
                ? "99+"
                : String(
                    unreadCount || 1
                );


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

            badge.textContent =
                unreadCount > 99
                    ? "99+"
                    : String(
                        unreadCount || 1
                    );

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
                    "user_id, fullname, avatar_url, role"
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
                data.role ||
                "user"

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

})();