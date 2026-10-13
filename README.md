# SẾP AI REMOTE — MOBILE VOICE CONTROL FOR ANTIGRAVITY

> **Sếp AI Remote** là giải pháp điều khiển và giám sát AI Coding Agent Antigravity trên máy tính Windows từ thiết bị di động (Android / iOS / Mobile Web), tích hợp giọng nói tiếng Việt hai chiều (STT giao việc & TTS thông báo hoàn thành).

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **Thông báo giọng nói AI tiếng Việt khi xong task:**  
   Khi Antigravity hoàn thành công việc, điện thoại lập tức nhận push notification và phát giọng đọc tiếng Việt chuẩn:  
   *“Đã xong task, Sếp vào kiểm tra đi ạ.”*

2. **Giao task bằng giọng nói (Voice STT):**  
   Bấm nút micro trên điện thoại và nói lệnh tiếng Việt (ví dụ: *“Em sửa tiếp lỗi đăng nhập Google trong project NQD-LMS, chạy test rồi báo cáo anh.”*). Xem trước và sửa văn bản trước khi gửi.

3. **Giao tiếp trực tiếp với phiên Agent hiện tại:**  
   Không tạo một AI coding agent độc lập mới; tin nhắn được gửi trực tiếp vào phiên Antigravity đang mở, giữ nguyên 100% ngữ cảnh, workspace, memory và lịch sử chat.

4. **Báo cáo task, diffs và kết quả kiểm thử:**  
   Xem chi tiết các file đã sửa, log tóm tắt, test results và mã lỗi nếu có.

5. **Hàng đợi thông minh khi PC Offline:**  
   Khi máy tính tắt hoặc mất mạng, điện thoại hiển thị trạng thái ngắt kết nối rõ ràng và lưu task vào hàng đợi offline (`QUEUED_OFFLINE`). Ngay khi máy tính bật lại, task tự động được chuyển tiếp xử lý.

6. **Bảo mật & Không mở cổng Inbound:**  
   Windows Bridge chủ động kết nối outbound WSS tới Backend, sử dụng JWT xác thực thiết bị và mã pairing an toàn, không mở port-forwarding trên router.

---

## 🏗️ CẤU TRÚC DỰ ÁN

```
sep-ai-remote/
├── apps/
│   ├── backend/            # REST API & WebSocket Gateway (Node.js + TS)
│   │   ├── public/         # Giao diện Mobile Web PWA (Zero Install)
│   │   └── src/            # Auth, TaskService, NotificationService, WsGateway
│   ├── windows-bridge/     # Windows Service kết nối Antigravity (Node.js + TS)
│   │   └── src/            # AntigravityAdapter, TaskQueue, HookServer, AgentBridge
│   └── mobile/             # Ứng dụng di động Flutter (Android & iOS)
│       ├── lib/            # Dashboard, Tasks, Chat, Settings, STT & TTS Services
│       └── android/        # Cấu hình quyền và manifest Android
├── packages/
│   └── shared/             # Shared Types, DTOs, Enums, Constants (@sep-ai/shared)
├── docs/
│   ├── ANTIGRAVITY_INTEGRATION.md  # Khảo sát & Phân tích cơ chế tích hợp
│   ├── ARCHITECTURE.md            # Kiến trúc hệ thống chi tiết
│   ├── API_CONTRACT.md            # Đặc tả REST API & WebSocket Protocol
│   ├── DEPLOYMENT.md              # Hướng dẫn triển khai & vận hành
│   └── TESTING.md                 # Kết quả & kịch bản kiểm thử
├── scripts/
│   ├── start-all.js        # Khởi chạy đồng thời Backend và Windows Bridge
│   ├── start-backend.js    # Khởi chạy riêng Backend
│   ├── start-bridge.js     # Khởi chạy riêng Windows Bridge
│   └── hook-notifier.js    # Script cho Lifecycle Hook của Antigravity
├── .agents/
│   └── hooks.json          # Cấu hình Stop Hook cho Antigravity
├── .env.example            # Mẫu biến môi trường
└── package.json            # Cấu hình monorepo (pnpm)
```

---

## 🚀 HƯỚNG DẪN KHỞI CHẠY NHANH

### 1. Cài đặt dependencies và build
```cmd
pnpm install
pnpm build
```

### 2. Khởi chạy hệ thống
```cmd
node scripts/start-all.js
```
- **Backend API & WebSocket:** Chạy tại `http://localhost:3000` và `ws://localhost:3000/ws`.
- **Giao diện Mobile Web:** Mở `http://localhost:3000` trên trình duyệt máy tính hoặc điện thoại trong cùng mạng Wi-Fi LAN (`http://<IP_MÁY_TÍNH>:3000`).
- **Mã ghép đôi mặc định:** `888999`.

### 3. Chạy kiểm thử tự động
```cmd
# Kiểm thử Backend
node --test apps/backend/dist/tests/backend.test.js

# Kiểm thử Windows Bridge
node --test apps/windows-bridge/dist/tests/bridge.test.js
```

---

## 🔍 CƠ CHẾ TÍCH HỢP ANTIGRAVITY ĐÃ XÁC MINH

- **Gửi prompt vào phiên agent đang mở:** Thông qua công cụ chính thức `agentapi.bat send-message <session_id> "<nội dung>"`.
- **Khởi tạo phiên mới:** `agentapi.bat new-conversation [--model] [--title] "<prompt>"`.
- **Lấy metadata:** `agentapi.bat get-conversation-metadata <session_id>`.
- **Bắt sự kiện hoàn thành:** Kết hợp Antigravity Lifecycle Hook `Stop` (`.agents/hooks.json`) và bộ theo dõi thời gian thực `conversation_summaries.db`.
- **Trích xuất báo cáo & kết quả kiểm thử:** Đọc tệp log `transcript.jsonl` và thư mục `artifacts/` trong `brain/<session_id>/`.
