import http from 'node:http';
import { Router } from 'express';

const router = Router();

// Kiểm tra trạng thái cổng local có đang mở không
router.get('/check/:port', (req, res) => {
  const port = parseInt(req.params.port, 10);
  if (!port || port < 1 || port > 65535) {
    res.status(400).json({ success: false, error: 'Cổng không hợp lệ' });
    return;
  }

  let responded = false;
  const sendResult = (active: boolean, statusCode?: number) => {
    if (responded || res.headersSent) return;
    responded = true;
    res.json({ success: true, active, statusCode });
  };

  const checkReq = http.request(
    {
      host: '127.0.0.1',
      port,
      method: 'GET',
      path: '/',
      timeout: 1500
    },
    (proxyRes) => {
      sendResult(true, proxyRes.statusCode);
      checkReq.destroy();
    }
  );

  checkReq.on('error', () => {
    sendResult(false);
  });

  checkReq.on('timeout', () => {
    checkReq.destroy();
    sendResult(false);
  });

  checkReq.end();
});

// Chuyển tiếp yêu cầu HTTP tới cổng local
router.all('/:port*', (req, res) => {
  const rawParams = req.params as Record<string, string>;
  const portStr = rawParams.port || rawParams['port*'] || Object.values(rawParams)[0] || '';
  const port = parseInt(portStr.replace(/[^0-9]/g, ''), 10);
  if (!port || port < 1 || port > 65535) {
    res.status(400).send('Cổng không hợp lệ');
    return;
  }

  // Lấy đường dẫn sau cổng
  const prefix = `/api/proxy/${port}`;
  let targetPath = req.originalUrl.startsWith(prefix) ? req.originalUrl.slice(prefix.length) : '/';
  if (!targetPath.startsWith('/')) {
    targetPath = '/' + targetPath;
  }

  const proxyHeaders = { ...req.headers };
  delete proxyHeaders['host'];
  proxyHeaders['host'] = `127.0.0.1:${port}`;

  const proxyReq = http.request(
    {
      host: '127.0.0.1',
      port,
      method: req.method,
      path: targetPath,
      headers: proxyHeaders
    },
    (proxyRes) => {
      if (res.headersSent) return;
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    if (res.headersSent) return;
    res.status(502).send(`[Sep AI Remote Proxy] Không thể kết nối tới dịch vụ local tại 127.0.0.1:${port} (${err.message}). Vui lòng đảm bảo web server đã được chạy.`);
  });

  req.pipe(proxyReq);
});

export default router;
