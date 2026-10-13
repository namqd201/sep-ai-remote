#!/usr/bin/env node
/**
 * CLI Quản lý Danh sách chờ (Task Queue) dành cho Antigravity & Terminal
 * Cho phép Antigravity tự động kiểm tra, lấy task tiếp theo và cập nhật hoàn thành.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const BASE_URL = process.env.BACKEND_HTTP_URL || 'http://127.0.0.1:3000';

async function main() {
  const [,, cmd, ...args] = process.argv;

  switch (cmd) {
    case 'list': {
      try {
        const res = await fetch(`${BASE_URL}/api/tasks/queue`);
        const data = await res.json();
        console.log('\n========================================================');
        console.log(`📋 DANH SÁCH CHỜ CỦA SẾP (${data.count || 0} task đang chờ):`);
        console.log('========================================================');
        if (!data.tasks || data.tasks.length === 0) {
          console.log('Hiện tại danh sách chờ đang trống.');
        } else {
          data.tasks.forEach((t, idx) => {
            console.log(`\n[${idx + 1}] ID: ${t.id} | Trạng thái: ${t.status}`);
            console.log(`📌 Tiêu đề: ${t.title}`);
            console.log(`📝 Yêu cầu: ${t.prompt}`);
            console.log(`🕒 Thời gian tạo: ${t.createdAt}`);
            if (t.attachments && t.attachments.length > 0) {
              console.log(`📷 Ảnh đính kèm: ${t.attachments.length} ảnh (${t.attachments.map(a => a.localPath || a.url).join(', ')})`);
            }
          });
        }
        console.log('========================================================\n');
      } catch (err) {
        console.error('Lỗi kết nối tới Backend:', err.message);
      }
      break;
    }

    case 'next': {
      try {
        const res = await fetch(`${BASE_URL}/api/tasks/queue/next`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
          console.log(`\nℹ️ ${data.message || 'Danh sách chờ đang trống.'}\n`);
          process.exit(0);
        }
        console.log('\n========================================================');
        console.log('🚀 ĐÃ LẤY TASK TIẾP THEO ĐỂ THỰC HIỆN:');
        console.log('========================================================');
        console.log(`ID:      ${data.task.id}`);
        console.log(`Tiêu đề: ${data.task.title}`);
        console.log(`Yêu cầu: ${data.task.prompt}`);
        if (data.task.attachments && data.task.attachments.length > 0) {
          console.log(`Ảnh:     ${data.task.attachments.map(a => a.localPath || a.url).join(', ')}`);
        }
        console.log('========================================================\n');
      } catch (err) {
        console.error('Lỗi khi lấy task:', err.message);
      }
      break;
    }

    case 'add': {
      const prompt = args.join(' ');
      if (!prompt) {
        console.error('Vui lòng nhập nội dung task: node scripts/task-queue-cli.js add "..."');
        process.exit(1);
      }
      try {
        const res = await fetch(`${BASE_URL}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            isQueued: true,
            idempotencyKey: 'cli_' + Date.now()
          })
        });
        const data = await res.json();
        console.log(`✅ Đã thêm task vào danh sách chờ thành công: ID ${data.task?.id}`);
      } catch (err) {
        console.error('Lỗi thêm task:', err.message);
      }
      break;
    }

    default:
      console.log(`
Sử dụng:
  node scripts/task-queue-cli.js list      - Xem tất cả task trong danh sách chờ
  node scripts/task-queue-cli.js next      - Lấy và bắt đầu thực hiện task tiếp theo
  node scripts/task-queue-cli.js add "..." - Thêm task mới vào danh sách chờ
      `);
      break;
  }
}

main().catch(console.error);
