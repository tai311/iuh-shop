/* =========================================================
   IUH SHOP FORUM
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


const DEFAULT_AVATAR =
    "../Images/default-avatar.svg";

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


        /* LẤY PHẦN TỬ HEADER */

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


        /* CHƯA ĐĂNG NHẬP */

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


        /* ĐÃ ĐĂNG NHẬP */

        const {
            data: profile
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


        /* ẨN ĐĂNG NHẬP / ĐĂNG KÝ */

        if (loginLink) {
            loginLink.style.display = "none";
        }

        if (registerLink) {
            registerLink.style.display = "none";
        }

        if (divider) {
            divider.style.display = "none";
        }


        /* HIỆN TÀI KHOẢN */

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
   STATE
========================================================= */

let currentUser = null;
let currentProfile = null;

let forumPosts = [];

let currentSort = "newest";

let currentPostType =
    "discussion";

let selectedPostImage =
    null;

let forumRealtimeChannel =
    null;



/* =========================================================
   DOM HELPER
========================================================= */

function $(
    selector,
    parent = document
) {

    return parent.querySelector(
        selector
    );

}


function $$(
    selector,
    parent = document
) {

    return Array.from(
        parent.querySelectorAll(
            selector
        )
    );

}



/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value ?? "";

    return div.innerHTML;

}



/* =========================================================
   USER PROFILE
========================================================= */

async function getProfile(
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
                `
                user_id,
                fullname,
                email,
                avatar_url,
                role,
                student_verified
                `
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


    return data;

}



/* =========================================================
   VERIFIED
========================================================= */

function hasVerifiedBadge(
    profile
) {

    if (!profile) {
        return false;
    }


    const role =
        profile.role ||
        "user";


    return (
        role === "admin" ||
        role === "moderator" ||
        profile.student_verified === true
    );

}


function getVerifiedTitle(
    profile
) {

    if (!profile) {
        return "";
    }


    if (
        profile.role ===
        "admin"
    ) {

        return "Tài khoản Admin";

    }


    if (
        profile.role ===
        "moderator"
    ) {

        return "Tài khoản Quản trị viên";

    }


    if (
        profile.student_verified ===
        true
    ) {

        return "Tài khoản đã xác thực sinh viên";

    }


    return "";

}



/* =========================================================
   PROFILE NAME
========================================================= */

function getProfileName(
    profile,
    user
) {

    return (
        profile?.fullname ||
        user?.user_metadata?.fullname ||
        user?.email?.split("@")[0] ||
        "Tài khoản"
    );

}



/* =========================================================
   LOAD CURRENT USER
========================================================= */

async function loadCurrentUser() {

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

        console.error(
            "Auth error:",
            error
        );

    }


    currentUser =
        user || null;


    if (!user) {

        currentProfile =
            null;

        updateForumCurrentAvatar();

        return null;
    }


    currentProfile =
        await getProfile(
            user.id
        );


    updateForumCurrentAvatar();


    return {
        user:
            currentUser,

        profile:
            currentProfile
    };

}



/* =========================================================
   CURRENT AVATAR
========================================================= */

function updateForumCurrentAvatar() {

    const image =
        document.getElementById(
            "forumCurrentAvatar"
        );


    if (!image) {
        return;
    }


    image.src =
        currentProfile?.avatar_url ||
        currentUser?.user_metadata?.avatar_url ||
        DEFAULT_AVATAR;


    image.onerror =
        function () {

            image.src =
                DEFAULT_AVATAR;

        };

}



/* =========================================================
   REQUIRE LOGIN
========================================================= */

function requireLogin() {

    if (currentUser) {
        return true;
    }


    const goLogin =
        confirm(
            "Bạn cần đăng nhập để sử dụng chức năng này.\n\nĐi đến trang đăng nhập?"
        );


    if (goLogin) {

        window.location.href =
            "dangnhap.html";

    }


    return false;

}



/* =========================================================
   TIME AGO
========================================================= */

function timeAgo(
    dateValue
) {

    if (!dateValue) {
        return "";
    }


    const date =
        new Date(
            dateValue
        );


    const diff =
        Date.now() -
        date.getTime();


    const seconds =
        Math.floor(
            diff / 1000
        );


    if (
        seconds <
        60
    ) {

        return "Vừa xong";

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    if (
        minutes <
        60
    ) {

        return `${minutes} phút trước`;

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    if (
        hours <
        24
    ) {

        return `${hours} giờ trước`;

    }


    const days =
        Math.floor(
            hours / 24
        );


    if (
        days <
        7
    ) {

        return `${days} ngày trước`;

    }


    return date
        .toLocaleDateString(
            "vi-VN"
        );

}



/* =========================================================
   MENTION FORMAT
   RAW:
   @[Nguyễn Văn A](USER_UUID)
========================================================= */

function renderMentions(
    rawText
) {

    let safe =
        escapeHTML(
            rawText || ""
        );


    safe =
        safe.replace(
            /@\[(.+?)\]\(([a-f0-9-]{20,})\)/gi,
            function (
                match,
                name,
                userId
            ) {

                return `
                    <a
                        href="trangcanhan.html?id=${encodeURIComponent(userId)}"
                        class="forum-mention"
                    >@${escapeHTML(name)}</a>
                `;

            }
        );


    return safe;

}



/* =========================================================
   GET USERS FOR @
========================================================= */

async function searchMentionUsers(
    keyword
) {

    let query =
        supabaseClient
            .from("users")
            .select(
                `
                user_id,
                fullname,
                avatar_url,
                role,
                student_verified
                `
            )
            .not(
                "fullname",
                "is",
                null
            )
            .limit(8);


    if (keyword) {

        query =
            query.ilike(
                "fullname",
                `%${keyword}%`
            );

    }


    const {
        data,
        error
    } =
        await query;


    if (error) {

        console.error(
            "Mention search error:",
            error
        );

        return [];
    }


    return data || [];

}



/* =========================================================
   SETUP @ MENTION INPUT
========================================================= */

function setupMentionInput(
    input,
    dropdown
) {

    if (
        !input ||
        !dropdown
    ) {

        return;
    }


    let mentionStart =
        -1;


    async function detectMention() {

        const cursor =
            input.selectionStart;


        const before =
            input.value.substring(
                0,
                cursor
            );


        const match =
            before.match(
                /(^|\s)@([^\s@]*)$/
            );


        if (!match) {

            dropdown.classList.remove(
                "show"
            );

            return;

        }


        const keyword =
            match[2] || "";


        mentionStart =
            before.lastIndexOf(
                "@"
            );


        const users =
            await searchMentionUsers(
                keyword
            );


        renderMentionOptions(
            users
        );

    }


    function renderMentionOptions(
        users
    ) {

        if (!users.length) {

            dropdown.classList.remove(
                "show"
            );

            return;

        }


        dropdown.innerHTML =
            users
                .map(
                    user => {

                        const verified =
                            hasVerifiedBadge(
                                user
                            );


                        return `

                            <button
                                type="button"
                                class="mention-option"
                                data-user-id="${user.user_id}"
                                data-user-name="${escapeHTML(user.fullname || "Người dùng")}"
                            >

                                <img
                                    src="${user.avatar_url || DEFAULT_AVATAR}"
                                    alt="Avatar"
                                >

                                <span class="mention-user-info">

                                    <span class="mention-user-name">

                                        ${escapeHTML(user.fullname || "Người dùng")}

                                        ${
                                            verified
                                                ? `
                                                    <span
                                                        class="forum-verified-badge"
                                                        title="${escapeHTML(getVerifiedTitle(user))}"
                                                    >
                                                        <i class="fa-solid fa-check"></i>
                                                    </span>
                                                `
                                                : ""
                                        }

                                    </span>

                                    <small>
                                        Nhắc đến người này
                                    </small>

                                </span>

                            </button>

                        `;

                    }
                )
                .join("");


        dropdown.classList.add(
            "show"
        );


        $$(".mention-option", dropdown)
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function () {

                            const userId =
                                button.dataset.userId;


                            const userName =
                                button.dataset.userName;


                            const cursor =
                                input.selectionStart;


                            const before =
                                input.value.substring(
                                    0,
                                    mentionStart
                                );


                            const after =
                                input.value.substring(
                                    cursor
                                );


                            const token =
                                `@[${userName}](${userId}) `;


                            input.value =
                                before +
                                token +
                                after;


                            const nextPosition =
                                (
                                    before +
                                    token
                                ).length;


                            input.focus();


                            input.setSelectionRange(
                                nextPosition,
                                nextPosition
                            );


                            dropdown.classList.remove(
                                "show"
                            );


                            input.dispatchEvent(
                                new Event(
                                    "input"
                                )
                            );

                        }
                    );

                }
            );

    }


    input.addEventListener(
        "input",
        detectMention
    );


    input.addEventListener(
        "keyup",
        detectMention
    );


    input.addEventListener(
        "blur",
        function () {

            setTimeout(
                function () {

                    dropdown.classList.remove(
                        "show"
                    );

                },
                180
            );

        }
    );

}



/* =========================================================
   LOAD POSTS
========================================================= */

