#!/usr/bin/env node

/**
 * Antigravity Lifecycle Hook Notifier
 * Được gọi bởi Antigravity khi có sự kiện vòng đời (Stop, PostToolUse...)
 * Đọc dữ liệu JSON từ stdin và POST tới Windows Bridge HookServer trên 127.0.0.1:59123
 */

const http = require('node:http');

let input = '';
process.stdin.setEncoding('utf-8');

process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const req = http.request(
      'http://127.0.0.1:59123/hook',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(input)
        },
        timeout: 1000
      },
      () => {
        // Output empty json to satisfy hook contract
        process.stdout.write(JSON.stringify({ decision: 'allow' }));
        process.exit(0);
      }
    );

    req.on('error', () => {
      // Nếu Bridge chưa chạy, vẫn thoát bình thường để không block agent loop
      process.stdout.write(JSON.stringify({ decision: 'allow' }));
      process.exit(0);
    });

    req.write(input);
    req.end();
  } catch (err) {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }
});
