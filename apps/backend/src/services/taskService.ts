import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { notificationService } from './notificationService.js';
import { telegramService } from './telegramService.js';
import {
  Task,
  TaskStatus,
  CreateTaskDto,
  TaskReport,
  DEFAULT_TTS_COMPLETION_PHRASE,
  getVietnamNowIso,
  getTaskCompletionVoiceText,
  getTaskFailureVoiceText,
  getTaskApprovalVoiceText
} from '@sep-ai/shared';

export class TaskService {
  private isPcOnline = false;
  private bridgeDispatcher?: (task: Task) => boolean;
  private wsBroadcaster?: (event: string, payload: unknown) => void;

  public setBridgeDispatcher(dispatcher: (task: Task) => boolean): void {
    this.bridgeDispatcher = dispatcher;
  }

  public setWsBroadcaster(broadcaster: (event: string, payload: unknown) => void): void {
    this.wsBroadcaster = broadcaster;
  }

  public setPcOnlineState(online: boolean): void {
    const prevState = this.isPcOnline;
    this.isPcOnline = online;

    if (!prevState && online) {
      // Khi PC kết nối lại, tự động giải phóng hàng đợi offline
      this.flushOfflineQueue();
    }
  }

  public getPcOnlineState(): boolean {
    return this.isPcOnline;
  }

  public createTask(dto: CreateTaskDto, createdByDevice: string): { task: Task; isDuplicate: boolean } {
    // 1. Kiểm tra Idempotency Key để chống gửi trùng lặp
    if (dto.idempotencyKey) {
      const existing = db.findTaskByIdempotency(dto.idempotencyKey);
      if (existing) {
        return { task: existing, isDuplicate: true };
      }
    }

    const taskId = `tsk_${uuidv4().substring(0, 8)}`;
    const now = getVietnamNowIso();

    const taskTitle = dto.title || (dto.prompt.length > 40 ? `${dto.prompt.substring(0, 40)}...` : dto.prompt);

    // Xử lý lưu ảnh đính kèm (nếu có)
    const processedAttachments = dto.attachments ? [...dto.attachments] : undefined;
    if (processedAttachments && processedAttachments.length > 0) {
      const uploadDir = path.resolve(process.cwd(), 'apps/backend/public/uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      for (const att of processedAttachments) {
        if (att.data) {
          try {
            const cleanExt = (att.mimeType || 'image/png').split('/')[1] || 'png';
            const fileName = `media_${Date.now()}_${uuidv4().substring(0, 8)}.${cleanExt}`;
            const filePath = path.join(uploadDir, fileName);

            const base64Data = att.data.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

            att.url = `/uploads/${fileName}`;
            att.localPath = filePath;

            // Đồng thời lưu vào thư mục .user_uploaded của Antigravity Brain để agent xem trực tiếp
            const targetSession = dto.sessionId || '44939315-00af-4786-86be-c0e8740762a9';
            const brainDir = path.join(
              process.env.USERPROFILE || 'C:\\Users\\PC',
              '.gemini', 'antigravity', 'brain', targetSession, '.user_uploaded'
            );
            if (!fs.existsSync(brainDir)) {
              fs.mkdirSync(brainDir, { recursive: true });
            }
            const destPath = path.join(brainDir, fileName);
            fs.copyFileSync(filePath, destPath);
            att.localPath = destPath;
            console.log(`[TaskService] Đã lưu ảnh đính kèm vào Antigravity: ${destPath}`);

            // Xóa dữ liệu base64 để tối ưu bộ nhớ db
            delete att.data;
          } catch (err) {
            console.error('[TaskService] Lỗi lưu ảnh đính kèm:', err);
          }
        }
      }
    }

    const initialStatus = dto.isQueued
      ? TaskStatus.PENDING
      : (this.isPcOnline ? TaskStatus.DISPATCHED : TaskStatus.QUEUED_OFFLINE);

    const task: Task = {
      id: taskId,
      idempotencyKey: dto.idempotencyKey,
      title: taskTitle,
      prompt: dto.prompt,
      sessionId: dto.sessionId,
      workspacePath: dto.workspacePath,
      status: initialStatus,
      createdAt: now,
      updatedAt: now,
      dispatchedAt: (!dto.isQueued && this.isPcOnline) ? now : undefined,
      createdByDevice,
      retryCount: 0,
      attachments: processedAttachments,
      isQueued: Boolean(dto.isQueued)
    };

    db.saveTask(task);

    // 2. Chuyển task tới Windows Bridge nếu PC online VÀ KHÔNG PHẢI task trong danh sách chờ
    if (!dto.isQueued && this.isPcOnline && this.bridgeDispatcher) {
      const dispatched = this.bridgeDispatcher(task);
      if (dispatched) {
        task.status = TaskStatus.RUNNING;
        task.updatedAt = getVietnamNowIso();
        db.saveTask(task);
      }
    }

    if (this.wsBroadcaster) {
      this.wsBroadcaster('task_updated', task);
    }

    return { task, isDuplicate: false };
  }