async function loadForumPosts() {

    showForumLoading(
        true
    );


    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "forum_posts"
            )
            .select("*")
            .order(
                "created_at",
                {
                    ascending:
                        false
                }
            );


    if (error) {

        console.error(
            "Load posts error:",
            error
        );


        showForumLoading(
            false
        );


        showForumError(
            "Không thể tải bài viết."
        );


        return;
    }


    const posts =
        data || [];


    const authorIds =
        [
            ...new Set(
                posts.map(
                    post =>
                        post.author_id
                )
            )
        ];


    let profiles =
        [];


    if (
        authorIds.length
    ) {

        const {
            data: profileData,
            error: profileError
        } =
            await supabaseClient
                .from("users")
                .select(
                    `
                    user_id,
                    fullname,
                    avatar_url,
                    role,
                    student_verified
                    `
                )
                .in(
                    "user_id",
                    authorIds
                );


        if (profileError) {

            console.error(
                profileError
            );

        }


        profiles =
            profileData || [];
    }


    const [
        reactionsResult,
        commentsResult
    ] =
        await Promise.all([

            supabaseClient
                .from(
                    "forum_reactions"
                )
                .select(
                    `
                    id,
                    post_id,
                    user_id,
                    reaction
                    `
                ),

            supabaseClient
                .from(
                    "forum_comments"
                )
                .select(
                    `
                    id,
                    post_id
                    `
                )

        ]);


    const reactions =
        reactionsResult.data ||
        [];


    const comments =
        commentsResult.data ||
        [];


    forumPosts =
        posts.map(
            post => {

                const profile =
                    profiles.find(
                        item =>
                            item.user_id ===
                            post.author_id
                    );


                const postReactions =
                    reactions.filter(
                        item =>
                            item.post_id ===
                            post.id
                    );


                const postComments =
                    comments.filter(
                        item =>
                            item.post_id ===
                            post.id
                    );


                const myReaction =
                    currentUser
                        ? postReactions.find(
                            item =>
                                item.user_id ===
                                currentUser.id
                        )
                        : null;


                return {

                    ...post,

                    author:
                        profile || null,

                    reactions:
                        postReactions,

                    comments_count:
                        postComments.length,

                    myReaction:
                        myReaction?.reaction ||
                        null

                };

            }
        );


    showForumLoading(
        false
    );


    renderForumPosts();

}



/* =========================================================
   SORT POSTS
========================================================= */

function getSortedPosts() {

    const posts =
        [...forumPosts];


    if (
        currentSort ===
        "popular"
    ) {

        return posts.sort(
            (
                a,
                b
            ) => {

                const scoreA =
                    (
                        a.reactions?.length ||
                        0
                    ) +
                    (
                        a.comments_count ||
                        0
                    ) * 2;


                const scoreB =
                    (
                        b.reactions?.length ||
                        0
                    ) +
                    (
                        b.comments_count ||
                        0
                    ) * 2;


                return (
                    scoreB -
                    scoreA
                );

            }
        );

    }


    return posts.sort(
        (
            a,
            b
        ) =>
            new Date(
                b.created_at
            ) -
            new Date(
                a.created_at
            )
    );

}



/* =========================================================
   REACTION CONSTANT
========================================================= */

const REACTIONS = {

    like: {
        emoji:
            "👍",
        label:
            "Thích"
    },

    love: {
        emoji:
            "❤️",
        label:
            "Yêu thích"
    },

    haha: {
        emoji:
            "😆",
        label:
            "Haha"
    },

    wow: {
        emoji:
            "😮",
        label:
            "Wow"
    },

    sad: {
        emoji:
            "😢",
        label:
            "Buồn"
    },

    angry: {
        emoji:
            "😡",
        label:
            "Phẫn nộ"
    }

};



/* =========================================================
   REACTION SUMMARY
========================================================= */

function getReactionSummary(
    reactions = []
) {

    const counts = {};


    reactions.forEach(
        item => {

            counts[
                item.reaction
            ] =
                (
                    counts[
                        item.reaction
                    ] ||
                    0
                ) + 1;

        }
    );


    const sorted =
        Object.entries(
            counts
        )
        .sort(
            (
                a,
                b
            ) =>
                b[1] -
                a[1]
        )
        .slice(
            0,
            3
        );


    return {
        total:
            reactions.length,

        top:
            sorted.map(
                item =>
                    item[0]
            )
    };

}



/* =========================================================
   VERIFIED HTML
========================================================= */

function verifiedHTML(
    profile
) {

    if (
        !hasVerifiedBadge(
            profile
        )
    ) {

        return "";

    }


    return `

        <span
            class="forum-verified-badge"
            title="${escapeHTML(getVerifiedTitle(profile))}"
        >
            <i class="fa-solid fa-check"></i>
        </span>

    `;

}



/* =========================================================
   POST HTML
========================================================= */

function createPostHTML(
    post
) {

    const author =
        post.author ||
        {};


    const authorName =
        author.fullname ||
        "Người dùng IUH";


    const avatar =
        author.avatar_url ||
        DEFAULT_AVATAR;


    const reactionSummary =
        getReactionSummary(
            post.reactions ||
            []
        );


    const myReaction =
        post.myReaction;


    const myReactionData =
        myReaction
            ? REACTIONS[
                myReaction
            ]
            : null;


    const typeLabel =
        post.post_type ===
        "question"
            ? "Đặt câu hỏi"
            : "Thảo luận";


    const reactionIcons =
        reactionSummary.top
            .map(
                type => {

                    return `

                        <span
                            class="reaction-mini"
                            title="${REACTIONS[type].label}"
                        >
                            ${REACTIONS[type].emoji}
                        </span>

                    `;

                }
            )
            .join("");


    const canManage =
        currentUser &&
        currentUser.id ===
        post.author_id;


    return `

        <article
            class="discussion-post"
            data-post-id="${post.id}"
        >


            <!-- HEADER -->

            <div class="post-header">


                <div class="post-user">


                    <a
                        href="trangcanhan.html?id=${encodeURIComponent(post.author_id)}"
                        class="post-avatar-link"
                        title="Xem trang cá nhân"
                    >

                        <img
                            src="${avatar}"
                            alt="${escapeHTML(authorName)}"
                            onerror="this.src='${DEFAULT_AVATAR}'"
                        >

                    </a>


                    <div class="post-user-info">


                        <div class="post-user-name-row">

                            <a
                                href="trangcanhan.html?id=${encodeURIComponent(post.author_id)}"
                                class="post-user-name"
                            >
                                ${escapeHTML(authorName)}
                            </a>

                            ${verifiedHTML(author)}

                        </div>


                        <div class="post-time">

                            ${timeAgo(post.created_at)}

                            <span>•</span>

                            <i class="fa-solid fa-earth-americas"></i>

                        </div>

                    </div>

                </div>


                <div class="post-more-wrapper">


                    <button
                        type="button"
                        class="post-more"
                    >

                        <i class="fa-solid fa-ellipsis"></i>

                    </button>


                    <div class="post-dropdown">

                        <button
                            type="button"
                            class="copy-post-button"
                        >
                            <i class="fa-regular fa-copy"></i>
                            Sao chép liên kết
                        </button>

                        ${
                            canManage
                                ? `
                                    <button
                                        type="button"
                                        class="delete-post-button"
                                    >
                                        <i class="fa-regular fa-trash-can"></i>
                                        Xóa bài viết
                                    </button>
                                `
                                : ""
                        }

                    </div>

                </div>

            </div>



            <!-- CONTENT -->

            <div class="post-content">

                <div class="post-type-badge">

                    ${
                        post.post_type ===
                        "question"
                            ? `<i class="fa-solid fa-circle-question"></i>`
                            : `<i class="fa-solid fa-comments"></i>`
                    }

                    ${typeLabel}

                </div>


                <p class="post-content-text">
                    ${renderMentions(post.content)}
                </p>

            </div>



            ${
                post.image_url
                    ? `
                        <div class="post-image">

                            <img
                                src="${post.image_url}"
                                alt="Ảnh bài viết"
                            >

                        </div>
                    `
                    : ""
            }



            <!-- STATS -->

            <div class="post-stats">


                <div class="reaction-summary">

                    ${
                        reactionIcons
                            ? `
                                <div class="reaction-mini-icons">
                                    ${reactionIcons}
                                </div>
                            `
                            : ""
                    }

                    <span>
                        ${
                            reactionSummary.total
                                ? reactionSummary.total
                                : "Chưa có cảm xúc"
                        }
                    </span>

                </div>


                <span class="post-comment-count">

                    ${
                        post.comments_count ||
                        0
                    }

                    bình luận

                </span>

            </div>



            <!-- ACTION -->

            <div class="post-actions">


                <div class="reaction-wrapper">


                    <button
                        type="button"
                        class="post-action reaction-main-button ${myReaction ? "active" : ""}"
                    >

                        ${
                            myReactionData
                                ? `
                                    <span>
                                        ${myReactionData.emoji}
                                    </span>

                                    ${myReactionData.label}
                                `
                                : `
                                    <i class="fa-regular fa-thumbs-up"></i>
                                    Thích
                                `
                        }

                    </button>


                    <div class="reaction-picker">

                        ${Object.entries(REACTIONS)
                            .map(
                                (
                                    [
                                        key,
                                        item
                                    ]
                                ) => `

                                    <button
                                        type="button"
                                        class="reaction-option"
                                        data-reaction="${key}"
                                        title="${item.label}"
                                    >
                                        ${item.emoji}
                                    </button>

                                `
                            )
                            .join("")
                        }

                    </div>

                </div>


                <button
                    type="button"
                    class="post-action comment-button"
                >

                    <i class="fa-regular fa-comment"></i>

                    Bình luận

                </button>


                <button
                    type="button"
                    class="post-action share-button"
                >

                    <i class="fa-solid fa-share"></i>

                    Chia sẻ

                </button>

            </div>



            <!-- COMMENTS -->

            <div
                class="post-comments"
                hidden
            >

                <div class="comments-list"></div>


                <div class="comment-input-row">


                    <div class="comment-input-avatar">

                        <img
                            src="${
                                currentProfile?.avatar_url ||
                                DEFAULT_AVATAR
                            }"
                            alt="Avatar"
                        >

                    </div>


                    <div class="comment-editor-wrapper">


                        <textarea
                            class="comment-textarea"
                            rows="1"
                            placeholder="Viết bình luận... dùng @ để nhắc đến người khác"
                        ></textarea>


                        <div
                            class="mention-dropdown comment-mention-dropdown"
                        ></div>


                        <button
                            type="button"
                            class="comment-submit"
                            title="Gửi bình luận"
                        >

                            <i class="fa-solid fa-paper-plane"></i>

                        </button>

                    </div>

                </div>

            </div>


        </article>

    `;

}



