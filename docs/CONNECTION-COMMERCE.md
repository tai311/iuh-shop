# Luồng kết nối mua bán PASSIT

## Quy tắc đã triển khai

- Người bán đăng miễn phí, cung cấp tên, danh mục, số lượng, giá, ảnh, tình trạng, khu vực và mô tả từ 10–1.800 ký tự. Không mua đẩy tin trong bước đăng mới.
- Giá sản phẩm trên trang chủ, danh sách, chi tiết và giỏ hàng không cộng thêm 5% cho người mua.
- Người mua không cần nhập họ tên, điện thoại hoặc địa điểm nhận hàng khi đặt yêu cầu. Có thể để lại ghi chú không bắt buộc; hai bên thống nhất thông tin và cách giao dịch trong chat sau khi người bán xác nhận. Bỏ thanh toán và lựa chọn vận chuyển ở bước đặt hàng.
- Giỏ nhiều người bán được tách thành từng yêu cầu. Phí mỗi yêu cầu = `max(2.000, round(tổng tiền sản phẩm × 5%))`, do người bán chịu. Giá và phí được tính lại ở SQL; không tin số phí gửi từ trình duyệt.
- Giữ tồn kho khi tạo yêu cầu. Người bán nhận thông báo và có 24 giờ để xác nhận phí. Hủy/hết hạn trả tồn kho đúng một lần, không khôi phục trạng thái đăng của sản phẩm đã bị xóa/ẩn.
- Xác nhận phí mới mở chat. Người mua ở trang chờ được chuyển sang chat; giỏ nhiều người bán có nút chat riêng từng yêu cầu. Trang đơn hàng và thông báo cũng có đường vào chat.
- Cả chat cũ và chat mới đều chịu kiểm tra quyền tại database. Chat hỗ trợ admin vẫn mở. Đơn lịch sử đã trả phí COD, hoặc đơn trực tuyến đã thanh toán và quyết toán, tiếp tục cho phép chat giữa đúng hai bên. Chỉ có đơn cũ đang chờ hoặc mới thanh toán tiền hàng COD chưa đủ điều kiện.
- Trong chat/đơn hàng, người bán chọn giao trực tiếp (0đ) hoặc PASSIT giao hộ (5.000đ). Xác nhận giao hộ tạo khoản phí riêng và thông báo admin. Admin nhận giao hộ rồi cập nhật đã giao; hai bên nhận thông báo trạng thái.

## Thanh toán hiện tại

Theo yêu cầu, `private.connection_settings.auto_confirm=true`: người bán chủ động bấm xác nhận, hệ thống ghi phí với `confirmation_mode='automatic_test'` và mở chat. Giao diện ghi rõ không chuyển tiền thật. Không tạo QR giả, không gọi ngân hàng/MoMo, không trừ hoặc cộng tiền ví.

`connection_fee_entries` là sổ ghi nhận phí của luồng mới, tách khỏi quyết toán tiền hàng cũ. Mỗi loại phí chỉ có một bản ghi trên mỗi yêu cầu. Tắt `auto_confirm` sẽ từ chối xác nhận phí mới; cần triển khai tích hợp cổng thanh toán và xác thực webhook trước khi dùng tiền thật.

## Dữ liệu, bảo vệ và triển khai

Migrations: `IUH shop/supabase/migrations/20261008105343_seller_connection_workflow.sql` and `IUH shop/supabase/migrations/20261008190000_optional_connection_recipient_details.sql`.

Migration tạo các bảng `connection_requests`, `connection_items`, `connection_fee_entries`, `connection_notifications`, cùng cấu hình và biên nhận idempotency trong schema `private`. Người dùng không được ghi trực tiếp vào trạng thái, số phí hoặc biên nhận. RPC xác nhận phí/giao hàng kiểm tra đúng người bán; cập nhật giao hộ kiểm tra admin. RLS giới hạn đọc theo bên tham gia.

Migration thay điều kiện thành viên chat, đồng thời thu hồi quyền tạo đơn thanh toán cũ và đăng sản phẩm có phí đẩy tin từ trình duyệt. API quản lý lịch sử vẫn được giữ. Các trang đơn hàng và dashboard tách lịch sử cũ khỏi yêu cầu kết nối mới.

Nếu có `pg_cron`, migration tạo lịch `passit-expire-connections` mỗi phút. Điều kiện xác nhận phí luôn kiểm tra hạn 24 giờ; truy vấn danh sách và tạo yêu cầu cũng dọn yêu cầu hết hạn. Sau khi triển khai cần kiểm tra lịch cron đang hoạt động để tồn kho được trả khi không có ai truy cập.

**Bản thay đổi này được kiểm tra cục bộ; chưa áp dụng migration vào Supabase, chưa push/deploy giao diện lên Vercel.** Khi triển khai, áp dụng cả hai migration cùng đợt phát hành các trang/JS mới: giao diện cũ không tạo được đơn sau khi RPC cũ bị thu hồi. Sau đó kiểm tra bằng tài khoản thử người mua, người bán và admin trên bản triển khai. Không rollback riêng giao diện về checkout cũ khi database đã chuyển luồng.

## Kiểm tra

- `npm run check`: kiểm tra cú pháp JS, đường dẫn tài nguyên và ID HTML.
- `npm test`: toàn bộ bộ hồi quy, gồm luồng database mới trên PGlite và tương tác DOM trên jsdom.
- Kết quả kiểm tra cục bộ: 121/121 test qua; 42 script và 34 trang qua kiểm tra mã nguồn.
- `tests/connection-commerce.test.cjs`: phí tối thiểu/tách người bán, idempotency, hồi phục biên nhận, quyền truy cập, chat cũ/mới, giao hộ, hết hạn/hủy và tồn kho, đăng miễn phí, không phát sinh tiền hàng hoặc giao dịch ví.
- `tests/connection-ui.test.cjs`: đặt hàng không yêu cầu họ tên, số điện thoại hoặc địa điểm, không cộng phí người mua, retry/mất phản hồi, chặn bấm lặp, thao tác phí/giao hộ và mở bảng giao dịch khi đổi cuộc chat.
- `tests/order-handoff.test.cjs` tạo đơn lịch sử trước migration rồi kiểm tra tiếp toàn bộ vòng đời sau migration.
- Các bộ kiểm tra hợp đồng checkout/boost cũ dùng `legacyCommerce` và fixture HTML tại commit `eb0fd17`; chúng kiểm tra hợp đồng lịch sử, không phải giao diện checkout đang chạy.

PGlite không kiểm chứng scheduler pg_cron hay cạnh tranh giữa nhiều kết nối PostgreSQL thực. Công cụ trình duyệt của phiên làm việc không có browser khả dụng, nên chưa có kiểm tra hình ảnh hay phiên đăng nhập người mua/người bán trên môi trường live.