  public getActiveTaskForSession(sessionId?: string): Task | null {
    return db.getActiveTaskBySession(sessionId);
  }

  public updateTaskFromBridge(
    taskId: string,
    status: TaskStatus,
    report?: TaskReport,
    sessionId?: string
  ): Task | null {
    const task = db.getTask(taskId);
    if (!task) return null;

    const now = getVietnamNowIso();
    task.status = status;
    task.updatedAt = now;
    if (sessionId) task.sessionId = sessionId;

    if (report) {
      task.report = report;
    }

    if (status === TaskStatus.COMPLETED) {
      task.completedAt = now;
      const voiceText = getTaskCompletionVoiceText(task.title);

      if (!task.report) {
        task.report = {
          summary: 'Task đã hoàn thành thành công.',
          filesModified: [],
          voiceNotificationText: voiceText,
          completedAt: now
        };
      } else {
        task.report.voiceNotificationText = voiceText;
        if (!task.report.completedAt) {
          task.report.completedAt = now;
        }
      }
      notificationService.notifyTaskCompleted(task.title, task.id, task.report?.summary);

      // Gửi tin nhắn thoại tự động qua Telegram (nếu đã cấu hình)
      telegramService.sendVoiceNotification(voiceText, task.title).catch((err) => {
        console.warn('[TaskService] Gửi voice Telegram thất bại:', err);
      });

      if (this.wsBroadcaster) {
        this.wsBroadcaster('task_completed', {
          taskId: task.id,
          sessionId: task.sessionId,
          title: task.title,
          summary: task.report.summary,
          ttsVoiceText: voiceText,
          report: task.report
        });
      }
    } else if (status === TaskStatus.FAILED) {
      task.completedAt = now;
      const voiceText = getTaskFailureVoiceText(task.title, task.report?.errorDetails);

      if (!task.report) {
        task.report = {
          summary: 'Task thực thi thất bại.',
          filesModified: [],
          errorDetails: 'Lỗi trong quá trình xử lý',
          voiceNotificationText: voiceText,
          completedAt: now
        };
      } else {
        task.report.voiceNotificationText = voiceText;
        if (!task.report.completedAt) {
          task.report.completedAt = now;
        }
      }

      notificationService.notifyTaskFailed(task.title, task.id, task.report?.errorDetails);

      // Gửi tin nhắn thoại tự động qua Telegram khi task lỗi (nếu đã cấu hình)
      telegramService.sendVoiceNotification(voiceText, task.title).catch((err) => {
        console.warn('[TaskService] Gửi voice Telegram thất bại:', err);
      });

      if (this.wsBroadcaster) {
        this.wsBroadcaster('task_failed', {
          taskId: task.id,
          sessionId: task.sessionId,
          title: task.title,
          error: task.report?.errorDetails || 'Task execution failed',
          ttsVoiceText: voiceText,
          report: task.report
        });
      }
    } else if (status === TaskStatus.WAITING_APPROVAL) {
      const voiceText = getTaskApprovalVoiceText(task.title);
      notificationService.notifyApprovalRequired(task.title, task.id, task.report?.summary);

      if (this.wsBroadcaster) {
        this.wsBroadcaster('approval_required', {
          taskId: task.id,
          sessionId: task.sessionId,
          title: task.title,
          reason: task.report?.summary || 'Cần xác nhận trên máy tính',
          ttsVoiceText: voiceText
        });
      }
    }

    db.saveTask(task);

    if (this.wsBroadcaster) {
      this.wsBroadcaster('task_updated', task);
    }

    return task;
  }

