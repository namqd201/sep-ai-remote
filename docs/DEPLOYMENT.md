# HƯỚNG DẪN ĐẨY DỰ ÁN LÊN GITHUB & DEPLOY LÊN BOTKEEP.CLOUD

Tài liệu này hướng dẫn chi tiết cách đưa **Sếp AI Remote** lên GitHub, deploy Backend lên nền tảng **Botkeep.cloud** để có link HTTPS 24/7 cố định vĩnh viễn cho điện thoại, và kết nối máy tính Windows với Cloud Backend.

---

## 1. MÔ HÌNH HOẠT ĐỘNG (CLOUD BACKEND + LOCAL BRIDGE)

```
[ Điện thoại Sếp ] 
        │ (Truy cập 24/7 qua 1 link cố định: https://your-app.botkeep.cloud)
        ▼
[ Botkeep.cloud Backend ] (Chạy 24/7 trên Cloud)
  - Lưu trữ CSDL Task & Hàng đợi
  - Phục vụ ứng dụng PWA Mobile
  - Xử lý xác thực & WebSockets
        ▲
        │ (Kết nối WSS bảo mật từ xa khi mở máy tính)
[ Windows Agent Bridge ] (Chạy trên máy tính của Sếp)
  - Kết nối với Google Antigravity IDE
  - Tự động lấy task trong danh sách chờ để làm
  - Báo cáo hoàn thành & phát thông báo giọng nói
```

---

## 2. BƯỚC 1: ĐƯA DỰ ÁN LÊN GITHUB

Mở Terminal (PowerShell) tại thư mục dự án `f:\Project\sep-ai-remote` và chạy lần lượt các lệnh sau:

### 1. Khởi tạo Git và Commit
```powershell
# Khởi tạo git repository
git init

# Thêm toàn bộ mã nguồn (đã cấu hình .gitignore loại bỏ dữ liệu nhạy cảm)
git add .

# Tạo commit đầu tiên
git commit -m "feat: Sep AI Remote MVP with Task Queue, Voice Control and Cloud Dockerfile"
```

### 2. Đẩy lên GitHub
1. Vào [GitHub.com](https://github.com) tạo một Repository mới (ví dụ đặt tên: `sep-ai-remote`).
2. Copy đường dẫn repo và chạy lệnh:
```powershell
# Đổi tên nhánh chính thành main
git branch -M main

# Thêm remote origin (thay URL bằng link GitHub của Sếp)
git remote add origin https://github.com/<tai-khoan-github-cua-sep>/sep-ai-remote.git

# Đẩy code lên GitHub
git push -u origin main
```

---

## 3. BƯỚC 2: DEPLOY LÊN BOTKEEP.CLOUD

Nền tảng **Botkeep.cloud** hỗ trợ chạy trực tiếp dự án từ GitHub hoặc qua `Dockerfile` đã được tạo sẵn tại thư mục gốc.

### Các bước thiết lập trên Botkeep.cloud:
1. Đăng nhập vào bảng điều khiển **[Botkeep.cloud](https://botkeep.cloud)**.
2. Chọn **Tạo ứng dụng mới (New Project / Deploy App)**.
3. Chọn nguồn triển khai: **GitHub Repository** -> Chọn repo `sep-ai-remote` vừa tạo.
4. **Cấu hình Build & Run:**
   - **Cách 1 (Khuyên dùng - Dùng Dockerfile):** Chọn phương thức triển khai là `Dockerfile`. Botkeep sẽ tự động đọc file [`Dockerfile`](file:///f:/Project/sep-ai-remote/Dockerfile) có sẵn để build và chạy bản tối ưu nhất.
   - **Cách 2 (Dùng Node.js):** 
     - Build Command: `pnpm install && pnpm run build`
     - Start Command: `node apps/backend/dist/index.js`
5. **Cấu hình Biến môi trường (Environment Variables):**
   Thêm các biến môi trường sau vào phần Settings của Botkeep:
   * `PORT`: `3000` (hoặc cổng mà Botkeep yêu cầu)
   * `NODE_ENV`: `production`
   * `TZ`: `Asia/Ho_Chi_Minh`
   * `PAIRING_CODE`: `888999` (Mã ghép đôi của Sếp)
   * `JWT_SECRET`: `sep_ai_remote_super_secret_jwt_key_2026`
   * `DATABASE_FILE`: `/app/data/sep_ai.db`
6. Bấm **Deploy**.
7. Sau khi build hoàn tất, Botkeep.cloud sẽ cấp cho Sếp một đường link HTTPS chính thức (ví dụ: `https://sep-ai.botkeep.cloud`).

---

## 4. BƯỚC 3: KẾT NỐI MÁY TÍNH WINDOWS VỚI CLOUD BACKEND

Sau khi Backend đã chạy trên Botkeep.cloud:

1. Mở file [`.env`](file:///f:/Project/sep-ai-remote/.env) trên máy tính của Sếp.
2. Cập nhật 2 dòng địa chỉ kết nối trỏ về Botkeep.cloud:
   ```env
   BACKEND_HTTP_URL=https://<ten-mien-cua-sep>.botkeep.cloud
   BACKEND_WS_URL=wss://<ten-mien-cua-sep>.botkeep.cloud/ws
   ```
3. Khởi động Windows Bridge bằng lệnh:
   ```powershell
   pnpm run start:bridge
   ```
   *(Hoặc chạy lệnh `node scripts/start-bridge.js`)*.
4. Windows Bridge sẽ tự động kết nối qua WebSocket bảo mật tới Botkeep.cloud, báo trạng thái Máy tính Online, và sẵn sàng nhận task!

---

## 5. BƯỚC 4: SỬ DỤNG TRÊN ĐIỆN THOẠI (1 LINK CỐ ĐỊNH 24/7)

1. Mở trình duyệt trên điện thoại (Chrome trên Android hoặc Safari trên iPhone).
2. Truy cập link: `https://<ten-mien-cua-sep>.botkeep.cloud`.
3. Nhập mã ghép đôi: `888999`.
4. Bấm **"Cài đặt ngay 📲"** để đưa ứng dụng ra màn hình chính.

### Lợi ích vượt trội khi đưa lên Botkeep.cloud:
* 🌐 **1 Link cố định trọn đời:** Không cần Cloudflare Quick Tunnel, không bị đổi link mỗi khi tắt bật máy.
* ⚡ **Giao việc mọi lúc mọi nơi:** Khi Sếp ra ngoài hoặc máy tính ở nhà đang tắt, Sếp vẫn mở app được 24/7, xem lịch sử và thêm task vào Danh sách chờ.
* 🤖 **Tự động làm việc khi mở máy:** Khi Sếp về nhà bật máy tính lên, Windows Bridge tự động kết nối, lấy task trong danh sách chờ ra làm và báo cáo lại ngay cho Sếp!
