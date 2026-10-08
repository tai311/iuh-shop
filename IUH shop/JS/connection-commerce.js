/* Shared contract for connection-only commerce. Amounts are recalculated by SQL. */
(() => {
    'use strict';
    const getClient = () => window.IUH_SUPABASE || (window.IUH_SUPABASE = window.IUHCore?.getClient() ||
        window.supabase.createClient('https://xecxofmogvqysejjpxvl.supabase.co', 'sb_publishable_3cUVsNUvhbzUReIB3oA41w_0aqdUJqC'));
    const money = value => new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + 'đ';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fee = subtotal => Math.max(2000, Math.round(Number(subtotal) * 0.05));
    const image = value => {
        try {
            let rows = typeof value === 'string' ? JSON.parse(value) : value;
            if (!Array.isArray(rows) || !rows[0]) return '../Images/default-product.svg';
            const url = new URL(rows[0], location.href);
            return ['https:', 'http:'].includes(url.protocol) ? url.href : '../Images/default-product.svg';
        } catch { return '../Images/default-product.svg'; }
    };
    async function rpc(name, args) {
        const { data, error } = await getClient().rpc(name, args);
        if (error) throw error;
        if (data?.success === false) throw new Error(data.message || 'Thao tác chưa hoàn tất.');
        return data;
    }
    const chatURL = id => 'tinnhan.html?conversation=' + encodeURIComponent(id);
    window.ConnectionCommerce = Object.freeze({ getClient, money, escape, fee, image, rpc, chatURL });
})();
