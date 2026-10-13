import http from 'node:http';
import { config } from '../config.js';
import { antigravityAdapter } from '../adapter/AntigravityAdapter.js';

export class HookServer {
  private server: http.Server | null = null;

  public start(): void {
    this.server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/hook') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.conversationId) {
              antigravityAdapter.handleDirectHookStop({
                conversationId: data.conversationId,
                terminationReason: data.terminationReason,
                error: data.error,
                fullyIdle: data.fullyIdle
              });
            }
          } catch (err) {
            console.error('[HookServer] Lỗi xử lý hook payload:', err);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ decision: 'allow' }));
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.server.listen(config.hookPort, '127.0.0.1', () => {
      console.log(`[HookServer] Endpoint nhận hook cục bộ đang chạy tại http://127.0.0.1:${config.hookPort}/hook`);
    });
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

export const hookServer = new HookServer();
