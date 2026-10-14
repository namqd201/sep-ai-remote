import WebSocket from 'ws';
import os from 'node:os';
import { config } from '../config.js';
import { antigravityAdapter } from '../adapter/AntigravityAdapter.js';
import { antigravityQuotaService } from '../adapter/AntigravityQuotaService.js';
import { taskQueue } from '../queue/TaskQueue.js';
import {
  WsEventType,
  WsMessage,
  BridgeStatus,
  Task,
  TaskEvent,
  DeviceType,
  PairResponse,
  AntigravityQuotaSummary
} from '@sep-ai/shared';

export class AgentBridge {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private quotaTimer: NodeJS.Timeout | null = null;

  public async start(): Promise<void> {
    console.log('[Bridge] Đang khởi động Windows Agent Bridge...');

    // Lắng nghe sự kiện từ Adapter và chuyển tiếp lên backend
    antigravityAdapter.subscribeToTaskEvents((event: TaskEvent) => {
      this.sendWsMessage({
        event: WsEventType.TASK_EVENT,
        payload: event,
        timestamp: new Date().toISOString()
      });
    });

    antigravityAdapter.subscribeToLiveSteps((data) => {
      this.sendWsMessage({
        event: WsEventType.TASK_LIVE_STEPS,
        payload: data,
        timestamp: new Date().toISOString()
      });
    });

    taskQueue.setEventCallback((event: TaskEvent) => {
      this.sendWsMessage({
        event: WsEventType.TASK_EVENT,
        payload: event,
        timestamp: new Date().toISOString()
      });
    });

    await this.connectWithRetry();
  }

  private async authenticateWithBackend(): Promise<boolean> {
    try {
      console.log(`[Bridge] Đang ghép đôi với Backend tại ${config.backendHttpUrl}...`);
      const response = await fetch(`${config.backendHttpUrl}/api/auth/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairingCode: config.pairingCode,
          deviceName: `${config.deviceName} (${os.hostname()})`,
          deviceType: DeviceType.WINDOWS_BRIDGE
        })
      });

      if (!response.ok) {
        console.error(`[Bridge] Ghép đôi thất bại: HTTP ${response.status}`);
        return false;
      }

      const data = (await response.json()) as PairResponse;
      if (data.success && data.token) {
        this.token = data.token;
        console.log('[Bridge] Ghép đôi thành công! Đã nhận access token.');
        return true;
      }
      return false;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Bridge] Lỗi kết nối HTTP Backend:', errorMsg);
      return false;
    }
  }

  private async connectWithRetry(): Promise<void> {
    if (!this.token) {
      const paired = await this.authenticateWithBackend();
      if (!paired) {
        this.scheduleReconnect();
        return;
      }
    }

    try {
      console.log(`[Bridge] Đang mở kết nối WebSocket tới ${config.backendWsUrl}...`);
      this.ws = new WebSocket(config.backendWsUrl);

      this.ws.on('open', () => {
        console.log('[Bridge] WebSocket đã kết nối thành công! Đang gửi thông điệp xác thực...');
        this.reconnectAttempts = 0;
        this.isConnected = true;

        this.sendWsMessage({
          event: WsEventType.AUTHENTICATE,
          payload: { token: this.token },
          timestamp: new Date().toISOString()
        });

        this.startPeriodicSync();
      });

      this.ws.on('message', (raw: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(raw.toString()) as WsMessage;
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[Bridge] Lỗi parse WS payload từ server:', err);
        }
      });

      this.ws.on('close', () => {
        console.warn('[Bridge] Kết nối WebSocket bị đóng!');
        this.cleanup();
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[Bridge] WebSocket gặp lỗi:', err.message);
        this.cleanup();
        this.scheduleReconnect();
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Bridge] Lỗi khởi tạo WebSocket:', errorMsg);
      this.scheduleReconnect();
    }
  }

  private handleServerMessage(msg: WsMessage): void {
    switch (msg.event) {
      case WsEventType.AUTHENTICATED: {
        console.log('[Bridge] Server đã xác thực phiên làm việc thành công!');
        this.sendBridgeStatus();
        this.sendSessionsUpdate();
        this.sendQuotaUpdate(false);
        break;
      }

      case WsEventType.GET_QUOTA: {
        console.log('[Bridge] Nhận yêu cầu cập nhật Quota từ Server...');
        this.sendQuotaUpdate(true);
        break;
      }

      case WsEventType.DISPATCH_TASK: {
        const task = msg.payload as Task;
        console.log(`[Bridge] Nhận task chỉ định từ Server: ${task.id} (${task.title})`);
        taskQueue.enqueue(task);
        break;
      }

      case WsEventType.SEND_DIRECTIVE: {
        const payload = msg.payload as { sessionId: string; message: string; taskId?: string };
        console.log(`[Bridge] Nhận chỉ đạo từ Sếp gửi tới session ${payload.sessionId}: ${payload.message.substring(0, 60)}...`);
        if (payload.taskId) {
          antigravityAdapter.setActiveTaskForSession(payload.sessionId, payload.taskId);
        }
        antigravityAdapter.sendMessageToSession(payload.sessionId, payload.message).then((res) => {
          if (!res.success) {
            console.error(`[Bridge] Gửi chỉ đạo tới session ${payload.sessionId} thất bại:`, res.error);
          } else {
            console.log(`[Bridge] Đã gửi chỉ đạo tới session ${payload.sessionId} thành công!`);
          }
        });
        break;
      }

      case WsEventType.PING: {
        this.sendWsMessage({
          event: WsEventType.PONG,
          payload: {},
          timestamp: new Date().toISOString()
        });
        break;
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    // Exponential backoff: 2s, 4s, 8s, tối đa 30s
    const delayMs = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    console.log(`[Bridge] Sẽ thử kết nối lại sau ${Math.round(delayMs / 1000)}s (Lần thử ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWithRetry();
    }, delayMs);
  }

  private cleanup(): void {
    this.isConnected = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.quotaTimer) clearInterval(this.quotaTimer);
    this.heartbeatTimer = null;
    this.syncTimer = null;
    this.quotaTimer = null;
  }

