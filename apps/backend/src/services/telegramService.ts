import { db } from '../db/database.js';
import { ttsService } from './ttsService.js';

export class TelegramService {
  /**
   * Lấy buffer âm thanh tiếng Việt từ TtsService (theo giọng Sếp đã chọn)
   */
  private async getTtsBuffer(text: string): Promise<Buffer> {
    return ttsService.synthesize(text);
  }

  /**
   * Gửi tin nhắn thoại qua Telegram Bot tới Sếp Nam
   */
  public async sendVoiceNotification(voiceText: string, taskTitle: string): Promise<boolean> {
    try {
      const enabled = db.getSetting('telegram_enabled');
      if (enabled === 'false') {
        return false;
      }

      const botToken = db.getSetting('telegram_bot_token') || process.env.TELEGRAM_BOT_TOKEN;
      const chatId = db.getSetting('telegram_chat_id') || process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        return false;
      }

      console.log(`[TelegramService] Đang gửi tin nhắn thoại tới Chat ID ${chatId}...`);
      const audioBuffer = await this.getTtsBuffer(voiceText);

      const formData = new FormData();
      formData.append('chat_id', chatId.trim());
      formData.append('caption', `🎉 Sếp Nam ơi: ${taskTitle}\n\n💬 ${voiceText}`);
      const blob = new Blob([audioBuffer as any], { type: 'audio/mpeg' });
      formData.append('voice', blob, 'sep_ai_voice.mp3');

      const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendVoice`, {
        method: 'POST',
        body: formData
      });

      const resData = await res.json() as { ok: boolean; description?: string };
      if (!resData.ok) {
        console.error('[TelegramService] Telegram API báo lỗi:', resData.description);
        return false;
      }

      console.log('[TelegramService] Đã gửi tin nhắn thoại thành công tới Telegram của Sếp!');
      return true;
    } catch (err) {
      console.error('[TelegramService] Lỗi khi gửi voice telegram:', err);
      return false;
    }
  }

  /**
   * Gửi voice thử nghiệm để kiểm tra cấu hình token & chat ID
   */
  public async sendTestVoice(botToken: string, chatId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!botToken || !chatId) {
        return { success: false, error: 'Vui lòng nhập đầy đủ Bot Token và Chat ID.' };
      }

      const testText = 'Dạ em chào Sếp Nam! Đây là tin nhắn thoại thử nghiệm từ Nhân viên quèn qua Telegram ạ.';
      const audioBuffer = await this.getTtsBuffer(testText);

      const formData = new FormData();
      formData.append('chat_id', chatId.trim());
      formData.append('caption', '🧪 [Test Thông Báo Giọng Nói — Nhân viên quèn]\n\nDạ em chào Sếp Nam! Kết nối Telegram Bot thành công mỹ mãn rồi ạ.');
      const blob = new Blob([audioBuffer as any], { type: 'audio/mpeg' });
      formData.append('voice', blob, 'sep_ai_test_voice.mp3');

      const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendVoice`, {
        method: 'POST',
        body: formData
      });

      const resData = await res.json() as { ok: boolean; description?: string };
      if (!resData.ok) {
        return { success: false, error: resData.description || 'Lỗi gửi tin nhắn Telegram' };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }
}

export const telegramService = new TelegramService();
