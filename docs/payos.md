# Thanh toán gói bằng payOS

Tài liệu này mô tả mua/gia hạn gói cá nhân/nhóm bằng chuyển khoản. Thanh toán ví IUH giữ nguyên. Thanh toán đơn hàng đã có tài liệu riêng tại [payos-orders.md](payos-orders.md); nạp/rút ví chưa nối payOS.

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

1. Tài khoản → Nâng cấp gói → Chuyển khoản ngân hàng → tạo link/QR PayOS theo đúng mã giao dịch. UI không dùng QR ngân hàng tĩnh.
2. Backend tạo yêu cầu với giá lấy từ DB, cấp một orderCode duy nhất, giữ cùng mã khi retry. Modal trả link thanh toán đã được PayOS cấp; khách mở link để thanh toán, sau đó có thể kiểm tra hoặc hủy cùng giao dịch. Không dùng QR tĩnh hay tự dựng nội dung chuyển khoản.
3. Webhook xác minh chữ ký rồi truy vấn lại giao dịch qua API payOS. Đồng bộ kiểm tra mã link, số tiền, trạng thái và số đã nhận trước khi kích hoạt.
4. DB ghi chứng từ, gia hạn và bút toán trong cùng giao dịch. Không trừ/cộng ví người mua khi trả bằng ngân hàng. Bút toán doanh thu admin dùng cơ chế hiện có.
5. Nút Kiểm tra thanh toán yêu cầu backend đối chiếu API PayOS; giao diện không tự kích hoạt gói từ callback trình duyệt. Đóng modal không hủy giao dịch; webhook tiếp tục hoạt động.
6. Hủy link qua payOS trước khi hủy yêu cầu trên hệ thống. Không cho RPC thủ công thay đổi giao dịch đã gắn payOS. Trạng thái PAID đã ghi nhận không bị ghi đè bởi thông báo hủy/chờ cũ.

Ví IUH ở luồng gói dịch vụ được trừ khỏi số dư người mua và giữ trong `pending`; admin duyệt mới phân bổ tiền và kích hoạt gói. Admin từ chối sẽ trả tiền giữ về ví. Chuyển khoản payOS được tự kích hoạt sau webhook xác minh; không cần admin xác nhận lần hai.

Migration `20261003100000_payment_review_admin_controls.sql` bổ sung giữ/hoàn tiền ví gói, quyền thu hồi gói có audit và hủy đơn an toàn. Cần áp dụng migration và deploy lại `payos-package`, `payos-order`, `payos-webhook` cùng frontend khi triển khai.

Migration này bật chế độ chạy thử miễn phí cho toàn bộ người dùng. Khi bật, frontend chỉ hiện phương thức trial và database từ chối trực tiếp `wallet`, `bank`, `qr`/link PayOS. Admin có thể tắt bằng RPC `set_iuh_trial_mode(false)` sau khi kết thúc chạy thử; giao diện sẽ hiện lại các phương thức trả tiền.

## Trường hợp cần hỗ trợ

Đã có tiền nhưng sai số tiền, nhận sau khi hủy, trùng chứng từ, hoặc thành viên nhóm đã tham gia gói khác: đánh dấu `payos_status=review`, giữ số tiền/chứng từ và lý do. Admin xem tại Đối soát & hỗ trợ → Gói dịch vụ → Chi tiết. Không tự thu thêm, tự hoàn tiền, hoặc kích hoạt lại. Các ca này cần kiểm tra/giải quyết riêng; chưa có hoàn tiền payOS tự động.

## Kiểm tra đã thực hiện

- 24 kiểm thử: DB/RLS trong PGlite, ký/xác minh HMAC, giả mạo giá, webhook giả, ownership, timeout/retry cùng mã, trùng thông báo, chặn đối soát thủ công, thanh toán muộn/sai số tiền, bảo toàn ví, khung checkout nhúng; cùng các regression trước đó.
- 32 JS/33 HTML qua source checks; các file TS Edge qua kiểm tra cú pháp Node và triển khai Supabase.
- Trình duyệt với dữ liệu giả: chọn ngân hàng, tạo yêu cầu, hiện nút mở QR và nút kiểm tra; không lỗi JavaScript.
- Production: hai hàm ACTIVE; gateway không đăng nhập trả 401; webhook sai chữ ký trả 401. Không dùng tài khoản thật để tạo giao dịch thu tiền khi kiểm thử.
- Khi triển khai ban đầu chưa thử chuyển khoản ngân hàng thật. Ngày 27/09/2026, giao dịch thật do người vận hành thực hiện đã phát hiện lỗi xử lý phản hồi RPC không có nội dung, được sửa như dưới đây.

## Sửa lỗi webhook ngày 27/09/2026

`payos_bind_package` trả `void`, nên PostgREST trả HTTP 204 không có body. Helper cũ gọi `res.json()` vô điều kiện, làm webhook trả 500 trước khi gọi `payos_sync_package`; giao dịch vẫn pending dù đã có thông báo từ payOS. Helper nay đọc body rỗng thành `null`, vẫn kiểm tra lỗi HTTP và từ chối JSON hỏng. Gateway và webhook đều cần triển khai lại vì cùng dùng helper này.

Kiểm thử Edge dùng phản hồi 204 thực tế thay cho JSON `null`: thất bại với code cũ, đạt sau bản sửa cho cả tạo QR, kiểm tra trạng thái và webhook hợp lệ. Có log lỗi chỉ chứa loại lỗi/mã HTTP/mã lỗi DB, không ghi khóa hoặc payload thanh toán. Đồng bộ lại vẫn phải xác minh chữ ký hoặc người dùng đăng nhập, truy vấn trạng thái từ API payOS và áp dụng kiểm tra số tiền/trùng giao dịch hiện có.

Tài liệu: https://payos.vn/docs/api/ và https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/.
