/* Persisted order updates; acknowledgement is scoped to the signed-in user. */
(function () {
    'use strict';
    if (window.IUHOrderNotifications) return;
    window.IUHOrderNotifications = true;
    const client = window.IUHCore?.getClient() || window.supabase?.createClient(
        'https://xecxofmogvqysejjpxvl.supabase.co', 'sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC');
    if (!client) return;
    let panel, loading = false, stopped = false, sessionVersion = 0;
    async function refresh() {
        if (loading || stopped || document.hidden) return;
        loading = true;
        const version = sessionVersion;
        try {
            const { data: { user }, error: authError } = await client.auth.getUser();
            if (authError || !user) { panel?.remove(); panel = null; return; }
            const { data, error } = await client.from('order_notifications')
                .select('id,message,event,order_id').eq('user_id', user.id).eq('is_read', false)
                .order('created_at', { ascending: false }).limit(5);
            if (error || stopped || version !== sessionVersion) return;
            if (!data?.length) { panel?.remove(); panel = null; return; }
            if (!panel) {
                panel = document.createElement('aside');
                panel.className = 'order-notification-panel';
                panel.setAttribute('aria-label', 'Thông báo đơn hàng');
                panel.setAttribute('aria-live', 'polite');
                document.body.append(panel);
            }
            panel.replaceChildren();
            const heading = document.createElement('strong');
            heading.textContent = 'Thông báo đơn hàng'; panel.append(heading);
            for (const item of data) {
                const article = document.createElement('div');
                const link = document.createElement('a');
                link.textContent = item.message;
                link.href = ['delivered', 'payment_requested'].includes(item.event) ? 'admin.html#orders' : item.event === 'payment_approved' ? 'donhang.html#sale' : 'donhang.html';
                const dismiss = document.createElement('button');
                dismiss.type = 'button'; dismiss.textContent = 'Đã đọc';
                dismiss.addEventListener('click', async () => {
                    dismiss.disabled = true;
                    try {
                        const result = await client.from('order_notifications').update({ is_read: true }).eq('id', item.id).eq('user_id', user.id);
                        if (result.error) throw result.error;
                        article.remove();
                        if (!panel?.querySelector('a')) { panel?.remove(); panel = null; }
                    } catch { dismiss.disabled = false; dismiss.textContent = 'Thử lại'; }
                });
                article.append(link, dismiss); panel.append(article);
            }
        } catch { /* Keep the page usable while offline. */ }
        finally { loading = false; }
    }
    const style = document.createElement('style');
    style.textContent = '.order-notification-panel{position:fixed;right:20px;top:90px;width:min(340px,calc(100vw - 40px));max-height:60vh;overflow:auto;z-index:1100;padding:16px;background:#fff;border:1px solid #dce5f5;border-radius:12px;box-shadow:0 8px 28px #193f9e26;color:#193f9e;font:14px/1.5 Arial,sans-serif}.order-notification-panel>div{padding-top:12px;margin-top:10px;border-top:1px solid #e7ebf2}.order-notification-panel a{display:block;color:#193f9e;text-decoration:none}.order-notification-panel button{margin-top:8px;padding:5px 10px;border:1px solid #dce5f5;border-radius:6px;background:#f4f7fc;color:#193f9e;cursor:pointer}';
    document.head.append(style);
    const timer = setInterval(refresh, 30000);
    window.addEventListener('pagehide', () => { stopped = true; clearInterval(timer); });
    document.addEventListener('visibilitychange', refresh);
    client.auth.onAuthStateChange?.(() => { sessionVersion++; panel?.remove(); panel = null; setTimeout(refresh, 0); });
    void refresh();
})();
