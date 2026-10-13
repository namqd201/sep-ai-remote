import { Task, TaskReport, TaskStatus } from './task.js';
import { AgentSessionSummary } from './session.js';
import { BridgeStatus } from './device.js';

export enum WsEventType {
  // Client/Bridge Authentication
  AUTHENTICATE = 'authenticate',
  AUTHENTICATED = 'authenticated',
  AUTH_ERROR = 'auth_error',

  // Heartbeat
  PING = 'ping',
  PONG = 'pong',

  // Bridge Events
  BRIDGE_STATUS = 'bridge_status',
  SESSIONS_UPDATED = 'sessions_updated',
  TASK_EVENT = 'task_event',
  REPORT_READY = 'report_ready',

  // Task Events
  NEW_TASK = 'new_task',
  DISPATCH_TASK = 'dispatch_task',
  TASK_STATUS_UPDATED = 'task_status_updated',
  TASK_LIVE_STEPS = 'task_live_steps',
  TASK_COMPLETED = 'task_completed',
  TASK_FAILED = 'task_failed',
  APPROVAL_REQUIRED = 'approval_required',

  // Chat/Interaction
  CHAT_MESSAGE = 'chat_message',
  NOTIFICATION = 'notification'
}

export interface WsMessage<T = unknown> {
  event: WsEventType;
  payload: T;
  timestamp: string;
}

export interface TaskLiveStepsPayload {
  taskId: string;
  sessionId: string;
  liveSteps: import('./task.js').TaskLiveStep[];
  currentActionText: string;
}

export interface TaskCompletedPayload {
  taskId: string;
  sessionId: string;
  title: string;
  summary: string;
  ttsVoiceText: string;
  report?: TaskReport;
}

export interface ApprovalRequiredPayload {
  taskId: string;
  sessionId: string;
  actionRequired: string;
  reason: string;
}

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  type: 'task_completed' | 'task_failed' | 'approval_required' | 'pc_status';
  taskId?: string;
  timestamp: string;
}
