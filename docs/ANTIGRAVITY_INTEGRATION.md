# BÁO CÁO KHẢO SÁT & TÍCH HỢP ANTIGRAVITY CHO DỰ ÁN SẾP AI REMOTE

**Thời gian khảo sát:** 2026-10-13  
**Hệ điều hành:** Windows 11 / Windows x64  
**Workspace hiện tại:** `f:\Project\sep-ai-remote`  
**Conversation ID hiện tại:** `44939315-00af-4786-86be-c0e8740762a9`  

---

## 1. Môi trường thực tế đã xác minh

Qua kiểm tra hệ thống thực tế trên máy Windows:
- **Node.js:** `v26.4.0` (Sẵn sàng cho Backend, Windows Bridge và Shared packages)
- **pnpm / npm:** `pnpm v11.1.3`, `npm v12.0.2`
- **Python:** `Python 3.13.9`
- **Java:** `Java 21 LTS` (Java SE Runtime Environment 21.0.12)
- **Flutter / Android SDK:** Chưa có sẵn trên `PATH` toàn cục của máy chủ Windows này. Ứng dụng Flutter sẽ được phát triển đầy đủ theo chuẩn cấu trúc cross-platform (Android & iOS) tại `apps/mobile/`, đi kèm hướng dẫn build, đồng thời cung cấp giao diện Mobile Web PWA chạy trực tiếp trên điện thoại qua mạng LAN để kiểm thử ngay lập tức.
- **Antigravity Host Process:** Đang chạy tại `C:\Users\PC\AppData\Local\Programs\antigravity\Antigravity.exe` (Antigravity 2.0 Desktop Electron).
- **Antigravity Language Server:** Đang chạy tại `C:\Users\PC\AppData\Local\Programs\antigravity\resources\bin\language_server.exe` (PID 33688, cổng nội bộ `127.0.0.1:60905`, `127.0.0.1:60906`).

---

## 2. Kết quả xác minh các khả năng tích hợp Antigravity

### Nhóm A: Tính năng có API chính thức được xác minh (Official Verified Mechanism)

1. **Gửi prompt vào phiên agent đang mở (`sendMessageToSession`):**
   - **Cơ chế xác minh:** Công cụ CLI chính thức `agentapi.bat` đặt tại:  
     `C:\Users\PC\.gemini\antigravity\bin\agentapi.bat`  
     (Ủy quyền trực tiếp vào `language_server.exe agentapi`).
   - **Lệnh thực thi:**
     ```cmd
     "C:\Users\PC\.gemini\antigravity\bin\agentapi.bat" send-message [--title="<Tiêu đề>"] <recipient_conversation_id> "<Nội dung>"
     ```
   - **Khả năng:** Gửi message/prompt trực tiếp vào conversation ID đang mở hoặc gửi cho chính phiên agent để kích hoạt reactive wakeup và tiếp tục xử lý.

2. **Khởi tạo phiên agent mới (`createNewSession`):**
   - **Lệnh thực thi:**
     ```cmd
     "C:\Users\PC\.gemini\antigravity\bin\agentapi.bat" new-conversation [--model=<flash_lite|flash|pro>] [--title="<Tiêu đề>"] "<Prompt>"
     ```
   - **Khả năng:** Cho phép giao việc mới từ điện thoại với việc chỉ định model tier (flash, flash_lite, pro) và title task.

3. **Lấy metadata của phiên agent (`getConversationMetadata`):**
   - **Lệnh thực thi:**
     ```cmd
     "C:\Users\PC\.gemini\antigravity\bin\agentapi.bat" get-conversation-metadata <conversation_id>
     ```
   - **Khả năng:** Trả về JSON chứa `rootConversationId`, `workspaces` (đường dẫn tuyệt đối `workspaceFolderAbsoluteUri`), `projectId`, `createdAt`. Đã kiểm thử thành công trên chính session hiện tại (`44939315-00af-4786-86be-c0e8740762a9`).

4. **Bắt sự kiện vòng đời qua Lifecycle Hooks (`hooks.json`):**
   - **Tài liệu nguồn:** `C:\Users\PC\.gemini\antigravity\builtin\skills\agy-customizations\docs\hooks.md`
   - **Cấu hình:** Đặt tại `.agents/hooks.json` hoặc thư mục customization của Antigravity.
   - **Sự kiện hỗ trợ:**
     - `Stop`: Kích hoạt khi agent kết thúc lượt làm việc (`model_stop`, `max_steps_exceeded`, `error`). Cung cấp `conversationId`, `fullyIdle`, `terminationReason`, `error`, `transcriptPath`, `artifactDirectoryPath`.
     - `PreToolUse` / `PostToolUse`: Bắt sự kiện trước/sau khi thực thi tool (ví dụ `run_command`).
     - `PreInvocation` / `PostInvocation`: Bắt sự kiện trước/sau khi gọi model.
   - **Ứng dụng:** Cấu hình hook `Stop` chạy script gửi thông báo tức thì (Webhook/IPC) đến Windows Agent Bridge khi task hoàn thành.

---

