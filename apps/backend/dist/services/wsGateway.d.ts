import { Server as HttpServer } from 'node:http';
import { WsMessage, BridgeStatus, AgentSessionSummary, Task } from '@sep-ai/shared';
export declare class WsGateway {
    private wss;
    private clients;
    private bridgeSocket;
    private bridgeStatus;
    private cachedSessions;
    init(server: HttpServer): void;
    private handleMessage;
    private handleDisconnect;
    dispatchTaskToBridge(task: Task): boolean;
    broadcastToMobile(message: WsMessage): void;
    getBridgeStatus(): BridgeStatus;
    getCachedSessions(): AgentSessionSummary[];
}
export declare const wsGateway: WsGateway;
//# sourceMappingURL=wsGateway.d.ts.map