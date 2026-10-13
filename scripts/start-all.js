import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Cấu hình múi giờ Việt Nam (UTC+7 / GMT+7)
process.env.TZ = 'Asia/Ho_Chi_Minh';

// KIỂM TRA MÔI TRƯỜNG CLOUD / LINUX (BOTKEEP, DOCKER, VPS)
const isCloudEnvironment = process.platform === 'linux' || process.env.IS_CLOUD === 'true' || process.env.NODE_ENV === 'production';

if (isCloudEnvironment) {
  console.log('========================================================');
  console.log('🚀 SẾP AI REMOTE — PHÁT HIỆN MÔI TRƯỜNG CLOUD / LINUX');
  console.log('========================================================');
  console.log(`🕒 Múi giờ: Việt Nam (GMT+7, Asia/Ho_Chi_Minh)`);
  console.log(`🌐 Cổng lắng nghe (PORT): ${process.env.PORT || process.env.SERVER_PORT || 3000}`);
  console.log('--------------------------------------------------------');

  const backendDist = path.join(rootDir, 'apps/backend/dist/index.js');
  if (!fs.existsSync(backendDist)) {
    console.log('[Cloud Build] Đang tự động biên dịch TypeScript...');
    try {
      const { execSync } = await import('node:child_process');
      execSync('npx tsc -p packages/shared/tsconfig.json && npx tsc -p apps/backend/tsconfig.json', {
        cwd: rootDir,
        stdio: 'inherit'
      });
      console.log('✅ [Cloud Build] Biên dịch hoàn tất!');
    } catch (err) {
      console.error('❌ [Cloud Build] Lỗi biên dịch:', err.message);
    }
  }

  // Trên Cloud: Chỉ khởi động duy nhất Backend Express & WebSockets
  const backend = spawn('node', [backendDist], {
    stdio: 'inherit',
    cwd: rootDir,
    env: { ...process.env, TZ: 'Asia/Ho_Chi_Minh' }
  });

  backend.on('exit', (code) => {
    console.log(`[Cloud Process] Backend đã dừng với mã ${code}`);
    process.exit(code || 0);
  });
} else {
  // MÔI TRƯỜNG MÁY TÍNH CÁ NHÂN (WINDOWS)
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
  console.log('🚀 NHÂN VIÊN QUÈN — BÁO CÁO CÔNG VIỆC CHO SẾP NAM');
  console.log('========================================================');
  console.log(`💻 PC Localhost:             http://localhost:3000`);
  console.log(`📱 Link Mạng Wi-Fi (LAN):    http://${lanIp}:3000`);
  console.log(`🔑 Mã ghép đôi:              888999`);
  console.log(`🕒 Múi giờ hệ thống:         Việt Nam (GMT+7, Asia/Ho_Chi_Minh)`);
  console.log('--------------------------------------------------------');

  const backend = spawn('node', [path.join(rootDir, 'apps/backend/dist/index.js')], {
    stdio: 'inherit',
    shell: true,
    cwd: rootDir,
    env: { ...process.env, TZ: 'Asia/Ho_Chi_Minh' }
  });

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

  import('./tunnel.js').then((m) => {
    m.startTunnel().catch((err) => {
      console.error('[Tunnel] Lỗi khởi chạy tunnel:', err.message);
    });
  });

  backend.on('exit', (code) => {
    console.log(`[Process] Backend exited with code ${code}`);
    process.exit(code || 0);
  });
}
