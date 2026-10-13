export declare enum DeviceType {
    MOBILE = "mobile",
    WINDOWS_BRIDGE = "windows_bridge",
    WEB_CLIENT = "web_client"
}
export declare enum UserRole {
    BOSS = "boss",
    BRIDGE = "bridge"
}
export interface Device {
    id: string;
    name: string;
    type: DeviceType;
    role: UserRole;
    isOnline: boolean;
    lastSeenAt: string;
    registeredAt: string;
    fcmToken?: string;
}
export interface BridgeStatus {
    isOnline: boolean;
    hostname: string;
    lastHeartbeat: string;
    antigravityDetected: boolean;
    activeSessionsCount: number;
    currentRunningSessionId?: string;
    version: string;
}
//# sourceMappingURL=device.d.ts.map