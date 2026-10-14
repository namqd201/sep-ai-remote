import { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { authService } from './authService.js';
import { taskService } from './taskService.js';
import { notificationService } from './notificationService.js';
import { db } from '../db/database.js';
import {
  WsEventType,
  WsMessage,
  UserRole,
  BridgeStatus,
  AgentSessionSummary,
  ProjectGroup,
  Task,
  TaskEvent,
  AntigravityQuotaSummary
} from '@sep-ai/shared';

interface ClientSocket {
  ws: WebSocket;
  deviceId: string;
  role: UserRole;
  isAlive: boolean;
}

export class WsGateway {
  private wss!: WebSocketServer;
  private clients: Map<WebSocket, ClientSocket> = new Map();
  private bridgeSocket: WebSocket | null = null;
  private bridgeStatus: BridgeStatus = {
    isOnline: false,
    hostname: '',
    lastHeartbeat: '',
    antigravityDetected: false,
    activeSessionsCount: 0,
    version: '1.0.0'
  };
  private cachedSessions: AgentSessionSummary[] = [];
  private cachedProjectGroups: ProjectGroup[] = [];
  private cachedQuota: AntigravityQuotaSummary | null = null;

  public init(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    const savedQuota = db.getSetting('antigravity_quota');
    if (savedQuota) {
      try {
        this.cachedQuota = JSON.parse(savedQuota);
      } catch (_) {}
    }

    // Cấu hình dispatcher cho taskService
    taskService.setBridgeDispatcher((task: Task) => this.dispatchTaskToBridge(task));
    taskService.setBridgeDirectiveSender((sessionId: string, message: string, taskId?: string) =>
      this.sendDirectiveToBridge(sessionId, message, taskId)
    );
    taskService.setWsBroadcaster((event: string, payload: unknown) => {
      this.broadcastToMobile({
        event: event as WsEventType,
        payload,
        timestamp: new Date().toISOString()
      });
    });

    notificationService.setBroadcaster((notification) => {
      this.broadcastToMobile({
        event: WsEventType.NOTIFICATION,
        payload: notification,
        timestamp: new Date().toISOString()
      });
    });

    this.wss.on('connection', (ws: WebSocket) => {
      const client: ClientSocket = {
        ws,
        deviceId: '',
        role: UserRole.BOSS,
        isAlive: true
      };
      this.clients.set(ws, client);

      ws.on('message', (raw: string) => {
        try {
          const message: WsMessage = JSON.parse(raw.toString());
          this.handleMessage(client, message);
        } catch (err) {
          console.error('[WS] Lỗi parse JSON:', err);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.error('[WS] Socket error:', err);
      });
    });

    // Heartbeat check mỗi 10 giây
    const interval = setInterval(() => {
      for (const [ws, client] of this.clients.entries()) {
        if (!client.isAlive) {
          ws.terminate();
          this.clients.delete(ws);
          continue;
        }
        client.isAlive = false;
        ws.ping();
      }
    }, 10000);
    interval.unref();
  }

  private handleMessage(client: ClientSocket, message: WsMessage): void {
    switch (message.event) {
      case WsEventType.AUTHENTICATE: {
        const payload = message.payload as { token: string };
        const verified = authService.verify(payload.token);

        if (!verified) {
          client.ws.send(
            JSON.stringify({
              event: WsEventType.AUTH_ERROR,
              payload: { message: 'Token không hợp lệ' },
              timestamp: new Date().toISOString()
            })
          );
          client.ws.close();
          return;
        }

        client.deviceId = verified.deviceId;
        client.role = verified.role;

        if (client.role === UserRole.BRIDGE) {
          this.bridgeSocket = client.ws;
          this.bridgeStatus.isOnline = true;
          this.bridgeStatus.lastHeartbeat = new Date().toISOString();
          taskService.setPcOnlineState(true);
          notificationService.notifyPcStatus(true, this.bridgeStatus.hostname);

          this.broadcastToMobile({
            event: WsEventType.BRIDGE_STATUS,
            payload: this.bridgeStatus,
            timestamp: new Date().toISOString()
          });
        }

        client.ws.send(
          JSON.stringify({
            event: WsEventType.AUTHENTICATED,
            payload: {
              success: true,
              role: client.role,
              bridgeOnline: this.bridgeStatus.isOnline,
              sessions: this.cachedSessions,
              quota: this.cachedQuota
            },
            timestamp: new Date().toISOString()
          })
        );
        break;
      }

      case WsEventType.PING: {
        client.isAlive = true;
        client.ws.send(
          JSON.stringify({
            event: WsEventType.PONG,
            payload: {},
            timestamp: new Date().toISOString()
          })
        );
        break;
      }

      case WsEventType.BRIDGE_STATUS: {
        if (client.role === UserRole.BRIDGE) {
          this.bridgeStatus = {
            ...(message.payload as BridgeStatus),
            isOnline: true,
            lastHeartbeat: new Date().toISOString()
          };
          this.broadcastToMobile(message);
        }
        break;
      }

      case WsEventType.SESSIONS_UPDATED: {
        if (client.role === UserRole.BRIDGE) {
          const payload = message.payload as {
            sessions: AgentSessionSummary[];
            projectGroups?: ProjectGroup[];
          };
          this.cachedSessions = payload.sessions || [];
          this.cachedProjectGroups = payload.projectGroups || [];
          this.broadcastToMobile(message);
        }
        break;
      }

      case WsEventType.QUOTA_UPDATED: {
        if (client.role === UserRole.BRIDGE) {
          this.cachedQuota = message.payload as AntigravityQuotaSummary;
          db.setSetting('antigravity_quota', JSON.stringify(this.cachedQuota));
          console.log(`[WsGateway] Đã nhận cập nhật Quota từ Bridge: ${this.cachedQuota.planName} (${this.cachedQuota.groups.length} groups)`);
          this.broadcastToMobile(message);
        }
        break;
      }

      case WsEventType.TASK_LIVE_STEPS: {
        if (client.role === UserRole.BRIDGE) {
          const payload = message.payload as {
            taskId?: string;
            sessionId: string;
            liveSteps: import('@sep-ai/shared').TaskLiveStep[];
            currentActionText: string;
          };
          taskService.updateLiveSteps(
            payload.taskId,
            payload.sessionId,
            payload.liveSteps,
            payload.currentActionText
          );
          this.broadcastToMobile(message);
        }
        break;
      }

      case WsEventType.TASK_EVENT: {
        if (client.role === UserRole.BRIDGE) {
          const taskEvent = message.payload as TaskEvent;
          let targetTaskId = taskEvent.taskId;

          // Nếu TaskEvent chỉ có sessionId (từ Stop Hook hoặc Polling Observer), tự động map về Task đang RUNNING hoặc task gần nhất của session
          if (!targetTaskId) {
            const activeTask =
              taskService.getActiveTaskForSession(taskEvent.sessionId) ||
              db.getLatestTaskForSession(taskEvent.sessionId);
            if (activeTask) {
              targetTaskId = activeTask.id;
              console.log(
                `[WsGateway] Đã tự động map sự kiện từ session ${taskEvent.sessionId} về task: ${targetTaskId} (${activeTask.title})`
              );
            } else {
              console.warn(
                `[WsGateway] Nhận taskEvent từ session ${taskEvent.sessionId} nhưng không tìm thấy task liên kết!`
              );
            }
          }

          if (targetTaskId) {
            taskService.updateTaskFromBridge(
              targetTaskId,
              taskEvent.status,
              taskEvent.report,
              taskEvent.sessionId,
              taskEvent.needsConfirmation,
              taskEvent.proposalText,
              taskEvent.ttsVoiceText
            );
          }
        }
        break;
      }

      case WsEventType.CHAT_MESSAGE: {
        // Chuyển tiếp tin nhắn chat
        if (client.role === UserRole.BOSS && this.bridgeSocket) {
          this.bridgeSocket.send(JSON.stringify(message));
        } else if (client.role === UserRole.BRIDGE) {
          this.broadcastToMobile(message);
        }
        break;
      }
    }
  }

  private handleDisconnect(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client) return;

    if (ws === this.bridgeSocket) {
      console.log('[WS] Windows Agent Bridge đã ngắt kết nối!');
      this.bridgeSocket = null;
      this.bridgeStatus.isOnline = false;
      taskService.setPcOnlineState(false);
      notificationService.notifyPcStatus(false);

      this.broadcastToMobile({
        event: WsEventType.BRIDGE_STATUS,
        payload: this.bridgeStatus,
        timestamp: new Date().toISOString()
      });
    }

    this.clients.delete(ws);
  }

  public dispatchTaskToBridge(task: Task): boolean {
    if (!this.bridgeSocket || this.bridgeSocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.bridgeSocket.send(
      JSON.stringify({
        event: WsEventType.DISPATCH_TASK,
        payload: task,
        timestamp: new Date().toISOString()
      })
    );
    return true;
  }

  public sendDirectiveToBridge(sessionId: string, message: string, taskId?: string): boolean {
    if (!this.bridgeSocket || this.bridgeSocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.bridgeSocket.send(
      JSON.stringify({
        event: WsEventType.SEND_DIRECTIVE,
        payload: { sessionId, message, taskId },
        timestamp: new Date().toISOString()
      })
    );
    return true;
  }

  public broadcastToMobile(message: WsMessage): void {
    const serialized = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.role === UserRole.BOSS && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(serialized);
      }
    }
  }

  public getBridgeStatus(): BridgeStatus {
    return this.bridgeStatus;
  }

  public getCachedSessions(): AgentSessionSummary[] {
    return this.cachedSessions;
  }

  public getCachedProjectGroups(): ProjectGroup[] {
    return this.cachedProjectGroups;
  }

  public getCachedQuota(): AntigravityQuotaSummary | null {
    return this.cachedQuota;
  }

  public requestQuotaRefresh(): boolean {
    if (this.bridgeSocket && this.bridgeSocket.readyState === WebSocket.OPEN) {
      this.bridgeSocket.send(
        JSON.stringify({
          event: WsEventType.GET_QUOTA,
          payload: {},
          timestamp: new Date().toISOString()
        })
      );
      return true;
    }
    return false;
  }
}

export const wsGateway = new WsGateway();
