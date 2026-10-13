import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('[Runner] Khởi động Sếp AI Remote Backend...');

const child = spawn('node', [path.join(rootDir, 'apps/backend/dist/index.js')], {
  stdio: 'inherit',
  shell: true,
  cwd: rootDir
});

child.on('exit', (code) => {
  console.log(`[Runner] Backend đã dừng với mã thoát ${code}`);
  process.exit(code || 0);
});
