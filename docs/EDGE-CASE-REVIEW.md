# PASSIT — rà soát trường hợp đặc biệt, 08/10/2026

Phạm vi: mã nguồn trong workspace; đọc cấu hình/hàm SQL thực tế của project xecxofmogvqysejjpxvl qua Supabase; kiểm thử logic bằng dữ liệu giả lập. Không tạo đơn, thu tiền, gửi email khôi phục hoặc đổi mật khẩu tài khoản thật. Không triển khai website và không sửa schema production trong lần rà soát này.

## Kết luận

Chưa đủ cơ sở kết luận toàn hệ thống đã sẵn sàng vận hành thật. Các khóa chống bán vượt tồn kho và chống tạo đơn trùng đã có trên database thật. Đã sửa lỗi thử lại ở giao diện và bổ sung khôi phục mật khẩu; các mục cấu hình/vận hành dưới đây còn mở.

## Những nhóm đã kiểm tra

| Tình huống | Bằng chứng / kết quả | Giới hạn |
|---|---|---|
| Hai người mua cuốn cuối | Hàm create_checkout_orders đang triển khai khóa toàn bộ sản phẩm theo ID; create_order dùng FOR UPDATE, kiểm tra tồn kho và trừ kho trong cùng giao dịch | Chưa chạy hai kết nối đặt hàng thật đồng thời |
| Bấm đặt lại / phản hồi mạng bị mất | Server lưu receipt theo người mua + mã yêu cầu; sửa frontend để retry vẫn đến được receipt khi kho hoặc số dư đã giảm | Mã yêu cầu lưu sessionStorage; đóng tab, thay đổi giỏ hoặc dữ liệu đơn tạo ra ngữ cảnh mới |
| Đơn thành công nhưng cập nhật ví / xóa sessionStorage lỗi | Đã thêm checkoutCommitted: không mở lại nút, không tạo yêu cầu mới; lỗi sau commit chuyển sang Đơn hàng | Đã kiểm thử giả lập |
| Giá/phí/số lượng bị sửa từ trình duyệt | Server tính lại từ products, so tổng tiền/phí, kiểm tra số lượng dương, gộp ID sản phẩm trùng | Đọc hàm SQL đang chạy |
| Mua nhiều người bán, một món lỗi | Hàm tạo đơn con nằm trong cùng giao dịch; lỗi trả về làm rollback toàn bộ | Bộ kiểm thử PGlite có sẵn nhưng chưa chạy lại được lần này |
| Giỏ: hết hàng, tự mua hàng mình, khách chưa đăng nhập, nhấn lặp | 16 kiểm thử cart-actions đã qua; dùng dữ liệu mới và kiểm tra kết quả ghi | Thêm vào giỏ không giữ tồn kho |
| Xóa giỏ: hủy, nhấn lặp, lỗi giữa nhiều món | 4 kiểm thử đã qua; giữ lại những món chưa xóa thành công | Giả lập API |
| Hủy đơn / hoàn tiền | cancel_order kiểm tra chủ đơn hoặc admin, trạng thái; hủy lặp trả kết quả cũ; hoàn kho; QR đã trả tiền tạo yêu cầu hoàn ngân hàng | Không thử hoàn tiền thật |
| Giả thanh toán, sửa số tiền, giả webhook / sai chủ đơn | 2 bài kiểm thử Edge Function PayOS đã qua với nhiều nhánh mô phỏng | Không phải giao dịch ngân hàng thật; chưa so toàn bộ bản Edge đang triển khai |
| Đăng nhập mất mạng / nhấn lặp / email chưa xác nhận | Đã sửa và có 3 kiểm thử qua; nút được mở lại khi lỗi | Đăng nhập bằng MSSV vẫn phụ thuộc quyền đọc users; nếu không tra được, giao diện hướng dẫn dùng email |
| Quên mật khẩu | Trước đây href=#. Nay có quenmatkhau.html, request email, xác minh session qua Auth, đặt mật khẩu, lỗi hết hạn, cooldown và chống nhấn lặp; 11 kiểm thử qua | Chưa thử email thật / SMTP / allowlist production |
| Quyền truy cập dữ liệu | Database thật: mọi bảng public dạng bảng thường đều bật RLS | RLS bật không tự chứng minh mọi policy đúng; kiểm thử quyền đầy đủ còn cần chạy |

