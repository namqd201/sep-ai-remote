import { Router } from 'express';
import { ttsService } from '../services/ttsService.js';
const router = Router();
// 1. Lấy danh sách giọng đọc có sẵn và giọng hiện tại đang chọn
router.get('/voices', (_req, res) => {
    try {
        const voices = ttsService.getVoices();
        const selectedVoiceId = ttsService.getSelectedVoiceId();
        res.json({
            success: true,
            selectedVoiceId,
            voices
        });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, error: errorMsg });
    }
});
// 2. Cài đặt giọng đọc mặc định
router.post('/voices/select', (req, res) => {
    try {
        const { voiceId } = req.body;
        if (!voiceId) {
            res.status(400).json({ success: false, error: 'Chưa cung cấp voiceId.' });
            return;
        }
        const ok = ttsService.setSelectedVoiceId(voiceId);
        if (!ok) {
            res.status(400).json({ success: false, error: 'Mã giọng đọc không hợp lệ.' });
            return;
        }
        res.json({
            success: true,
            message: 'Đã cập nhật giọng đọc thông báo thành công.',
            selectedVoiceId: voiceId
        });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, error: errorMsg });
    }
});
// 3. Phát âm thanh giọng đọc (Audio stream)
router.get('/', async (req, res) => {
    const text = (req.query.text || 'Đã xong task, Sếp vào kiểm tra đi ạ.').trim();
    const voice = req.query.voice || undefined;
    try {
        const buffer = await ttsService.synthesize(text, voice);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(buffer);
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: errorMsg });
    }
});
export default router;
//# sourceMappingURL=ttsRoutes.js.map