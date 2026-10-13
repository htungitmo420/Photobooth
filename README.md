# Khoảnh Khắc Photobooth

Photobooth tập trung vào một luồng duy nhất: chọn bố cục, chụp liên tiếp, chỉnh nhẹ và tải ảnh về. Ảnh người dùng được xử lý hoàn toàn trong trình duyệt. Supabase chỉ lưu danh mục và asset frame.

## Chạy local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Điền URL và publishable key của project Supabase vào `.env.local`. Không dùng secret key hoặc service-role key ở frontend.

## Supabase

Migration trong `supabase/migrations` tạo:

- Bảng `public.photobooth_frames` có RLS.
- Bucket public `photobooth-frames` cho PNG/SVG/WebP tối đa 5 MB.
- Quyền đọc frame đã phát hành cho khách; quyền ghi chỉ dành cho user có `app_metadata.role = admin`.
- Sáu frame màu mặc định.

Nếu chưa cấu hình Supabase, app dùng cùng sáu preset tích hợp để việc phát triển local không bị chặn.

## Scripts

- `pnpm dev`: chạy môi trường phát triển.
- `pnpm typecheck`: kiểm tra TypeScript.
- `pnpm test`: kiểm tra hình học bố cục và các quy tắc render thuần.
- `pnpm build`: tạo bản production trong `dist/`.
- `pnpm preview`: xem bản build production.
