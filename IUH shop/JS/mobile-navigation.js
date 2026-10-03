(() => {
    "use strict";

    function bindMobileNavigation() {
        const mainNav = document.querySelector(".main-nav");
        const container = mainNav?.querySelector(".nav-container");
        const brand = container?.querySelector(".brand");
        const navigation = container?.querySelector(".navigation");

        if (!mainNav || !container || !brand || !navigation || container.querySelector(".mobile-nav-toggle")) return;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "mobile-nav-toggle";
        toggle.setAttribute("aria-label", "Mở menu điều hướng");
        toggle.setAttribute("aria-expanded", "false");

        if (!navigation.id) navigation.id = "primary-navigation";
        toggle.setAttribute("aria-controls", navigation.id);

        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("aria-hidden", "true");
        for (const y of [5, 12, 19]) {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
            line.setAttribute("d", `M4 ${y}h16`);
            icon.append(line);
        }
        toggle.append(icon);
        brand.after(toggle);

        const mobileViewport = window.matchMedia
            ? window.matchMedia("(max-width: 760px)")
            : null;

        function isMobileViewport() {
            return window.innerWidth <= 760;
        }

        function closeMenu() {
            mainNav.classList.remove("menu-open");
            navigation.hidden = isMobileViewport();
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Mở menu điều hướng");
        }

        function syncViewport() {
            const isMobile = isMobileViewport();
            toggle.hidden = !isMobile;
            if (isMobile) {
                navigation.hidden = !mainNav.classList.contains("menu-open");
            } else {
                mainNav.classList.remove("menu-open");
                navigation.hidden = false;
                toggle.setAttribute("aria-expanded", "false");
                toggle.setAttribute("aria-label", "Mở menu điều hướng");
            }
        }

        toggle.addEventListener("click", () => {
            const isOpen = toggle.getAttribute("aria-expanded") === "true";
            mainNav.classList.toggle("menu-open", !isOpen);
            navigation.hidden = isOpen;
            toggle.setAttribute("aria-expanded", String(!isOpen));
            toggle.setAttribute("aria-label", isOpen ? "Mở menu điều hướng" : "Đóng menu điều hướng");
        });

        navigation.addEventListener("click", (event) => {
            if (event.target.closest("a")) closeMenu();
        });

        document.addEventListener("click", (event) => {
            if (isMobileViewport() && !mainNav.contains(event.target)) closeMenu();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && mainNav.classList.contains("menu-open")) {
                closeMenu();
                toggle.focus();
            }
        });

        if (mobileViewport?.addEventListener) {
            mobileViewport.addEventListener("change", syncViewport);
        } else if (mobileViewport?.addListener) {
            mobileViewport.addListener(syncViewport);
        }

        window.addEventListener("resize", syncViewport);
        syncViewport();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindMobileNavigation, { once: true });
    } else {
        bindMobileNavigation();
    }
})();
