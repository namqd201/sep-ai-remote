import { Router } from 'express';
import { authService } from '../services/authService.js';
import { db } from '../db/database.js';

const router = Router();

router.get('/', authService.authenticateMiddleware, (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
  const notifications = db.listNotifications(limit);
  res.json({ success: true, notifications });
});

export default router;
