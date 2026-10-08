    # Sửa hiển thị phía người dùng — 08/10/2026

## Nguyên nhân và bản sửa

Trang chủ, tìm kiếm, diễn đàn, đánh giá và tin nhắn còn đọc hồ sơ từ `users`. Policy chỉ cho đọc chính mình hoặc admin nên tên người khác bị mất. Các phần hiển thị công khai này chuyển sang `public_profiles`; đọc và cập nhật tài khoản riêng vẫn dùng `users`.

Đề xuất trang chủ và gợi ý tìm kiếm còn đọc `service_package_members` / `service_packages`, vốn chỉ dành cho thành viên và admin. Chuyển sang `service_package_badges` có sẵn, chỉ chọn user_id, status, starts_at, expires_at. Giữ kiểm tra hạn sử dụng; nếu đọc badge lỗi thì vẫn hiển thị tin đẩy hợp lệ. Bỏ giới hạn 100 sản phẩm trước khi lọc đề xuất trong tìm kiếm để tránh bỏ sót các sản phẩm nằm ngoài 100 dòng đầu.

Không thay đổi schema hoặc policy database.

## Xác minh

- 10/10 test liên quan qua: `node --test tests/public-discovery.test.cjs tests/public-sellers.test.cjs tests/boost.test.cjs`.
- Truy vấn database thật với role authenticated và ID người dùng thường: 53 hồ sơ có tên tìm kiếm được, 68 sản phẩm active nối được hồ sơ người bán, 19 sản phẩm nối được badge gói, 0 hồ sơ riêng của người khác đọc được. Giao dịch kiểm tra đã rollback.
- Role anon đọc được 112 hồ sơ công khai và 6 badge. Database hiện không có tin đẩy còn hạn; luồng tin đẩy được kiểm thử bằng fixture.
- Check nguồn parse được 39 script. Kiểm tra đầy đủ vẫn báo 26 trang thiếu runtime dùng chung, tồn tại trước bản sửa. Bộ frontend mở rộng: 16/17 test qua; test audit/test-social.cjs lỗi vì IUHChatMedia.signedURL không tồn tại trong phần mã fixture nạp. Phần khởi tạo này không được sửa trong task.
- `git -c core.whitespace=cr-at-eol diff --check` qua; giữ CRLF hiện có.
- Chưa kiểm tra trực quan: công cụ trình duyệt không khởi động được (CreateProcessWithLogonW 1056).

Bản sửa nằm trong workspace, chưa triển khai website production. Xem tại http://127.0.0.1:4173/HTML/trangchu.html khi server `node scripts/serve.cjs` đang chạy.
