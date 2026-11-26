# Khoảnh Khắc Photobooth

Photobooth tập trung vào một luồng duy nhất: chọn bố cục, chụp liên tiếp, chỉnh nhẹ và tải ảnh về. Ở chế độ Chỉ ảnh, mọi ảnh chỉ được xử lý trong trình duyệt. Chế độ Ảnh + LiveGallery chụp gấp đôi số ảnh, cho khách chọn ảnh đưa vào photobooth, ghép toàn bộ ảnh đã chụp thành GIF động 0,75 giây mỗi ảnh và chỉ tải album lên khi khách bấm tạo mã QR.

P1 bổ sung zoom và căn khung khi chụp, bộ đếm ngược từ 0 đến 30 giây, flash tự động có fallback màn hình, chọn camera ngoài, thư viện sticker kéo thả và frame PNG/WebP cá nhân.

## Chạy local

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Điền URL và publishable key của dự án Supabase vào `.env.local`. Không dùng secret key, `service_role` hoặc thông tin R2 trong frontend hay các biến `VITE_*`.

LiveGallery dùng các biến công khai sau:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_GALLERY_PUBLISH_URL=https://<project-ref>.supabase.co/functions/v1/album-publish
```

## Tải album song song trực tiếp lên Cloudflare R2

Khi khách bấm Tạo mã QR LiveGallery, `src/galleryPublish.ts` giữ nguyên chất lượng ảnh gốc (JPEG 0.97, ảnh ghép 0.97, GIF 720×540) và tải tệp song song trực tiếp lên R2:

1. Gửi `POST` JSON tới `album-publish` với `action: "init"` và danh sách tệp theo thứ tự `strip` (`photobooth.jpg`), `gif` (`khoanh-khac.gif`), tiếp theo là từng ảnh gốc (`anh-01.jpg`, ...).
2. Khi máy chủ trả về `mode: "r2-direct"` cùng các presigned PUT URL, trình duyệt tải song song tối đa 5 tệp cùng lúc trực tiếp lên `*.r2.cloudflarestorage.com`. Mỗi tệp tự thử lại 1 lần nếu gặp lỗi mạng hoặc mã `5xx`. Nếu vẫn lỗi, trình duyệt chờ các lượt PUT đang chạy kết thúc rồi gửi `action: "abort"` để xóa bản nháp và tệp R2 tải dở.
3. Sau khi toàn bộ tệp tải xong, trình duyệt gửi `action: "complete"` kèm `albumId`, `uploadToken` và danh sách `storagePath` để máy chủ xác minh và phát hành album.
4. Nếu máy chủ trả về `{ mode: "multipart" }` (khi chưa bật R2) hoặc máy chủ cũ trả mã `400`/`415` cho yêu cầu JSON `init`, trình duyệt tự chuyển sang luồng `multipart/form-data`.
5. Mọi `putUrl` và `share.url` trả về đều phải dùng `https:` (hoặc `http://localhost` / `http://127.0.0.1` khi chạy trên máy) và không chứa thông tin đăng nhập nhúng. Hộp thoại mã QR tự hiển thị đúng tên miền lấy từ `share.url`.

## Triển khai Vercel và cấu hình `vercel.json`

Tệp `vercel.json` cấu hình chuyển hướng SPA về `/index.html` (giữ nguyên `/assets/`, `/_vercel/`, `/favicon.svg`, `/robots.txt`), đặt bộ đệm 1 năm cho `/assets/*` và gắn các header bảo mật cho mọi đường dẫn:

- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `DENY`
- `Referrer-Policy`: `strict-origin-when-cross-origin`
- `Permissions-Policy`: `camera=(self), microphone=(), geolocation=()` (cho phép dùng camera trên chính tên miền, chặn micro và định vị)
- `Content-Security-Policy`:
  - `script-src`: chỉ cho phép `'self'`, Vercel Web Analytics (`https://va.vercel-scripts.com`) và đúng mã băm SHA-256 của đoạn inline `<script>` chống nháy giao diện trong `index.html`. Nếu sửa đoạn script này trong `index.html`, cần cập nhật lại mã băm SHA-256 tương ứng trong `vercel.json` (bài test trong `src/galleryPublish.test.ts` sẽ tự động kiểm tra khớp mã băm).
  - `connect-src`: cho phép `'self'`, Supabase (`https://*.supabase.co`), Cloudflare R2 (`https://*.r2.cloudflarestorage.com`), Vercel Analytics (`https://vitals.vercel-insights.com`, `https://va.vercel-scripts.com`), `blob:` và `data:`.
  - `img-src`, `media-src`, `style-src` và `font-src`: bao phủ Google Fonts, ảnh từ Supabase và R2, luồng camera `blob:` và bản chụp `data:`.

## Supabase

Các migration trong `supabase/migrations` tạo:

- Bảng `public.photobooth_frames` có RLS và bucket công khai `photobooth-frames` cho PNG/SVG/WebP tối đa 5 MB.
- Bảng `public.photobooth_stickers` có RLS và bucket công khai `photobooth-stickers` cho tài nguyên tối đa 1 MB.
- Quyền đọc frame đã phát hành cho khách; quyền ghi chỉ dành cho tài khoản có `app_metadata.role = admin`.
- Sáu frame màu mặc định.
- Edge Function `album-publish` thuộc dự án LiveGallery nhận bộ ảnh từ tên miền production, lưu vào Cloudflare R2 (hoặc bucket riêng tư Supabase khi chưa bật R2) và trả về mã cùng đường dẫn LiveGallery trên Vercel.

Nếu chưa cấu hình Supabase, ứng dụng dùng sẵn sáu preset tích hợp để việc phát triển trên máy không bị chặn.

## Scripts

- `pnpm dev`: chạy máy chủ phát triển.
- `pnpm typecheck`: kiểm tra kiểu TypeScript.
- `pnpm test`: chạy bộ kiểm thử hình học bố cục, render thuần, luồng tải album LiveGallery/R2 và kiểm tra cấu hình `vercel.json`.
- `pnpm build`: tạo bản production trong `dist/`.
- `pnpm preview`: xem trước bản build production.
