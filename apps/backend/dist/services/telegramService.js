import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/database.js';
import { ttsService } from './ttsService.js';
import { taskService } from './taskService.js';
import { PcHealthService } from './pcHealthService.js';
import { exec } from 'node:child_process';
export class TelegramService {
    isPolling = false;
    lastUpdateId = 0;
    pollAbortController = null;
    async getTtsBuffer(text) {
        return ttsService.synthesize(text);
    }
    getBotToken() {
        return db.getSetting('telegram_bot_token') || process.env.TELEGRAM_BOT_TOKEN;
    }
    getChatId() {
        return db.getSetting('telegram_chat_id') || process.env.TELEGRAM_CHAT_ID;
    }
    /**
     * Khởi động vòng lặp Long Polling nhận tin nhắn từ Telegram Bot
     */
    startPolling() {
        if (this.isPolling)
            return;
        const token = this.getBotToken();
        if (!token) {
            console.log('[TelegramBot] Chưa cấu hình TELEGRAM_BOT_TOKEN. Bỏ qua polling.');
            return;
        }
        this.isPolling = true;
        console.log('[TelegramBot] 🚀 Bắt đầu chạy Telegram Long Polling 2 chiều...');
        this.pollLoop();
    }
    stopPolling() {
        this.isPolling = false;
        if (this.pollAbortController) {
            this.pollAbortController.abort();
            this.pollAbortController = null;
        }
    }
    async pollLoop() {
        while (this.isPolling) {
            const token = this.getBotToken();
            if (!token) {
                await new Promise((r) => setTimeout(r, 5000));
                continue;
            }
            try {
                this.pollAbortController = new AbortController();
                const url = `https://api.telegram.org/bot${token.trim()}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=20`;
                const res = await fetch(url, { signal: this.pollAbortController.signal });
                if (res.ok) {
                    const data = (await res.json());
                    if (data.ok && Array.isArray(data.result)) {
                        for (const update of data.result) {
                            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
                            await this.handleUpdate(update, token.trim());
                        }
                    }
                }
                else {
                    await new Promise((r) => setTimeout(r, 4000));
                }
            }
            catch (err) {
                if (err.name !== 'AbortError') {
                    await new Promise((r) => setTimeout(r, 4000));
                }
            }
        }
    }
    async handleUpdate(update, token) {
        // 1. Xử lý Callback Button (Inline Buttons)
        if (update.callback_query) {
            const cb = update.callback_query;
            const chatId = String(cb.message?.chat?.id || '');
            const data = String(cb.data || '');
            const callbackId = cb.id;
            // Trả lời callback query để tắt loading spinner trên Telegram
            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callbackId })
            }).catch(() => { });
            if (data === 'screenshot') {
                await this.sendScreenshot(chatId, token);
            }
            else if (data === 'health_pc') {
                await this.sendHealthStatus(chatId, token);
            }
            else if (data === 'sleep_pc') {
                await this.sendMessage(chatId, '💤 Máy tính đang chuẩn bị vào chế độ ngủ (Sleep) theo lệnh của Sếp...', token);
                setTimeout(() => {
                    exec('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)"');
                }, 1000);
            }
            else if (data.startsWith('confirm_task_')) {
                const taskId = data.replace('confirm_task_', '');
                taskService.respondToProposal(taskId, 'confirm', 'Sếp Nam đồng ý qua Telegram Bot');
                await this.sendMessage(chatId, `✅ Sếp Nam đã ĐỒNG Ý đề xuất cho task \`${taskId}\`. Antigravity đang tiếp tục làm việc!`, token);
            }
            else if (data.startsWith('reject_task_')) {
                const taskId = data.replace('reject_task_', '');
                taskService.respondToProposal(taskId, 'reject', 'Sếp Nam từ chối qua Telegram Bot');
                await this.sendMessage(chatId, `❌ Sếp Nam đã TỪ CHỐI đề xuất cho task \`${taskId}\`.`, token);
            }
            else if (data === 'list_tasks') {
                await this.sendRecentTasks(chatId, token);
            }
            return;
        }
        // 2. Xử lý Tin nhắn từ người dùng
        if (!update.message)
            return;
        const msg = update.message;
        const chatId = String(msg.chat.id);
        const configuredChatId = this.getChatId();
        // Tự động lưu Chat ID nếu chưa cấu hình
        if (!configuredChatId) {
            db.setSetting('telegram_chat_id', chatId);
            db.setSetting('telegram_enabled', 'true');
            console.log(`[TelegramBot] Đã tự động phát hiện và liên kết Chat ID của Sếp Nam: ${chatId}`);
        }
        else if (configuredChatId !== chatId) {
            // Người lạ gửi tin nhắn
            await this.sendMessage(chatId, '⛔ Xin lỗi, đây là bot riêng tư phục vụ Sếp Nam.', token);
            return;
        }
        // Xử lý Voice Message (Tin nhắn thoại từ Sếp)
        if (msg.voice) {
            await this.sendMessage(chatId, '🎙️ Dạ em đã nhận tin nhắn thoại từ Sếp Nam! Đang khởi tạo task cho Antigravity...', token);
            const voiceTitle = `[Voice Task] Giao việc qua giọng nói (${new Date().toLocaleTimeString('vi-VN')})`;
            const prompt = `[Sếp Nam gửi tin nhắn thoại qua Telegram lúc ${new Date().toLocaleTimeString('vi-VN')}]. Vui lòng kiểm tra và xử lý yêu cầu.`;
            const { task } = taskService.createTask({
                title: voiceTitle,
                prompt
            }, 'telegram_voice');
            await this.sendMessage(chatId, `✅ Đã tạo task thành công!\n📌 **Tiêu đề:** ${task.title}\n🆔 **Mã Task:** \`${task.id}\`\n⚡ Đang giao việc cho Antigravity...`, token);
            return;
        }
        // Xử lý Text Message
        const text = (msg.text || '').trim();
        if (!text)
            return;
        if (text === '/start' || text === '/help') {
            const welcome = `👋 **Kính chào Sếp Nam! Em là Nhân viên quèn đây ạ.**\n\n` +
                `Sếp có thể giao việc cực nhanh bằng cách:\n` +
                `• Nhắn tin yêu cầu trực tiếp vào đây 💬\n` +
                `• Gửi tin nhắn thoại (Voice note) 🎙️\n` +
                `• Dùng các phím lệnh nhanh bên dưới 👇`;
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📸 Chụp màn hình PC', callback_data: 'screenshot' },
                        { text: '📊 Sức khỏe PC', callback_data: 'health_pc' }
                    ],
                    [
                        { text: '📋 Danh sách Task', callback_data: 'list_tasks' },
                        { text: '💤 Cho PC đi ngủ', callback_data: 'sleep_pc' }
                    ],
                    [
                        { text: '🌐 Mở Web App Nhân viên quèn', url: 'https://padding-shifting-useable.ngrok-free.dev' }
                    ]
                ]
            };
            await this.sendMessageWithKeyboard(chatId, welcome, keyboard, token);
            return;
        }
        if (text === '/screenshot') {
            await this.sendScreenshot(chatId, token);
            return;
        }
        if (text === '/status' || text === '/health') {
            await this.sendHealthStatus(chatId, token);
            return;
        }
        if (text === '/sleep') {
            await this.sendMessage(chatId, '💤 Máy tính đang chuẩn bị vào chế độ ngủ (Sleep)...', token);
            setTimeout(() => {
                exec('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)"');
            }, 1000);
            return;
        }
        if (text === '/lock') {
            exec('rundll32.exe user32.dll,LockWorkStation');
            await this.sendMessage(chatId, '🔒 Đã khóa màn hình máy tính an toàn cho Sếp!', token);
            return;
        }
        if (text === '/tasks') {
            await this.sendRecentTasks(chatId, token);
            return;
        }
        // Giao task tự động từ tin nhắn văn bản
        const { task } = taskService.createTask({
            title: text.length > 50 ? text.substring(0, 50) + '...' : text,
            prompt: text
        }, 'telegram');
        const replyMsg = `✅ **Đã nhận task mới từ Sếp Nam!**\n\n` +
            `📌 **Tiêu đề:** ${task.title}\n` +
            `🆔 **Mã Task:** \`${task.id}\`\n` +
            `⚡ Antigravity đang tiếp nhận và bắt tay vào làm ngay ạ!`;
        const kb = {
            inline_keyboard: [
                [
                    { text: '🌐 Xem tiến độ trực tiếp', url: `https://padding-shifting-useable.ngrok-free.dev` }
                ]
            ]
        };
        await this.sendMessageWithKeyboard(chatId, replyMsg, kb, token);
        // Gửi phản hồi âm thanh tiếng Việt ngắn qua Telegram
        this.sendVoiceNotification('Dạ em nhận task của Sếp rồi ạ, em làm ngay đây.', task.title).catch(() => { });
    }
    async sendMessage(chatId, text, token) {
        const botToken = token || this.getBotToken();
        if (!botToken)
            return false;
        try {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text,
                    parse_mode: 'Markdown'
                })
            });
            return res.ok;
        }
        catch (_) {
            return false;
        }
    }
    async sendMessageWithKeyboard(chatId, text, keyboard, token) {
        const botToken = token || this.getBotToken();
        if (!botToken)
            return false;
        try {
            const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                })
            });
            return res.ok;
        }
        catch (_) {
            return false;
        }
    }
    async sendScreenshot(chatId, token) {
        const botToken = token || this.getBotToken();
        if (!botToken)
            return false;
        await this.sendMessage(chatId, '📸 Đang chụp màn hình PC...', botToken);
        const result = await PcHealthService.captureScreen();
        const screenshotPath = path.resolve(process.cwd(), 'apps/backend/public/uploads/pc_screen.png');
        if (fs.existsSync(screenshotPath)) {
            try {
                const fileBuffer = fs.readFileSync(screenshotPath);
                const formData = new FormData();
                formData.append('chat_id', chatId);
                formData.append('caption', `📸 Màn hình PC lúc ${new Date().toLocaleTimeString('vi-VN')}`);
                formData.append('photo', new Blob([fileBuffer]), 'screen.png');
                const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                    method: 'POST',
                    body: formData
                });
                return res.ok;
            }
            catch (err) {
                await this.sendMessage(chatId, '❌ Lỗi gửi ảnh màn hình.', botToken);
                return false;
            }
        }
        return false;
    }
    async sendHealthStatus(chatId, token) {
        const botToken = token || this.getBotToken();
        if (!botToken)
            return false;
        try {
            const health = await PcHealthService.getHealthData();
            const text = `📊 **TÌNH TRẠNG SỨC KHỎE PC:**\n\n` +
                `⚡ **CPU:** ${health.cpu.percent}% (${health.cpu.cores} nhân)\n` +
                `💾 **RAM:** ${health.memory.usedGb} / ${health.memory.totalGb} GB (${health.memory.percent}%)\n` +
                `💽 **Ổ đĩa:** ${health.disks.map((d) => `${d.drive} trống ${d.freeGb}GB`).join(' | ')}\n` +
                `⏱️ **Uptime:** ${health.uptime.formatted}\n` +
                `💻 **Thiết bị:** ${health.platform.hostname} (${health.platform.osType})`;
            const kb = {
                inline_keyboard: [
                    [
                        { text: '📸 Chụp màn hình', callback_data: 'screenshot' },
                        { text: '💤 Cho PC ngủ', callback_data: 'sleep_pc' }
                    ]
                ]
            };
            return this.sendMessageWithKeyboard(chatId, text, kb, botToken);
        }
        catch (_) {
            return false;
        }
    }
    async sendRecentTasks(chatId, token) {
        const botToken = token || this.getBotToken();
        if (!botToken)
            return false;
        const tasks = taskService.listTasks(undefined, 5);
        if (tasks.length === 0) {
            return this.sendMessage(chatId, '📋 Hiện tại chưa có task nào được tạo.', botToken);
        }
        let msg = `📋 **5 TASK GẦN NHẤT:**\n\n`;
        for (const t of tasks) {
            const statusIcon = t.status === 'COMPLETED'
                ? '✅'
                : t.status === 'RUNNING'
                    ? '⚡'
                    : t.status === 'FAILED'
                        ? '❌'
                        : '⏳';
            msg += `${statusIcon} **${t.title}**\n   Trạng thái: \`${t.status}\` • ID: \`${t.id.slice(0, 8)}\`\n`;
        }
        const kb = {
            inline_keyboard: [
                [
                    { text: '🌐 Mở Web App xem chi tiết', url: 'https://padding-shifting-useable.ngrok-free.dev' }
                ]
            ]
        };
        return this.sendMessageWithKeyboard(chatId, msg, kb, botToken);
    }
    /**
     * Gửi thông báo kèm nút duyệt đề xuất cho Sếp qua Telegram
     */
    async sendProposalApproval(taskId, title, proposalText) {
        const botToken = this.getBotToken();
        const chatId = this.getChatId();
        if (!botToken || !chatId)
            return false;
        const text = `💡 **ANTIGRAVITY CẦN SẾP XÁC NHẬN ĐỀ XUẤT:**\n\n` +
            `📌 **Task:** ${title}\n` +
            `📝 **Đề xuất:** ${proposalText.substring(0, 300)}...\n\n` +
            `Sếp có đồng ý để Antigravity tiếp tục không ạ?`;
        const kb = {
            inline_keyboard: [
                [
                    { text: '✅ ĐỒNG Ý TRIỂN KHAI', callback_data: `confirm_task_${taskId}` },
                    { text: '❌ TỪ CHỐI', callback_data: `reject_task_${taskId}` }
                ]
            ]
        };
        return this.sendMessageWithKeyboard(chatId, text, kb, botToken);
    }
    /**
     * Gửi tin nhắn thoại qua Telegram Bot tới Sếp Nam
     */
    async sendVoiceNotification(voiceText, taskTitle) {
        try {
            const enabled = db.getSetting('telegram_enabled');
            if (enabled === 'false')
                return false;
            const botToken = this.getBotToken();
            const chatId = this.getChatId();
            if (!botToken || !chatId)
                return false;
            const audioBuffer = await this.getTtsBuffer(voiceText);
            const formData = new FormData();
            formData.append('chat_id', chatId.trim());
            formData.append('caption', `🎉 Sếp Nam ơi: ${taskTitle}\n\n💬 ${voiceText}`);
            const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
            formData.append('voice', blob, 'sep_ai_voice.mp3');
            const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendVoice`, {
                method: 'POST',
                body: formData
            });
            const resData = (await res.json());
            return resData.ok;
        }
        catch (_) {
            return false;
        }
    }
    async sendTestVoice(botToken, chatId) {
        try {
            if (!botToken || !chatId) {
                return { success: false, error: 'Vui lòng nhập đầy đủ Bot Token và Chat ID.' };
            }
            const testText = 'Dạ em chào Sếp Nam! Đây là tin nhắn thoại thử nghiệm từ Nhân viên quèn qua Telegram ạ.';
            const audioBuffer = await this.getTtsBuffer(testText);
            const formData = new FormData();
            formData.append('chat_id', chatId.trim());
            formData.append('caption', '🧪 [Test Thông Báo Giọng Nói — Nhân viên quèn]\n\nDạ em chào Sếp Nam! Kết nối Telegram Bot thành công mỹ mãn rồi ạ.');
            const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
            formData.append('voice', blob, 'sep_ai_test_voice.mp3');
            const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendVoice`, {
                method: 'POST',
                body: formData
            });
            const resData = (await res.json());
            if (!resData.ok) {
                return { success: false, error: resData.description || 'Lỗi gửi tin nhắn Telegram' };
            }
            return { success: true };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, error: msg };
        }
    }
}
export const telegramService = new TelegramService();
//# sourceMappingURL=telegramService.js.map