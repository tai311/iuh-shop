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

## Bổ sung: sửa chat trực tuyến

Phát hiện và sửa trong `tinnhan.js` / `iuh-chat-notification.js`:

- Trang chat khai báo nhưng không gọi `subscribeToMessages`: nay đăng ký khi khởi tạo, nhận tin mới và đồng bộ tin sửa/thu hồi. Khung mini cũng nghe cập nhật tin.
- Tạo hội thoại/thành viên trực tiếp bị database chặn: chuyển sang `get_or_create_direct_conversation`. Cả hai khung chat đánh dấu đã đọc bằng `mark_conversation_read`.
- Kho `chat-images` riêng tư nhưng UI dùng URL công khai: lưu đường dẫn đối tượng, tạo URL có thời hạn khi hiển thị; hỗ trợ URL cũ của cùng kho, từ chối URL bên ngoài.
- Chặn gửi trùng; chụp người nhận và bản nháp trước khi tải ảnh; không xóa bản nháp hoặc render tin sang cuộc chat vừa chuyển đến. Giữ bản nháp nếu gửi lỗi.
- Dùng chung Supabase client, sửa đường dẫn đăng nhập và mở đúng hội thoại khi có tham số `conversation`.
- Chặn phản hồi tải tin cũ ghi đè hội thoại đang mở; xử lý danh sách chưa đọc rỗng khi cập nhật thông báo.

Xác minh bổ sung: 18/18 test qua với `node --test tests/chat-runtime.test.cjs tests/frontend.test.cjs tests/public-discovery.test.cjs`. Test chat/signup cũ ở mục trên nay đã qua. Kiểm thử gồm DOM ảnh chat, callback realtime giả lập, RPC frontend và database PGlite kiểm tra quyền người tham gia/người ngoài. Hai script parse hợp lệ; trang chat localhost trả HTTP 200.

Database thật xác nhận hai RPC cho authenticated được gọi, ghi trực tiếp hội thoại/thành viên bị chặn, bảng messages có trong publication realtime và kho ảnh chat là private. Không sửa database, không gửi tin thật; chưa xác minh WebSocket và hai tài khoản thật qua trình duyệt. Bản sửa chưa triển khai production.

## Bổ sung: giảm thời gian chờ chat

Nguyên nhân trong frontend: mỗi cuộc chat tải thành viên, hồ sơ, số chưa đọc và tin cuối tuần tự; mỗi tin nhận lại truy vấn hồ sơ; gửi tin phải chờ cập nhật preview; sự kiện UPDATE của trạng thái đã đọc tải lại cả lịch sử và danh sách chat.

Đã gom truy vấn thành viên và hồ sơ, lưu hồ sơ công khai trong bộ nhớ 60 giây (gộp cả request đang chạy), tải số chưa đọc/tin cuối song song theo nhóm tối đa 6 cuộc chat, bỏ tìm lại admin khi đã có trong danh sách. Tin đã được server xác nhận hiển thị trước khi cập nhật preview; các lần ghi preview được xếp thứ tự theo hội thoại. Mini chat thêm tin vừa gửi thay vì tải lại lịch sử. Tin nhận không chờ RPC đánh dấu đã đọc mới render. UPDATE chỉ xử lý lại nội dung khi có sửa/thu hồi; trạng thái đã đọc của tin thông thường không tải lại lịch sử.

17/17 test qua: `node --test tests/chat-performance.test.cjs tests/chat-runtime.test.cjs tests/frontend.test.cjs`. Test hiệu năng xác nhận 50 lời gọi hồ sơ cùng người chỉ tạo 1 request, 12 cuộc chat dùng 1 truy vấn hồ sơ và 2 truy vấn thành viên (lấy ID của mình + lấy các thành viên đối ứng), có chạy song song với giới hạn, gửi không chờ preview và read receipt không tải lại lịch sử. Đây là kiểm thử số request/luồng chờ với mock; chưa có benchmark độ trễ mạng Supabase hoặc hai tài khoản thật. Không thay đổi database; bản online chưa được triển khai các sửa đổi này.
