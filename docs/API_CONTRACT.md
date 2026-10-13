# TÀI LIỆU API CONTRACT & WEBSOCKET PROTOCOL

## 1. REST API Endpoints

### A. Xác thực và Thiết bị (Authentication & Pairing)

#### 1. Đăng ký / Ghép đôi thiết bị (Pairing)
- **Endpoint:** `POST /api/auth/pair`
- **Request Body:**
  ```json
  {
    "deviceType": "mobile", // "mobile" | "windows_bridge"
    "deviceName": "iPhone 15 Pro của Sếp",
    "pairingCode": "123456" // Mã 6 số sinh ra từ Backend hoặc màn hình cài đặt
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "jwt_access_token_here",
    "deviceId": "dev_01j7xyz...",
    "role": "boss" // "boss" | "bridge"
  }
  ```

#### 2. Kiểm tra phiên đăng nhập (Session Check)
- **Endpoint:** `GET /api/auth/me`
- **Header:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "authenticated": true,
    "deviceId": "dev_01j7xyz...",
    "deviceName": "iPhone của Sếp",
    "pcOnline": true,
    "activeSessionId": "44939315-00af-4786-86be-c0e8740762a9"
  }
  ```

---

### B. Trạng thái PC & Danh sách phiên (PC & Sessions)

#### 1. Lấy trạng thái PC hiện tại
- **Endpoint:** `GET /api/pc/status`
- **Header:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "isOnline": true,
    "lastSeenAt": "2026-10-13T16:25:00.000Z",
    "hostname": "DESKTOP-PC",
    "activeSessionsCount": 1,
    "pendingTasksCount": 0,
    "agentRunning": true
  }
  ```

#### 2. Lấy danh sách các phiên làm việc Antigravity
- **Endpoint:** `GET /api/pc/sessions`
- **Header:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "sessions": [
      {
        "sessionId": "44939315-00af-4786-86be-c0e8740762a9",
        "title": "Sếp AI Remote Architecture Design",
        "workspacePath": "F:/Project/sep-ai-remote",
        "status": "RUNNING", // "RUNNING" | "IDLE" | "ERROR"
        "isNotFullyIdle": true,
        "lastModified": "2026-10-13T16:22:15.000Z",
        "stepCount": 14
      }
    ]
  }
  ```

---

### C. Quản lý Task (Tasks Management)

#### 1. Lấy danh sách task
- **Endpoint:** `GET /api/tasks?status=all&limit=20`
- **Response (200 OK):**
  ```json
  {
    "tasks": [
      {
        "id": "tsk_01j8abc...",
        "title": "Kiểm tra test đăng nhập Google",
        "prompt": "Em sửa tiếp lỗi đăng nhập Google trong project NQD-LMS, chạy test rồi báo cáo anh.",
        "sessionId": "44939315-00af-4786-86be-c0e8740762a9",
        "status": "COMPLETED", // "QUEUED_OFFLINE" | "DISPATCHED" | "RUNNING" | "COMPLETED" | "FAILED" | "WAITING_APPROVAL"
        "createdAt": "2026-10-13T16:20:00.000Z",
        "completedAt": "2026-10-13T16:24:30.000Z",
        "summary": "Đã chạy 12 test suites, pass toàn bộ 48 unit tests."
      }
    ]
  }
  ```

#### 2. Tạo task mới (Hỗ trợ gửi bằng giọng nói / văn bản)
- **Endpoint:** `POST /api/tasks`
- **Request Body:**
  ```json
  {
    "idempotencyKey": "uuid-v4-client-generated",
    "prompt": "Em kiểm tra lại build và chạy test",
    "sessionId": "44939315-00af-4786-86be-c0e8740762a9", // Phiên chỉ định hoặc để trống để tạo mới
    "createNewSession": false,
    "modelTier": "flash", // "flash" | "pro" | "flash_lite"
    "title": "Kiểm tra build & test"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "task": {
      "id": "tsk_01j8...",
      "status": "RUNNING", // hoặc "QUEUED_OFFLINE" nếu PC đang offline
      "message": "Task đã được chuyển tới agent Antigravity trên PC."
    }
  }
  ```

#### 3. Lấy chi tiết task & báo cáo
- **Endpoint:** `GET /api/tasks/:id`
- **Response (200 OK):**
  ```json
  {
    "task": {
      "id": "tsk_01j8...",
      "status": "COMPLETED",
      "report": {
        "summary": "Đã hoàn thành phân tích kiến trúc và tạo tài liệu.",
        "filesModified": [
          "docs/ANTIGRAVITY_INTEGRATION.md",
          "docs/ARCHITECTURE.md"
        ],
        "testResults": "PASS: 12 tests passed, 0 failed.",
        "voiceNotificationText": "Đã xong task, Sếp vào kiểm tra đi ạ."
      }
    }
  }
  ```

---

## 2. WebSocket Protocol (Realtime Gateway)

Kết nối qua: `ws://<server_host>:<port>/ws` hoặc `wss://...`

### A. Định dạng tin nhắn chuẩn
```json
{
  "event": "event_name",
  "payload": {},
  "timestamp": 1728836540000
}
```

### B. Luồng bắt tay (Handshake)
1. Client gửi: `{"event": "authenticate", "payload": {"token": "jwt_token"}}`
2. Server phản hồi: `{"event": "authenticated", "payload": {"success": true, "pcOnline": true}}`

### C. Sự kiện hệ thống
- `pc_status_changed`: Báo khi PC chuyển sang `online` hoặc `offline`.
- `task_status_changed`: Cập nhật trạng thái task (`RUNNING`, `COMPLETED`, `WAITING_APPROVAL`, `FAILED`).
- `task_completed`: Sự kiện đặc biệt mang theo câu thoại TTS tiếng Việt:
  ```json
  {
    "event": "task_completed",
    "payload": {
      "taskId": "tsk_01j8...",
      "taskTitle": "Kiểm tra build",
      "ttsVoiceText": "Đã xong task, Sếp vào kiểm tra đi ạ.",
      "summary": "Đã hoàn thành các bước kiểm tra."
    }
  }
  ```
- `chat_message`: Tin nhắn trò chuyện giữa Sếp và Agent.
