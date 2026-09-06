/* =========================================================
   IUH SHOP - SHARED ACCOUNT NAVIGATION
========================================================= */

(function () {
    function bindAccountNavigation() {
        const wrapper = document.querySelector(".account-nav-wrapper");
        const arrow = document.getElementById("accountNavArrow");
        const shortcuts = document.getElementById("accountShortcuts");

        if (!wrapper || !arrow || !shortcuts || arrow.dataset.accountNavBound === "true") return;

        arrow.dataset.accountNavBound = "true";
        arrow.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const isOpen = wrapper.classList.toggle("open");
            if (isOpen && window.matchMedia("(max-width: 600px)").matches) {
                const headerBottom = wrapper.closest(".main-nav")?.getBoundingClientRect().bottom || 180;
                shortcuts.style.top = `${Math.max(12, headerBottom + 6)}px`;
            }
            arrow.setAttribute("aria-expanded", isOpen ? "true" : "false");
        });

        shortcuts.addEventListener("click", (event) => event.stopPropagation());
        document.addEventListener("click", () => {
            wrapper.classList.remove("open");
            arrow.setAttribute("aria-expanded", "false");
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindAccountNavigation);
    } else {
        bindAccountNavigation();
    }
})();
