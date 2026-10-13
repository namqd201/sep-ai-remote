import {
  AgentSessionSummary,
  AgentSessionMetadata,
  ProjectGroup,
  TaskReport,
  TaskStatus,
  TaskEvent
} from '@sep-ai/shared';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  isUnsupported?: boolean;
}

export interface IAntigravityAdapter {
  /**
   * Kiểm tra khả năng kết nối và phát hiện phiên bản/tiến trình Antigravity
   */
  getConnectionStatus(): Promise<{
    isAvailable: boolean;
    hasAgentApi: boolean;
    hasDatabase: boolean;
    activeSessionsCount: number;
    details: string;
  }>;

  /**
   * Lấy danh sách toàn bộ các phiên agent đang mở hoặc đã lưu
   */
  getAvailableSessions(): Promise<AgentSessionSummary[]>;

  /**
   * Lấy danh sách sessions nhóm theo Project (giống sidebar Antigravity)
   */
  getProjectGroups(): Promise<ProjectGroup[]>;

  /**
   * Lấy chi tiết metadata của một phiên (workspaces, git info, projectId)
   */
  getSessionMetadata(sessionId: string): Promise<ActionResult<AgentSessionMetadata>>;

  /**
   * Gửi prompt/nội dung vào phiên agent đang mở
   */
  sendMessageToSession(
    sessionId: string,
    message: string,
    title?: string
  ): Promise<ActionResult<{ delivered: boolean }>>;

  /**
   * Khởi tạo một phiên agent mới với prompt ban đầu
   */
  createNewSession(
    prompt: string,
    title?: string,
    model?: 'flash_lite' | 'flash' | 'pro'
  ): Promise<ActionResult<{ sessionId?: string; output: string }>>;

  /**
   * Lấy trạng thái thực thi hiện tại của một phiên
   */
  getTaskStatus(sessionId: string): Promise<TaskStatus>;

  /**
   * Lấy báo cáo chi tiết của task vừa hoàn thành
   */
  getTaskReport(sessionId: string): Promise<TaskReport>;

  /**
   * Đăng ký nhận sự kiện vòng đời task (từ Hooks và SQLite Observer)
   */
  subscribeToTaskEvents(callback: (event: TaskEvent) => void): () => void;

  /**
   * Liên kết session với taskId và tiêu đề task hiện tại
   */
  setActiveTaskForSession?(sessionId: string, taskId: string, title: string): void;
  getActiveTaskForSession?(sessionId: string): { taskId: string; title: string } | undefined;
  clearActiveTaskForSession?(sessionId: string): void;

  /**
   * Lấy các bước hành động thời gian thực của phiên làm việc từ transcript
   */
  getSessionLiveSteps?(sessionId: string): {
    liveSteps: import('@sep-ai/shared').TaskLiveStep[];
    currentActionText: string;
    isWorking: boolean;
  };
  subscribeToLiveSteps?(
    callback: (data: {
      taskId?: string;
      sessionId: string;
      liveSteps: import('@sep-ai/shared').TaskLiveStep[];
      currentActionText: string;
    }) => void
  ): () => void;
}
