# Kết quả sửa IUH Shop — 27/09/2026

## Đã sửa

- Gói dịch vụ: thay luồng thanh toán cũ bằng RPC kiểm tra người mua, giá, hạn gói, thành viên; khóa giao dịch, chống gọi lặp, gia hạn thêm 30 ngày. Chuyển khoản chờ đối soát, không tự kích hoạt. Giao diện giữ mã giao dịch khi mất kết nối để thử lại an toàn; khóa nút khi xử lý.
- Đơn hàng: giá và phí 5% tính phía máy chủ, khóa tồn kho, tạo đơn/trừ số dư nguyên tử. Không cho sửa tổng tiền, mua hàng của mình hoặc gộp nhiều người bán vào một đơn thường. Cập nhật trạng thái tuần tự; người bán không tự xác nhận người mua nhận hàng.
- Số dư: tiền giữ cho đơn tách khỏi khoản có thể chi; hoàn tất giải ngân đúng người bán, ghi phí; chặn các RPC cộng/trừ tiền giả cũ. Nạp/rút dùng yêu cầu có đối soát, giữ tiền rút và chống duyệt lặp. Có lịch sử yêu cầu.
- Hoàn tiền: hủy đơn QR tạo yêu cầu hoàn qua ngân hàng, không cộng giả vào ví rồi báo đã hoàn. Admin chỉ ghi hoàn tất sau chuyển tiền thật có mã đối soát. Một mã ngân hàng không dùng lại giữa các luồng thanh toán.
- Ký gửi: duyệt và tạo sản phẩm trong cùng giao dịch, chặn chi tiền thủ công qua RPC cũ thiếu ràng buộc; hủy giữ lịch sử thay vì xóa dữ liệu liên quan đơn hàng.
- Tài khoản: hồ sơ riêng chỉ chủ tài khoản/admin được đọc; hồ sơ công khai tách riêng. Chặn tự nâng quyền, tự xác thực và tự cấp đẩy tin. Xử lý đăng ký cần xác nhận email; bổ sung gửi lại thẻ sinh viên sau đăng nhập, ảnh riêng tư và URL xem tạm thời.
- Chat: tạo hội thoại/thành viên nguyên tử, không cho tự tham gia hội thoại bất kỳ; đọc tin qua RPC riêng, không sửa tin người khác. Giữ đúng người nhận khi đổi hội thoại lúc đang tải ảnh. Ảnh chat dùng quyền thành viên và URL ký.
- Nội dung: escape dữ liệu khi dựng giao diện, lọc HTML diễn đàn; bảo vệ bài viết chính thức, trạng thái kiểm duyệt và ảnh upload. Sản phẩm ẩn không còn được đọc công khai qua policy rộng.
- Hỗ trợ/admin: form liên hệ có nơi lưu và lịch sử; báo cáo sản phẩm/người dùng có quyền và hàng chờ xử lý. Bổ sung mục đối soát gói/đơn/nạp-rút/hoàn tiền/Donate/thẻ sinh viên. Sửa vùng quảng cáo nằm ngoài trang quản trị tương ứng.
- Giao diện: sửa URL chuyển hướng, link sai, ảnh dự phòng; sửa header/footer tràn ngang và banner bị cắt trên điện thoại. SDK dùng chung, khóa phiên bản, sửa đường dẫn thư viện bị thiếu; đồng bộ bản chat ở root và bản web thực tải.

## Kiểm chứng

- `npm test`: **16/16 đạt**. Dùng PostgreSQL cục bộ (PGlite) chạy SQL thật với role/RLS; kiểm tra chống thanh toán lặp, gia hạn, thiếu số dư rollback, duyệt ngân hàng, trùng mã chứng từ, sửa giá, hoàn QR, phân bổ 100.000đ/5.000đ, giữ/hủy rút tiền, chặn RPC cũ, quyền chat và dữ liệu công khai.
- Kiểm tra DOM bằng jsdom: popup gói ngân hàng không báo kích hoạt sớm, bấm lặp chỉ gửi một lần, lỗi máy chủ mở lại nút, mất kết nối giữ mã thử lại; lọc HTML. Bài kiểm tra đăng ký và chat dùng mã ứng dụng thật với dịch vụ giả cục bộ.
- `npm run check`: **32 file JS, 33 trang HTML**, không có lỗi cú pháp JS, thiếu script/CSS nội bộ hoặc trùng ID.
- Trình duyệt: đã mở 33 entrypoint HTML (trang riêng có chuyển hướng đăng nhập), cùng entrypoint root. Không ghi nhận lỗi JavaScript chưa xử lý trong lượt cuối; không có ảnh đã tải xong nhưng hỏng tại thời điểm đo. Đây là kiểm tra tải trang, không phải toàn bộ tương tác của từng trang.
- Trang chủ/sản phẩm/diễn đàn được đo ở 360, 390 và 768px: chiều rộng nội dung khớp viewport. Popup gói và admin được kiểm tra bằng tài khoản giả cục bộ, không dùng tiền hoặc tài khoản thật.
- Ba migration đã áp dụng trên Supabase và xác minh lại quyền; RPC nạp giả không còn quyền gọi cho authenticated. Truy vấn sau sửa không thấy số dư âm hoặc NaN.
- Supabase Security Advisor sau migration thứ hai không còn mục mức ERROR. Còn cảnh báo về 29 RPC SECURITY DEFINER cho người đăng nhập: đây là các điểm vào nghiệp vụ có kiểm tra người dùng/quyền, đã giữ search_path cố định. Còn cảnh báo Auth chưa bật kiểm tra mật khẩu rò rỉ: [hướng dẫn Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Performance Advisor còn khuyến nghị về index/FK, cách viết RLS và policy trùng. Chưa coi đây là bằng chứng đã kiểm tra tải lớn; chưa chạy stress test hoặc kiểm thử nhiều giao dịch đồng thời trên máy chủ.

## Phần chưa thể gọi là hoàn tất vận hành thật

1. **payOS chưa nối**: cần tạo link ở backend, giữ API/checksum key trong secret, kiểm tra chữ ký webhook, khớp mã đơn/số tiền, chống xử lý lại và xử lý giao dịch đến trễ. Frontend không được tự xác nhận thanh toán dựa vào trang redirect.
2. **7 đơn lịch sử cần đối soát**: đã đánh dấu và khóa thu/chi tự động liên quan. Không tự đoán số tiền thực đã chuyển hoặc thay đổi số dư để che lệch lịch sử.
3. Chưa thử chuyển tiền thật, xác nhận email qua hộp thư thật, hay tải thẻ thật. Chưa công bố frontend lên hosting; bản source đã sửa ở workspace, Supabase đã cập nhật.
4. Đồ án hiện dùng đối soát thủ công cho ngân hàng và hoàn tiền. Không có tác vụ tự hết hạn QR/đơn chưa trả tiền, bộ xử lý tranh chấp đầy đủ hay cơ chế tự động chi ngân hàng; cần bổ sung theo phạm vi khi tích hợp payOS.

Các báo cáo audit ban đầu mô tả trạng thái trước sửa, không phải danh sách lỗi còn hiện hành. Không có cơ sở để hứa web không còn bất kỳ lỗi nào ngoài phạm vi các kiểm tra trên.
