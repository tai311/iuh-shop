/* Student cards stay in private storage; only the server can grant verification. */
(function () {
    "use strict";
    const panel = document.getElementById("accountVerificationPanel");
    if (!panel) return;
    const form = document.getElementById("accountVerificationForm");
    const fileInput = document.getElementById("accountVerificationFile");
    const submit = document.getElementById("accountVerificationSubmit");
    const status = document.getElementById("accountVerificationStatus");
    const message = document.getElementById("accountVerificationMessage");
    const preview = document.getElementById("accountVerificationPreview");
    const reload = document.getElementById("accountVerificationReload");
    const client = window.IUHCore.getClient();
    let busy = false;
    let renderVersion = 0;

    function showMessage(text, failed = false) {
        message.textContent = text;
        message.style.color = failed ? "#b42318" : "#193f9e";
    }
    async function renderProfile(profile) {
        const version = ++renderVersion;
        status.textContent = profile.student_verified ? "Đã xác thực sinh viên"
            : profile.verification_status === "pending" ? "Đã gửi thẻ · Đang chờ quản trị viên duyệt"
            : "Chưa xác thực sinh viên";
        fileInput.disabled = profile.student_verified === true;
        submit.disabled = profile.student_verified === true;
        preview.hidden = true;
        preview.removeAttribute("src");
        if (!profile.student_card_url) return;
        try {
            const bucket = /\/student-verifications\//.test(profile.student_card_url) ? "student-verifications" : "student-cards";
            const url = await window.IUHCore.privateImageURL(profile.student_card_url, bucket);
            if (version !== renderVersion) return;
            preview.src = url;
            preview.hidden = false;
        } catch (error) {
            if (version === renderVersion) showMessage("Chưa xem được ảnh thẻ. Bấm tải lại trạng thái để thử lại.", true);
        }
    }
    async function loadProfile() {
        const { data: { user }, error: authError } = await client.auth.getUser();
        if (authError || !user) {
            status.textContent = "Vui lòng đăng nhập để gửi thẻ sinh viên.";
            submit.disabled = true;
            fileInput.disabled = true;
            return null;
        }
        const { data: profile, error } = await client.from("users")
            .select("user_id,student_verified,verification_status,student_card_url")
            .eq("user_id", user.id).single();
        if (error || !profile) throw error || new Error("Chưa tải được thông tin xác thực.");
        await renderProfile(profile);
        return { user, profile };
    }
    async function refresh() {
        if (busy) return;
        showMessage("");
        reload.disabled = true;
        try { await loadProfile(); }
        catch (error) { showMessage("Không tải được thông tin xác thực. Vui lòng thử lại.", true); }
        finally { reload.disabled = false; }
    }
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (busy) return;
        const file = fileInput.files?.[0];
        const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
        if (!file || !extensions[file.type] || file.size > 5 * 1024 * 1024) {
            showMessage("Chọn ảnh JPG, PNG hoặc WebP tối đa 5MB.", true);
            return;
        }
        busy = true;
        submit.disabled = true;
        reload.disabled = true;
        submit.textContent = "Đang gửi thẻ...";
        showMessage("");
        let uploadedPath = null;
        let saved = false;
        try {
            const { data: { user }, error: authError } = await client.auth.getUser();
            if (authError || !user) throw new Error("Vui lòng đăng nhập lại để gửi thẻ.");
            const objectPath = `${user.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
            const { error: uploadError } = await client.storage.from("student-cards")
                .upload(objectPath, file, { upsert: false, contentType: file.type });
            if (uploadError) throw uploadError;
            uploadedPath = objectPath;
            const { data, error } = await client.from("users").update({
                student_card_url: objectPath, verification_status: "pending"
            }).eq("user_id", user.id).select("user_id").single();
            if (error || !data) throw error || new Error("Chưa lưu được yêu cầu xác thực.");
            saved = true;
            fileInput.value = "";
            await loadProfile();
            showMessage("Đã gửi thẻ sinh viên. Quản trị viên sẽ kiểm tra và xác thực tài khoản.");
        } catch (error) {
            if (uploadedPath && !saved) {
                await client.storage.from("student-cards").remove([uploadedPath]).catch(() => {});
            }
            showMessage(saved ? "Đã gửi yêu cầu. Chưa tải lại được trạng thái; vui lòng bấm tải lại."
                : error.message || "Chưa gửi được thẻ. Vui lòng thử lại.", !saved);
        } finally {
            busy = false;
            submit.disabled = fileInput.disabled;
            reload.disabled = false;
            submit.textContent = "Gửi thẻ để xác thực";
        }
    });
    reload.addEventListener("click", refresh);
    void refresh();
    if (new URLSearchParams(window.location.search).get("verify") === "1") panel.scrollIntoView({ block: "center" });
})();
