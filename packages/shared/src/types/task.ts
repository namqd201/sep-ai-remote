export enum TaskStatus {
  PENDING = 'PENDING',
  QUEUED_OFFLINE = 'QUEUED_OFFLINE',
  DISPATCHED = 'DISPATCHED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  CANCELLED = 'CANCELLED'
}

export interface TaskAttachment {
  name: string;
  mimeType: string;
  data?: string;       // base64 encoded image
  url?: string;        // Web accessible URL (/uploads/...)
  localPath?: string;  // Local file path on Windows PC
}

export interface TaskReport {
  summary: string;
  filesModified: string[];
  testResults?: string;
  errorDetails?: string;
  executionTimeMs?: number;
  voiceNotificationText: string;
  completedAt: string;
}

export interface TaskLiveStep {
  id: string;
  type: 'thinking' | 'tool_call' | 'file_read' | 'file_edit' | 'command' | 'generic';
  title: string;
  detail?: string;
  status: 'running' | 'done' | 'error';
  timestamp: string;
}

export interface Task {
  id: string;
  idempotencyKey?: string;
  title: string;
  prompt: string;
  sessionId?: string;
  workspacePath?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  dispatchedAt?: string;
  completedAt?: string;
  report?: TaskReport;
  createdByDevice: string;
  retryCount: number;
  attachments?: TaskAttachment[];
  isQueued?: boolean;
  priority?: number;
  liveSteps?: TaskLiveStep[];
  currentActionText?: string;
  needsConfirmation?: boolean;
  proposalText?: string;
  startVoiceText?: string;
  completionVoiceText?: string;
}

export interface CreateTaskDto {
  prompt: string;
  title?: string;
  sessionId?: string;
  workspacePath?: string;
  createNewSession?: boolean;
  modelTier?: 'flash_lite' | 'flash' | 'pro';
  idempotencyKey?: string;
  attachments?: TaskAttachment[];
  isQueued?: boolean;
  priority?: number;
}

export interface TaskEvent {
  taskId?: string;
  sessionId: string;
  type: 'status_changed' | 'tool_executed' | 'completed' | 'failed' | 'waiting_approval' | 'needs_confirmation';
  status: TaskStatus;
  details?: Record<string, unknown>;
  report?: TaskReport;
  timestamp: string;
  needsConfirmation?: boolean;
  proposalText?: string;
  ttsVoiceText?: string;
}
