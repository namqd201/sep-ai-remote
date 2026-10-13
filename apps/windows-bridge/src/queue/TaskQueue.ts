import { Task, TaskStatus, TaskEvent, getVietnamNowIso } from '@sep-ai/shared';
import { antigravityAdapter } from '../adapter/AntigravityAdapter.js';

export class TaskQueue {
  private queue: Task[] = [];
  private isProcessing = false;
  private processedIds: Set<string> = new Set();
  private onTaskEvent?: (event: TaskEvent) => void;

  public setEventCallback(callback: (event: TaskEvent) => void): void {
    this.onTaskEvent = callback;
  }

  public enqueue(task: Task): boolean {
    if (this.processedIds.has(task.id)) {
      console.log(`[TaskQueue] Bỏ qua task ${task.id} (Đã xử lý trước đó - Deduplication)`);
      return false;
    }

    this.processedIds.add(task.id);
    this.queue.push(task);
    console.log(`[TaskQueue] Đã nhận task mới vào hàng đợi: ${task.id} (${task.title})`);

    this.processNext();
    return true;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift()!;

    try {
      console.log(`[TaskQueue] Bắt đầu xử lý task: ${task.id} -> Prompt: "${task.prompt}"`);

      // Xác định session mục tiêu:
      // 1. Nếu task có sessionId cụ thể
      // 2. Nếu không có, tìm session đang mở hoặc tạo session mới
      let targetSessionId = task.sessionId;

      if (!targetSessionId) {
        const sessions = await antigravityAdapter.getAvailableSessions();
        if (sessions.length > 0) {
          targetSessionId = sessions[0].sessionId;
          console.log(`[TaskQueue] Chọn session gần nhất: ${targetSessionId} (${sessions[0].title})`);
        }
      }

      // Chuẩn bị nội dung prompt kèm thông tin ảnh đính kèm từ điện thoại
      let finalPrompt = task.prompt;
      if (task.attachments && task.attachments.length > 0) {
        finalPrompt += '\n\n📷 [ẢNH ĐÍNH KÈM TỪ SẾP QUA ĐIỆN THOẠI]:';
        for (const att of task.attachments) {
          const pathOrUrl = att.localPath
            ? `file:///${att.localPath.replace(/\\/g, '/')}`
            : att.url || att.name;
          finalPrompt += `\n- ${att.name}: ${pathOrUrl}`;
        }
        finalPrompt += '\n(Agent hãy dùng tool view_file để xem các ảnh đính kèm trên và xử lý theo yêu cầu của Sếp!)';
      }

      if (targetSessionId) {
        antigravityAdapter.setActiveTaskForSession(targetSessionId, task.id, task.title);

        // Gửi thông báo bắt đầu
        if (this.onTaskEvent) {
          this.onTaskEvent({
            taskId: task.id,
            sessionId: targetSessionId,
            type: 'status_changed',
            status: TaskStatus.RUNNING,
            timestamp: getVietnamNowIso()
          });
        }

        const result = await antigravityAdapter.sendMessageToSession(
          targetSessionId,
          finalPrompt,
          task.title
        );

        if (!result.success) {
          throw new Error(result.error || 'Gửi message vào session thất bại');
        }

        console.log(`[TaskQueue] Task ${task.id} (kèm ${task.attachments?.length || 0} ảnh) đã được gửi thành công vào session ${targetSessionId}!`);
      } else {
        // Không có session nào -> tạo mới
        console.log(`[TaskQueue] Không có session có sẵn, đang tạo session mới...`);
        const result = await antigravityAdapter.createNewSession(finalPrompt, task.title, 'flash');

        if (!result.success) {
          throw new Error(result.error || 'Khởi tạo session mới thất bại');
        }

        console.log(`[TaskQueue] Đã tạo session mới cho task ${task.id}:`, result.data?.output);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[TaskQueue] Lỗi thực thi task ${task.id}:`, errorMsg);

      if (this.onTaskEvent) {
        this.onTaskEvent({
          taskId: task.id,
          sessionId: task.sessionId || 'unknown',
          type: 'failed',
          status: TaskStatus.FAILED,
          report: {
            summary: `Lỗi: ${errorMsg}`,
            filesModified: [],
            errorDetails: errorMsg,
            voiceNotificationText: `Sếp Nam ơi, task '${task.title}' gặp lỗi rồi ạ: ${errorMsg}`,
            completedAt: getVietnamNowIso()
          },
          timestamp: getVietnamNowIso()
        });
      }
    } finally {
      this.isProcessing = false;
      // Xử lý task tiếp theo nếu còn trong queue
      if (this.queue.length > 0) {
        setTimeout(() => this.processNext(), 500);
      }
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

export const taskQueue = new TaskQueue();
