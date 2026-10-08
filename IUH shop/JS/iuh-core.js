/* Shared browser services. Load after the pinned Supabase SDK; load DOMPurify before rendering rich HTML. */
(function () {
    "use strict";
    if (window.IUHCore) return;
    const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
    function safeURL(value, fallback = "") {
        if (typeof value !== "string" || !value.trim()) return fallback;
        try {
            const url = new URL(value.trim(), window.location.href);
            return ["http:", "https:"].includes(url.protocol) ? url.href : fallback;
        } catch (_) { return fallback; }
    }
    function sanitizeHTML(value) {
        if (!window.DOMPurify) return escapeHTML(value);
        return window.DOMPurify.sanitize(String(value ?? ""), {
            ALLOWED_TAGS: ["p", "br", "b", "strong", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "div", "span", "pre", "code", "a", "img", "table", "thead", "tbody", "tr", "th", "td", "hr"],
            ALLOWED_ATTR: ["href", "src", "alt", "title", "width", "height", "colspan", "rowspan"],
            ALLOW_DATA_ATTR: false,
            ALLOW_ARIA_ATTR: false,
            ALLOW_UNKNOWN_PROTOCOLS: false,
            FORBID_TAGS: ["svg", "math", "style", "script", "iframe", "form", "input", "button"],
            FORBID_ATTR: ["style", "srcset", "id", "name"],
            ADD_DATA_URI_TAGS: [],
            ALLOWED_URI_REGEXP: /^(?:(?:https?):|[^a-z]|[a-z+.-]+(?:[^a-z+.:\-]|$))/i
        });
    }
    window.IUHSecurity = Object.freeze({ escapeHTML, safeURL, sanitizeHTML });
    let client;
    function getClient() {
        if (!client) client = window.IUH_SUPABASE || window.supabase.createClient(
            "https://xecxofmogvqysejjpxvl.supabase.co",
            "sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC"
        );
        window.IUH_SUPABASE = client;
        return client;
    }
    let pendingUser;
    // Session existence is only a guest check; identity still comes from Auth.
    function getUser() {
        if (!pendingUser) pendingUser = (async () => {
            const auth = getClient().auth;
            const { data, error } = await auth.getSession();
            if (error) return { data: { user: null }, error };
            if (!data?.session) return { data: { user: null }, error: null };
            const result = await auth.getUser();
            if (result.error?.name === 'AuthSessionMissingError') {
                return { data: { user: null }, error: null };
            }
            if (result.data?.user) {
                const latest = await auth.getSession();
                if (latest.error) return { data: { user: null }, error: latest.error };
                if (latest.data?.session?.user?.id !== result.data.user.id) {
                    return { data: { user: null }, error: null };
                }
            }
            return result;
        })().finally(() => { pendingUser = null; });
        return pendingUser;
    }
    // Supabase holds its auth lock while invoking subscribers. Defer UI work
    // so callbacks may safely query Auth without waiting on their own lock.
    function onAuthStateChange(callback) {
        let active = true;
        const result = getClient().auth.onAuthStateChange((event, session) => {
            setTimeout(() => {
                if (active) Promise.resolve().then(() => callback(event, session))
                    .catch(() => console.error('PASSIT: Unable to refresh account display.'));
            }, 0);
        });
        return { data: { subscription: { unsubscribe() {
            active = false;
            result.data.subscription.unsubscribe();
        } } } };
    }
    function objectPath(value, bucket) {
        if (!value) return "";
        const input = String(value);
        if (!/^https?:/i.test(input)) return input.replace(/^\/+/, "");
        try {
            const url = new URL(input);
            if (url.origin !== "https://xecxofmogvqysejjpxvl.supabase.co") return "";
            for (const kind of ["public", "sign", "authenticated"]) {
                const prefix = `/storage/v1/object/${kind}/${bucket}/`;
                if (url.pathname.startsWith(prefix)) return decodeURIComponent(url.pathname.slice(prefix.length));
            }
        } catch (_) { /* invalid legacy URL */ }
        return "";
    }
    async function privateImageURL(value, bucket = "student-cards") {
        const path = objectPath(value, bucket);
        if (!path || path.split("/").includes("..")) throw new Error("Đường dẫn ảnh không hợp lệ.");
        const { data, error } = await getClient().storage.from(bucket).createSignedUrl(path, 300);
        if (error) throw error;
        return data.signedUrl;
    }
    window.IUHCore = Object.freeze({ getClient, getUser, onAuthStateChange, objectPath, privateImageURL });
})();
