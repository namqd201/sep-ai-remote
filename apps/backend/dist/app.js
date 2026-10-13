import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import authRoutes from './routes/authRoutes.js';
import pcRoutes from './routes/pcRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import ttsRoutes from './routes/ttsRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pc', pcRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/settings', settingsRoutes);
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'sep-ai-backend'
    });
});
// Phục vụ giao diện Mobile Web PWA nếu có trong thư mục public
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));
//# sourceMappingURL=app.js.map