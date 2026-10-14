import http from 'node:http';
import { app } from './app.js';
import { config } from './config.js';
import { db } from './db/database.js';
import { wsGateway } from './services/wsGateway.js';
import { telegramService } from './services/telegramService.js';
// Dọn dẹp task mồ côi từ phiên trước khi server backend khởi động
db.cleanupOrphanedTasksOnStartup();
const server = http.createServer(app);
// Khởi động WebSocket Gateway
wsGateway.init(server);
server.listen(config.port, config.host, () => {
    console.log(`====================================================`);
    console.log(`🚀 SẾP AI REMOTE BACKEND ĐÃ KHỞI CHẠY THÀNH CÔNG!`);
    console.log(`📡 HTTP Server: http://${config.host}:${config.port}`);
    console.log(`⚡ WebSocket Server: ws://${config.host}:${config.port}/ws`);
    console.log(`🔑 Mã ghép đôi (Pairing Code): ${config.pairingCode}`);
    console.log(`====================================================`);
    // Bắt đầu lắng nghe Telegram 2 chiều
    telegramService.startPolling();
});
// Mở thêm cổng phụ 3000 nếu cổng chính khác 3000
if (config.port !== 3000) {
    try {
        const backupServer = http.createServer(app);
        wsGateway.init(backupServer);
        backupServer.listen(3000, config.host, () => {
            console.log(`📡 Cổng phụ (Backup): http://${config.host}:3000`);
        });
        backupServer.on('error', () => {
            // Bỏ qua nếu port 3000 không mở được
        });
    }
    catch (_) { }
}
export { server };
//# sourceMappingURL=index.js.map