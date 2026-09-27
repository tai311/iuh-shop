# Khu đối soát và hỗ trợ

Đăng nhập tài khoản có `users.role = admin`, mở `/HTML/admin.html`, chọn **Đối soát & hỗ trợ** hoặc **Đơn hàng**.

- 9 nhóm: đơn hàng, gói dịch vụ, nạp/rút ví, hoàn tiền, hỗ trợ, báo cáo sản phẩm, báo cáo người dùng, xác minh sinh viên, ủng hộ.
- Số trên nhóm đếm hồ sơ cần theo dõi, không phải tổng doanh thu hay tổng đơn. Danh sách mặc định gồm cả lịch sử, mới nhất trước, 20 hồ sơ/trang.
- Tìm theo mã hồ sơ, tên hoặc ID người tạo. Lọc riêng trạng thái xử lý và trạng thái thanh toán. Nhấn **Tìm / lọc** để áp dụng, **Làm mới** để lấy dữ liệu mới nhất.
- Chi tiết đơn hiển thị người mua, người nhận hàng, người bán từng sản phẩm, người hưởng tiền (bao gồm chủ ký gửi), thời điểm phân bổ ví và lịch sử trạng thái. Phân bổ vào ví không đồng nghĩa đã chuyển tiền ra ngân hàng.
- Chứng từ ngân hàng đã đối soát được hiển thị cùng người duyệt và thời điểm ghi nhận. Thao tác thu/chi vẫn sử dụng các RPC kiểm tra quyền và chống ghi nhận trùng có sẵn; chưa tích hợp webhook payOS.
- Đơn đã đối soát hoặc tiền mặt có thể chuyển sang trạng thái kế tiếp; hoàn tất đơn online chạy cơ chế phân bổ tiền có sẵn. Đơn cũ `needs_payment_review` chỉ xem, không đối soát hoặc chuyển tiếp qua màn hình này.
- Phản hồi hỗ trợ có trạng thái chờ/đang xử lý/giải quyết/từ chối. Cập nhật kiểm tra trạng thái cũ để tránh ghi đè khi admin khác đã xử lý.

## Quyền và dữ liệu

Hai RPC đọc `admin_operations_list` và `admin_operation_detail` kiểm tra đăng nhập và `private.is_admin()` trên máy chủ. Dùng SECURITY INVOKER và RLS, thu hồi quyền gọi của anon/PUBLIC. Tài khoản thường và moderator không được truy cập khu này, kể cả gọi API trực tiếp.

Danh sách chỉ lấy dữ liệu tóm tắt; điện thoại/địa chỉ giao nhận, thông tin tài khoản nhận tiền và nội dung hỗ trợ chỉ tải khi mở hồ sơ. Chi tiết dùng danh sách trường được phép, không trả mật khẩu/hash hoặc toàn bộ hồ sơ người dùng. Ảnh thẻ chỉ xin URL có hạn khi bấm xem; dữ liệu của màn hình được xóa khi đóng chi tiết hoặc đăng xuất. Không ghi dữ liệu riêng tư vào localStorage.

## Kiểm tra

- `npm.cmd test`: 18 kiểm thử đạt, gồm DB/RLS thật trong PGlite, vai trò user/moderator/anon bị chặn, phân trang, lọc, chứng từ, người hưởng tiền, escaping, bỏ kết quả tải cũ, xóa dữ liệu sau đăng xuất.
- `npm.cmd run check`: 32 script, 33 HTML không lỗi.
- Trình duyệt với dữ liệu giả cục bộ: bảng desktop, thẻ mobile 390px, chi tiết, không lỗi JavaScript. Không tạo giao dịch tài chính thật để thử UI.
- Migration `20260927091715_admin_operations_dashboard.sql` đã áp dụng Supabase. Đã xác minh quyền thực thi production; advisor không nêu lỗi mới liên quan đến các đối tượng này. Connector SQL chỉ đọc không có quyền đóng vai authenticated, nên kiểm thử hành vi admin/user được thực hiện trong PGlite thay vì đổi quyền connector production.
