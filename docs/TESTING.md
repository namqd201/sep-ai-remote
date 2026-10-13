# HƯỚNG DẪN KIỂM THỬ HỆ THỐNG SẾP AI REMOTE

## 1. Kết quả kiểm thử thực tế đã thực hiện

Hệ thống đã trải qua các bài kiểm thử tự động nghiêm ngặt trên Node.js test runner và môi trường thật của máy tính:

### A. Kiểm thử Backend (`apps/backend/src/tests/backend.test.ts`)
```
✔ 1. Xác thực thiết bị: Ghép đôi sai mã phải bị từ chối
✔ 2. Xác thực thiết bị: Ghép đôi đúng mã phải trả về token JWT hợp lệ
✔ 3. Quản lý hàng đợi khi PC offline: Task mới phải vào QUEUED_OFFLINE
✔ 4. Chống gửi trùng lặp qua Idempotency Key (Deduplication)
✔ 5. Tự động giải phóng hàng đợi khi PC online trở lại
✔ 6. Cập nhật task hoàn thành và thông báo giọng nói AI tiếng Việt
```

### B. Kiểm thử Windows Bridge & Antigravity Adapter (`apps/windows-bridge/src/tests/bridge.test.ts`)
```
✔ 1. AntigravityAdapter: Phát hiện môi trường thực tế Antigravity
✔ 2. AntigravityAdapter: Đọc danh sách phiên làm việc từ conversation_summaries.db
✔ 3. AntigravityAdapter: Lấy metadata của session qua agentapi
✔ 4. TaskQueue: Chống gửi trùng lặp (Deduplication)
✔ 5. HookServer: Tiếp nhận sự kiện Stop từ Antigravity Hook và kích hoạt callback
```

**Xác thực thực nghiệm thành công:** Lệnh `agentapi.bat send-message` đã được gọi thực tế trong bài kiểm thử số 4 và tin nhắn đã được đưa trực tiếp vào phiên agent đang mở trên Windows.

---

## 2. Các lệnh chạy kiểm thử lại

### Chạy toàn bộ test suite của hệ thống:
```cmd
pnpm test
```

### Chạy riêng Backend tests:
```cmd
node --test apps/backend/dist/tests/backend.test.js
```

### Chạy riêng Windows Bridge tests:
```cmd
node --test apps/windows-bridge/dist/tests/bridge.test.js
```

---

## 3. Kịch bản kiểm thử thủ công (Manual E2E Testing)

1. **Kiểm thử Offline Queue:**
   - Tắt tiến trình `start-bridge.js`.
   - Vào giao diện Mobile Web hoặc App, giao 1 task mới: *"Kiểm tra offline queue"*.
   - Quan sát trạng thái: Task nhận badge màu cam `QUEUED_OFFLINE`.
   - Bật lại `start-bridge.js`.
   - Quan sát trạng thái: Task tự động chuyển sang `RUNNING` và được chuyển tới Antigravity.

2. **Kiểm thử Voice AI STT & TTS:**
   - Trên điện thoại/trình duyệt, bấm nút micro 🎙️.
   - Nói: *"Em kiểm tra lại toàn bộ file vừa tạo nhé."*
   - Kiểm tra nội dung nhận diện hiển thị trên ô nhập văn bản.
   - Khi task hoàn thành, kiểm tra loa điện thoại phát âm thanh tiếng Việt:  
     *“Đã xong task, Sếp vào kiểm tra đi ạ.”*