/* =========================================================
   RENDER POSTS
========================================================= */

function renderForumPosts() {

    const feed =
        document.getElementById(
            "discussionFeed"
        );


    if (!feed) {
        return;
    }


    const posts =
        getSortedPosts();


    if (!posts.length) {

        feed.innerHTML = `

            <div class="forum-empty">

                <i class="fa-regular fa-comments"></i>

                <h3>
                    Chưa có bài viết nào
                </h3>

                <p>
                    Hãy là người đầu tiên chia sẻ với cộng đồng IUH SHOP.
                </p>

            </div>

        `;


        return;
    }


    feed.innerHTML =
        posts
            .map(
                createPostHTML
            )
            .join("");


    bindPostEvents();

}



/* =========================================================
   SHOW LOADING
========================================================= */

function showForumLoading(
    show
) {

    const loading =
        document.getElementById(
            "forumLoading"
        );


    if (!loading) {
        return;
    }


    loading.style.display =
        show
            ? "flex"
            : "none";

}



/* =========================================================
   ERROR
========================================================= */

function showForumError(
    message
) {

    const feed =
        document.getElementById(
            "discussionFeed"
        );


    if (!feed) {
        return;
    }


    feed.innerHTML = `

        <div class="forum-empty">

            <i class="fa-solid fa-triangle-exclamation"></i>

            <h3>
                Có lỗi xảy ra
            </h3>

            <p>
                ${escapeHTML(message)}
            </p>

        </div>

    `;

}



/* =========================================================
   SET REACTION
========================================================= */

async function setReaction(
    postId,
    reaction
) {

    if (!requireLogin()) {
        return;
    }


    const {
        data: existing,
        error: checkError
    } =
        await supabaseClient
            .from(
                "forum_reactions"
            )
            .select(
                "id, reaction"
            )
            .eq(
                "post_id",
                postId
            )
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (checkError) {

        console.error(
            checkError
        );

        return;
    }


    /*
     * Click đúng cảm xúc đang dùng
     * => bỏ cảm xúc.
     */

    if (
        existing &&
        existing.reaction ===
        reaction
    ) {

        await supabaseClient
            .from(
                "forum_reactions"
            )
            .delete()
            .eq(
                "id",
                existing.id
            );

    }

    else if (
        existing
    ) {

        await supabaseClient
            .from(
                "forum_reactions"
            )
            .update({
                reaction:
                    reaction
            })
            .eq(
                "id",
                existing.id
            );

    }

    else {

        await supabaseClient
            .from(
                "forum_reactions"
            )
            .insert({
                post_id:
                    postId,

                user_id:
                    currentUser.id,

                reaction:
                    reaction
            });

    }


    await loadForumPosts();

}



/* =========================================================
   LOAD COMMENTS
========================================================= */

async function loadComments(
    postId,
    postElement
) {

    const commentsList =
        $(
            ".comments-list",
            postElement
        );


    if (!commentsList) {
        return;
    }


    commentsList.innerHTML = `

        <div class="forum-loading">

            <div class="forum-loading-spinner"></div>

        </div>

    `;


    const {
        data: comments,
        error
    } =
        await supabaseClient
            .from(
                "forum_comments"
            )
            .select("*")
            .eq(
                "post_id",
                postId
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
            error
        );


        commentsList.innerHTML =
            "Không tải được bình luận.";

        return;
    }


    const items =
        comments || [];

    /* LOAD REACTION CỦA BÌNH LUẬN */

const commentIds =
    items.map(
        item => item.id
    );

let commentReactions = [];

if (commentIds.length) {

    const {
        data: reactionData,
        error: reactionError
    } =
        await supabaseClient
            .from(
                "forum_comment_reactions"
            )
            .select(`
                id,
                comment_id,
                user_id,
                reaction
            `)
            .in(
                "comment_id",
                commentIds
            );


    if (reactionError) {

        console.error(
            "Comment reaction load error:",
            reactionError
        );

    } else {

        commentReactions =
            reactionData || [];

    }

}


    if (!items.length) {

        commentsList.innerHTML = `

            <div
                style="
                    padding:12px 4px;
                    color:#939caf;
                    font-size:11px;
                "
            >
                Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.
            </div>

        `;

        return;
    }


    const authorIds =
        [
            ...new Set(
                items.map(
                    item =>
                        item.author_id
                )
            )
        ];


    let profiles =
        [];


    if (
        authorIds.length
    ) {

        const {
            data: profileData
        } =
            await supabaseClient
                .from("users")
                .select(
                    `
                    user_id,
                    fullname,
                    avatar_url,
                    role,
                    student_verified
                    `
                )
                .in(
                    "user_id",
                    authorIds
                );


        profiles =
            profileData || [];

    }


    const enriched =
    items.map(
        item => {

            const reactions =
                commentReactions.filter(
                    reaction =>
                        reaction.comment_id ===
                        item.id
                );


            const myReaction =
                currentUser
                    ? reactions.find(
                        reaction =>
                            reaction.user_id ===
                            currentUser.id
                    )
                    : null;


            return {

                ...item,

                author:
                    profiles.find(
                        profile =>
                            profile.user_id ===
                            item.author_id
                    ) || null,

                reactions,

                myReaction:
                    myReaction?.reaction ||
                    null

            };

        }
    );


    const parents =
        enriched.filter(
            item =>
                !item.parent_id
        );


    commentsList.innerHTML =
        parents
            .map(
                parent => {

                    const replies =
                        enriched.filter(
                            item =>
                                item.parent_id ===
                                parent.id
                        );


                    return (
                        createCommentHTML(
                            parent,
                            false
                        ) +
                        replies
                            .map(
                                reply =>
                                    createCommentHTML(
                                        reply,
                                        true
                                    )
                            )
                            .join("")
                    );

                }
            )
            .join("");


    bindCommentEvents(
        postId,
        postElement
    );

}



/* =========================================================
   COMMENT HTML
========================================================= */

function createCommentHTML(
    comment,
    isReply
) {

    const author =
        comment.author ||
        {};


    const name =
        author.fullname ||
        "Người dùng IUH";


    const avatar =
        author.avatar_url ||
        DEFAULT_AVATAR;


    const canManage =
    currentUser &&
    currentUser.id ===
    comment.author_id;

const commentReactions =
    comment.reactions || [];

const myReaction =
    comment.myReaction || null;

const myReactionData =
    myReaction
        ? REACTIONS[myReaction]
        : null;

const reactionSummary =
    getReactionSummary(
        commentReactions
    );

const reactionIcons =
    reactionSummary.top
        .map(
            type => `
                <span
                    class="comment-reaction-mini"
                    title="${REACTIONS[type].label}"
                >
                    ${REACTIONS[type].emoji}
                </span>
            `
        )
        .join("");


    return `

        <div
            class="comment-item ${isReply ? "reply" : ""}"
            data-comment-id="${comment.id}"
            data-comment-author-id="${comment.author_id}"
            data-comment-author-name="${escapeHTML(name)}"
            data-comment-content="${escapeHTML(comment.content || "")}"
        >


            <a
                href="trangcanhan.html?id=${encodeURIComponent(comment.author_id)}"
                class="comment-avatar-link"
            >

                <img
                    src="${avatar}"
                    alt="${escapeHTML(name)}"
                    onerror="this.src='${DEFAULT_AVATAR}'"
                >

            </a>


            <div class="comment-main">


                <div class="comment-box">


                    <div class="comment-name-row">

                        <a
                            href="trangcanhan.html?id=${encodeURIComponent(comment.author_id)}"
                            class="comment-name"
                        >
                            ${escapeHTML(name)}
                        </a>

                        ${verifiedHTML(author)}

                    </div>


                    <p>
                        ${renderMentions(comment.content)}
                    </p>

                </div>


               <!-- CẢM XÚC BÌNH LUẬN -->
<div class="comment-reaction-area">

    <div class="comment-reaction-wrapper">

        <button
            type="button"
            class="comment-reaction-main ${myReaction ? "active" : ""}"
            data-reaction="${myReaction || ""}"
            title="${myReactionData ? myReactionData.label : "Thả cảm xúc"}"
        >
            ${
    myReactionData
        ? myReactionData.emoji
        : `<i class="fa-regular fa-thumbs-up"></i>`
}
        </button>


        <div class="comment-reaction-picker">

            ${Object.entries(REACTIONS)
                .map(
                    ([key, item]) => `
                        <button
                            type="button"
                            class="comment-reaction-option"
                            data-reaction="${key}"
                            title="${item.label}"
                        >
                            ${item.emoji}
                        </button>
                    `
                )
                .join("")}

        </div>

    </div>


    ${
        reactionSummary.total
            ? `
                <div class="comment-reaction-summary">

                    <div class="comment-reaction-icons">
                        ${reactionIcons}
                    </div>

                    <span>
                        ${reactionSummary.total}
                    </span>

                </div>
            `
            : ""
    }

</div>


<!-- ACTION BÌNH LUẬN -->
<div class="comment-actions">

    <span>
        ${timeAgo(comment.created_at)}
    </span>


    ${
        !isReply
            ? `
                <button
                    type="button"
                    class="reply-comment-button"
                >
                    Trả lời
                </button>
            `
            : ""
    }


    ${
        canManage
            ? `
                <button
                    type="button"
                    class="edit-comment-button"
                >
                    Chỉnh sửa
                </button>

                <button
                    type="button"
                    class="delete-comment-button"
                >
                    Xóa
                </button>
            `
            : ""
    }

</div>


                <div class="reply-form-container"></div>

            </div>

        </div>

    `;

}



