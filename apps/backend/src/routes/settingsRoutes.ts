import { Router } from 'express';
import { db } from '../db/database.js';
import { telegramService } from '../services/telegramService.js';

const router = Router();

// Lấy tất cả cài đặt
router.get('/', (_req, res) => {
  try {
    const settings = db.getAllSettings();
    res.json({ success: true, settings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// Lưu cài đặt
router.post('/', (req, res) => {
  try {
    const settings = req.body as Record<string, string>;
    if (typeof settings !== 'object' || settings === null) {
      res.status(400).json({ success: false, error: 'Dữ liệu không hợp lệ.' });
      return;
    }

    for (const [key, value] of Object.entries(settings)) {
      db.setSetting(key, String(value));
    }

    res.json({ success: true, message: 'Đã lưu cài đặt thành công.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

// Test gửi voice Telegram
router.post('/telegram/test', async (req, res) => {
  try {
    const { botToken, chatId } = req.body as { botToken?: string; chatId?: string };
    const token = botToken || db.getSetting('telegram_bot_token') || process.env.TELEGRAM_BOT_TOKEN;
    const chat = chatId || db.getSetting('telegram_chat_id') || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chat) {
      res.status(400).json({ success: false, error: 'Chưa có Bot Token hoặc Chat ID.' });
      return;
    }

    const result = await telegramService.sendTestVoice(token, chat);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, message: 'Đã gửi tin nhắn thoại thử nghiệm tới Telegram của Sếp!' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
