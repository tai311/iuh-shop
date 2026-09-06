/* =========================================================
   IUH SHOP - SERVICE PACKAGE SHARED STATE
========================================================= */

(function () {
    const STORAGE_KEY = "iuhServicePackages";

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
        return normalizePackage(readPackages()[userId]);
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
        getBadge,
        escapeHTML,
        formatExpiry(expiry) {
            return new Date(expiry).toLocaleDateString("vi-VN");
        },
        save(userId, value) {
            const packages = readPackages();
            packages[userId] = value;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
        },
        remove(userId) {
            const packages = readPackages();
            delete packages[userId];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
        }
    };
})();
