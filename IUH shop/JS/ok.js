const slides = document.querySelectorAll(".slide");
const dots = document.querySelectorAll(".slider-dot");
const prevButton = document.querySelector(".slider-prev");
const nextButton = document.querySelector(".slider-next");

let currentSlide = 0;
let slideInterval;


/* ================================
   HIỂN THỊ SLIDE
================================ */

function showSlide(index) {

    slides.forEach((slide, i) => {
        slide.classList.toggle("active", i === index);
    });

    dots.forEach((dot, i) => {
        dot.classList.toggle("active", i === index);
    });

    currentSlide = index;
}


/* ================================
   SLIDE TIẾP THEO
================================ */

function nextSlide() {

    let next = currentSlide + 1;

    if (next >= slides.length) {
        next = 0;
    }

    showSlide(next);
}


/* ================================
   SLIDE TRƯỚC
================================ */

function prevSlide() {

    let prev = currentSlide - 1;

    if (prev < 0) {
        prev = slides.length - 1;
    }

    showSlide(prev);
}


/* ================================
   TỰ ĐỘNG CHUYỂN - 7 GIÂY
================================ */

function startSlider() {
    slideInterval = setInterval(nextSlide, 7000);
}


/* ================================
   RESET BỘ ĐẾM KHI BẤM NÚT
================================ */

function resetSlider() {

    clearInterval(slideInterval);

    startSlider();
}


/* ================================
   NÚT TRƯỚC
================================ */

prevButton.addEventListener("click", () => {

    prevSlide();

    resetSlider();

});


/* ================================
   NÚT SAU
================================ */

nextButton.addEventListener("click", () => {

    nextSlide();

    resetSlider();

});


/* ================================
   DOT
================================ */

dots.forEach((dot, index) => {

    dot.addEventListener("click", () => {

        showSlide(index);

        resetSlider();

    });

});


/* ================================
   KHỞI ĐỘNG
================================ */

showSlide(0);
startSlider();