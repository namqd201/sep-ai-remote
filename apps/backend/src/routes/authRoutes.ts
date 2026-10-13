import { Router, Response } from 'express';
import { authService, AuthenticatedRequest } from '../services/authService.js';
import { wsGateway } from '../services/wsGateway.js';
import { PairRequest } from '@sep-ai/shared';

const router = Router();

router.post('/pair', (req, res) => {
  const body = req.body as PairRequest;
  if (!body.pairingCode) {
    res.status(400).json({ error: 'Mã ghép đôi không được để trống' });
    return;
  }

  const result = authService.pair(body);
  if (!result.success) {
    res.status(401).json(result);
    return;
  }

  res.json(result);
});

router.get('/me', authService.authenticateMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const bridgeStatus = wsGateway.getBridgeStatus();
  res.json({
    authenticated: true,
    user: req.user,
    pcOnline: bridgeStatus.isOnline,
    bridgeStatus
  });
});

export default router;
