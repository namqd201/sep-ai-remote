import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { DEFAULT_TTS_COMPLETION_PHRASE } from '@sep-ai/shared';
export class NotificationService {
    recentNotifications = new Map();
    wsBroadcaster;
    setBroadcaster(broadcaster) {
        this.wsBroadcaster = broadcaster;
    }
    notify(payload) {
        const dedupeKey = `${payload.type}_${payload.taskId || payload.title}`;
        const now = Date.now();
        const lastTime = this.recentNotifications.get(dedupeKey);
        // Chống gửi trùng lặp trong vòng 3 giây
        if (lastTime && now - lastTime < 3000) {
            return;
        }
        this.recentNotifications.set(dedupeKey, now);
        const notificationId = `notif_${uuidv4().substring(0, 8)}`;
        const timestamp = new Date().toISOString();
        db.saveNotification({
            id: notificationId,
            title: payload.title,
            body: payload.body,
            type: payload.type,
            taskId: payload.taskId,
            createdAt: timestamp
        });
        const notifPayload = {
            id: notificationId,
            title: payload.title,
            body: payload.body,
            type: payload.type,
            taskId: payload.taskId,
            timestamp
        };
        if (this.wsBroadcaster) {
            this.wsBroadcaster(notifPayload);
        }
    }
    notifyTaskCompleted(taskTitle, taskId, summary) {
        this.notify({
            title: `Task hoàn thành: ${taskTitle}`,
            body: summary || DEFAULT_TTS_COMPLETION_PHRASE,
            type: 'task_completed',
            taskId
        });
    }
    notifyTaskFailed(taskTitle, taskId, error) {
        this.notify({
            title: `Task thất bại: ${taskTitle}`,
            body: error || 'Đã xảy ra lỗi trong quá trình thực thi.',
            type: 'task_failed',
            taskId
        });
    }
    notifyApprovalRequired(taskTitle, taskId, reason) {
        this.notify({
            title: `Chờ phê duyệt: ${taskTitle}`,
            body: reason || 'Task cần sự xác nhận của Sếp trên máy tính để tiếp tục.',
            type: 'approval_required',
            taskId
        });
    }
    notifyPcStatus(isOnline, hostname) {
        this.notify({
            title: isOnline ? 'Máy tính đã kết nối' : 'Mất kết nối máy tính',
            body: isOnline
                ? `Windows PC (${hostname || 'Dev Machine'}) đã online và sẵn sàng.`
                : 'Máy tính đang offline. Các task mới sẽ được lưu trong hàng đợi.',
            type: 'pc_status'
        });
    }
}
export const notificationService = new NotificationService();
//# sourceMappingURL=notificationService.js.map