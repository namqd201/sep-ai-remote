import http from 'node:http';
import { app } from './app.js';
import { config } from './config.js';
import { wsGateway } from './services/wsGateway.js';
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
});
export { server };
//# sourceMappingURL=index.js.map