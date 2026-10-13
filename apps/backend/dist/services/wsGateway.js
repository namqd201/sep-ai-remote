import { WebSocketServer, WebSocket } from 'ws';
import { authService } from './authService.js';
import { taskService } from './taskService.js';
import { notificationService } from './notificationService.js';
import { WsEventType, UserRole } from '@sep-ai/shared';
export class WsGateway {
    wss;
    clients = new Map();
    bridgeSocket = null;
    bridgeStatus = {
        isOnline: false,
        hostname: '',
        lastHeartbeat: '',
        antigravityDetected: false,
        activeSessionsCount: 0,
        version: '1.0.0'
    };
    cachedSessions = [];
    cachedProjectGroups = [];
    init(server) {
        this.wss = new WebSocketServer({ server, path: '/ws' });
        // Cấu hình dispatcher cho taskService
        taskService.setBridgeDispatcher((task) => this.dispatchTaskToBridge(task));
        taskService.setWsBroadcaster((event, payload) => {
            this.broadcastToMobile({
                event: event,
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
        this.wss.on('connection', (ws) => {
            const client = {
                ws,
                deviceId: '',
                role: UserRole.BOSS,
                isAlive: true
            };
            this.clients.set(ws, client);
            ws.on('message', (raw) => {
                try {
                    const message = JSON.parse(raw.toString());
                    this.handleMessage(client, message);
                }
                catch (err) {
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
    handleMessage(client, message) {
        switch (message.event) {
            case WsEventType.AUTHENTICATE: {
                const payload = message.payload;
                const verified = authService.verify(payload.token);
                if (!verified) {
                    client.ws.send(JSON.stringify({
                        event: WsEventType.AUTH_ERROR,
                        payload: { message: 'Token không hợp lệ' },
                        timestamp: new Date().toISOString()
                    }));
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
                client.ws.send(JSON.stringify({
                    event: WsEventType.AUTHENTICATED,
                    payload: {
                        success: true,
                        role: client.role,
                        bridgeOnline: this.bridgeStatus.isOnline,
                        sessions: this.cachedSessions
                    },
                    timestamp: new Date().toISOString()
                }));
                break;
            }
            case WsEventType.PING: {
                client.isAlive = true;
                client.ws.send(JSON.stringify({
                    event: WsEventType.PONG,
                    payload: {},
                    timestamp: new Date().toISOString()
                }));
                break;
            }
            case WsEventType.BRIDGE_STATUS: {
                if (client.role === UserRole.BRIDGE) {
                    this.bridgeStatus = {
                        ...message.payload,
                        isOnline: true,
                        lastHeartbeat: new Date().toISOString()
                    };
                    this.broadcastToMobile(message);
                }
                break;
            }
            case WsEventType.SESSIONS_UPDATED: {
                if (client.role === UserRole.BRIDGE) {
                    const payload = message.payload;
                    this.cachedSessions = payload.sessions || [];
                    this.cachedProjectGroups = payload.projectGroups || [];
                    this.broadcastToMobile(message);
                }
                break;
            }
            case WsEventType.TASK_EVENT: {
                if (client.role === UserRole.BRIDGE) {
                    const taskEvent = message.payload;
                    let targetTaskId = taskEvent.taskId;
                    // Nếu TaskEvent chỉ có sessionId (từ Stop Hook hoặc Polling Observer), tự động map về Task đang RUNNING
                    if (!targetTaskId) {
                        const activeTask = taskService.getActiveTaskForSession(taskEvent.sessionId);
                        if (activeTask) {
                            targetTaskId = activeTask.id;
                            console.log(`[WsGateway] Đã tự động map sự kiện từ session ${taskEvent.sessionId} về task: ${targetTaskId} (${activeTask.title})`);
                        }
                        else {
                            console.warn(`[WsGateway] Nhận taskEvent từ session ${taskEvent.sessionId} nhưng không có task nào đang chạy!`);
                        }
                    }
                    if (targetTaskId) {
                        taskService.updateTaskFromBridge(targetTaskId, taskEvent.status, taskEvent.report, taskEvent.sessionId);
                    }
                }
                break;
            }
            case WsEventType.CHAT_MESSAGE: {
                // Chuyển tiếp tin nhắn chat
                if (client.role === UserRole.BOSS && this.bridgeSocket) {
                    this.bridgeSocket.send(JSON.stringify(message));
                }
                else if (client.role === UserRole.BRIDGE) {
                    this.broadcastToMobile(message);
                }
                break;
            }
        }
    }
    handleDisconnect(ws) {
        const client = this.clients.get(ws);
        if (!client)
            return;
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
    dispatchTaskToBridge(task) {
        if (!this.bridgeSocket || this.bridgeSocket.readyState !== WebSocket.OPEN) {
            return false;
        }
        this.bridgeSocket.send(JSON.stringify({
            event: WsEventType.DISPATCH_TASK,
            payload: task,
            timestamp: new Date().toISOString()
        }));
        return true;
    }
    broadcastToMobile(message) {
        const serialized = JSON.stringify(message);
        for (const client of this.clients.values()) {
            if (client.role === UserRole.BOSS && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(serialized);
            }
        }
    }
    getBridgeStatus() {
        return this.bridgeStatus;
    }
    getCachedSessions() {
        return this.cachedSessions;
    }
    getCachedProjectGroups() {
        return this.cachedProjectGroups;
    }
}
export const wsGateway = new WsGateway();
//# sourceMappingURL=wsGateway.js.map