/* Shared cart write path for listing and detail pages. */
(function () {
    'use strict';
    const pending = new Map();
    function fail(code, message) { return Object.assign(new Error(message), { code }); }
    async function save(client, productId) {
        const auth = await client.auth.getUser();
        if (!auth.data?.user) {
            if (auth.error && auth.error.name !== 'AuthSessionMissingError') throw fail('AUTH_ERROR', 'Không thể kiểm tra tài khoản. Vui lòng thử lại.');
            throw fail('LOGIN_REQUIRED', 'Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng.');
        }
        if (auth.error) throw auth.error;
        const userId = auth.data.user.id;
        async function write() {
            for (let attempt = 0; attempt < 3; attempt++) {
                const productResult = await client.from('products').select('id, seller_id, status, quantity').eq('id', productId).maybeSingle();
                if (productResult.error) throw productResult.error;
                const product = productResult.data;
                if (!product || product.status !== 'active' || !Number.isInteger(Number(product.quantity)) || Number(product.quantity) <= 0) {
                    throw fail('UNAVAILABLE', 'Sản phẩm đã hết hàng hoặc không còn được bán.');
                }
                if (String(product.seller_id) === String(userId)) throw fail('OWN_PRODUCT', 'Bạn không thể thêm sản phẩm của mình vào giỏ hàng.');
                const current = await client.from('cart_items').select('id, quantity').eq('user_id', userId).eq('product_id', productId).maybeSingle();
                if (current.error) throw current.error;
                const previous = current.data ? Number(current.data.quantity) : 0;
                if (!Number.isInteger(previous) || previous < 0) throw fail('INVALID_CART', 'Số lượng trong giỏ không hợp lệ. Vui lòng kiểm tra giỏ hàng.');
                if (previous >= Number(product.quantity)) throw fail('STOCK_LIMIT', 'Giỏ hàng đã có tối đa số lượng sản phẩm hiện có.');
                const quantity = previous + 1;
                const values = { quantity, selected: true, updated_at: new Date().toISOString() };
                let result;
                if (current.data) {
                    // Compare-and-set prevents overwriting changes from another tab.
                    result = await client.from('cart_items').update(values).eq('id', current.data.id).eq('user_id', userId).eq('quantity', previous).select('id, quantity').maybeSingle();
                } else {
                    result = await client.from('cart_items').insert({ ...values, user_id: userId, product_id: productId }).select('id, quantity').maybeSingle();
                }
                if (result.error) {
                    if (result.error.code === '23505') continue;
                    throw result.error;
                }
                if (result.data) {
                    window.dispatchEvent(new CustomEvent('passit:cart-updated', { detail: { productId, quantity: result.data.quantity } }));
                    return result.data;
                }
            }
            throw fail('CONFLICT', 'Giỏ hàng vừa thay đổi hoặc chưa thể lưu. Vui lòng thử lại.');
        }
        // Same-origin tabs serialize additions when Web Locks are supported.
        return window.navigator?.locks
            ? window.navigator.locks.request('passit-cart:' + userId + ':' + productId, write)
            : write();
    }
    function add(client, productId) {
        const key = String(productId);
        if (!/^\d+$/.test(key) || Number(key) <= 0) return Promise.reject(fail('INVALID_PRODUCT', 'Sản phẩm không hợp lệ.'));
        if (pending.has(key)) return pending.get(key);
        const operation = save(client, productId).finally(() => pending.delete(key));
        pending.set(key, operation);
        return operation;
    }
    window.PassitCart = Object.freeze({ add });
})();
