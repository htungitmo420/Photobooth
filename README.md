# Khoảnh Khắc Photobooth

Photobooth tập trung vào một luồng duy nhất: chọn bố cục, chụp liên tiếp, chỉnh nhẹ và tải ảnh về. Ở chế độ **Chỉ ảnh**, ảnh chỉ được xử lý trong trình duyệt. Chế độ **Ảnh + LiveGallery** chụp gấp đôi số ảnh, cho khách chọn ảnh đưa vào photobooth, ghép phần còn lại thành GIF/video và chỉ tải album lên khi khách bấm tạo mã QR.

P1 bổ sung zoom/căn khung khi chụp, countdown 0–30 giây, flash tự động với fallback màn hình, chọn camera ngoài, thư viện sticker kéo thả và frame PNG/WebP cá nhân.

## Chạy local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Điền URL và publishable key của project Supabase vào `.env.local`. Không dùng secret key hoặc service-role key ở frontend.

LiveGallery dùng các biến:

```text
VITE_GALLERY_PUBLISH_URL=https://<project-ref>.supabase.co/functions/v1/album-publish
```

## Supabase

Migration trong `supabase/migrations` tạo:

- Bảng `public.photobooth_frames` có RLS.
- Bucket public `photobooth-frames` cho PNG/SVG/WebP tối đa 5 MB.
- Bảng `public.photobooth_stickers` có RLS và bucket public `photobooth-stickers` cho asset tối đa 1 MB.
- Quyền đọc frame đã phát hành cho khách; quyền ghi chỉ dành cho user có `app_metadata.role = admin`.
- Sáu frame màu mặc định.
- Edge Function `album-publish` của dự án LiveGallery nhận bộ ảnh hợp lệ từ domain production, lưu vào bucket riêng tư và trả về mã album.

Nếu chưa cấu hình Supabase, app dùng cùng sáu preset tích hợp để việc phát triển local không bị chặn.

## Scripts

- `pnpm dev`: chạy môi trường phát triển.
- `pnpm typecheck`: kiểm tra TypeScript.
- `pnpm test`: kiểm tra hình học bố cục và các quy tắc render thuần.
- `pnpm build`: tạo bản production trong `dist/`.
- `pnpm preview`: xem bản build production.
