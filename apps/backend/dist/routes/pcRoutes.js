import { Router } from 'express';
import { exec } from 'node:child_process';
import { authService } from '../services/authService.js';
import { wsGateway } from '../services/wsGateway.js';
const router = Router();
router.get('/status', authService.authenticateMiddleware, (_req, res) => {
    const status = wsGateway.getBridgeStatus();
    res.json({
        success: true,
        status
    });
});
router.get('/sessions', authService.authenticateMiddleware, (_req, res) => {
    const sessions = wsGateway.getCachedSessions();
    const projectGroups = wsGateway.getCachedProjectGroups();
    res.json({
        success: true,
        sessions,
        projectGroups
    });
});
// Khóa màn hình máy tính (Lock Screen)
router.post('/lock', authService.authenticateMiddleware, (_req, res) => {
    if (process.platform === 'win32') {
        exec('rundll32.exe user32.dll,LockWorkStation', (err) => {
            if (err) {
                console.error('[PC Command] Lỗi khóa màn hình:', err);
                res.status(500).json({ success: false, error: err.message });
                return;
            }
            console.log('[PC Command] Đã khóa màn hình máy tính thành công.');
            res.json({ success: true, message: 'Đã khóa màn hình máy tính thành công.' });
        });
    }
    else {
        res.status(400).json({ success: false, error: 'Chỉ hỗ trợ trên hệ điều hành Windows.' });
    }
});
// Cho máy tính đi ngủ (Sleep)
router.post('/sleep', authService.authenticateMiddleware, (_req, res) => {
    if (process.platform === 'win32') {
        res.json({ success: true, message: 'Máy tính đang chuẩn bị vào chế độ ngủ (Sleep)...' });
        setTimeout(() => {
            console.log('[PC Command] Đang đưa máy tính vào chế độ Sleep...');
            exec('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)"', (err) => {
                if (err) {
                    exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
                }
            });
        }, 1500);
    }
    else {
        res.status(400).json({ success: false, error: 'Chỉ hỗ trợ trên hệ điều hành Windows.' });
    }
});
// Khởi động lại máy tính (Restart)
router.post('/restart', authService.authenticateMiddleware, (_req, res) => {
    if (process.platform === 'win32') {
        res.json({ success: true, message: 'Máy tính sẽ khởi động lại sau 5 giây...' });
        setTimeout(() => {
            exec('shutdown /r /t 5 /c "Khoi dong lai tu Sep AI Remote"');
        }, 1000);
    }
    else {
        res.status(400).json({ success: false, error: 'Chỉ hỗ trợ trên hệ điều hành Windows.' });
    }
});
export default router;
//# sourceMappingURL=pcRoutes.js.map