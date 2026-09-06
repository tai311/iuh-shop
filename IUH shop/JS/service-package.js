/* =========================================================
   IUH SHOP - SERVICE PACKAGE SHARED STATE
========================================================= */

(function () {
    const STORAGE_KEY = "iuhServicePackages";
    const packageCache = new Map();

    function readPackages() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        } catch (error) {
            return {};
        }
    }

    function normalizePackage(value) {
        if (!value || !value.expiry) return null;
        const expiry = new Date(value.expiry);
        if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) return null;
        return { ...value, expiry: expiry.toISOString(), members: Array.isArray(value.members) ? value.members : [] };
    }

    function getPackage(userId) {
        if (!userId) return null;
        if (packageCache.has(userId)) return packageCache.get(userId);
        return normalizePackage(readPackages()[userId]);
    }

    async function loadForUsers(userIds) {
        const ids = [...new Set((userIds || []).filter(Boolean))];
        if (!ids.length || !window.supabase) return;
        const { data: membershipData, error: membershipError } = await window.supabase
            .from("service_package_members")
            .select("user_id, package_id")
            .in("user_id", ids);
        if (membershipError) {
            console.warn("Không thể tải thành viên gói từ Supabase:", membershipError.message);
            return;
        }
        const packageIds = [...new Set((membershipData || []).map((row) => row.package_id).filter(Boolean))];
        ids.forEach((id) => packageCache.delete(id));
        ids.forEach((id) => packageCache.set(id, null));
        if (!packageIds.length) return;
        const { data: packageData, error: packageError } = await window.supabase
            .from("service_packages")
            .select("id, plan_type, transaction_code, status, expires_at")
            .in("id", packageIds)
            .eq("status", "active")
            .gt("expires_at", new Date().toISOString());
        if (packageError) {
            console.warn("Không thể tải gói dịch vụ từ Supabase:", packageError.message);
            return;
        }
        (membershipData || []).forEach((row) => {
            const currentPackage = (packageData || []).find((item) => item.id === row.package_id);
            if (!currentPackage) return;
            const members = (membershipData || [])
                .filter((member) => member.package_id === currentPackage.id)
                .map((member) => ({ user_id: member.user_id }));
            packageCache.set(row.user_id, normalizePackage({
                plan: currentPackage.plan_type,
                transaction: currentPackage.transaction_code,
                expiry: currentPackage.expires_at,
                members
            }));
        });
    }

    function getBadge(userId) {
        const servicePackage = getPackage(userId);
        if (!servicePackage) return null;
        if (servicePackage.plan === "group" && servicePackage.members.some((member) => member.user_id === userId)) {
            return { label: "Thành viên nổi bật", className: "group-featured-badge" };
        }
        return { label: "Người bán nổi bật", className: "seller-featured-badge" };
    }

    function escapeHTML(value) {
        return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
    }

    window.IUHServicePackage = {
        getPackage,
        loadForUsers,
        getBadge,
        escapeHTML,
        formatExpiry(expiry) {
            return new Date(expiry).toLocaleDateString("vi-VN");
        },
        save(userId, value) {
            packageCache.set(userId, normalizePackage(value));
            const packages = readPackages();
            packages[userId] = value;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
        },
        async saveRemote(userId, value) {
            if (!window.supabase || !userId) return { error: new Error("Supabase chưa sẵn sàng") };
            const request = (async () => {
                const { data: packageData, error: packageError } = await window.supabase
                    .from("service_packages")
                    .insert({
                        owner_id: userId,
                        plan_type: value.plan,
                        price: value.price,
                        payment_method: value.paymentMethod,
                        transaction_code: value.transaction,
                        status: "active",
                        starts_at: new Date().toISOString(),
                        expires_at: value.expiry
                    })
                    .select("id")
                    .single();
                return { packageData, packageError };
            })();
            const timeout = new Promise((resolve) => window.setTimeout(() => resolve({ packageData: null, packageError: new Error("Supabase không phản hồi sau 10 giây") }), 10000));
            const { data: packageData, error: packageError } = await Promise.race([request, timeout]);
            if (packageError) return { error: packageError };
            const members = (value.members || []).filter((member) => member.user_id && member.user_id !== userId).map((member) => ({ package_id: packageData.id, user_id: member.user_id, member_role: "member" }));
            if (members.length) {
                const memberRequest = window.supabase.from("service_package_members").insert(members);
                const memberTimeout = new Promise((resolve) => window.setTimeout(() => resolve({ error: new Error("Không thể lưu thành viên sau 10 giây") }), 10000));
                const { error: memberError } = await Promise.race([memberRequest, memberTimeout]);
                if (memberError) return { error: memberError };
            }
            return { data: packageData };
        },
        remove(userId) {
            packageCache.delete(userId);
            const packages = readPackages();
            delete packages[userId];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
        }
    };
})();