  private startPeriodicSync(): void {
    // Gửi nhịp tim định kỳ
    this.heartbeatTimer = setInterval(() => {
      this.sendWsMessage({
        event: WsEventType.PING,
        payload: {},
        timestamp: new Date().toISOString()
      });
    }, config.heartbeatIntervalMs);

    // Đồng bộ danh sách sessions định kỳ
    this.syncTimer = setInterval(async () => {
      await this.sendBridgeStatus();
      await this.sendSessionsUpdate();
    }, 4000);

    // Đồng bộ Quota định kỳ mỗi 30 giây
    this.quotaTimer = setInterval(async () => {
      await this.sendQuotaUpdate(false);
    }, 30000);
  }

  private async sendBridgeStatus(): Promise<void> {
    const conn = await antigravityAdapter.getConnectionStatus();
    const status: BridgeStatus = {
      isOnline: true,
      hostname: os.hostname(),
      lastHeartbeat: new Date().toISOString(),
      antigravityDetected: conn.isAvailable,
      activeSessionsCount: conn.activeSessionsCount,
      version: '1.0.0'
    };

    this.sendWsMessage({
      event: WsEventType.BRIDGE_STATUS,
      payload: status,
      timestamp: new Date().toISOString()
    });
  }

  private async sendSessionsUpdate(): Promise<void> {
    const sessions = await antigravityAdapter.getAvailableSessions();
    const projectGroups = await antigravityAdapter.getProjectGroups();
    this.sendWsMessage({
      event: WsEventType.SESSIONS_UPDATED,
      payload: { sessions, projectGroups },
      timestamp: new Date().toISOString()
    });
  }

  public async sendQuotaUpdate(forceRefresh = false): Promise<void> {
    try {
      const quota = await antigravityQuotaService.getQuotaSummary(forceRefresh);
      this.sendWsMessage({
        event: WsEventType.QUOTA_UPDATED,
        payload: quota,
        timestamp: new Date().toISOString()
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Bridge] Lỗi gửi cập nhật Quota:', msg);
    }
  }

  private sendWsMessage(msg: WsMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}

export const agentBridge = new AgentBridge();