/* =========================================================
   CREATE COMMENT
========================================================= */

async function submitComment(
    postId,
    content,
    parentId = null
) {

    if (!requireLogin()) {
        return false;
    }


    const clean =
        content.trim();


    if (!clean) {
        return false;
    }


    const {
        error
    } =
        await supabaseClient
            .from(
                "forum_comments"
            )
            .insert({
                post_id:
                    postId,

                author_id:
                    currentUser.id,

                parent_id:
                    parentId,

                content:
                    clean
            });


    if (error) {

        console.error(
            "Comment insert error:",
            error
        );


        alert(
            "Không thể gửi bình luận."
        );


        return false;
    }


    return true;

}

/* =========================================================
   COMMENT REACTION
========================================================= */

async function setCommentReaction(
    commentId,
    reaction
) {

    if (!requireLogin()) {
        return;
    }


    const {
        data: existing,
        error
    } =
        await supabaseClient
            .from(
                "forum_comment_reactions"
            )
            .select(
                "id, reaction"
            )
            .eq(
                "comment_id",
                commentId
            )
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        console.error(
            "Comment reaction error:",
            error
        );

        return;
    }


    /* Bấm lại cảm xúc hiện tại
       => bỏ cảm xúc */

    if (
        existing &&
        existing.reaction === reaction
    ) {

        await supabaseClient
            .from(
                "forum_comment_reactions"
            )
            .delete()
            .eq(
                "id",
                existing.id
            );

        return;
    }


    /* Đổi sang cảm xúc khác */

    if (existing) {

        await supabaseClient
            .from(
                "forum_comment_reactions"
            )
            .update({
                reaction:
                    reaction
            })
            .eq(
                "id",
                existing.id
            );

        return;
    }


    /* Thêm cảm xúc mới */

    await supabaseClient
        .from(
            "forum_comment_reactions"
        )
        .insert({
            comment_id:
                commentId,

            user_id:
                currentUser.id,

            reaction:
                reaction
        });

}

/* =========================================================
   EDIT COMMENT
========================================================= */

async function editComment(
    commentId,
    content
) {

    if (!requireLogin()) {
        return false;
    }


    const clean =
        content.trim();


    if (!clean) {

        alert(
            "Bình luận không được để trống."
        );

        return false;
    }


    const {
        error
    } =
        await supabaseClient
            .from(
                "forum_comments"
            )
            .update({
                content:
                    clean
            })
            .eq(
                "id",
                commentId
            )
            .eq(
                "author_id",
                currentUser.id
            );


    if (error) {

        console.error(
            "Edit comment error:",
            error
        );

        alert(
            "Không thể chỉnh sửa bình luận."
        );

        return false;
    }


    return true;

}



/* =========================================================
   COMMENT EVENTS
========================================================= */

function bindCommentEvents(
    postId,
    postElement
) {

    /* =========================================================
   REACTION BÌNH LUẬN
========================================================= */

$$(
    ".comment-reaction-option",
    postElement
)
.forEach(
    button => {

        button.addEventListener(
            "click",
            async function () {

                const item =
                    button.closest(
                        ".comment-item"
                    );


                if (!item) {
                    return;
                }


                await setCommentReaction(
                    item.dataset.commentId,
                    button.dataset.reaction
                );


                await loadComments(
                    postId,
                    postElement
                );

            }
        );

    }
);


/* =========================================================
   LIKE NHANH BÌNH LUẬN
========================================================= */

$$(
    ".comment-reaction-main",
    postElement
)
.forEach(
    button => {

        button.addEventListener(
            "click",
            async function () {

                const item =
                    button.closest(
                        ".comment-item"
                    );


                if (!item) {
                    return;
                }


                const currentReaction =
                    button.dataset.reaction;


                await setCommentReaction(
                    item.dataset.commentId,
                    currentReaction ||
                        "like"
                );


                await loadComments(
                    postId,
                    postElement
                );

            }
        );

    }
);


/* =========================================================
   CHỈNH SỬA BÌNH LUẬN
========================================================= */

$$(
    ".edit-comment-button",
    postElement
)
.forEach(
    button => {

        button.addEventListener(
            "click",
            function () {

                const item =
                    button.closest(
                        ".comment-item"
                    );


                if (!item) {
                    return;
                }


                const box =
                    $(".comment-box", item);


                const actions =
                    $(".comment-actions", item);


                const oldContent =
                    item.dataset.commentContent ||
                    "";


                box.innerHTML = `

                    <div class="comment-edit-form">

                        <textarea
                            class="comment-edit-input"
                            rows="2"
                        ></textarea>


                        <div class="comment-edit-actions">

                            <button
                                type="button"
                                class="comment-edit-cancel"
                            >
                                Hủy
                            </button>


                            <button
                                type="button"
                                class="comment-edit-save"
                            >
                                Lưu
                            </button>

                        </div>

                    </div>

                `;


                const input =
                    $(".comment-edit-input", box);


                input.value =
                    oldContent;


                input.focus();


                if (actions) {
                    actions.style.display =
                        "none";
                }


                /* HỦY */

                $(".comment-edit-cancel", box)
                    ?.addEventListener(
                        "click",
                        async function () {

                            await loadComments(
                                postId,
                                postElement
                            );

                        }
                    );


                /* LƯU */

                $(".comment-edit-save", box)
                    ?.addEventListener(
                        "click",
                        async function () {

                            const success =
                                await editComment(
                                    item.dataset.commentId,
                                    input.value
                                );


                            if (success) {

                                await loadComments(
                                    postId,
                                    postElement
                                );

                            }

                        }
                    );


                /* Enter = lưu
                   Esc = hủy */

                input.addEventListener(
                    "keydown",
                    function (event) {

                        if (
                            event.key ===
                                "Enter" &&
                            !event.shiftKey
                        ) {

                            event.preventDefault();

                            $(".comment-edit-save", box)
                                ?.click();

                        }


                        if (
                            event.key ===
                                "Escape"
                        ) {

                            $(".comment-edit-cancel", box)
                                ?.click();

                        }

                    }
                );

            }
        );

    }
);

    $$(".reply-comment-button", postElement)
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        if (
                            !requireLogin()
                        ) {

                            return;
                        }


                        const item =
                            button.closest(
                                ".comment-item"
                            );


                        const container =
                            $(
                                ".reply-form-container",
                                item
                            );


                        const targetName =
                            item.dataset.commentAuthorName;


                        const targetUserId =
                            item.dataset.commentAuthorId;


                        const commentId =
                            item.dataset.commentId;


                        container.innerHTML = `

                            <div class="reply-form">

                                <input
                                    type="text"
                                    class="reply-input"
                                    placeholder="Trả lời ${escapeHTML(targetName)}..."
                                    value="@[${escapeHTML(targetName)}](${targetUserId}) "
                                >

                                <button
                                    type="button"
                                    class="reply-send"
                                >

                                    <i class="fa-solid fa-paper-plane"></i>

                                </button>

                            </div>

                        `;


                        const input =
                            $(
                                ".reply-input",
                                container
                            );


                        const send =
                            $(
                                ".reply-send",
                                container
                            );


                        input.focus();


                        input.setSelectionRange(
                            input.value.length,
                            input.value.length
                        );


                        send.addEventListener(
                            "click",
                            async function () {

                                const success =
                                    await submitComment(
                                        postId,
                                        input.value,
                                        commentId
                                    );


                                if (
                                    success
                                ) {

                                    await loadComments(
                                        postId,
                                        postElement
                                    );


                                    await refreshPostCounts(
                                        postId
                                    );

                                }

                            }
                        );


                        input.addEventListener(
                            "keydown",
                            async function (
                                event
                            ) {

                                if (
                                    event.key ===
                                        "Enter" &&
                                    !event.shiftKey
                                ) {

                                    event.preventDefault();

                                    send.click();

                                }

                            }
                        );

                    }
                );

            }
        );


    $$(".delete-comment-button", postElement)
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async function () {

                        const item =
                            button.closest(
                                ".comment-item"
                            );


                        const commentId =
                            item.dataset.commentId;


                        if (
                            !confirm(
                                "Xóa bình luận này?"
                            )
                        ) {

                            return;
                        }


                        const {
                            error
                        } =
                            await supabaseClient
                                .from(
                                    "forum_comments"
                                )
                                .delete()
                                .eq(
                                    "id",
                                    commentId
                                );


                        if (error) {

                            console.error(
                                error
                            );

                            return;
                        }


                        await loadComments(
                            postId,
                            postElement
                        );


                        await refreshPostCounts(
                            postId
                        );

                    }
                );

            }
        );

}



