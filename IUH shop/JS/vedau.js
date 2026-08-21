/* =========================================
   VỀ ĐẦU TRANG
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const backToTop =
            document.getElementById(
                "backToTop"
            );

        if (!backToTop) {
            return;
        }


        /* Hiện nút khi cuộn xuống */

        window.addEventListener(
            "scroll",
            function () {

                if (window.scrollY > 400) {

                    backToTop.classList.add(
                        "show"
                    );

                } else {

                    backToTop.classList.remove(
                        "show"
                    );

                }

            },
            { passive: true }
        );


        /* Về đầu trang */

        backToTop.addEventListener(
            "click",
            function () {

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });

            }
        );

    }
);