import { Router } from 'express';
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
export default router;
//# sourceMappingURL=pcRoutes.js.map