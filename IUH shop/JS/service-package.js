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

    async function payosRequest(action, value) {
        try {
            const result=await client.functions.invoke('payos-package',{timeout:45000,body:{action,transaction:value.transaction,plan:value.plan,memberIds:value.memberIds}});
            if(result.error){
                let detail;try{detail=await result.error.context?.json();}catch(_){}
                return {error:new Error(detail?.error||'Chưa nhận được phản hồi payOS. Kiểm tra lại cùng giao dịch.')};
            }
            if(result.data?.error)return {error:new Error(result.data.error)};
            return result;
        }catch(error){return {error};}
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
            return value && typeof value.transaction === "string" && ["personal", "group"].includes(value.plan) && ["wallet", "bank"].includes(value.paymentMethod) && Array.isArray(value.memberIds) ? value : null;
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
        const methodButtons = [...document.querySelectorAll(".payment-method")];
        const plans = { personal: { name: "Gói Cá nhân", price: 19000 }, group: { name: "Gói Nhóm", price: 29000 } };
        let selectedPlan = "personal";
        let selectedMethod = "wallet";
        let members = [];
        let userId = null;
        let state = { package: null, pending_requests: [] };
        let attempt = null;
        let busy = false;
        let findingMember = false;
        let loaded = false;
        let epoch = 0;
        let receiptTransaction=null,pollTimer=null;
        const money = (value) => new Intl.NumberFormat("vi-VN").format(value) + "đ";
        const memberOnly = () => !!state.package && state.package.owner_id !== userId;

        function renderControls() {
            const locked = busy || findingMember || !loaded || !!attempt || memberOnly();
            planButtons.forEach((button) => {
                button.classList.toggle("selected", button.dataset.plan === selectedPlan);
                button.setAttribute("aria-pressed", String(button.dataset.plan === selectedPlan));
                button.disabled = locked || (!!state.package && button.dataset.plan !== state.package.plan);
            });
            methodButtons.forEach((button) => {
                const selected = button.dataset.method === selectedMethod;
                button.classList.toggle("selected", selected);
                button.setAttribute("aria-checked", String(selected));
                button.disabled = locked;
                button.querySelector(".method-check").className = selected ? "fa-solid fa-circle-check method-check" : "fa-regular fa-circle method-check";
            });
            byId("servicePackageGroupManager").hidden = selectedPlan !== "group";
            byId("upgradeBankInfo").hidden = selectedMethod !== "bank";
            byId("upgradeSelectedPlan").textContent = plans[selectedPlan].name;
            byId("upgradeTotal").textContent = money(plans[selectedPlan].price);
            memberEmail.disabled = locked;
            addMemberButton.disabled = locked || members.length >= 2;
            memberList.querySelectorAll("button").forEach((button) => { button.disabled = locked; });
            byId("closeUpgradeModalButton").disabled = busy;
            byId("finishUpgradeButton").disabled = busy;
            confirmButton.disabled = busy || findingMember || !loaded || memberOnly() || (state.pending_requests.length > 0 && !attempt);
            const label = busy ? "Đang xử lý..." : attempt ? "Kiểm tra lại giao dịch" : selectedMethod === "bank" ? "Tạo mã QR payOS" : state.package ? "Gia hạn thêm 30 ngày" : "Xác nhận thanh toán";
            confirmButton.innerHTML = '<i class="fa-solid ' + (busy ? 'fa-spinner fa-spin' : 'fa-lock') + '"></i> ' + label + ' <span id="upgradeConfirmAmount">' + money(plans[selectedPlan].price) + '</span>';
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
            pendingList.innerHTML = state.pending_requests.map((request) => '<div class="service-package-pending"><strong>'+(request.payos_status==='review'?'Giao dịch cần hỗ trợ đối soát':'Chờ thanh toán chuyển khoản')+'</strong><span>Mã: ' + service.escapeHTML(request.transaction_code) + ' · ' + money(request.price) + '</span><p>Ví IUH không bị trừ. Mở QR hoặc kiểm tra để cập nhật kết quả.</p><button type="button" data-resume-package="'+service.escapeHTML(request.transaction_code)+'">Mở / kiểm tra thanh toán</button> <button type="button" data-cancel-package="' + service.escapeHTML(request.transaction_code) + '">Hủy yêu cầu chưa thanh toán</button></div>').join("");
            pendingList.querySelectorAll("button").forEach((button) => button.addEventListener("click", async () => {
                if (busy) return;
                busy = true; renderControls(); button.disabled = true;
                const result = await payosRequest(button.dataset.cancelPackage?'cancel':'status',{transaction:button.dataset.cancelPackage||button.dataset.resumePackage});
                if (result.error) message.textContent = result.error.message;
                else {showReceipt(result.data);service.clearAttempt(userId);attempt=null;}
                await reloadState();
                busy = false; renderStatus(); renderControls();
            }));
        }

        async function reloadState() {
            const result = await service.loadCurrent(userId);
            if (result.error) { message.textContent = result.error.message; return false; }
            state = result.data; loaded = true;
            return true;
        }

        function showReceipt(receipt) {
            clearTimeout(pollTimer);receiptTransaction=receipt.transaction_code;
            const pending = receipt.status === "pending";
            const cancelled=receipt.status==='cancelled',review=receipt.payos_status==='review';
            const icon=successView.querySelector('.upgrade-success-icon i');if(icon)icon.className='fa-solid '+(review?'fa-triangle-exclamation':cancelled?'fa-xmark':pending?'fa-clock':'fa-check');
            byId("upgradeSuccessEyebrow").textContent = pending ? "YÊU CẦU ĐÃ ĐƯỢC GHI NHẬN" : "THANH TOÁN THÀNH CÔNG";
            byId("upgradeSuccessHeading").textContent = pending ? "Đang chờ xác nhận chuyển khoản" : "Gói dịch vụ đã được kích hoạt";
            byId("upgradeSuccessText").textContent = pending ? "Mở mã QR payOS để chuyển khoản. Gói tự kích hoạt sau khi hệ thống xác minh đã nhận đủ tiền. Ví IUH không bị trừ." : "Đã thanh toán " + money(receipt.price) + " cho " + plans[receipt.plan_type].name + ". Hạn sử dụng bên dưới đã được hệ thống xác nhận.";
            if(cancelled||review){byId('upgradeSuccessEyebrow').textContent='THÔNG TIN GIAO DỊCH';byId('upgradeSuccessHeading').textContent=review?'Cần hỗ trợ đối soát':'Yêu cầu đã hủy / hết hạn';byId('upgradeSuccessText').textContent=review?'Hệ thống đã ghi nhận giao dịch cần kiểm tra. Không thanh toán lại; liên hệ hỗ trợ kèm mã bên dưới.':'Gói chưa kích hoạt từ yêu cầu này. Đóng và mở lại để tạo thanh toán mới.';}
            byId('payosPackageActions').hidden=!pending||review;
            const link=byId('payosCheckoutLink');link.hidden=true;link.removeAttribute('href');
            if(pending&&!review&&typeof receipt.checkout_url==='string'&&/^https:\/\/pay\.payos\.vn\/web\/[A-Za-z0-9_-]+$/.test(receipt.checkout_url)){link.href=receipt.checkout_url;link.hidden=false;}
            byId('payosPaymentStatus').textContent='';
            byId("upgradeTransactionCode").textContent = receipt.transaction_code;
            byId("upgradeExpiryDate").textContent = receipt.expires_at ? service.formatExpiry(receipt.expires_at) : "Chưa kích hoạt";
            formView.hidden = true; successView.hidden = false;
            if(pending&&!review){const currentEpoch=epoch;pollTimer=setTimeout(async function poll(){if(currentEpoch!==epoch||!modal.classList.contains('open'))return;const result=await service.loadCurrent(userId);if(currentEpoch!==epoch)return;if(result.data){state=result.data;const fresh=(state.recent_transactions||[]).find(r=>r.transaction_code===receiptTransaction);if(fresh&&(fresh.status!=='pending'||fresh.payos_status==='review')){showReceipt(fresh);return;}}pollTimer=setTimeout(poll,10000);},10000);}
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
                selectedMethod = attempt?.paymentMethod || "wallet";
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
            clearTimeout(pollTimer);
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
        methodButtons.forEach((button) => button.addEventListener("click", () => {
            if (button.disabled || busy || attempt) return;
            selectedMethod = button.dataset.method; message.textContent = ""; renderControls();
        }));
        addMemberButton.addEventListener("click", addMember);
        memberEmail.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addMember(); } });
        confirmButton.addEventListener("click", purchase);
        byId('payosCheckPayment').addEventListener('click',async()=>{if(busy||!receiptTransaction)return;busy=true;renderControls();const b=byId('payosCheckPayment');b.disabled=true;byId('payosPaymentStatus').textContent='Đang kiểm tra với payOS…';try{const result=await payosRequest('status',{transaction:receiptTransaction});if(result.error)throw result.error;showReceipt(result.data);await reloadState();}catch(error){byId('payosPaymentStatus').textContent=error.message;}finally{busy=false;b.disabled=false;renderControls();}});
        document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal.classList.contains("open")) closeModal(); });
        renderControls();
        if(new URLSearchParams(location.search).get('payos_return')==='1'){history.replaceState(null,'',location.pathname+location.hash);openModal();}
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
            if(value.paymentMethod==='bank')return payosRequest('create',value);
            const result = await request("purchase_service_package", {
                p_plan_type: value.plan,
                p_payment_method: value.paymentMethod,
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