## Những việc còn mở

1. **Cấu hình khôi phục mật khẩu trên production**: triển khai các file mới; cho phép URL quay về và kiểm tra SMTP theo docs/PASSWORD-RECOVERY.md. API tools hiện có không đọc/sửa được Auth URL Configuration hay SMTP. Chưa gửi thư thật.
2. **Đơn bỏ thanh toán giữ tồn kho**: create_order trừ kho ngay khi tạo. Không có cron.job trên database này; chưa thấy cơ chế tự hết hạn và nhả hàng trong luồng đã rà. Có thể còn tác vụ ngoài database chưa kiểm tra. Cần quy định thời gian giữ hàng và xử lý an toàn khi webhook thanh toán đến cùng lúc hết hạn, trước khi thêm tự hủy.
3. **Chế độ thử nghiệm đang bật**: public.iuh_trial_settings.enabled=true trên database thật. Chưa tắt vì đây là cấu hình nghiệp vụ hiện có. Không xem kiểm thử trial là bằng chứng đã thu tiền ngân hàng.
4. **Trạng thái hết hàng và xóa tin đang dùng chung deleted**: create_order đánh deleted khi kho về 0; cancel_order đổi lại active nếu deleted và kho bằng 0. Vì vậy không phân biệt được tin bị chủ động xóa sau khi hết hàng với tin chỉ hết hàng. Cần tách trạng thái/ý định ẩn tin trước khi chỉnh cơ chế hoàn kho.
5. **Auth security advisor**: bảo vệ mật khẩu đã rò rỉ đang tắt. Có 36 cảnh báo RPC SECURITY DEFINER được authenticated gọi; đây không tự động là lỗ hổng, nhưng cần rà điều kiện chủ sở hữu/admin ở từng RPC. Hai thông báo bảng bật RLS không có policy thuộc checkout_receipts và iuh_trial_settings: dữ liệu được chặn truy cập trực tiếp, đi qua hàm kiểm soát.
6. **Kiểm thử đầy đủ chưa hoàn tất**: check-source và các test dùng jsdom/PGlite chưa chạy được do thiếu dependency. npm ci không hoàn tất tải; thử offline trả ENOTCACHED (xmlchars). Không tính các test này là pass.

## Sửa trong lần này

- JS/dathang.js: để RPC quyết định tồn kho/số dư sau bước tìm receipt; khóa submit sau thành công kể cả lỗi hậu xử lý.
- JS/dangnhap.js: chống submit lặp, khôi phục nút khi lỗi mạng, thông báo email chưa xác nhận, không log hồ sơ người dùng.
- HTML/dangnhap.html: nối liên kết khôi phục.
- HTML/quenmatkhau.html, CSS/password-recovery.css, JS/password-recovery.js: luồng khôi phục; SDK đóng gói nội bộ; session tạm trong bộ nhớ, không ghi đè phiên đăng nhập thông thường; xóa token khỏi URL; không đưa lỗi/token vào HTML.
- Tests mới: checkout-retry, login-resilience, password-recovery.

## Xác minh đã chạy

40 test pass: node --test tests/payos-edge.test.cjs tests/payos-order-edge.test.cjs tests/checkout-retry.test.cjs tests/login-resilience.test.cjs tests/password-recovery.test.cjs tests/cart-actions.test.cjs tests/cart-ui.test.cjs

Ba script đã đổi parse hợp lệ; git diff --check sạch. Trang khôi phục được render trong Edge ở desktop và 390px, không tràn ngang. Production website chưa được xác minh giao diện do công cụ truy cập mạng không tải được tên miền trong phiên này.