/* =========================================================
   REFRESH COUNTS
========================================================= */

async function refreshPostCounts(
    postId
) {

    await loadForumPosts();

}



/* =========================================================
   SHARE
========================================================= */

async function sharePost(
    post
) {

    const baseUrl =
        window.location
            .origin +
        window.location
            .pathname;


    const url =
        `${baseUrl}?post=${encodeURIComponent(post.id)}`;


    const cleanText =
        post.content
            .replace(
                /@\[(.+?)\]\(([a-f0-9-]{20,})\)/gi,
                "@$1"
            );


    if (
        navigator.share
    ) {

        try {

            await navigator.share({

                title:
                    "IUH SHOP - Diễn đàn",

                text:
                    cleanText.substring(
                        0,
                        150
                    ),

                url:
                    url

            });


            return;

        }
        catch (
            error
        ) {

            if (
                error.name ===
                "AbortError"
            ) {

                return;

            }

        }

    }


    try {

        await navigator
            .clipboard
            .writeText(
                url
            );


        alert(
            "Đã sao chép liên kết bài viết."
        );

    }
    catch {

        prompt(
            "Sao chép liên kết:",
            url
        );

    }

}



/* =========================================================
   DELETE POST
========================================================= */

async function deletePost(
    post
) {

    if (
        !currentUser ||
        currentUser.id !==
        post.author_id
    ) {

        return;
    }


    if (
        !confirm(
            "Bạn chắc chắn muốn xóa bài viết này?"
        )
    ) {

        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from(
                "forum_posts"
            )
            .delete()
            .eq(
                "id",
                post.id
            );


    if (error) {

        alert(
            "Không thể xóa bài viết."
        );

        console.error(
            error
        );

        return;
    }


    await loadForumPosts();

}



/* =========================================================
   BIND POST EVENTS
========================================================= */

function bindPostEvents() {

    $$(".discussion-post")
        .forEach(
            postElement => {

                const postId =
                    postElement.dataset
                        .postId;


                const post =
                    forumPosts.find(
                        item =>
                            item.id ===
                            postId
                    );


                if (!post) {
                    return;
                }


                /* MORE */

                const moreButton =
                    $(
                        ".post-more",
                        postElement
                    );


                const dropdown =
                    $(
                        ".post-dropdown",
                        postElement
                    );


                moreButton?.addEventListener(
                    "click",
                    function (
                        event
                    ) {

                        event.stopPropagation();


                        $$(".post-dropdown")
                            .forEach(
                                menu => {

                                    if (
                                        menu !==
                                        dropdown
                                    ) {

                                        menu.classList.remove(
                                            "show"
                                        );

                                    }

                                }
                            );


                        dropdown.classList.toggle(
                            "show"
                        );

                    }
                );


                /* COPY */

                $(
                    ".copy-post-button",
                    postElement
                )?.addEventListener(
                    "click",
                    function () {

                        sharePost(
                            post
                        );

                    }
                );


                /* DELETE */

                $(
                    ".delete-post-button",
                    postElement
                )?.addEventListener(
                    "click",
                    function () {

                        deletePost(
                            post
                        );

                    }
                );


                /* REACTION */

                $$(".reaction-option", postElement)
                    .forEach(
                        button => {

                            button.addEventListener(
                                "click",
                                async function () {

                                    await setReaction(
                                        postId,
                                        button.dataset.reaction
                                    );

                                }
                            );

                        }
                    );


                /* QUICK LIKE */

                $(
                    ".reaction-main-button",
                    postElement
                )?.addEventListener(
                    "click",
                    async function () {

                        await setReaction(
                            postId,
                            post.myReaction ||
                            "like"
                        );

                    }
                );


                /* COMMENT */

                const commentButton =
                    $(
                        ".comment-button",
                        postElement
                    );


                const comments =
                    $(
                        ".post-comments",
                        postElement
                    );


                commentButton?.addEventListener(
                    "click",
                    async function () {

                        comments.hidden =
                            !comments.hidden;


                        if (
                            !comments.hidden
                        ) {

                            await loadComments(
                                postId,
                                postElement
                            );


                            $(
                                ".comment-textarea",
                                postElement
                            )?.focus();

                        }

                    }
                );


                /* COMMENT INPUT */

                const commentTextarea =
                    $(
                        ".comment-textarea",
                        postElement
                    );


                const mentionDropdown =
                    $(
                        ".comment-mention-dropdown",
                        postElement
                    );


                setupMentionInput(
                    commentTextarea,
                    mentionDropdown
                );


                const commentSubmit =
                    $(
                        ".comment-submit",
                        postElement
                    );


                async function sendComment() {

                    if (
                        !commentTextarea
                    ) {

                        return;
                    }


                    const success =
                        await submitComment(
                            postId,
                            commentTextarea.value
                        );


                    if (
                        success
                    ) {

                        commentTextarea.value =
                            "";


                        await loadComments(
                            postId,
                            postElement
                        );


                        await refreshPostCounts(
                            postId
                        );

                    }

                }


                commentSubmit
                    ?.addEventListener(
                        "click",
                        sendComment
                    );


                commentTextarea
                    ?.addEventListener(
                        "keydown",
                        function (
                            event
                        ) {

                            if (
                                event.key ===
                                    "Enter" &&
                                !event.shiftKey
                            ) {

                                event.preventDefault();

                                sendComment();

                            }

                        }
                    );


                /* SHARE */

                $(
                    ".share-button",
                    postElement
                )?.addEventListener(
                    "click",
                    function () {

                        sharePost(
                            post
                        );

                    }
                );

            }
        );


    document.addEventListener(
        "click",
        closePostDropdowns,
        {
            once:
                true
        }
    );

}



/* =========================================================
   CLOSE POST MENU
========================================================= */

function closePostDropdowns() {

    $$(".post-dropdown")
        .forEach(
            menu => {

                menu.classList.remove(
                    "show"
                );

            }
        );

}



/* =========================================================
   UPLOAD POST IMAGE
========================================================= */

async function uploadPostImage(
    file
) {

    if (!file) {
        return null;
    }


    if (
        !currentUser
    ) {

        return null;
    }


    const allowedTypes =
        [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        throw new Error(
            "Chỉ hỗ trợ JPG, PNG hoặc WEBP."
        );

    }


    if (
        file.size >
        8 *
        1024 *
        1024
    ) {

        throw new Error(
            "Ảnh không được lớn hơn 8MB."
        );

    }


    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    const fileName =
        `${crypto.randomUUID()}.${extension}`;


    const path =
        `${currentUser.id}/${fileName}`;


    const {
        error
    } =
        await supabaseClient
            .storage
            .from(
                "forum-images"
            )
            .upload(
                path,
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
            .from(
                "forum-images"
            )
            .getPublicUrl(
                path
            );


    return data.publicUrl;

}



/* =========================================================
   CREATE POST MODAL
========================================================= */

function setupCreatePostModal() {

    const modal =
        document.getElementById(
            "createPostModal"
        );


    const overlay =
        $(
            ".create-post-overlay",
            modal
        );


    const openButton =
        document.getElementById(
            "openCreatePost"
        );


    const closeButton =
        document.getElementById(
            "closeCreatePost"
        );


    const textarea =
        document.getElementById(
            "createPostContent"
        );


    const name =
        document.getElementById(
            "createPostName"
        );


    const avatar =
        document.getElementById(
            "createPostAvatar"
        );


    const badge =
        document.getElementById(
            "createPostVerified"
        );


    const imageInput =
        document.getElementById(
            "createPostImage"
        );


    const preview =
        document.getElementById(
            "createPostImagePreview"
        );


    const previewImage =
        document.getElementById(
            "createPostPreviewImg"
        );


    const removeImage =
        document.getElementById(
            "removePostImage"
        );


    const submit =
        document.getElementById(
            "submitCreatePost"
        );


    const counter =
        document.getElementById(
            "createPostCounter"
        );


    const mentionDropdown =
        document.getElementById(
            "mentionDropdown"
        );


    const typeLabel =
        document.getElementById(
            "createPostTypeLabel"
        );


    if (
        !modal ||
        !textarea
    ) {

        return;

    }


    setupMentionInput(
        textarea,
        mentionDropdown
    );


    function populateCurrentUser() {

        if (!currentUser) {

            name.textContent =
                "Bạn chưa đăng nhập";


            avatar.src =
                DEFAULT_AVATAR;


            badge.hidden =
                true;


            return;

        }


        name.textContent =
            getProfileName(
                currentProfile,
                currentUser
            );


        avatar.src =
            currentProfile?.avatar_url ||
            currentUser.user_metadata?.avatar_url ||
            DEFAULT_AVATAR;


        const verified =
            hasVerifiedBadge(
                currentProfile
            );


        badge.hidden =
            !verified;


        if (
            verified
        ) {

            badge.title =
                getVerifiedTitle(
                    currentProfile
                );

        }

    }


    function openModal(
        type =
            "discussion",
        openImage =
            false
    ) {

        if (
            !requireLogin()
        ) {

            return;
        }


        currentPostType =
            type;


        populateCurrentUser();


        updateTypeButtons();


        modal.classList.add(
            "show"
        );


        document.body.style
            .overflow =
                "hidden";


        setTimeout(
            function () {

                textarea.focus();


                if (
                    openImage
                ) {

                    imageInput.click();

                }

            },
            60
        );

    }


    function closeModal() {

        modal.classList.remove(
            "show"
        );


        document.body.style
            .overflow =
                "";

    }


    function resetModal() {

        textarea.value =
            "";


        counter.textContent =
            "0";


        imageInput.value =
            "";


        selectedPostImage =
            null;


        preview.hidden =
            true;


        previewImage.src =
            "";


        currentPostType =
            "discussion";


        updateTypeButtons();

    }


    function updateTypeButtons() {

        $$(".create-type-button", modal)
            .forEach(
                button => {

                    button.classList.toggle(
                        "active",
                        button.dataset.type ===
                        currentPostType
                    );

                }
            );


        typeLabel.textContent =
            currentPostType ===
            "question"
                ? "Đặt câu hỏi"
                : "Thảo luận";

    }


    openButton?.addEventListener(
        "click",
        function () {

            openModal(
                "discussion"
            );

        }
    );


    document
        .getElementById(
            "createDiscussionPost"
        )
        ?.addEventListener(
            "click",
            function () {

                openModal(
                    "discussion"
                );

            }
        );


    document
        .getElementById(
            "createQuestionPost"
        )
        ?.addEventListener(
            "click",
            function () {

                openModal(
                    "question"
                );

            }
        );


    document
        .getElementById(
            "createPhotoPost"
        )
        ?.addEventListener(
            "click",
            function () {

                openModal(
                    "discussion",
                    true
                );

            }
        );


    closeButton?.addEventListener(
        "click",
        closeModal
    );


    overlay?.addEventListener(
        "click",
        closeModal
    );


    document.addEventListener(
        "keydown",
        function (
            event
        ) {

            if (
                event.key ===
                    "Escape" &&
                modal.classList
                    .contains(
                        "show"
                    )
            ) {

                closeModal();

            }

        }
    );


    $$(".create-type-button", modal)
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        currentPostType =
                            button.dataset.type;


                        updateTypeButtons();

                    }
                );

            }
        );


    textarea.addEventListener(
        "input",
        function () {

            counter.textContent =
                textarea.value.length;

        }
    );


    imageInput.addEventListener(
        "change",
        function () {

            const file =
                imageInput.files?.[0];


            if (!file) {
                return;
            }


            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                alert(
                    "Vui lòng chọn file ảnh."
                );


                imageInput.value =
                    "";


                return;
            }


            if (
                file.size >
                8 *
                1024 *
                1024
            ) {

                alert(
                    "Ảnh không được lớn hơn 8MB."
                );


                imageInput.value =
                    "";


                return;
            }


            selectedPostImage =
                file;


            const url =
                URL.createObjectURL(
                    file
                );


            previewImage.src =
                url;


            preview.hidden =
                false;

        }
    );


    removeImage.addEventListener(
        "click",
        function () {

            selectedPostImage =
                null;


            imageInput.value =
                "";


            previewImage.src =
                "";


            preview.hidden =
                true;

        }
    );


    submit.addEventListener(
        "click",
        async function () {

            if (
                !requireLogin()
            ) {

                return;
            }


            const content =
                textarea.value.trim();


            if (
                !content &&
                !selectedPostImage
            ) {

                alert(
                    "Bạn chưa nhập nội dung hoặc chọn ảnh."
                );


                textarea.focus();


                return;
            }


            submit.disabled =
                true;


            submit.innerHTML = `

                <i class="fa-solid fa-spinner fa-spin"></i>

                <span>
                    Đang đăng...
                </span>

            `;


            try {

                let imageUrl =
                    null;


                if (
                    selectedPostImage
                ) {

                    imageUrl =
                        await uploadPostImage(
                            selectedPostImage
                        );

                }


                const {
                    error
                } =
                    await supabaseClient
                        .from(
                            "forum_posts"
                        )
                        .insert({

                            author_id:
                                currentUser.id,

                            content:
                                content ||
                                " ",

                            image_url:
                                imageUrl,

                            post_type:
                                currentPostType

                        });


                if (error) {

                    throw error;

                }


                resetModal();

                closeModal();


                await loadForumPosts();


                window.scrollTo({

                    top:
                        document
                            .getElementById(
                                "discussionFeed"
                            )
                            .getBoundingClientRect()
                            .top +
                        window.scrollY -
                        170,

                    behavior:
                        "smooth"

                });

            }
            catch (
                error
            ) {

                console.error(
                    "Create post error:",
                    error
                );


                alert(
                    error.message ||
                    "Không thể đăng bài."
                );

            }
            finally {

                submit.disabled =
                    false;


                submit.innerHTML = `

                    <i class="fa-solid fa-paper-plane"></i>

                    <span>
                        Đăng bài
                    </span>

                `;

            }

        }
    );

}



