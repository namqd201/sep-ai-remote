import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { notificationService } from './notificationService.js';
import { telegramService } from './telegramService.js';
import { summarizeTaskPrompt } from './taskSummarizer.js';
import { TaskStatus, getVietnamNowIso, getTaskCompletionVoiceText, getTaskApprovalVoiceText } from '@sep-ai/shared';
export class TaskService {
    isPcOnline = false;
    bridgeDispatcher;
    bridgeDirectiveSender;
    wsBroadcaster;
    setBridgeDispatcher(dispatcher) {
        this.bridgeDispatcher = dispatcher;
    }
    setBridgeDirectiveSender(sender) {
        this.bridgeDirectiveSender = sender;
    }
    setWsBroadcaster(broadcaster) {
        this.wsBroadcaster = broadcaster;
    }
    setPcOnlineState(online) {
        const prevState = this.isPcOnline;
        this.isPcOnline = online;
        if (!prevState && online) {
            // Khi PC kết nối lại, tự động giải phóng hàng đợi offline
            this.flushOfflineQueue();
            if (this.isAutoProcessEnabled()) {
                setTimeout(() => {
                    this.triggerNextInQueueIfIdle();
                }, 1500);
            }
        }
    }
    getPcOnlineState() {
        return this.isPcOnline;
    }
    createTask(dto, createdByDevice) {
        // 1. Kiểm tra Idempotency Key để chống gửi trùng lặp
        if (dto.idempotencyKey) {
            const existing = db.findTaskByIdempotency(dto.idempotencyKey);
            if (existing) {
                return { task: existing, isDuplicate: true };
            }
        }
        const taskId = `tsk_${uuidv4().substring(0, 8)}`;
        const now = getVietnamNowIso();
        const summary = summarizeTaskPrompt(dto.prompt);
        const taskTitle = dto.title || summary.shortTitle;
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
                        const brainDir = path.join(process.env.USERPROFILE || 'C:\\Users\\PC', '.gemini', 'antigravity', 'brain', targetSession, '.user_uploaded');
                        if (!fs.existsSync(brainDir)) {
                            fs.mkdirSync(brainDir, { recursive: true });
                        }
                        const destPath = path.join(brainDir, fileName);
                        fs.copyFileSync(filePath, destPath);
                        att.localPath = destPath;
                        console.log(`[TaskService] Đã lưu ảnh đính kèm vào Antigravity: ${destPath}`);
                        // Xóa dữ liệu base64 để tối ưu bộ nhớ db
                        delete att.data;
                    }
                    catch (err) {
                        console.error('[TaskService] Lỗi lưu ảnh đính kèm:', err);
                    }
                }
            }
        }
        const initialStatus = dto.isQueued
            ? TaskStatus.PENDING
            : (this.isPcOnline ? TaskStatus.DISPATCHED : TaskStatus.QUEUED_OFFLINE);
        const task = {
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
            isQueued: Boolean(dto.isQueued),
            currentActionText: summary.shortAction,
            startVoiceText: summary.startVoiceText,
            completionVoiceText: summary.doneVoiceText
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
        // Nếu chế độ tự động xử lý task đang bật, kiểm tra nếu worker rảnh thì lấy task làm ngay
        if (this.isAutoProcessEnabled() && this.isPcOnline) {
            setTimeout(() => {
                this.triggerNextInQueueIfIdle();
            }, 500);
        }
        return { task, isDuplicate: false };
    }
    getActiveTaskForSession(sessionId) {
        return db.getActiveTaskBySession(sessionId);
    }
    updateTaskFromBridge(taskId, status, report, sessionId, needsConfirmation, proposalText, ttsVoiceText) {
        const task = db.getTask(taskId);
        if (!task)
            return null;
        const now = getVietnamNowIso();
        task.status = status;
        task.updatedAt = now;
        if (sessionId)
            task.sessionId = sessionId;
        if (needsConfirmation) {
            task.needsConfirmation = true;
            task.proposalText = proposalText;
            task.currentActionText = 'Đang chờ Sếp Nam xác nhận đề xuất...';
            const voiceText = ttsVoiceText ||
                'sếp ơi, em có đề xuất xử lý task như này ạ. Sếp vào đọc và confirm giúp em để em làm nhé';
            telegramService.sendVoiceNotification(voiceText, task.title).catch((err) => {
                console.warn('[TaskService] Gửi voice Telegram thất bại:', err);
            });
            if (this.wsBroadcaster) {
                this.wsBroadcaster('task_needs_confirmation', {
                    taskId: task.id,
                    sessionId: task.sessionId,
                    title: task.title,
                    proposalText,
                    ttsVoiceText: voiceText
                });
            }
        }
        else if (report) {
            task.report = report;
        }
        if (status === TaskStatus.COMPLETED) {
            task.completedAt = now;
            const voiceText = task.completionVoiceText ||
                (task.prompt ? summarizeTaskPrompt(task.prompt).doneVoiceText : getTaskCompletionVoiceText(task.title));
            if (!task.report) {
                task.report = {
                    summary: 'Task đã hoàn thành thành công.',
                    filesModified: [],
                    voiceNotificationText: voiceText,
                    completedAt: now
                };
            }
            else {
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
            // Tự động xử lý task tiếp theo từ hàng đợi nếu chế độ auto-process đang BẬT
            if (this.isAutoProcessEnabled() && this.isPcOnline) {
                console.log(`[TaskService] [AutoProcess] Task ${task.id} đã hoàn thành. Chuẩn bị lấy task tiếp theo sau 2 giây...`);
                setTimeout(() => {
                    this.triggerNextInQueueIfIdle();
                }, 2000);
            }
        }
        else if (status === TaskStatus.FAILED) {
            task.completedAt = now;
            const voiceText = `Sếp Nam ơi, việc ${task.title} gặp lỗi trong lúc chạy rồi ạ. Sếp vào kiểm tra nhé!`;
            if (!task.report) {
                task.report = {
                    summary: 'Task thực thi thất bại.',
                    filesModified: [],
                    errorDetails: 'Lỗi trong quá trình xử lý',
                    voiceNotificationText: voiceText,
                    completedAt: now
                };
            }
            else {
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
            // Tự động xử lý task tiếp theo từ hàng đợi nếu chế độ auto-process đang BẬT
            if (this.isAutoProcessEnabled() && this.isPcOnline) {
                console.log(`[TaskService] [AutoProcess] Task ${task.id} thất bại. Chuẩn bị lấy task tiếp theo sau 3 giây...`);
                setTimeout(() => {
                    this.triggerNextInQueueIfIdle();
                }, 3000);
            }
        }
        else if (status === TaskStatus.WAITING_APPROVAL) {
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
    updateLiveSteps(taskId, sessionId, liveSteps, currentActionText) {
        let task = null;
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
    flushOfflineQueue() {
        if (!this.isPcOnline || !this.bridgeDispatcher)
            return;
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
    listTasks(status, limit = 50) {
        return db.listTasks(status, limit);
    }
    getTask(id) {
        return db.getTask(id);
    }
    getWaitingQueueTasks() {
        return db.getWaitingQueueTasks();
    }
    executeQueuedTask(taskId) {
        const task = db.getTask(taskId);
        if (!task) {
            return { success: false, message: 'Task không tồn tại' };
        }
        if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.QUEUED_OFFLINE) {
            return { success: false, message: `Task đang ở trạng thái ${task.status}` };
        }
        // Tự động tối ưu tiêu đề và câu voice thông minh nếu task cũ chưa có hoặc bị cắt cụt từ
        if (!task.startVoiceText || !task.completionVoiceText || task.title.endsWith('...')) {
            const summary = summarizeTaskPrompt(task.prompt);
            task.title = summary.shortTitle;
            task.currentActionText = summary.shortAction;
            task.startVoiceText = summary.startVoiceText;
            task.completionVoiceText = summary.doneVoiceText;
        }
        if (!this.isPcOnline || !this.bridgeDispatcher) {
            task.status = TaskStatus.QUEUED_OFFLINE;
            task.updatedAt = getVietnamNowIso();
            db.saveTask(task);
            if (this.wsBroadcaster)
                this.wsBroadcaster('task_updated', task);
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
    executeNextInQueue() {
        const queue = this.getWaitingQueueTasks();
        if (queue.length === 0) {
            return { success: false, message: 'Danh sách chờ đang trống, không có task nào.' };
        }
        const nextTask = queue[0];
        return this.executeQueuedTask(nextTask.id);
    }
    isAutoProcessEnabled() {
        return db.getSetting('auto_process_queue') === 'true';
    }
    setAutoProcessEnabled(enabled) {
        db.setSetting('auto_process_queue', enabled ? 'true' : 'false');
        if (this.wsBroadcaster) {
            this.wsBroadcaster('auto_process_status', { enabled });
        }
        if (enabled) {
            setTimeout(() => {
                this.triggerNextInQueueIfIdle();
            }, 500);
        }
    }
    triggerNextInQueueIfIdle() {
        if (!this.isPcOnline || !this.bridgeDispatcher) {
            console.log('[TaskService] [AutoProcess] PC đang offline, không kích hoạt task hàng đợi.');
            return { success: false, message: 'PC đang offline.' };
        }
        if (!this.isAutoProcessEnabled()) {
            return { success: false, message: 'Chế độ tự động xử lý task đang tắt.' };
        }
        // Tự động dọn dẹp các task bị treo quá 15 phút (stale running tasks)
        db.cleanupStaleRunningTasks(15);
        const running = db.getRunningTasks();
        if (running.length > 0) {
            console.log(`[TaskService] [AutoProcess] Hiện có ${running.length} task đang chạy (${running[0].id} - ${running[0].title}), chưa kích hoạt task tiếp theo.`);
            return { success: false, message: 'Đang có task chạy.' };
        }
        const queue = this.getWaitingQueueTasks();
        if (queue.length === 0) {
            console.log('[TaskService] [AutoProcess] Danh sách chờ đang trống.');
            return { success: false, message: 'Danh sách chờ đang trống.' };
        }
        const nextTask = queue[0];
        console.log(`[TaskService] [AutoProcess] ⚡ Tự động lấy task tiếp theo từ hàng đợi: ${nextTask.id} (${nextTask.title})`);
        const result = this.executeQueuedTask(nextTask.id);
        if (result.success && result.task) {
            const voiceMsg = result.task.startVoiceText ||
                nextTask.startVoiceText ||
                `Dạ em tự động chuyển sang xử lý task tiếp theo: ${result.task.title}`;
            if (this.wsBroadcaster) {
                this.wsBroadcaster('auto_process_task_started', {
                    taskId: result.task.id,
                    title: result.task.title,
                    ttsVoiceText: voiceMsg
                });
            }
        }
        return result;
    }
    deleteQueuedTask(taskId) {
        const task = db.getTask(taskId);
        if (!task)
            return false;
        const ok = db.deleteTask(taskId);
        if (ok && this.wsBroadcaster) {
            this.wsBroadcaster('task_deleted', { id: taskId });
        }
        return ok;
    }
    async respondToProposal(taskId, action, feedbackText) {
        const task = db.getTask(taskId);
        if (!task) {
            return { success: false, message: 'Task không tồn tại' };
        }
        const sessionId = task.sessionId;
        if (!sessionId) {
            return { success: false, message: 'Task không có session Antigravity liên kết' };
        }
        const now = getVietnamNowIso();
        task.needsConfirmation = false;
        task.status = TaskStatus.RUNNING;
        task.updatedAt = now;
        task.currentActionText =
            action === 'confirm'
                ? 'Đang thực hiện theo xác nhận của Sếp'
                : 'Đang điều chỉnh theo chỉ đạo của Sếp';
        db.saveTask(task);
        let directivePrompt = '';
        if (action === 'confirm') {
            directivePrompt = `[CHỈ ĐẠO TỪ SẾP NAM - ĐÃ XÁC NHẬN / CONFIRMED]:\nSếp Nam đã đồng ý với đề xuất của bạn. Hãy tiếp tục triển khai ngay!`;
            if (feedbackText && feedbackText.trim()) {
                directivePrompt += `\n\nÝ kiến bổ sung của Sếp: ${feedbackText.trim()}`;
            }
        }
        else {
            directivePrompt = `[CHỈ ĐẠO TỪ SẾP NAM - TỪ CHỐI / REJECTED]:\nSếp Nam không đồng ý với phương án/đề xuất này.`;
            if (feedbackText && feedbackText.trim()) {
                directivePrompt += `\n\nChỉ đạo cụ thể của Sếp: ${feedbackText.trim()}`;
            }
            else {
                directivePrompt += `\nHãy dừng phương án này và đề xuất giải pháp khác phù hợp hơn.`;
            }
        }
        if (this.bridgeDirectiveSender) {
            this.bridgeDirectiveSender(sessionId, directivePrompt, task.id);
        }
        if (this.wsBroadcaster) {
            this.wsBroadcaster('task_updated', task);
        }
        return {
            success: true,
            task,
            message: action === 'confirm'
                ? 'Đã gửi xác nhận đồng ý cho Antigravity'
                : 'Đã gửi từ chối và chỉ đạo cho Antigravity'
        };
    }
    async replyToTask(taskId, directivePrompt, attachments) {
        const task = db.getTask(taskId);
        if (!task) {
            return { success: false, message: 'Task không tồn tại' };
        }
        if (!directivePrompt || !directivePrompt.trim()) {
            return { success: false, message: 'Nội dung chỉ đạo không được để trống' };
        }
        // Xử lý lưu ảnh đính kèm bổ sung nếu có
        const processedAttachments = attachments ? [...attachments] : [];
        if (processedAttachments.length > 0) {
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
                        const targetSession = task.sessionId || '44939315-00af-4786-86be-c0e8740762a9';
                        const brainDir = path.join(process.env.USERPROFILE || 'C:\\Users\\PC', '.gemini', 'antigravity', 'brain', targetSession, '.user_uploaded');
                        if (!fs.existsSync(brainDir)) {
                            fs.mkdirSync(brainDir, { recursive: true });
                        }
                        const destPath = path.join(brainDir, fileName);
                        fs.copyFileSync(filePath, destPath);
                        att.localPath = destPath;
                        delete att.data;
                    }
                    catch (err) {
                        console.error('[TaskService] Lỗi lưu ảnh chỉ đạo bổ sung:', err);
                    }
                }
            }
            task.attachments = [...(task.attachments || []), ...processedAttachments];
        }
        const sessionId = task.sessionId;
        if (!sessionId) {
            return { success: false, message: 'Task không có session Antigravity liên kết' };
        }
        if (!this.isPcOnline || !this.bridgeDirectiveSender) {
            return { success: false, message: 'Máy tính đang offline, không thể gửi chỉ đạo trực tiếp' };
        }
        const now = getVietnamNowIso();
        task.status = TaskStatus.RUNNING;
        task.updatedAt = now;
        task.currentActionText = 'Đang thực hiện theo chỉ đạo bổ sung của Sếp Nam';
        task.startVoiceText = `Dạ Sếp Nam, em đã nhận chỉ đạo bổ sung và bắt đầu làm tiếp việc: ${task.title} rồi ạ!`;
        task.completionVoiceText = `Sếp Nam ơi, em đã làm xong theo chỉ đạo bổ sung cho việc ${task.title} rồi ạ. Sếp vào kiểm tra nhé!`;
        db.saveTask(task);
        // Chuẩn bị directive message gửi Antigravity
        let fullDirective = `[CHỈ ĐẠO BỔ SUNG TỪ SẾP NAM CHO TASK: "${task.title}"]:\n${directivePrompt.trim()}`;
        if (processedAttachments.length > 0) {
            fullDirective += '\n\n📷 [ẢNH ĐÍNH KÈM CHỈ ĐẠO MỚI TỪ SẾP]:';
            for (const att of processedAttachments) {
                const pathOrUrl = att.localPath
                    ? `file:///${att.localPath.replace(/\\/g, '/')}`
                    : att.url || att.name;
                fullDirective += `\n- ${att.name}: ${pathOrUrl}`;
            }
            fullDirective += '\n(Agent hãy dùng tool view_file để xem các ảnh đính kèm trên và thực hiện theo đúng chỉ đạo của Sếp!)';
        }
        const dispatched = this.bridgeDirectiveSender(sessionId, fullDirective, task.id);
        if (!dispatched) {
            return { success: false, message: 'Gửi chỉ đạo qua WebSocket tới PC thất bại' };
        }
        if (this.wsBroadcaster) {
            this.wsBroadcaster('task_updated', task);
        }
        return {
            success: true,
            task,
            message: 'Đã gửi chỉ đạo làm tiếp tới Antigravity thành công'
        };
    }
}
export const taskService = new TaskService();
//# sourceMappingURL=taskService.js.map