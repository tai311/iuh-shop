# IUH Shop

Web HTML/CSS/JavaScript, dùng Supabase cho tài khoản, dữ liệu và lưu ảnh.

## Chạy cục bộ

```sh
npm ci
npm run dev
```

Mở http://127.0.0.1:4173. Trên PowerShell có thể dùng `npm.cmd` nếu chính sách máy chặn `npm.ps1`.

```sh
npm test
npm run check
```

Thư viện trình duyệt được khóa phiên bản trong `package-lock.json` và lưu tại `IUH shop/JS/vendor`. Sau khi chủ động cập nhật dependency, dùng `npm run vendor` rồi kiểm thử lại.

## Cơ sở dữ liệu

Ba migration trong `IUH shop/supabase/migrations` đã được áp dụng vào dự án Supabase `xecxofmogvqysejjpxvl` ngày 27/09/2026. Phiên bản file khớp lịch sử migration trên máy chủ. Không chạy lại các SQL gói dịch vụ cũ để tránh khôi phục quyền không an toàn.

Các file `supabase/patches` là nguồn tham khảo cho lần sửa đầu. Thay đổi tiếp theo cần migration mới; không sửa migration đã áp dụng. Các bài kiểm tra dựng PostgreSQL cục bộ từ metadata trước sửa rồi áp dụng lần lượt migration; không dùng tài khoản, đơn hàng hoặc tiền thật.

## Thanh toán hiện tại

- Gói cá nhân 19.000đ/30 ngày; nhóm 29.000đ/30 ngày, tối đa 3 người gồm chủ gói. Thanh toán từ số dư được xử lý nguyên tử; chuyển khoản tạo yêu cầu chờ đối soát.
- Quản trị viên vào **Đối soát và hỗ trợ**, kiểm tra tiền thực nhận rồi nhập mã giao dịch ngân hàng để xác nhận. Mỗi mã chỉ được dùng một lần.
- Đơn thường: người bán nhập 100.000đ → khách trả 105.000đ, cộng phí giao trung gian nếu chọn. Tiền bán chỉ được mở khóa sau khi người mua xác nhận hoàn tất hoặc quản trị viên xử lý.
- Rút tiền: giữ số tiền yêu cầu; quản trị viên chuyển qua ứng dụng ngân hàng rồi ghi nhận mã chuyển tiền thành công. Hủy đơn đã chuyển khoản tạo yêu cầu hoàn tiền ngân hàng; thao tác hủy chưa có nghĩa là ngân hàng đã trả tiền.
- **Chưa tích hợp payOS**, chưa có webhook và chưa tự chuyển tiền ngân hàng. Không có đơn payOS thật nào được tạo trong quá trình kiểm thử. QR minh họa cũ không phải bằng chứng thanh toán.
- **7 đơn cũ** được đánh dấu `needs_payment_review`. Cần đối chiếu chứng từ thật trước khi thu, hoàn hoặc chi tiếp.

Chi tiết thay đổi và giới hạn kiểm thử: [audit/REPAIR-REPORT.md](audit/REPAIR-REPORT.md).
