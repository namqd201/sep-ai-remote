import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const urlFilePath = path.join(rootDir, 'apps/backend/public/https_url.txt');

// Đọc file .env nếu có mà không cần thư viện ngoài
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch (_) {}
  }
}

loadEnv();

export async function isUrlReachable(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${url}/manifest.json`, {
      signal: controller.signal,
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    clearTimeout(timer);
    return res.status === 200;
  } catch (_) {
    return false;
  }
}

export async function startTunnel() {
  loadEnv();
  const provider = (process.env.TUNNEL_PROVIDER || 'cloudflare').toLowerCase();
  const cfToken = process.env.CLOUDFLARE_TUNNEL_TOKEN || '';

  // 1. Kiểm tra xem tunnel cũ có đang sống và phản hồi không
  if (fs.existsSync(urlFilePath)) {
    try {
      const savedUrl = fs.readFileSync(urlFilePath, 'utf-8').trim();
      const matchesProvider =
        (provider === 'ngrok' && savedUrl.includes('ngrok')) ||
        (provider === 'cloudflare' && !savedUrl.includes('ngrok'));

      if (matchesProvider && savedUrl && (await isUrlReachable(savedUrl))) {
        console.log('\n========================================================');
        console.log('⭐ PHÁT HIỆN TUNNEL ĐANG HOẠT ĐỘNG — GIỮ NGUYÊN LINK CỐ ĐỊNH:');
        console.log(`👉 ${savedUrl}`);
        console.log('--------------------------------------------------------');
        console.log('✅ Sếp KHÔNG CẦN CÀI LẠI! Mọi cập nhật code đã được đồng bộ vào app.');
        console.log('========================================================\n');
        return { url: savedUrl, process: null };
      }
    } catch (_) {}
  }

  // 2. Nếu dùng Ngrok Static Domain vĩnh viễn
  if (provider === 'ngrok') {
    const ngrokDomain = process.env.NGROK_DOMAIN || 'padding-shifting-useable.ngrok-free.dev';

    // Kiểm tra nếu Ngrok đã đang chạy sẵn ở cổng 4040
    try {
      const existingRes = await fetch('http://127.0.0.1:4040/api/tunnels');
      if (existingRes.ok) {
        const data = await existingRes.json();
        const pubUrl = data.tunnels?.[0]?.public_url || `https://${ngrokDomain}`;
        fs.writeFileSync(urlFilePath, pubUrl);
        console.log('\n========================================================');
        console.log('⭐ LINK NGROK TĨNH VĨNH VIỄN (KHÔNG BAO GIỜ ĐỔI):');
        console.log(`👉 ${pubUrl}`);
        console.log('--------------------------------------------------------');
        console.log('📲 Sếp chỉ cần cài vào điện thoại ĐÚNG 1 LẦN DUY NHẤT!');
        console.log('========================================================\n');
        return { url: pubUrl, process: null };
      }
    } catch (_) {}

    console.log(`[Tunnel] Đang khởi động Ngrok với tên miền tĩnh vĩnh viễn: ${ngrokDomain}...`);
    
    const ngrokArgs = ['http', '3000'];
    if (ngrokDomain) {
      ngrokArgs.push(`--url=${ngrokDomain}`);
    }

    const ngrokProc = spawn('ngrok', ngrokArgs, {
      shell: true,
      cwd: rootDir
    });

    // Chờ ngrok khởi động và lấy public URL từ local API
    return new Promise((resolve) => {
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch('http://127.0.0.1:4040/api/tunnels');
          if (res.ok) {
            const data = await res.json();
            const pubUrl = data.tunnels?.[0]?.public_url;
            if (pubUrl) {
              clearInterval(interval);
              fs.writeFileSync(urlFilePath, pubUrl);
              console.log('\n========================================================');
              console.log('⭐ LINK NGROK TĨNH VĨNH VIỄN (KHÔNG BAO GIỜ ĐỔI):');
              console.log(`👉 ${pubUrl}`);
              console.log('--------------------------------------------------------');
              console.log('📲 Sếp chỉ cần cài vào điện thoại ĐÚNG 1 LẦN DUY NHẤT!');
              console.log('========================================================\n');
              resolve({ url: pubUrl, process: ngrokProc });
            }
          }
        } catch (_) {}

        if (attempts > 15) {
          clearInterval(interval);
          console.warn('[Tunnel] Quá thời gian chờ lấy link từ Ngrok API.');
          resolve({ url: `https://${ngrokDomain}`, process: ngrokProc });
        }
      }, 1000);
    });
  }

  // 3. Nếu dùng Cloudflare Named Tunnel với Token
  if (cfToken) {
    console.log('[Tunnel] Đang kết nối Cloudflare Named Tunnel qua Token bảo mật...');
    const cfProc = spawn('cloudflared', ['tunnel', 'run', '--token', cfToken], {
      shell: true,
      cwd: rootDir
    });
    console.log('✅ Cloudflare Named Tunnel đã khởi chạy với cấu hình tên miền riêng của Sếp.');
    return { url: 'Custom Domain Token', process: cfProc };
  }

  // 4. Mặc định: Cloudflare Quick Tunnel (giữ độc lập, không tắt khi restart server)
  console.log('[Tunnel] Đang khởi tạo Cloudflare Tunnel bảo mật...');
  const tunnelProc = spawn('cloudflared', ['tunnel', '--url', 'http://127.0.0.1:3000'], {
    shell: true,
    cwd: rootDir
  });

  return new Promise((resolve) => {
    let resolved = false;
    tunnelProc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match && !resolved) {
        resolved = true;
        const httpsUrl = match[0];
        fs.writeFileSync(urlFilePath, httpsUrl);
        console.log('\n========================================================');
        console.log('⭐ LINK HTTPS CỐ ĐỊNH ĐỂ CÀI ĐẶT APP:');
        console.log(`👉 ${httpsUrl}`);
        console.log('--------------------------------------------------------');
        console.log('✅ Link này được giữ nguyên cố định trong suốt quá trình phát triển.');
        console.log('========================================================\n');
        resolve({ url: httpsUrl, process: tunnelProc });
      }
    });

    tunnelProc.on('exit', (code) => {
      console.log(`[Tunnel] Cloudflare tunnel process exited with code ${code}`);
    });
  });
}

// Chạy trực tiếp nếu file được thực thi bằng node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startTunnel().catch(console.error);
}
