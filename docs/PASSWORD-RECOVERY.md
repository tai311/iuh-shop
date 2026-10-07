# Khôi phục mật khẩu PASSIT

## Luồng người dùng

Đăng nhập → Quên mật khẩu? → nhập email đăng ký → mở email mới nhất → đặt mật khẩu mới → quay lại đăng nhập. Không yêu cầu người dùng đưa mật khẩu cũ cho admin.

## Cấu hình trước khi dùng trên website thật

Website được người dùng xác nhận: https://iuh-shop.vercel.app/
Với thư mục deploy là IUH shop (index.html chuyển đến HTML/trangchu.html), trang nhận email là:

https://iuh-shop.vercel.app/HTML/quenmatkhau.html

1. Triển khai mã mới lên website; kiểm tra đường dẫn trên trả trang khôi phục, không phải 404. Nếu cấu hình deploy đổi đường dẫn, dùng URL thực tế của quenmatkhau.html.
2. Trong [Supabase URL Configuration](https://supabase.com/dashboard/project/xecxofmogvqysejjpxvl/auth/url-configuration), giữ các redirect hiện có, thêm URL chính xác ở trên; Site URL dùng https://iuh-shop.vercel.app/.
3. Nếu thử local bằng scripts/serve.cjs, thêm http://localhost:4173/HTML/quenmatkhau.html hoặc http://127.0.0.1:4173/HTML/quenmatkhau.html đúng với địa chỉ đang mở. Không dùng file://.
4. Kiểm tra SMTP/sender email của Supabase. Email template Reset Password cần giữ liên kết xác thực {{ .ConfirmationURL }} của Supabase để token được kiểm tra trước khi chuyển về trang. Không thay bằng liên kết trần tới trang web.
5. Thử bằng tài khoản kiểm thử và email do bạn kiểm soát: yêu cầu email, mở link, đổi mật khẩu, xác nhận mật khẩu cũ không đăng nhập được; kiểm tra link hết hạn/đã dùng, hai mật khẩu khác nhau, mất mạng và mở link khi đang đăng nhập tài khoản khác.

Mã gửi resetPasswordForEmail với redirectTo là trang quenmatkhau.html cùng nguồn hiện tại. Dùng implicit recovery rõ ràng; trang nhận token trong fragment, xóa token khỏi URL rồi gọi setSession/getUser/updateUser. Không dùng session đăng nhập có sẵn để bật form. Session khôi phục chỉ ở bộ nhớ: tải lại trang sau khi mở link cần yêu cầu email mới.

Giới hạn: cooldown giao diện 60 giây chỉ ngăn nhấn liên tục; giới hạn máy chủ Supabase mới là lớp chống lạm dụng. Mật khẩu mới 8–128 ký tự; chính sách Auth chặt hơn sẽ được máy chủ kiểm tra. Thành công reset không bị đổi thành thất bại nếu lệnh đăng xuất sau đó lỗi; chưa khẳng định mọi access token cũ mất hiệu lực tức thời.

Tham khảo: [Gửi email reset](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Cập nhật mật khẩu](https://supabase.com/docs/reference/javascript/auth-updateuser).