/* =========================================================
   TABS
========================================================= */

function setupForumTabs() {

    const discussionTab =
        document.getElementById(
            "discussionTab"
        );


    const articleTab =
        document.getElementById(
            "articleTab"
        );


    const discussionContent =
        document.getElementById(
            "discussionContent"
        );


    const articleContent =
        document.getElementById(
            "articleContent"
        );


    discussionTab?.addEventListener(
        "click",
        function () {

            discussionTab
                .classList
                .add(
                    "active"
                );


            articleTab
                .classList
                .remove(
                    "active"
                );


            discussionContent
                .classList
                .add(
                    "active"
                );


            articleContent
                .classList
                .remove(
                    "active"
                );

        }
    );


    articleTab?.addEventListener(
        "click",
        function () {

            articleTab
                .classList
                .add(
                    "active"
                );


            discussionTab
                .classList
                .remove(
                    "active"
                );


            articleContent
                .classList
                .add(
                    "active"
                );


            discussionContent
                .classList
                .remove(
                    "active"
                );

        }
    );

}



/* =========================================================
   SORT
========================================================= */

function setupForumSort() {

    const button =
        document.getElementById(
            "discussionSort"
        );


    const menu =
        document.getElementById(
            "forumSortMenu"
        );


    const text =
        document.getElementById(
            "sortText"
        );


    if (
        !button ||
        !menu
    ) {

        return;
    }


    button.addEventListener(
        "click",
        function (
            event
        ) {

            event.stopPropagation();


            menu.classList.toggle(
                "show"
            );

        }
    );


    $$(
        "button[data-sort]",
        menu
    )
        .forEach(
            option => {

                option.addEventListener(
                    "click",
                    function () {

                        currentSort =
                            option.dataset.sort;


                        text.textContent =
                            currentSort ===
                            "popular"
                                ? "Nổi bật"
                                : "Mới nhất";


                        menu.classList.remove(
                            "show"
                        );


                        renderForumPosts();

                    }
                );

            }
        );


    document.addEventListener(
        "click",
        function () {

            menu.classList.remove(
                "show"
            );

        }
    );

}



/* =========================================================
   REALTIME
========================================================= */

function setupForumRealtime() {

    if (
        forumRealtimeChannel
    ) {

        supabaseClient
            .removeChannel(
                forumRealtimeChannel
            );

    }


    forumRealtimeChannel =
        supabaseClient
            .channel(
                "forum-live"
            )

            .on(
                "postgres_changes",
                {
                    event:
                        "*",

                    schema:
                        "public",

                    table:
                        "forum_posts"
                },
                function () {

                    loadForumPosts();

                }
            )

            .on(
                "postgres_changes",
                {
                    event:
                        "*",

                    schema:
                        "public",

                    table:
                        "forum_reactions"
                },
                function () {

                    loadForumPosts();

                }
            )

            .on(
                "postgres_changes",
                {
                    event:
                        "*",

                    schema:
                        "public",

                    table:
                        "forum_comments"
                },
                function () {

                    loadForumPosts();

                }
            )

            .subscribe(
                function (
                    status
                ) {

                    console.log(
                        "Forum realtime:",
                        status
                    );

                }
            );

}



/* =========================================================
   DIRECT POST LINK
========================================================= */

function scrollToSharedPost() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const postId =
        params.get(
            "post"
        );


    if (!postId) {
        return;
    }


    setTimeout(
        function () {

            const element =
                document.querySelector(
                    `[data-post-id="${CSS.escape(postId)}"]`
                );


            if (!element) {
                return;
            }


            element.scrollIntoView({

                behavior:
                    "smooth",

                block:
                    "center"

            });


            element.animate(

                [
                    {
                        boxShadow:
                            "0 0 0 4px rgba(245,202,46,.55)"
                    },

                    {
                        boxShadow:
                            "0 5px 20px rgba(25,45,90,.04)"
                    }
                ],

                {
                    duration:
                        1800
                }

            );

        },
        350
    );

}



/* =========================================================
   HEADER ACTIVE
========================================================= */

