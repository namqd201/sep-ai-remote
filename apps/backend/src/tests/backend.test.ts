import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { app } from '../app.js';
import { config } from '../config.js';
import { db } from '../db/database.js';
import { authService } from '../services/authService.js';
import { taskService } from '../services/taskService.js';
import { wsGateway } from '../services/wsGateway.js';
import { DeviceType, TaskStatus, UserRole } from '@sep-ai/shared';

describe('Sếp AI Remote Backend Test Suite', () => {
  let server: http.Server;
  let testPort = 3199;

  before(async () => {
    config.port = testPort;
    server = http.createServer(app);
    wsGateway.init(server);
    await new Promise<void>((resolve) => server.listen(testPort, resolve));
  });

  after(() => {
    server.close();
  });

  test('1. Xác thực thiết bị: Ghép đôi sai mã phải bị từ chối', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairingCode: 'SAI_MA_123',
        deviceName: 'Thiết bị lạ',
        deviceType: DeviceType.MOBILE
      })
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  test('2. Xác thực thiết bị: Ghép đôi đúng mã phải trả về token JWT hợp lệ', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairingCode: config.pairingCode,
        deviceName: 'iPhone Test Sếp',
        deviceType: DeviceType.MOBILE
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.token);
    assert.strictEqual(data.role, UserRole.BOSS);

    const verified = authService.verify(data.token);
    assert.ok(verified);
    assert.strictEqual(verified.deviceName, 'iPhone Test Sếp');
  });

  test('3. Quản lý hàng đợi khi PC offline: Task mới phải vào QUEUED_OFFLINE', async () => {
    taskService.setPcOnlineState(false);

    const { task } = taskService.createTask(
      {
        prompt: 'Em build và test project NQD-LMS khi máy tính mở lại nhé',
        title: 'Task chờ offline'
      },
      'dev_test_boss'
    );

    assert.ok(task.id);
    assert.strictEqual(task.status, TaskStatus.QUEUED_OFFLINE);

    const saved = db.getTask(task.id);
    assert.ok(saved);
    assert.strictEqual(saved.status, TaskStatus.QUEUED_OFFLINE);
  });

  test('4. Chống gửi trùng lặp qua Idempotency Key (Deduplication)', async () => {
    const key = `test_key_${Date.now()}`;

    const res1 = taskService.createTask(
      {
        prompt: 'Task gốc',
        idempotencyKey: key
      },
      'dev_test_boss'
    );
    assert.strictEqual(res1.isDuplicate, false);

    // Gửi lại cùng key
    const res2 = taskService.createTask(
      {
        prompt: 'Task gửi trùng',
        idempotencyKey: key
      },
      'dev_test_boss'
    );
    assert.strictEqual(res2.isDuplicate, true);
    assert.strictEqual(res2.task.id, res1.task.id);
  });

  test('5. Tự động giải phóng hàng đợi khi PC online trở lại', async () => {
    let dispatchedTaskIds: string[] = [];
    taskService.setBridgeDispatcher((t) => {
      dispatchedTaskIds.push(t.id);
      return true;
    });

    // Tạo thêm 1 task offline
    const { task } = taskService.createTask(
      { prompt: 'Task sẽ được dispatch khi PC online' },
      'dev_test_boss'
    );
    assert.strictEqual(task.status, TaskStatus.QUEUED_OFFLINE);

    // Bật trạng thái PC Online
    taskService.setPcOnlineState(true);

    assert.ok(dispatchedTaskIds.includes(task.id));
    const reloaded = db.getTask(task.id);
    assert.strictEqual(reloaded?.status, TaskStatus.RUNNING);
  });

  test('6. Cập nhật task hoàn thành và thông báo giọng nói AI tiếng Việt chuẩn Sếp Nam', async () => {
    const { task } = taskService.createTask(
      { prompt: 'Task kiểm tra completion report', title: 'Sửa giao diện Header' },
      'dev_test_boss'
    );

    const updated = taskService.updateTaskFromBridge(
      task.id,
      TaskStatus.COMPLETED,
      {
        summary: 'Đã hoàn thành phân tích và viết code.',
        filesModified: ['src/App.tsx'],
        testResults: 'PASS (12 tests)',
        voiceNotificationText: '',
        completedAt: new Date().toISOString()
      }
    );

    assert.ok(updated);
    assert.strictEqual(updated.status, TaskStatus.COMPLETED);
    assert.strictEqual(
      updated.report?.voiceNotificationText,
      "Sếp Nam ơi, em đã làm xong task 'Sửa giao diện Header' mà sếp giao rồi. Sếp còn việc gì cần em làm nữa không ạ. Sếp vào kiểm tra task kia nhé."
    );
  });

  test('7. Ánh xạ tự động từ session sang Task đang RUNNING khi Bridge chỉ gửi sessionId (Fix Bug Task stuck in RUNNING)', async () => {
    const testSessionId = 'session-running-fix-123';
    const { task } = taskService.createTask(
      {
        prompt: 'Viết test kiểm tra fix task stuck in running',
        title: 'Task kiểm tra tự động map session',
        sessionId: testSessionId
      },
      'dev_test_boss'
    );

    // Chuyển task sang RUNNING
    taskService.updateTaskFromBridge(task.id, TaskStatus.RUNNING, undefined, testSessionId);
    assert.strictEqual(db.getTask(task.id)?.status, TaskStatus.RUNNING);

    // Giả lập Bridge/Hook gửi TASK_EVENT chỉ có sessionId (taskId = undefined)
    const activeTask = taskService.getActiveTaskForSession(testSessionId);
    assert.ok(activeTask);
    assert.strictEqual(activeTask.id, task.id);

    // Cập nhật hoàn thành thông qua activeTask.id
    const completedTask = taskService.updateTaskFromBridge(
      activeTask.id,
      TaskStatus.COMPLETED,
      undefined,
      testSessionId
    );
    assert.ok(completedTask);
    assert.strictEqual(completedTask.status, TaskStatus.COMPLETED);
    assert.ok(completedTask.report?.voiceNotificationText.includes("Sếp Nam ơi"));
  });

  test('8. Định dạng thời gian theo múi giờ Việt Nam (UTC+7 / GMT+7)', async () => {
    const { task } = taskService.createTask(
      { prompt: 'Kiểm tra múi giờ Việt Nam', title: 'Task múi giờ' },
      'dev_test_boss'
    );

    assert.ok(task.createdAt.includes('+07:00'));
    const reloaded = db.getTask(task.id);
    assert.ok(reloaded?.createdAt.includes('+07:00'));
  });

  test('9. Danh sách chờ (Task Queue): Thêm task vào hàng đợi chờ Antigravity làm', async () => {
    const { task } = taskService.createTask(
      {
        prompt: 'Thực hiện tối ưu hóa tốc độ database khi rảnh',
        title: 'Task chờ làm sau',
        isQueued: true
      },
      'dev_test_boss'
    );

    assert.strictEqual(task.status, TaskStatus.PENDING);
    assert.strictEqual(task.isQueued, true);

    const queueList = taskService.getWaitingQueueTasks();
    assert.ok(queueList.some(t => t.id === task.id));

    // Test API GET /api/tasks/queue
    const res = await fetch(`http://127.0.0.1:${testPort}/api/tasks/queue`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.ok(data.count >= 1);
  });

  test('10. Danh sách chờ (Task Queue): Kích hoạt lấy và làm task tiếp theo qua API', async () => {
    taskService.setPcOnlineState(true);
    let lastDispatched: string | null = null;
    taskService.setBridgeDispatcher((t) => {
      lastDispatched = t.id;
      return true;
    });

    const res = await fetch(`http://127.0.0.1:${testPort}/api/tasks/queue/next`, {
      method: 'POST'
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.task);
    assert.strictEqual(data.task.status, TaskStatus.RUNNING);
    assert.strictEqual(lastDispatched, data.task.id);
  });
});
