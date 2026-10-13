import { Task, TaskStatus, CreateTaskDto, TaskReport } from '@sep-ai/shared';
export declare class TaskService {
    private isPcOnline;
    private bridgeDispatcher?;
    private wsBroadcaster?;
    setBridgeDispatcher(dispatcher: (task: Task) => boolean): void;
    setWsBroadcaster(broadcaster: (event: string, payload: unknown) => void): void;
    setPcOnlineState(online: boolean): void;
    getPcOnlineState(): boolean;
    createTask(dto: CreateTaskDto, createdByDevice: string): {
        task: Task;
        isDuplicate: boolean;
    };
    updateTaskFromBridge(taskId: string, status: TaskStatus, report?: TaskReport, sessionId?: string): Task | null;
    flushOfflineQueue(): void;
    listTasks(status?: TaskStatus, limit?: number): Task[];
    getTask(id: string): Task | null;
}
export declare const taskService: TaskService;
//# sourceMappingURL=taskService.d.ts.map