function setupActiveNavigation() {

    const currentPage =
        window.location
            .pathname
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
                        .getAttribute(
                            "href"
                        )
                        ?.split("/")
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
   AUTH LISTENER
========================================================= */

supabaseClient
    .auth
    .onAuthStateChange(
        async function () {

            await loadCurrentUser();

            await updateUserMenu();

            await loadForumPosts();

        }
    );


/* =========================================================
   BÀI VIẾT CHÍNH THỨC
========================================================= */

let articleEditingId = null;
let selectedArticleImage = null;


/* =========================================================
   KIỂM TRA QUYỀN ADMIN
========================================================= */

function isArticleAdmin() {

    if (!currentProfile) {
        return false;
    }

    return (
        currentProfile.role === "admin" ||
        currentProfile.role === "moderator"
    );
}


/* =========================================================
   MỞ MODAL
========================================================= */

function openArticleModal(article = null) {

    if (!requireLogin()) {
        return;
    }

    if (!isArticleAdmin()) {
        alert(
            "Bạn không có quyền đăng bài viết."
        );

        return;
    }

    const modal =
        document.getElementById(
            "articleModal"
        );

    const titleInput =
        document.getElementById(
            "articleTitleInput"
        );

    const categoryInput =
        document.getElementById(
            "articleCategoryInput"
        );

    const editor =
        document.getElementById(
            "articleEditor"
        );

    const modalTitle =
        document.getElementById(
            "articleModalTitle"
        );

    const saveButton =
        document.getElementById(
            "saveArticleButton"
        );

    if (!modal) {
        return;
    }


    articleEditingId =
        article?.id || null;


    if (article) {

        modalTitle.textContent =
            "Chỉnh sửa bài viết";

        saveButton.innerHTML = `
            <i class="fa-solid fa-floppy-disk"></i>
            Lưu thay đổi
        `;

        titleInput.value =
            article.title || "";

        categoryInput.value =
            article.category ||
            "THÔNG BÁO";

        editor.innerHTML =
            article.content || "";

    } else {

        modalTitle.textContent =
            "Đăng bài viết";

        saveButton.innerHTML = `
            <i class="fa-solid fa-paper-plane"></i>
            Đăng bài viết
        `;

        titleInput.value =
            "";

        categoryInput.value =
            "THÔNG BÁO";

        editor.innerHTML =
            "";

    }


    modal.classList.add(
        "show"
    );

    document.body.style.overflow =
        "hidden";

    setTimeout(
        () => titleInput.focus(),
        100
    );
}


/* =========================================================
   ĐÓNG MODAL
========================================================= */

function closeArticleModal() {

    const modal =
        document.getElementById(
            "articleModal"
        );

    if (!modal) {
        return;
    }

    modal.classList.remove(
        "show"
    );

    document.body.style.overflow =
        "";

    articleEditingId =
        null;

    selectedArticleImage =
        null;

    const imageInput =
        document.getElementById(
            "articleImageInput"
        );

    const preview =
        document.getElementById(
            "articleImagePreview"
        );

    const previewImg =
        document.getElementById(
            "articlePreviewImg"
        );

    if (imageInput) {
        imageInput.value =
            "";
    }

    if (preview) {
        preview.hidden =
            true;
    }

    if (previewImg) {
        previewImg.src =
            "";
    }
}


/* =========================================================
   UPLOAD ẢNH BÀI VIẾT
========================================================= */

async function uploadArticleImage(
    file
) {

    if (!file) {
        return null;
    }

    if (!currentUser) {
        throw new Error(
            "Bạn chưa đăng nhập."
        );
    }


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

        throw new Error(
            "Chỉ hỗ trợ JPG, PNG hoặc WEBP."
        );
    }


    if (
        file.size >
        8 * 1024 * 1024
    ) {

        throw new Error(
            "Ảnh không được lớn hơn 8MB."
        );
    }


    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    const fileName =
        `${crypto.randomUUID()}.${extension}`;


    const path =
        `articles/${currentUser.id}/${fileName}`;


    const {
        error
    } =
        await supabaseClient
            .storage
            .from(
                "forum-images"
            )
            .upload(
                path,
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
            .from(
                "forum-images"
            )
            .getPublicUrl(
                path
            );


    return data.publicUrl;
}


/* =========================================================
   LOAD BÀI VIẾT
========================================================= */

async function loadOfficialArticles() {

    const list =
        document.getElementById(
            "officialArticleList"
        );

    if (!list) {
        return;
    }


    list.innerHTML = `
        <div class="forum-loading">
            <div class="forum-loading-spinner"></div>
            <span>Đang tải bài viết...</span>
        </div>
    `;


    const {
        data: articles,
        error
    } =
        await supabaseClient
            .from(
                "forum_articles"
            )
            .select("*")
            .order(
                "created_at",
                {
                    ascending:
                        false
                }
            );


    if (error) {

        console.error(
            "Load articles error:",
            error
        );

        list.innerHTML = `
            <div class="forum-empty">
                <i class="fa-regular fa-newspaper"></i>

                <h3>
                    Không thể tải bài viết
                </h3>

                <p>
                    Vui lòng thử lại sau.
                </p>
            </div>
        `;

        return;
    }

    window.__forumArticles =
    articles || [];


    if (!articles?.length) {

        list.innerHTML = `
            <div class="forum-empty">

                <i class="fa-regular fa-newspaper"></i>

                <h3>
                    Chưa có bài viết
                </h3>

                <p>
                    Hiện chưa có nội dung chính thức nào.
                </p>

            </div>
        `;

        return;
    }


    const authorIds =
        [
            ...new Set(
                articles.map(
                    article =>
                        article.author_id
                )
            )
        ];


    let profiles = [];


    if (authorIds.length) {

        const {
            data
        } =
            await supabaseClient
                .from("users")
                .select(`
                    user_id,
                    fullname,
                    avatar_url,
                    role,
                    student_verified
                `)
                .in(
                    "user_id",
                    authorIds
                );

        profiles =
            data || [];
    }


    list.innerHTML =
        articles
            .map(
                article => {

                    const author =
                        profiles.find(
                            profile =>
                                profile.user_id ===
                                article.author_id
                        ) || {};


                    return createArticleCard(
                        article,
                        author
                    );
                }
            )
            .join("");


    bindArticleEvents();

}


/* =========================================================
   TẠO CARD BÀI VIẾT
========================================================= */

function createArticleCard(
    article,
    author
) {

    const name =
        author.fullname ||
        "IUH SHOP";


    const avatar =
        author.avatar_url ||
        DEFAULT_AVATAR;


    const verified =
        hasVerifiedBadge(
            author
        );


    const plainText =
        document.createElement(
            "div"
        );


    plainText.innerHTML =
        article.content || "";


    const excerpt =
        (
            plainText.textContent ||
            ""
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim()
            .slice(
                0,
                180
            );


    const canManage =
        currentUser &&
        currentUser.id ===
            article.author_id;


    return `
        <article
            class="official-article-card"
            data-article-id="${article.id}"
        >

            ${
                article.image_url
                    ? `
                        <div class="article-card-image">

                            <img
                                src="${escapeHTML(article.image_url)}"
                                alt="${escapeHTML(article.title || "Bài viết")}"
                                onerror="this.style.display='none'"
                            >

                        </div>
                    `
                    : ""
            }


            <div class="article-card-body">

                <div class="article-card-category">
                    ${escapeHTML(
                        article.category ||
                        "THÔNG BÁO"
                    )}
                </div>


                <h3 class="article-card-title">
                    ${escapeHTML(
                        article.title ||
                        "Bài viết"
                    )}
                </h3>


                <p class="article-card-excerpt">
                    ${escapeHTML(
                        excerpt ||
                        "Xem nội dung bài viết..."
                    )}
                </p>


                <div class="article-card-meta">

                    <div class="article-card-author">

                        <img
                            src="${escapeHTML(avatar)}"
                            alt="${escapeHTML(name)}"
                            onerror="this.src='${DEFAULT_AVATAR}'"
                        >

                        <span>
                            ${escapeHTML(name)}
                        </span>

                        ${
                            verified
                                ? `
                                    <span
                                        class="forum-verified-badge"
                                        title="${escapeHTML(
                                            getVerifiedTitle(
                                                author
                                            )
                                        )}"
                                    >
                                        <i class="fa-solid fa-check"></i>
                                    </span>
                                `
                                : ""
                        }

                    </div>

                    <span>•</span>

                    <span>
                        ${timeAgo(
                            article.created_at
                        )}
                    </span>

                </div>


                <div class="article-card-actions">

                    <button
                        type="button"
                        class="article-read-button"
                        data-action="read"
                    >
                        <i class="fa-regular fa-eye"></i>
                        Đọc bài
                    </button>

                    ${
                        canManage
                            ? `
                                <button
                                    type="button"
                                    class="article-edit-button"
                                    data-action="edit"
                                >
                                    <i class="fa-regular fa-pen-to-square"></i>
                                    Sửa
                                </button>

                                <button
                                    type="button"
                                    class="article-delete-button"
                                    data-action="delete"
                                >
                                    <i class="fa-regular fa-trash-can"></i>
                                    Xóa
                                </button>
                            `
                            : ""
                    }

                </div>

            </div>

        </article>
    `;
}


/* =========================================================
   EVENT BÀI VIẾT
========================================================= */

function bindArticleEvents() {

    document
        .querySelectorAll(
            ".official-article-card"
        )
        .forEach(
            card => {

                const articleId =
                    card.dataset.articleId;


                const article =
                    window.__forumArticles?.find(
                        item =>
                            String(item.id) ===
                            String(articleId)
                    );


                card
                    .querySelector(
                        '[data-action="read"]'
                    )
                    ?.addEventListener(
                        "click",
                        () => {

                            if (article) {
                                openArticleViewer(
                                    article
                                );
                            }

                        }
                    );


                card
                    .querySelector(
                        '[data-action="edit"]'
                    )
                    ?.addEventListener(
                        "click",
                        () => {

                            if (article) {
                                openArticleModal(
                                    article
                                );
                            }

                        }
                    );


                card
                    .querySelector(
                        '[data-action="delete"]'
                    )
                    ?.addEventListener(
                        "click",
                        async () => {

                            if (!article) {
                                return;
                            }

                            await deleteArticle(
                                article.id
                            );

                        }
                    );

            }
        );
}


