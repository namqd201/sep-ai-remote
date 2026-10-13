import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { config } from '../config.js';
import { antigravityAdapter } from '../adapter/AntigravityAdapter.js';
import { taskQueue } from '../queue/TaskQueue.js';
import { hookServer } from '../hook/HookServer.js';
import { Task, TaskStatus } from '@sep-ai/shared';

describe('Sếp AI Remote Windows Bridge Test Suite', () => {
  before(() => {
    config.hookPort = 59199; // Test port for HookServer
    hookServer.start();
  });

  after(() => {
    hookServer.stop();
  });

  test('1. AntigravityAdapter: Phát hiện môi trường thực tế Antigravity', async () => {
    const status = await antigravityAdapter.getConnectionStatus();
    assert.strictEqual(status.isAvailable, true);
    assert.strictEqual(status.hasAgentApi, true);
    assert.strictEqual(status.hasDatabase, true);
    assert.ok(status.activeSessionsCount >= 1);
  });

  test('2. AntigravityAdapter: Đọc danh sách phiên làm việc từ conversation_summaries.db', async () => {
    const sessions = await antigravityAdapter.getAvailableSessions();
    assert.ok(Array.isArray(sessions));
    assert.ok(sessions.length > 0);

    // Phiên hiện tại phải nằm trong danh sách
    const currentSession = sessions.find((s) => s.sessionId.length === 36);
    assert.ok(currentSession, 'Tìm thấy session với UUID hợp lệ');
    assert.ok(currentSession.title);
    assert.ok(currentSession.status === 'RUNNING' || currentSession.status === 'IDLE');
  });

  test('3. AntigravityAdapter: Lấy metadata của session qua agentapi', async () => {
    const sessions = await antigravityAdapter.getAvailableSessions();
    if (sessions.length > 0) {
      const sessionId = sessions[0].sessionId;
      const meta = await antigravityAdapter.getSessionMetadata(sessionId);
      assert.strictEqual(meta.success, true);
      assert.ok(meta.data);
      assert.strictEqual(meta.data.sessionId, sessionId);
      assert.ok(Array.isArray(meta.data.workspaces));
    }
  });

  test('4. TaskQueue: Chống gửi trùng lặp (Deduplication)', () => {
    const dummyTask: Task = {
      id: `task_test_queue_${Date.now()}`,
      title: 'Kiểm tra hàng đợi',
      prompt: 'Prompt kiểm tra',
      status: TaskStatus.RUNNING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByDevice: 'test_dev',
      retryCount: 0
    };

    const firstEnqueue = taskQueue.enqueue(dummyTask);
    assert.strictEqual(firstEnqueue, true);

    const secondEnqueue = taskQueue.enqueue(dummyTask);
    assert.strictEqual(secondEnqueue, false, 'Task gửi trùng phải bị chặn bởi Deduplication');
  });

  test('5. HookServer: Tiếp nhận sự kiện Stop từ Antigravity Hook và kích hoạt callback', async () => {
    let hookReceived = false;

    // Đăng ký nhận sự kiện
    const unsubscribe = antigravityAdapter.subscribeToTaskEvents((event) => {
      if (event.sessionId === 'test-session-hook-uuid') {
        hookReceived = true;
      }
    });

    // Mô phỏng Antigravity Lifecycle Hook gửi POST request
    const payload = JSON.stringify({
      conversationId: 'test-session-hook-uuid',
      terminationReason: 'model_stop',
      fullyIdle: true
    });

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        `http://127.0.0.1:59199/hook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        (res) => {
          assert.strictEqual(res.statusCode, 200);
          resolve();
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    // Chờ 200ms để adapter xử lý async
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(hookReceived, true, 'Hook event phải được dispatch tới subscriber');

    unsubscribe();
  });
});
