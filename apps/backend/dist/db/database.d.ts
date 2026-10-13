import { Task, TaskStatus, Device } from '@sep-ai/shared';
export declare class AppDatabase {
    private db;
    constructor();
    private initTables;
    upsertDevice(device: Device): void;
    getDevice(id: string): Device | null;
    setDeviceOnline(id: string, isOnline: boolean): void;
    findTaskByIdempotency(key: string): Task | null;
    getTask(id: string): Task | null;
    listTasks(status?: TaskStatus, limit?: number): Task[];
    saveTask(task: Task): void;
    getPendingOfflineTasks(): Task[];
    saveNotification(notification: {
        id: string;
        title: string;
        body: string;
        type: string;
        taskId?: string;
        createdAt: string;
    }): void;
    listNotifications(limit?: number): Array<{
        id: string;
        title: string;
        body: string;
        type: string;
        taskId?: string;
        createdAt: string;
    }>;
    private mapTask;
}
export declare const db: AppDatabase;
//# sourceMappingURL=database.d.ts.map