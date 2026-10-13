import { Router } from 'express';
const router = Router();
const audioCache = new Map();
router.get('/', async (req, res) => {
    const text = (req.query.text || 'Đã xong task, Sếp vào kiểm tra đi ạ.').trim();
    if (audioCache.has(text)) {
        const cached = audioCache.get(text);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', cached.length);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(cached);
        return;
    }
    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=vi&client=tw-ob`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        if (!response.ok) {
            res.status(502).json({ error: 'TTS provider returned error' });
            return;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        audioCache.set(text, buffer);
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