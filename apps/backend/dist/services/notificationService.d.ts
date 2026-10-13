import { NotificationPayload } from '@sep-ai/shared';
export declare class NotificationService {
    private recentNotifications;
    private wsBroadcaster?;
    setBroadcaster(broadcaster: (notification: NotificationPayload) => void): void;
    notify(payload: {
        title: string;
        body: string;
        type: 'task_completed' | 'task_failed' | 'approval_required' | 'pc_status';
        taskId?: string;
    }): void;
    notifyTaskCompleted(taskTitle: string, taskId: string, summary?: string): void;
    notifyTaskFailed(taskTitle: string, taskId: string, error?: string): void;
    notifyApprovalRequired(taskTitle: string, taskId: string, reason?: string): void;
    notifyPcStatus(isOnline: boolean, hostname?: string): void;
}
export declare const notificationService: NotificationService;
//# sourceMappingURL=notificationService.d.ts.map