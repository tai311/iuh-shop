# Chạy thử miễn phí

Đã áp dụng `free_trial_checkout` và `payment_review_admin_controls` lên Supabase `xecxofmogvqysejjpxvl` ngày 03/10/2026. Đã xác minh chế độ thử bật, luồng admin được cài đặt và tài khoản chưa đăng nhập không có quyền duyệt. HTML/JS/CSS đã cập nhật trong workspace; chưa phát hành frontend lên hosting.

- Chế độ thử được bật trong database. Checkout giữ lựa chọn “Thanh toán bằng QR”, không có lựa chọn miễn phí riêng. Khi xác nhận QR trong chế độ thử, frontend gửi phương thức nội bộ `trial` để không phát sinh tiền hay mở payOS. Gói dịch vụ tiếp tục dùng chế độ miễn phí hiện có.
- Khách chọn một trong bốn điểm nhận hàng: Cơ sở chính Nguyễn Văn Bảo, Cơ sở Nguyễn Văn Dung, Cơ sở Phạm Văn Chiêu, Sân vận động Đạt Đức.
- Khách xác nhận: đơn `pending`, thanh toán `unpaid`, thông báo thành công và chờ admin duyệt. Không trừ ví hay tạo QR.
- Admin xác nhận thanh toán: đơn tự sang `shipping`, thanh toán `paid`. Không cần thao tác bắt đầu giao riêng.
- Admin xác nhận giao thành công: đơn `completed`. Người mua/người bán không được tự duyệt đơn thử. Gọi lặp không phát sinh tiền hoặc lịch sử trùng.
- Gói dịch vụ thử được gửi vào mục Gói dịch vụ trên admin với trạng thái chờ duyệt. Admin duyệt mới kích hoạt, hoặc hủy yêu cầu; gói đang hoạt động có thể được thu hồi. Đã cập nhật Supabase bằng migration `trial_packages_require_admin_approval`. Các đơn thanh toán thật cũ giữ nguyên quy trình đối soát/hoàn tiền.
- Giá sản phẩm vẫn hiển thị để kiểm thử tính giá; đơn thử không tạo bút toán tiền, phí hoặc khoản chi người bán.

Kiểm thử database sử dụng PGlite và schema đã lưu trong dự án, không tạo đơn trên môi trường thật.

Security advisors: bảng cấu hình cố ý không có policy đọc trực tiếp (chỉ truy cập qua RPC kiểm tra đăng nhập); các RPC admin kiểm tra quyền trong hàm. Các cảnh báo sẵn có cần theo dõi riêng: [get_my_orders cho phép anon gọi SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [bảo vệ mật khẩu rò rỉ chưa bật](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
