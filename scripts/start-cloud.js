import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Cấu hình múi giờ Việt Nam (GMT+7)
process.env.TZ = 'Asia/Ho_Chi_Minh';
process.env.NODE_ENV = 'production';

console.log('========================================================');
console.log('🚀 SẾP AI REMOTE — KHỞI CHẠY CLOUD BACKEND');
console.log('========================================================');
console.log(`🕒 Múi giờ: Việt Nam (GMT+7, Asia/Ho_Chi_Minh)`);
console.log(`🌐 Cổng lắng nghe (PORT): ${process.env.PORT || 3000}`);
console.log('--------------------------------------------------------');

const backendDist = path.join(rootDir, 'apps/backend/dist/index.js');

// 1. Tự động biên dịch nếu chưa có file dist
if (!fs.existsSync(backendDist)) {
  console.log('[Cloud Build] Đang tự động biên dịch TypeScript cho Backend...');
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

// 2. Khởi chạy duy nhất Backend Express & WebSockets
const backend = spawn('node', [backendDist], {
  stdio: 'inherit',
  cwd: rootDir,
  env: {
    ...process.env,
    TZ: 'Asia/Ho_Chi_Minh',
    NODE_ENV: 'production'
  }
});

backend.on('exit', (code) => {
  console.log(`[Cloud Process] Backend đã thoát với mã ${code}`);
  process.exit(code || 0);
});
