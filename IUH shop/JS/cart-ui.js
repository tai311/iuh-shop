/* Cart feedback and confirmation. No cart data is stored in this UI module. */
(() => {
    'use strict';
    let toast, timer, revision = 0, confirming = false;
    function position() {
        if (!toast || toast.hidden) return;
        const target = document.querySelector('.top-cart-icon');
        const box = target?.getBoundingClientRect();
        const width = Math.min(350, window.innerWidth - 24);
        toast.style.width = width + 'px';
        toast.style.left = Math.max(12, Math.min(window.innerWidth - width - 12, box ? box.right - width : window.innerWidth - width - 12)) + 'px';
        toast.style.top = Math.max(12, Math.min(window.innerHeight - toast.offsetHeight - 12, box && box.bottom > 0 ? box.bottom + 12 : 20)) + 'px';
    }
    function dismiss() { if (toast) toast.hidden = true; clearTimeout(timer); }
    function schedule() { clearTimeout(timer); timer = setTimeout(dismiss, 6500); }
    function notify({ title = 'Đã thêm vào giỏ hàng', name = '', image = '', error = false, login = false } = {}) {
        if (!toast) {
            toast = document.createElement('aside');
            toast.className = 'passit-cart-toast';
            toast.setAttribute('aria-label', 'Thông báo giỏ hàng');
            toast.addEventListener('mouseenter', () => clearTimeout(timer));
            toast.addEventListener('mouseleave', schedule);
            toast.addEventListener('focusin', () => clearTimeout(timer));
            toast.addEventListener('focusout', schedule);
            document.body.append(toast);
        }
        clearTimeout(timer);
        toast.replaceChildren();
        toast.hidden = false;
        toast.classList.toggle('is-error', error);
        if (image) {
            const img = document.createElement('img'); img.src = image; img.alt = ''; img.className = 'passit-toast-image';
            img.onerror = () => { img.onerror = null; img.src = '../Images/default-product.svg'; };
            toast.append(img);
        }
        const content = document.createElement('div'); content.className = 'passit-toast-content';
        const status = document.createElement('div'); status.setAttribute('role', error ? 'alert' : 'status');
        const heading = document.createElement('strong'); heading.textContent = title;
        const text = document.createElement('p'); text.textContent = name;
        status.append(heading, text); content.append(status);
        if (!error || login) {
            const link = document.createElement('a'); link.href = login ? 'dangnhap.html' : 'giohang.html';
            link.textContent = login ? 'Đăng nhập →' : 'Xem giỏ hàng →'; content.append(link);
        }
        const close = document.createElement('button'); close.type = 'button'; close.className = 'passit-toast-close';
        close.setAttribute('aria-label', 'Đóng thông báo'); close.textContent = '×'; close.onclick = dismiss;
        toast.append(content, close); position(); schedule();
    }
    function added(source, name) {
        const current = ++revision;
        const target = document.querySelector('.top-cart-icon');
        const image = source?.currentSrc || source?.src || '';
        notify({ name, image });
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const end = target?.getBoundingClientRect(), start = source?.getBoundingClientRect();
        if (reduced || !source || !end || !start || start.width <= 0 || end.bottom <= 0 || typeof source.animate !== 'function') return;
        const flying = document.createElement('img'); flying.src = image; flying.alt = ''; flying.setAttribute('aria-hidden', 'true'); flying.className = 'passit-cart-flight';
        const size = Math.min(100, start.width, start.height);
        Object.assign(flying.style, { width: size + 'px', height: size + 'px', left: start.left + start.width / 2 - size / 2 + 'px', top: start.top + start.height / 2 - size / 2 + 'px' });
        document.body.append(flying);
        const dx = end.left + end.width / 2 - (start.left + start.width / 2);
        const dy = end.top + end.height / 2 - (start.top + start.height / 2);
        const animation = flying.animate([
            { transform: 'translate(0,0) scale(1)', opacity: 1 },
            { transform: 'translate(' + dx * .45 + 'px,' + (dy * .45 - 75) + 'px) scale(.7)', opacity: .95, offset: .45 },
            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.12)', opacity: .15 }
        ], { duration: 720, easing: 'cubic-bezier(.22,.65,.35,1)' });
        animation.finished.catch(() => {}).finally(() => {
            flying.remove();
            if (current === revision && target.isConnected) target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 320 });
        });
    }
    function confirmRemoval(names) {
        if (confirming) return Promise.resolve(false);
        confirming = true;
        return new Promise(resolve => {
            const dialog = document.createElement('dialog'); dialog.className = 'passit-cart-confirm';
            dialog.setAttribute('aria-labelledby', 'passit-remove-title'); dialog.setAttribute('aria-describedby', 'passit-remove-description');
            const title = document.createElement('h2'); title.id = 'passit-remove-title'; title.textContent = names.length > 1 ? 'Xóa ' + names.length + ' sản phẩm?' : 'Xóa sản phẩm khỏi giỏ?';
            const text = document.createElement('p'); text.id = 'passit-remove-description'; text.textContent = names.length === 1 ? names[0] : 'Các sản phẩm đã chọn sẽ được bỏ khỏi giỏ hàng.';
            const actions = document.createElement('div'); actions.className = 'passit-confirm-actions';
            const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Giữ lại'; cancel.autofocus = true;
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger'; remove.textContent = 'Xóa khỏi giỏ';
            actions.append(cancel, remove); dialog.append(title, text, actions); document.body.append(dialog);
            const previous = document.activeElement;
            cancel.onclick = () => dialog.close('cancel'); remove.onclick = () => dialog.close('remove');
            dialog.addEventListener('close', () => { const yes = dialog.returnValue === 'remove'; dialog.remove(); confirming = false; if (previous?.isConnected) previous.focus(); resolve(yes); }, { once: true });
            dialog.showModal();
        });
    }
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, { passive: true });
    window.PassitCartUI = Object.freeze({ added, notify, confirmRemoval });
})();
