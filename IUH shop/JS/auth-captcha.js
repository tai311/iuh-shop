/* Public site key only. Supabase Auth must enforce CAPTCHA using its secret key. */
(() => {
    'use strict';
    if (window.IUHCaptcha) return;
    const sitekey = '0x4AAAAAAFRZdAHQ487-gx99';
    const form = document.getElementById('registerForm') || document.getElementById('loginForm') || document.getElementById('requestResetForm');
    if (!form) return;
    const box = document.createElement('div');
    box.style.cssText = 'margin:16px 0;min-width:0';
    const widget = document.createElement('div');
    const status = document.createElement('p');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    status.style.cssText = 'font-size:13px;margin:8px 0';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.textContent = 'Tải lại xác thực'; retry.hidden = true;
    box.append(widget, status, retry);
    form.insertBefore(box, form.querySelector('button[type="submit"], .auth-button'));
    let token = '', expires = 0, widgetId, script, timer;
    function clear(message) { token = ''; expires = 0; status.textContent = message; }
    function failed() {
        clear('Chưa tải được xác thực. Kiểm tra mạng hoặc trình chặn nội dung rồi thử lại.');
        retry.hidden = false;
    }
    function render() {
        clearTimeout(timer);
        if (widgetId !== undefined) return;
        try {
            widgetId = window.turnstile.render(widget, {
                sitekey, theme: 'light', size: 'flexible', 'response-field': false,
                callback(value) { token = value; expires = Date.now() + 290000; status.textContent = 'Đã xác thực.'; retry.hidden = true; },
                'expired-callback'() { clear('Xác thực đã hết hạn. Vui lòng xác thực lại.'); retry.hidden = false; },
                'timeout-callback': failed,
                'error-callback'() { failed(); return true; }
            });
        } catch { failed(); }
    }
    function load() {
        clear('Đang tải xác thực…'); retry.hidden = true;
        if (window.turnstile) { render(); return; }
        script?.remove(); clearTimeout(timer);
        window.passitTurnstileReady = render;
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=passitTurnstileReady&render=explicit';
        script.async = true;
        script.onerror = () => { clearTimeout(timer); failed(); };
        timer = setTimeout(failed, 15000);
        document.head.appendChild(script);
    }
    function reset() {
        clear('Vui lòng hoàn thành xác thực trước khi tiếp tục.');
        if (widgetId !== undefined && window.turnstile) {
            try { window.turnstile.reset(widgetId); } catch { failed(); }
        }
    }
    retry.addEventListener('click', () => { if (widgetId === undefined) load(); else reset(); });
    window.IUHCaptcha = Object.freeze({
        takeToken() {
            if (!token || Date.now() >= expires) {
                clear('Vui lòng hoàn thành ô xác thực trước khi tiếp tục.');
                throw new Error(status.textContent);
            }
            const result = token; token = ''; expires = 0;
            return result;
        },
        reset
    });
    window.addEventListener('pagehide', () => { clearTimeout(timer); token = ''; expires = 0; });
    load();
})();
