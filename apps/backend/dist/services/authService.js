import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { db } from '../db/database.js';
import { DeviceType, UserRole } from '@sep-ai/shared';
export class AuthService {
    pair(req) {
        if (req.pairingCode !== config.pairingCode) {
            return {
                success: false,
                token: '',
                deviceId: '',
                role: UserRole.BOSS,
                message: 'Mã ghép đôi không chính xác. Vui lòng kiểm tra lại cấu hình.'
            };
        }
        const deviceId = `dev_${uuidv4().substring(0, 8)}`;
        const deviceType = req.deviceType || DeviceType.MOBILE;
        const role = deviceType === DeviceType.WINDOWS_BRIDGE ? UserRole.BRIDGE : UserRole.BOSS;
        const now = new Date().toISOString();
        db.upsertDevice({
            id: deviceId,
            name: req.deviceName || 'Thiết bị mới',
            type: deviceType,
            role,
            isOnline: true,
            lastSeenAt: now,
            registeredAt: now
        });
        const payload = {
            deviceId,
            deviceName: req.deviceName || 'Thiết bị mới',
            deviceType,
            role
        };
        const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
        return {
            success: true,
            token,
            deviceId,
            role,
            message: 'Ghép đôi thiết bị thành công!'
        };
    }
    verify(token) {
        try {
            const decoded = jwt.verify(token, config.jwtSecret);
            return decoded;
        }
        catch {
            return null;
        }
    }
    authenticateMiddleware = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Yêu cầu xác thực (Missing Bearer token)' });
            return;
        }
        const token = authHeader.substring(7);
        const payload = this.verify(token);
        if (!payload) {
            res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
            return;
        }
        req.user = payload;
        db.setDeviceOnline(payload.deviceId, true);
        next();
    };
}
export const authService = new AuthService();
//# sourceMappingURL=authService.js.map