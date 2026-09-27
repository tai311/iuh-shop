# Thanh toán gói bằng payOS

Phạm vi: mua/gia hạn gói cá nhân/nhóm bằng chuyển khoản. Thanh toán ví IUH giữ nguyên. Chuyển khoản mua hàng, nạp/rút ví chưa nối payOS trong thay đổi này.

## Cấu hình production

Lưu trong Supabase Edge Function Secrets (không đưa giá trị vào source/GitHub):

- `PAYOS_CLIENT_ID`
- `PAYOS_API_KEY`
- `PAYOS_CHECKSUM_KEY`

Hai hàm Edge: `payos-package` và `payos-webhook`. `verify_jwt=false` là có chủ đích: gateway kiểm tra access token bằng Supabase Auth trước mọi thao tác; webhook dùng chữ ký HMAC payOS, không dùng JWT người dùng. RPC ghi nhận thanh toán chỉ cấp EXECUTE cho service_role; trình duyệt không được gọi để tự kích hoạt gói.

Gateway tự đăng ký URL webhook dưới đây trước khi phát hành QR, dùng API confirm-webhook chính thức. Nếu đăng ký thất bại thì không phát hành QR. Có thể cấu hình cùng URL trong kênh payOS:

`https://xecxofmogvqysejjpxvl.supabase.co/functions/v1/payos-webhook`

Trang khách quay về cố định: `https://iuh-shop.vercel.app/HTML/taikhoan.html?payos_return=1`. Tham số URL không được dùng để xác nhận đã trả tiền.

## Luồng

1. Tài khoản → Nâng cấp gói → Chuyển khoản ngân hàng → Tạo mã QR payOS.
2. Backend tạo yêu cầu với giá lấy từ DB, cấp một orderCode duy nhất, giữ cùng mã khi retry. Khách mở trang QR do payOS cung cấp.
3. Webhook xác minh chữ ký rồi truy vấn lại giao dịch qua API payOS. Đồng bộ kiểm tra mã link, số tiền, trạng thái và số đã nhận trước khi kích hoạt.
4. DB ghi chứng từ, gia hạn và bút toán trong cùng giao dịch. Không trừ/cộng ví người mua khi trả bằng ngân hàng. Bút toán doanh thu admin dùng cơ chế hiện có.
5. Khi cửa sổ đang mở, giao diện đọc trạng thái DB mỗi 10 giây; nút Kiểm tra thanh toán đối chiếu API nếu webhook chậm. Đóng trang không ngăn webhook hoạt động.
6. Hủy link qua payOS trước khi hủy yêu cầu trên hệ thống. Không cho RPC thủ công thay đổi giao dịch đã gắn payOS. Trạng thái PAID đã ghi nhận không bị ghi đè bởi thông báo hủy/chờ cũ.

## Trường hợp cần hỗ trợ

Đã có tiền nhưng sai số tiền, nhận sau khi hủy, trùng chứng từ, hoặc thành viên nhóm đã tham gia gói khác: đánh dấu `payos_status=review`, giữ số tiền/chứng từ và lý do. Admin xem tại Đối soát & hỗ trợ → Gói dịch vụ → Chi tiết. Không tự thu thêm, tự hoàn tiền, hoặc kích hoạt lại. Các ca này cần kiểm tra/giải quyết riêng; chưa có hoàn tiền payOS tự động.

## Kiểm tra đã thực hiện

- 21 kiểm thử: DB/RLS trong PGlite, ký/xác minh HMAC, giả mạo giá, webhook giả, ownership, timeout/retry cùng mã, trùng thông báo, chặn đối soát thủ công, thanh toán muộn/sai số tiền, bảo toàn ví; cùng các regression trước đó.
- 32 JS/33 HTML qua source checks; các file TS Edge qua kiểm tra cú pháp Node và triển khai Supabase.
- Trình duyệt với dữ liệu giả: chọn ngân hàng, tạo yêu cầu, hiện nút mở QR và nút kiểm tra; không lỗi JavaScript.
- Production: hai hàm ACTIVE; gateway không đăng nhập trả 401; webhook sai chữ ký trả 401. Không dùng tài khoản thật để tạo giao dịch thu tiền khi kiểm thử.
- Chưa thử chuyển khoản ngân hàng thật và chưa xác nhận bộ khóa với một lần tạo QR thật. Người vận hành cần kiểm tra một lần mua gói trước khi cho người khác sử dụng.

Tài liệu: https://payos.vn/docs/api/ và https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/.