  public updateLiveSteps(
    taskId?: string,
    sessionId?: string,
    liveSteps?: import('@sep-ai/shared').TaskLiveStep[],
    currentActionText?: string
  ): Task | null {
    let task: Task | null = null;
    if (taskId) {
      task = db.getTask(taskId);
    }
    if (!task && sessionId) {
      task = this.getActiveTaskForSession(sessionId);
    }

    if (task) {
      task.liveSteps = liveSteps || [];
      task.currentActionText = currentActionText || '';
      task.updatedAt = getVietnamNowIso();
      db.saveTask(task);
    }

    return task;
  }

  public flushOfflineQueue(): void {
    if (!this.isPcOnline || !this.bridgeDispatcher) return;

    const queuedTasks = db.getPendingOfflineTasks();
    const now = getVietnamNowIso();
    for (const task of queuedTasks) {
      const dispatched = this.bridgeDispatcher(task);
      if (dispatched) {
        task.status = TaskStatus.RUNNING;
        task.dispatchedAt = now;
        task.updatedAt = now;
        db.saveTask(task);

        if (this.wsBroadcaster) {
          this.wsBroadcaster('task_updated', task);
        }
      }
    }
  }

  public listTasks(status?: TaskStatus, limit = 50): Task[] {
    return db.listTasks(status, limit);
  }

  public getTask(id: string): Task | null {
    return db.getTask(id);
  }

  public getWaitingQueueTasks(): Task[] {
    return db.getWaitingQueueTasks();
  }

  public executeQueuedTask(taskId: string): { success: boolean; task?: Task; message?: string } {
    const task = db.getTask(taskId);
    if (!task) {
      return { success: false, message: 'Task không tồn tại' };
    }
    if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.QUEUED_OFFLINE) {
      return { success: false, message: `Task đang ở trạng thái ${task.status}` };
    }

    if (!this.isPcOnline || !this.bridgeDispatcher) {
      task.status = TaskStatus.QUEUED_OFFLINE;
      task.updatedAt = getVietnamNowIso();
      db.saveTask(task);
      if (this.wsBroadcaster) this.wsBroadcaster('task_updated', task);
      return { success: false, task, message: 'PC đang offline. Task được chuyển sang hàng đợi offline.' };
    }

    const now = getVietnamNowIso();
    task.status = TaskStatus.DISPATCHED;
    task.dispatchedAt = now;
    task.updatedAt = now;
    db.saveTask(task);

    const dispatched = this.bridgeDispatcher(task);
    if (dispatched) {
      task.status = TaskStatus.RUNNING;
      task.updatedAt = now;
      db.saveTask(task);
    }

    if (this.wsBroadcaster) {
      this.wsBroadcaster('task_updated', task);
    }

    return { success: true, task, message: 'Đã gửi task vào Antigravity thành công.' };
  }

  public executeNextInQueue(): { success: boolean; task?: Task; message?: string } {
    const queue = this.getWaitingQueueTasks();
    if (queue.length === 0) {
      return { success: false, message: 'Danh sách chờ đang trống, không có task nào.' };
    }
    const nextTask = queue[0];
    return this.executeQueuedTask(nextTask.id);
  }

  public deleteQueuedTask(taskId: string): boolean {
    const task = db.getTask(taskId);
    if (!task) return false;
    const ok = db.deleteTask(taskId);
    if (ok && this.wsBroadcaster) {
      this.wsBroadcaster('task_deleted', { id: taskId });
    }
    return ok;
  }
}

export const taskService = new TaskService();

