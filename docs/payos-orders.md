# Thanh toán đơn hàng và chuyển tiền người bán

## Cách sử dụng

- Người mua chọn QR khi đặt hàng. Sau khi đơn được lưu, trang Đơn hàng mở khung payOS ngay trong IUH Shop. Có thể đóng và mở lại bằng nút Thanh toán / kiểm tra payOS của cùng đơn.
- Webhook HMAC dùng chung cho mua gói và mua hàng, tra API payOS trước khi ghi nhận. Giá và số tiền lấy từ đơn do database tính; callback từ iframe không xác nhận đã trả tiền.
- Admin → Đối soát & hỗ trợ → Đơn hàng hiển thị tiền khách trả, phí sàn, vận chuyển, tiền người bán nhận và trạng thái chuyển. Bật Chỉ cần theo dõi để vẫn thấy đơn hoàn tất nhưng chưa chuyển tiền.
- Trong chi tiết, đơn payOS chưa thu có nút kiểm tra lại payOS. Khi đơn đã thanh toán và hoàn tất, hệ thống tạo khoản chờ chuyển ngân hàng cho đúng người hưởng. Sau khi tự chuyển tiền thành công, admin nhập mã chứng từ và xác nhận. Nút này chỉ ghi nhận việc đã chuyển, không gửi lệnh chuyển ngân hàng.

## Phí và số dư

Phí đơn thường giữ nguyên cách tính hiện có: cộng 5% vào giá người bán nhập, làm tròn từng đơn vị sản phẩm. Ví dụ giá gốc 100.000đ → tiền hàng khách trả 105.000đ → phí sàn 5.000đ → người bán nhận 100.000đ. Không lấy 5% của 105.000đ để trừ lần nữa. Phí vận chuyển được tách riêng. Hàng ký gửi giữ cơ chế phí 10% hiện có.

Chỉ các đơn đã gắn payOS dùng cơ chế chuyển ngân hàng mới. Đơn ví và đơn ngân hàng cũ tiếp tục cơ chế cũ. Tiền payOS giữ trong pending của admin; khi hoàn tất, phần phí và vận chuyển chuyển sang balance, còn tiền người bán tiếp tục được giữ theo `order_bank_payouts`. Ghi nhận chuyển ngân hàng giảm pending đúng một lần. Không cộng tiền này vào balance của người bán để tránh vừa chi ngân hàng vừa rút ví. Không thay đổi trạng thái đơn cũ để ép vào luồng mới.

## Đảm bảo và giới hạn

- Người bán không được xác nhận tiền đã thu hay đánh dấu đã chuyển ngân hàng; RPC chi tiền kiểm tra tài khoản admin trong database. Người bán chỉ đọc khoản của mình; thông tin đối soát tổng chỉ admin được đọc.
- Mã ngân hàng dùng chung sổ chứng từ: không sử dụng cùng mã cho thu tiền, hoàn tiền và trả người bán. Lặp webhook hoặc lặp xác nhận không thu/chi lại.
- Chưa trả tiền: hủy link payOS trước rồi mới hủy đơn, hoàn lại tồn kho. Đã trả tiền: hủy đơn theo điều kiện hiện có, tạo yêu cầu hoàn ngân hàng; không trả tiền người bán.
- Tiền thừa, nhận sau khi đã hủy, trùng chứng từ hoặc lỗi ghi nhận chuyển sang review; không tự ghi là thanh toán thành công.
- Link hết hạn không tự tạo đơn/QR mới và không tự khôi phục tồn kho: khách hủy đơn rồi đặt lại. Hoàn tiền và chuyển người bán vẫn do admin thực hiện ở ngân hàng.
- Phải có webhook ACTIVE trước khi phát hành QR đơn hàng. Không đưa khóa payOS vào trình duyệt.

## Triển khai và xác minh

1. Áp dụng migration `20260927165641_payos_orders_and_seller_payouts.sql`.
2. Deploy `payos-webhook` với module `_shared/order-payment.ts`, rồi `payos-order`. Cả hai dùng custom authentication: HMAC cho webhook, Supabase Auth và quyền chủ đơn/admin cho gateway.
3. Triển khai HTML, JS và CSS mới. Bộ khóa payOS và webhook URL hiện có được dùng tiếp.

27 kiểm thử đạt: bổ sung database/tiền/sở hữu/trùng giao dịch/hủy/hoàn, gateway đơn hàng và webhook định tuyến, iframe chỉ tin backend và dọn khi đóng. Source check: 33 JavaScript, 33 HTML. Trình duyệt cục bộ kiểm tra bảng/chỉ tiết admin trên desktop/mobile, SDK payOS thật nhúng URL mẫu và dọn iframe; không phát hành QR hay chuyển tiền thật trong kiểm thử.

RPC `admin_complete_order_payout` cố ý là SECURITY DEFINER vì tài khoản trình duyệt không có quyền ghi sổ tiền trực tiếp; kiểm tra `auth.uid()` và `private.is_admin()` trước mọi thao tác, search_path rỗng, thu hồi quyền PUBLIC/anon. Cảnh báo [authenticated SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) cần được hiểu cùng các kiểm tra quyền này.

API chính thức: https://payos.vn/docs/api/.
