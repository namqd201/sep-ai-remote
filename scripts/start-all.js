import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startTunnel } from './tunnel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Cấu hình múi giờ Việt Nam (UTC+7 / GMT+7)
process.env.TZ = 'Asia/Ho_Chi_Minh';

// Tìm địa chỉ IP LAN
let lanIp = '127.0.0.1';
const interfaces = os.networkInterfaces();
for (const iface of Object.values(interfaces)) {
  if (!iface) continue;
  for (const alias of iface) {
    if (alias.family === 'IPv4' && !alias.internal && !alias.address.startsWith('172.')) {
      lanIp = alias.address;
      break;
    }
  }
}

console.log('========================================================');
console.log('🚀 SẾP AI REMOTE — ĐIỀU KHIỂN ANTIGRAVITY BẰNG GIỌNG NÓI');
console.log('========================================================');
console.log(`💻 PC Localhost:             http://localhost:3000`);
console.log(`📱 Link Mạng Wi-Fi (LAN):    http://${lanIp}:3000`);
console.log(`🔑 Mã ghép đôi:              888999`);
console.log(`🕒 Múi giờ hệ thống:         Việt Nam (GMT+7, Asia/Ho_Chi_Minh)`);
console.log('--------------------------------------------------------');

// 1. Khởi động Backend
const backend = spawn('node', [path.join(rootDir, 'apps/backend/dist/index.js')], {
  stdio: 'inherit',
  shell: true,
  cwd: rootDir,
  env: { ...process.env, TZ: 'Asia/Ho_Chi_Minh' }
});

// 2. Khởi động Windows Bridge sau 1.5s
setTimeout(() => {
  const bridge = spawn('node', [path.join(rootDir, 'apps/windows-bridge/dist/index.js')], {
    stdio: 'inherit',
    shell: true,
    cwd: rootDir,
    env: { ...process.env, TZ: 'Asia/Ho_Chi_Minh' }
  });

  bridge.on('exit', (code) => {
    console.log(`[Process] Windows Bridge exited with code ${code}`);
  });
}, 1500);

// 3. Khởi động hoặc Tái sử dụng Tunnel cố định (Ngrok / Cloudflare)
startTunnel().catch((err) => {
  console.error('[Tunnel] Lỗi khởi chạy tunnel:', err.message);
});

// Khi backend thoát, giữ nguyên tunnel để không làm đổi link của Sếp
backend.on('exit', (code) => {
  console.log(`[Process] Backend exited with code ${code}`);
  process.exit(code || 0);
});