/* =========================================================
   XÓA BÀI
========================================================= */

async function deleteArticle(
    articleId
) {

    if (!requireLogin()) {
        return;
    }


    if (
        !confirm(
            "Bạn chắc chắn muốn xóa bài viết này?"
        )
    ) {
        return;
    }


    const {
        error
    } =
        await supabaseClient
            .from(
                "forum_articles"
            )
            .delete()
            .eq(
                "id",
                articleId
            )
            .eq(
                "author_id",
                currentUser.id
            );


    if (error) {

        console.error(
            "Delete article error:",
            error
        );

        alert(
            "Không thể xóa bài viết."
        );

        return;
    }


    await loadOfficialArticles();

}


/* =========================================================
   VIEW BÀI VIẾT
========================================================= */

function openArticleViewer(
    article
) {

    const modal =
        document.getElementById(
            "articleModal"
        );

    if (!modal) {
        return;
    }


    const modalBox =
        modal.querySelector(
            ".article-modal-box"
        );


    modalBox.innerHTML = `

        <div class="article-modal-header">

            <div>

                <span class="article-modal-eyebrow">
                    IUH SHOP INFORMATION
                </span>

                <h2>
                    ${escapeHTML(
                        article.title ||
                        "Bài viết"
                    )}
                </h2>

            </div>


            <button
                type="button"
                class="article-modal-close"
                onclick="closeArticleModal()"
            >
                <i class="fa-solid fa-xmark"></i>
            </button>

        </div>


        <div
            style="
                padding: 25px 28px 30px;
            "
        >

            ${
                article.image_url
                    ? `
                        <img
                            src="${escapeHTML(article.image_url)}"
                            alt="${escapeHTML(article.title || "Bài viết")}"
                            style="
                                width:100%;
                                max-height:420px;
                                object-fit:cover;
                                border-radius:12px;
                                margin-bottom:22px;
                            "
                        >
                    `
                    : ""
            }


            <div class="article-full-content">
                ${article.content || ""}
            </div>

        </div>

    `;


    modal.classList.add(
        "show"
    );

    document.body.style.overflow =
        "hidden";
}

function setupOfficialArticles() {

    const adminButton =
        document.getElementById(
            "adminCreateArticle"
        );

    adminButton?.addEventListener(
        "click",
        function () {

            openArticleModal();

        }
    );


    document
        .getElementById(
            "closeArticleModal"
        )
        ?.addEventListener(
            "click",
            closeArticleModal
        );


    document
        .getElementById(
            "cancelArticleButton"
        )
        ?.addEventListener(
            "click",
            closeArticleModal
        );


    document
        .getElementById(
            "articleModalOverlay"
        )
        ?.addEventListener(
            "click",
            closeArticleModal
        );


    document
        .getElementById(
            "articleImageInput"
        )
        ?.addEventListener(
            "change",
            function () {

                const file =
                    this.files?.[0];

                if (!file) {
                    return;
                }


                selectedArticleImage =
                    file;


                const preview =
                    document.getElementById(
                        "articleImagePreview"
                    );

                const image =
                    document.getElementById(
                        "articlePreviewImg"
                    );


                image.src =
                    URL.createObjectURL(
                        file
                    );

                preview.hidden =
                    false;

            }
        );


    document
        .getElementById(
            "removeArticleImage"
        )
        ?.addEventListener(
            "click",
            function () {

                selectedArticleImage =
                    null;

                document
                    .getElementById(
                        "articleImageInput"
                    )
                    .value =
                    "";

                document
                    .getElementById(
                        "articleImagePreview"
                    )
                    .hidden =
                    true;

            }
        );


    document
        .getElementById(
            "saveArticleButton"
        )
        ?.addEventListener(
            "click",
            saveArticle
        );


    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key ===
                "Escape"
            ) {

                const modal =
                    document.getElementById(
                        "articleModal"
                    );

                if (
                    modal?.classList.contains(
                        "show"
                    )
                ) {

                    closeArticleModal();

                }

            }

        }
    );

}

async function saveArticle() {

    if (!requireLogin()) {
        return;
    }


    if (!isArticleAdmin()) {

        alert(
            "Bạn không có quyền thực hiện chức năng này."
        );

        return;
    }


    const titleInput =
        document.getElementById(
            "articleTitleInput"
        );

    const categoryInput =
        document.getElementById(
            "articleCategoryInput"
        );

    const editor =
        document.getElementById(
            "articleEditor"
        );

    const saveButton =
        document.getElementById(
            "saveArticleButton"
        );


    const title =
        titleInput.value.trim();

    const category =
        categoryInput.value;

    const content =
        editor.innerHTML.trim();


    if (!title) {

        alert(
            "Vui lòng nhập tiêu đề bài viết."
        );

        titleInput.focus();

        return;
    }


    if (!content) {

        alert(
            "Vui lòng nhập nội dung bài viết."
        );

        editor.focus();

        return;
    }


    saveButton.disabled =
        true;


    saveButton.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        Đang lưu...
    `;


    try {

        let imageUrl =
            null;


        if (selectedArticleImage) {

            imageUrl =
                await uploadArticleImage(
                    selectedArticleImage
                );

        }


        if (articleEditingId) {

            const updateData = {
                title,
                category,
                content
            };


            if (imageUrl) {
                updateData.image_url =
                    imageUrl;
            }


            const {
                error
            } =
                await supabaseClient
                    .from(
                        "forum_articles"
                    )
                    .update(
                        updateData
                    )
                    .eq(
                        "id",
                        articleEditingId
                    )
                    .eq(
                        "author_id",
                        currentUser.id
                    );


            if (error) {
                throw error;
            }


            alert(
                "Đã cập nhật bài viết."
            );

        } else {

            const {
                error
            } =
                await supabaseClient
                    .from(
                        "forum_articles"
                    )
                    .insert({

                        author_id:
                            currentUser.id,

                        title,

                        category,

                        content,

                        image_url:
                            imageUrl

                    });


            if (error) {
                throw error;
            }


            alert(
                "Đã đăng bài viết."
            );

        }


        closeArticleModal();

        await loadOfficialArticles();

    }
    catch (error) {

        console.error(
            "Save article error:",
            error
        );


        alert(
            error.message ||
            "Không thể lưu bài viết."
        );

    }
    finally {

        saveButton.disabled =
            false;

        saveButton.innerHTML = `
            <i class="fa-solid fa-paper-plane"></i>
            Đăng bài viết
        `;

    }

}

/* =========================================================
   DROPDOWN TÀI KHOẢN - HEADER
========================================================= */

function setupAccountDropdown() {

    const userAccountButton =
        document.getElementById("userAccountButton");

    const accountDropdown =
        document.getElementById("accountDropdown");

    if (!userAccountButton || !accountDropdown) {
        return;
    }

    function closeDropdown() {
        accountDropdown.style.display = "none";
    }

    function toggleDropdown(event) {

        event.preventDefault();
        event.stopPropagation();

        if (!document.body.classList.contains("logged-in")) {
            closeDropdown();
            return;
        }

        const isOpen =
            accountDropdown.style.display === "block";

        accountDropdown.style.display =
            isOpen ? "none" : "block";
    }

    closeDropdown();

    userAccountButton.addEventListener(
        "click",
        toggleDropdown
    );

    accountDropdown.addEventListener(
        "click",
        function (event) {
            event.stopPropagation();
        }
    );

    document.addEventListener(
        "click",
        function () {
            closeDropdown();
        }
    );
}


/* =========================================================
   TÀI KHOẢN Ở TẦNG 1
========================================================= */

function setupAccountNavDropdown() {

    const accountWrapper =
        document.querySelector(".account-nav-wrapper");

    const accountArrow =
        document.getElementById("accountNavArrow");

    const accountShortcuts =
        document.getElementById("accountShortcuts");

    if (
        !accountWrapper ||
        !accountArrow ||
        !accountShortcuts
    ) {
        return;
    }


    /* BẤM MŨI TÊN */

    accountArrow.addEventListener(
        "click",
        function (event) {

            event.preventDefault();
            event.stopPropagation();

            accountWrapper.classList.toggle("open");

        }
    );


    /* BẤM VÀO MENU */

    accountShortcuts.addEventListener(
        "click",
        function (event) {
            event.stopPropagation();
        }
    );


    /* BẤM RA NGOÀI */

    document.addEventListener(
        "click",
        function () {

            accountWrapper.classList.remove("open");

        }
    );

}

/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        setupActiveNavigation();

        await updateUserMenu();

           /* DROPDOWN HEADER */
        setupAccountDropdown();

        /* TÀI KHOẢN TẦNG 1 */
        setupAccountNavDropdown();

        setupForumTabs();

        setupForumSort();


        await loadCurrentUser();


        setupCreatePostModal();


        await loadForumPosts();


        setupForumRealtime();


        scrollToSharedPost();

        setupOfficialArticles();

await loadOfficialArticles();

    }
);