import { DeviceType, UserRole } from './device.js';
export interface PairRequest {
    pairingCode: string;
    deviceName: string;
    deviceType: DeviceType;
}
export interface PairResponse {
    success: boolean;
    token: string;
    deviceId: string;
    role: UserRole;
    message?: string;
}
export interface JwtPayload {
    deviceId: string;
    deviceName: string;
    deviceType: DeviceType;
    role: UserRole;
    iat?: number;
    exp?: number;
}
//# sourceMappingURL=auth.d.ts.map