### Nhóm B: Tính năng triển khai bằng Adapter hoặc cơ chế được hỗ trợ (Supported Storage & Observers)

1. **Giám sát trạng thái hoạt động của mọi phiên (`conversation_summaries.db`):**
   - **Vị trí tệp:** `C:\Users\PC\.gemini\antigravity\conversation_summaries.db`
   - **Bảng dữ liệu:** `conversation_summaries`
   - **Các trường quan trọng:**
     - `conversation_id`: ID phiên làm việc.
     - `title`: Tiêu đề phiên làm việc.
     - `status`: Trạng thái thực tế (`CASCADE_RUN_STATUS_RUNNING`, `CASCADE_RUN_STATUS_IDLE`).
     - `not_fully_idle`: `1` khi agent đang suy nghĩ/chạy tool, `0` khi hoàn thành lượt.
     - `last_modified_time`: Dấu thời gian cập nhật gần nhất.
     - `workspace_uris`: Danh sách URI workspace liên quan.
     - `step_count`: Số bước đã thực hiện.
   - **Cơ chế Adapter:** Windows Agent Bridge theo dõi biến động của SQLite DB (sử dụng WAL mode observer hoặc polling chu kỳ 500ms) để phát hiện sự thay đổi trạng thái từ `RUNNING` sang `IDLE` hoặc ngược lại.

2. **Lấy nội dung báo cáo, diff, thinking và kết quả kiểm thử:**
   - **File transcript:** `C:\Users\PC\.gemini\antigravity\brain\<conversation_id>\.system_generated\logs\transcript.jsonl`
     Ghi nhận toàn bộ từng bước (`step_index`, `type`, `status`, `tool_calls`, `content`, `thinking`).
   - **File artifacts:** `C:\Users\PC\.gemini\antigravity\brain\<conversation_id>\`
     Chứa các báo cáo tóm tắt Markdown, kết quả review, diff plan.
   - **Cơ chế Adapter:** Khi task hoàn thành, Bridge đọc các dòng mới nhất của `transcript.jsonl` và các file trong thư mục `brain/` để tạo `TaskReport` gửi về backend.

3. **Cơ chế giữ nguyên ngữ cảnh và lịch sử hội thoại:**
   - Khi người dùng gửi task/tin nhắn từ điện thoại chỉ định đúng `conversation_id`, Adapter sử dụng `agentapi send-message <conversation_id> "<nội dung>"`.
   - Phiên agent tại ID đó sẽ tiếp nhận tin nhắn như một lượt giao tiếp mới, giữ nguyên 100% ngữ cảnh mã nguồn, biến bộ nhớ, workspace và lịch sử trò chuyện.

---

### Nhóm C: Giới hạn nền tảng và các điều chưa thể thực hiện (Platform Limitations)

1. **Không can thiệp DOM nội bộ của Electron:**
   - Antigravity 2.0 là ứng dụng Electron đóng gói (`app.asar`), không mở port CDP (Chrome DevTools Protocol) công khai ra bên ngoài mà không có cấu hình debug riêng.
   - Không hack cookie hay giải mã bộ nhớ tiến trình trái phép. Mọi tương tác tuân thủ giao thức chính thức qua `agentapi.bat`, SQLite Observer và Lifecycle Hooks.

2. **Quyền phê duyệt bảo mật (Approval Gate):**
   - Nếu người dùng cấu hình chính sách yêu cầu xác nhận dòng lệnh nhạy cảm trong Antigravity IDE/App (`CASCADE_COMMANDS_AUTO_EXECUTION_STRICT` hoặc `request-review`), Antigravity sẽ dừng chờ người dùng bấm "Approve" trên máy tính.
   - Adapter phát hiện trạng thái chờ này qua log `permissions` hoặc trạng thái `WAITING_FOR_INPUT` và gửi thông báo cảnh báo "Task đang chờ phê duyệt trên máy tính" tới điện thoại của Sếp. Adapter tuyệt đối không tự ý vượt quyền phê duyệt an toàn.

---

## 3. Kiến trúc tích hợp của Sếp AI Remote

```
   [ Điện thoại của Sếp (Flutter / PWA) ]
                  |
     (HTTPS / WSS / JWT Auth)
                  |
         [ Sếp AI Backend ]  <--- (FCM Push Service)
                  |
     (WSS Secure Device Channel)
                  |
     [ Windows Agent Bridge ]
         |              |
  (Hooks / DB Poll)   (agentapi.bat)
         |              |
    [ Antigravity Desktop Engine & Sessions ]
```

1. **Giao tiếp 2 chiều an toàn:** Windows Bridge chủ động kết nối outbound WSS tới Backend, không cần mở cổng inbound trên router hoặc máy Windows.
2. **Kích hoạt tức thì:** Hỗ trợ cả 2 cơ chế: Hook `.agents/hooks.json` (phản ứng tức thời) kết hợp `conversation_summaries.db` observer (dự phòng độc lập tin cậy).
3. **Phản hồi bằng giọng nói:** Tích hợp Voice AI tiếng Việt (TTS đọc: "Đã xong task, Sếp vào kiểm tra đi ạ." và STT ghi âm lệnh giao việc).
