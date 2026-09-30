/* Shared, server-authoritative service package state. */
(function () {
    const packageCache = new Map();
    const ATTEMPT_KEY = "iuhPackageAttempt:";
    let client = window.IUHCore?.getClient() || null;
    function normalizePackage(value) {
        if (!value) return null;
        const expiry = new Date(value.expires_at || value.expiry);
        if (!Number.isFinite(expiry.getTime()) || expiry <= new Date()) return null;
        return { ...value, plan: value.plan_type || value.plan, expiry: expiry.toISOString(), members: value.members || [] };
    }

    async function request(name, args) {
        if (!client) return { error: new Error("Kết nối chưa sẵn sàng. Vui lòng tải lại trang.") };
        let timer;
        const controller = new AbortController();
        try {
            let query = client.rpc(name, args);
            if (typeof query.abortSignal === "function") query = query.abortSignal(controller.signal);
            const timeout = new Promise((resolve) => {
                timer = window.setTimeout(() => {
                    controller.abort();
                    resolve({ error: new Error("Chưa nhận được kết quả. Bấm kiểm tra lại để tiếp tục cùng giao dịch, không tạo giao dịch mới.") });
                }, 20000);
            });
            const result = await Promise.race([query, timeout]);
            if (result.error) return { error: result.error };
            if (result.data?.success === false) return { error: new Error(result.data.message || "Không thể xử lý gói dịch vụ.") };
            return { data: result.data };
        } catch (error) {
            return { error };
        } finally {
            window.clearTimeout(timer);
        }
    }

    function getPackage(userId) {
        const value = normalizePackage(packageCache.get(userId));
        if (!value) packageCache.delete(userId);
        return value;
    }

    async function loadCurrent(userId) {
        const result = await request("get_my_service_package");
        if (result.error) return result;
        const data = result.data || {};
        packageCache.set(userId, normalizePackage(data.package ? { ...data.package, members: data.members || [] } : null));
        return { data: { ...data, package: getPackage(userId), members: data.members || [], pending_requests: data.pending_requests || [] } };
    }

    async function loadForUsers(userIds) {
        const ids = [...new Set((userIds || []).filter(Boolean))];
        if (!client || !ids.length) return;
        const { data, error } = await client.from("service_package_badges").select("user_id, owner_id, plan_type, expires_at").in("user_id", ids);
        if (error) throw error;
        ids.forEach((id) => packageCache.delete(id));
        (data || []).forEach((value) => packageCache.set(value.user_id, normalizePackage(value)));
    }

    function readAttempt(userId) {
        try {
            const value = JSON.parse(localStorage.getItem(ATTEMPT_KEY + userId) || "null");
            return value && typeof value.transaction === "string" && ["personal", "group"].includes(value.plan) && value.paymentMethod === "trial" && Array.isArray(value.memberIds) ? value : null;
        } catch (_) { return null; }
    }

    function setupModal(supabaseClient) {
        const modal = document.getElementById("upgradeModal");
        const openButton = document.getElementById("openUpgradeModalButton");
        if (!modal || !openButton) return;
        const service = window.IUHServicePackage;
        service.configure(supabaseClient);
        const byId = (id) => document.getElementById(id);
        const formView = byId("upgradeFormView");
        const successView = byId("upgradeSuccessView");
        const confirmButton = byId("confirmUpgradeButton");
        const message = byId("upgradePaymentMessage");
        const memberEmail = byId("servicePackageMemberEmail");
        const memberMessage = byId("servicePackageMemberMessage");
        const memberList = byId("servicePackageMemberList");
        const addMemberButton = byId("addServicePackageMemberButton");
        const pendingList = byId("servicePackagePendingRequests");
        const planButtons = [...document.querySelectorAll(".service-plan-card")];
        const plans = { personal: { name: "Gói Cá nhân", price: 19000 }, group: { name: "Gói Nhóm", price: 29000 } };
        let selectedPlan = "personal";
        const selectedMethod = "trial";
        let members = [];
        let userId = null;
        let state = { package: null, pending_requests: [] };
        let attempt = null;
        let busy = false;
        let findingMember = false;
        let loaded = false;
        let epoch = 0;
        const money = (value) => new Intl.NumberFormat("vi-VN").format(value) + "đ";
        const memberOnly = () => !!state.package && state.package.owner_id !== userId;

        function renderControls() {
            const locked = busy || findingMember || !loaded || !!attempt || memberOnly();
            planButtons.forEach((button) => {
                button.classList.toggle("selected", button.dataset.plan === selectedPlan);
                button.setAttribute("aria-pressed", String(button.dataset.plan === selectedPlan));
                button.disabled = locked || (!!state.package && button.dataset.plan !== state.package.plan);
            });
            byId("servicePackageGroupManager").hidden = selectedPlan !== "group";
            byId("upgradeSelectedPlan").textContent = plans[selectedPlan].name;
            byId("upgradeTotal").textContent = "0đ · dùng thử";
            memberEmail.disabled = locked;
            addMemberButton.disabled = locked || members.length >= 2;
            memberList.querySelectorAll("button").forEach((button) => { button.disabled = locked; });
            byId("closeUpgradeModalButton").disabled = busy;
            byId("finishUpgradeButton").disabled = busy;
            confirmButton.disabled = busy || findingMember || !loaded || memberOnly() || (state.pending_requests.length > 0 && !attempt);
            const label = busy ? "Đang xử lý..." : state.package ? "Gia hạn miễn phí 30 ngày" : "Kích hoạt gói dùng thử";
            confirmButton.innerHTML = '<i class="fa-solid ' + (busy ? 'fa-spinner fa-spin' : 'fa-check') + '"></i> ' + label;
            modal.setAttribute("aria-busy", String(busy));
        }

        function renderMembers() {
            byId("servicePackageMemberCount").textContent = (members.length + 1) + "/3";
            memberList.innerHTML = members.map((member, index) => '<div class="service-package-member"><img class="service-package-member-avatar" src="' + service.escapeHTML(window.IUHSecurity.safeURL(member.avatar_url, "../Images/default-avatar.svg")) + '" alt=""><span class="service-package-member-info"><strong>' + service.escapeHTML(member.fullname || "Thành viên") + '</strong><span>' + service.escapeHTML(member.email || "Tài khoản IUH SHOP") + '</span></span><button type="button" class="service-package-member-remove" data-member-index="' + index + '" aria-label="Xóa thành viên"><i class="fa-solid fa-xmark"></i></button></div>').join("");
            memberList.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
                if (busy || findingMember || attempt || memberOnly()) return;
                members.splice(Number(button.dataset.memberIndex), 1); renderMembers();
            }));
            renderControls();
        }

        function renderStatus() {
            const reminder = byId("servicePackageReminder");
            reminder.hidden = !state.package && !attempt;
            if (state.package) {
                const days = Math.max(0, Math.ceil((new Date(state.package.expiry) - new Date()) / 86400000));
                const roleText = memberOnly() ? "Bạn là thành viên. Chủ gói quản lý và gia hạn cho nhóm." : "Gia hạn cùng gói cộng thêm 30 ngày vào hạn hiện tại. Có thể đổi loại gói sau khi hết hạn.";
                reminder.textContent = (days <= 5 ? "Gói sắp hết hạn. " : "Đang dùng ") + plans[state.package.plan].name + ", đến " + service.formatExpiry(state.package.expiry) + " (" + days + " ngày). " + roleText;
            } else reminder.textContent = attempt ? "Có giao dịch chưa nhận được kết quả. Kiểm tra lại cùng mã để tránh thanh toán lặp." : "";
            pendingList.innerHTML = state.pending_requests.map((request) => '<div class="service-package-pending"><strong>Giao dịch cũ đang chờ xử lý</strong><span>Mã: ' + service.escapeHTML(request.transaction_code) + ' · ' + money(request.price) + '</span><p>Liên hệ quản trị viên để kiểm tra giao dịch trước khi tạo lượt dùng thử.</p></div>').join("");
        }

        async function reloadState() {
            const result = await service.loadCurrent(userId);
            if (result.error) { message.textContent = result.error.message; return false; }
            state = result.data; loaded = true;
            return true;
        }

        function showReceipt(receipt) {
            const cancelled = receipt.status === "cancelled";
            const trial = receipt.payment_method === "trial";
            const icon = successView.querySelector('.upgrade-success-icon i');
            if (icon) icon.className = 'fa-solid ' + (cancelled ? 'fa-xmark' : 'fa-check');
            byId("upgradeSuccessEyebrow").textContent = cancelled ? "THÔNG TIN GIAO DỊCH" : trial ? "KÍCH HOẠT DÙNG THỬ" : "GIAO DỊCH ĐÃ GHI NHẬN";
            byId("upgradeSuccessHeading").textContent = cancelled ? "Yêu cầu đã hủy" : trial ? "Gói dùng thử đã được kích hoạt" : "Gói dịch vụ đã được kích hoạt";
            byId("upgradeSuccessText").textContent = cancelled ? "Gói chưa được kích hoạt từ yêu cầu này." : trial ? "Gói được kích hoạt miễn phí trong giai đoạn chạy thử. Không có khoản tiền nào được thu." : "Gói dịch vụ đã được hệ thống xác nhận.";
            byId("upgradeTransactionCode").textContent = receipt.transaction_code;
            byId("upgradeExpiryDate").textContent = receipt.expires_at ? service.formatExpiry(receipt.expires_at) : "Chưa kích hoạt";
            formView.hidden = true; successView.hidden = false;
            modal.querySelector('.upgrade-modal-content').scrollTop=0;
        }

        async function openModal() {
            if (busy) return;
            const currentEpoch = ++epoch;
            busy = true; loaded = false; findingMember = false;
            formView.hidden = false; successView.hidden = true;
            message.textContent = "Đang tải gói từ hệ thống..."; memberMessage.textContent = "";
            state = { package: null, pending_requests: [] }; members = []; attempt = null;
            modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden";
            renderControls();
            try {
                const { data, error } = await supabaseClient.auth.getUser();
                if (error || !data.user) throw new Error("Vui lòng đăng nhập để sử dụng gói dịch vụ.");
                userId = data.user.id; attempt = service.readAttempt(userId);
                if (!await reloadState() || currentEpoch !== epoch) return;
                selectedPlan = attempt?.plan || state.package?.plan || "personal";
                members = (state.members || []).filter((member) => member.user_id !== state.package?.owner_id);
                if (attempt) members = attempt.memberIds.map((id) => members.find((member) => member.user_id === id) || { user_id: id, fullname: "Thành viên đã chọn" });
                message.textContent = attempt ? "Hãy kiểm tra lại giao dịch chưa rõ kết quả trước khi tạo giao dịch khác." : "";
                const previous = attempt && (state.recent_transactions || []).find((item) => item.transaction_code === attempt.transaction);
                if (previous && ["paid", "pending", "cancelled"].includes(previous.status)) {
                    service.clearAttempt(userId); attempt = null;
                    if (previous.status !== "cancelled") showReceipt(previous);
                    else message.textContent = "Yêu cầu trước đã được hủy. Bạn có thể tạo yêu cầu mới.";
                }
            } catch (error) { message.textContent = error.message; }
            finally { busy = false; renderStatus(); renderMembers(); renderControls(); }
        }

        function closeModal() {
            if (busy) return;
            epoch++;
            modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = "";
            openButton.focus();
        }

        async function addMember() {
            if (busy || findingMember || attempt || memberOnly() || members.length >= 2) return;
            const email = memberEmail.value.trim().toLowerCase();
            if (!email || !memberEmail.checkValidity()) { memberMessage.textContent = "Vui lòng nhập email hợp lệ."; return; }
            const currentEpoch = epoch;
            findingMember = true; renderControls(); memberMessage.textContent = "Đang tìm thành viên...";
            try {
                const { data, error } = await service.request("find_service_package_member", { p_email: email });
                if (error) throw error;
                if (currentEpoch !== epoch) return;
                if (data.user_id === userId || members.some((member) => member.user_id === data.user_id)) throw new Error("Tài khoản này đã có trong nhóm.");
                if (members.length >= 2) throw new Error("Nhóm tối đa 3 tài khoản gồm chủ gói.");
                members.push({ ...data, email }); memberEmail.value = ""; memberMessage.textContent = "";
            } catch (error) { memberMessage.textContent = error.message; }
            finally { findingMember = false; renderMembers(); }
        }

        async function purchase() {
            if (busy || findingMember || !loaded || memberOnly() || (state.pending_requests.length && !attempt)) return;
            busy = true; message.textContent = ""; renderControls();
            try {
                if (!attempt) {
                    const next = { plan: selectedPlan, paymentMethod: selectedMethod, transaction: service.createTransactionCode(), memberIds: selectedPlan === "group" ? members.map((member) => member.user_id).sort() : [] };
                    service.rememberAttempt(userId, next); attempt = Object.freeze(next);
                }
                const result = await service.purchase(attempt);
                if (result.error) {
                    // SQL/PostgREST rejections did not commit. A lost reply retains the same retry key.
                    if (/^[0-9A-Z]{5}$|^PGRST/.test(result.error.code || "")) { service.clearAttempt(userId); attempt = null; }
                    throw result.error;
                }
                service.clearAttempt(userId); attempt = null;
                showReceipt(result.data); await reloadState();
            } catch (error) { message.textContent = error.message || "Chưa nhận được kết quả giao dịch. Vui lòng kiểm tra lại."; }
            finally { busy = false; renderStatus(); renderControls(); }
        }

        openButton.addEventListener("click", openModal);
        byId("closeUpgradeModalButton").addEventListener("click", closeModal);
        byId("upgradeModalOverlay").addEventListener("click", closeModal);
        byId("finishUpgradeButton").addEventListener("click", closeModal);
        planButtons.forEach((button) => button.addEventListener("click", () => {
            if (button.disabled || busy || attempt) return;
            selectedPlan = button.dataset.plan; message.textContent = ""; renderControls();
        }));
        addMemberButton.addEventListener("click", addMember);
        memberEmail.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addMember(); } });
        confirmButton.addEventListener("click", purchase);
        document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal.classList.contains("open")) closeModal(); });
        renderControls();
    }

    window.IUHServicePackage = {
        setupModal,
        configure(value) { client = value; },
        request, getPackage, loadCurrent, loadForUsers,
        getBadge(userId) {
            const value = getPackage(userId);
            if (!value) return null;
            return value.plan === "group" && value.owner_id !== userId
                ? { label: "Thành viên nổi bật", className: "group-featured-badge" }
                : { label: "Người bán nổi bật", className: "seller-featured-badge" };
        },
        escapeHTML(value) {
            return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
        },
        formatExpiry(value) { return new Date(value).toLocaleDateString("vi-VN"); },
        createTransactionCode() { return "IUH-" + crypto.randomUUID(); },
        readAttempt,
        rememberAttempt(userId, value) {
            // Persist the idempotency key before sending; fail closed if persistence is unavailable.
            localStorage.setItem(ATTEMPT_KEY + userId, JSON.stringify(value));
        },
        clearAttempt(userId) { localStorage.removeItem(ATTEMPT_KEY + userId); },
        async purchase(value) {
            const result = await request("purchase_service_package", {
                p_plan_type: value.plan,
                p_payment_method: "trial",
                p_transaction_code: value.transaction,
                p_member_ids: value.memberIds
            });
            if (!result.error && (!result.data?.transaction_code || !["paid", "pending"].includes(result.data.status))) {
                return { error: new Error("Kết quả giao dịch chưa rõ. Vui lòng kiểm tra lại cùng giao dịch.") };
            }
            return result;
        }
    };
})();
