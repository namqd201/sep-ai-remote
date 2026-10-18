import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  ScreenStreamConfig,
  RemoteInputPayload,
  ScreenFramePayload
} from '@sep-ai/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../..');
const streamerScriptPath = path.join(rootDir, 'scripts/screen_streamer.py');

export class RemoteControlService {
  private static instance: RemoteControlService;
  private process: ChildProcess | null = null;
  private isStreamActive = false;
  private screenWidth = 1920;
  private screenHeight = 1080;
  private frameListeners: ((frame: ScreenFramePayload) => void)[] = [];
  private isStarting = false;

  private constructor() {
    this.ensureProcess();
  }

  public static getInstance(): RemoteControlService {
    if (!RemoteControlService.instance) {
      RemoteControlService.instance = new RemoteControlService();
    }
    return RemoteControlService.instance;
  }

  private ensureProcess(): void {
    if (this.process && !this.process.killed) return;
    if (this.isStarting) return;
    this.isStarting = true;

    try {
      this.process = spawn('python', [streamerScriptPath], {
        cwd: rootDir,
        stdio: ['pipe', 'pipe', 'inherit']
      });

      if (!this.process.stdout || !this.process.stdin) {
        console.error('[RemoteControl] Không thể mở stdin/stdout cho screen_streamer.py');
        this.isStarting = false;
        return;
      }

      const rl = readline.createInterface({
        input: this.process.stdout,
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const msg = JSON.parse(trimmed);
          if (msg.event === 'frame') {
            const framePayload: ScreenFramePayload = {
              frame: msg.data,
              width: msg.w,
              height: msg.h,
              timestamp: msg.ts || Date.now()
            };
            for (const listener of this.frameListeners) {
              try {
                listener(framePayload);
              } catch (err) {
                console.error('[RemoteControl] Lỗi trong frame listener:', err);
              }
            }
          } else if (msg.event === 'ready') {
            this.screenWidth = msg.screenWidth || 1920;
            this.screenHeight = msg.screenHeight || 1080;
            console.log(`[RemoteControl] Screen Streamer đã sẵn sàng! Màn hình: ${this.screenWidth}x${this.screenHeight}`);
          } else if (msg.event === 'started') {
            this.isStreamActive = true;
            console.log('[RemoteControl] Bắt đầu stream màn hình tới Mobile!');
          } else if (msg.event === 'stopped') {
            this.isStreamActive = false;
            console.log('[RemoteControl] Đã dừng stream màn hình.');
          }
        } catch (_) {}
      });

      this.process.on('exit', (code) => {
        console.warn(`[RemoteControl] screen_streamer.py thoát với mã ${code}. Đang tự động khởi động lại...`);
        this.process = null;
        this.isStreamActive = false;
        this.isStarting = false;
        setTimeout(() => this.ensureProcess(), 2000);
      });

      this.process.on('error', (err) => {
        console.error('[RemoteControl] Lỗi tiến trình screen_streamer.py:', err.message);
        this.isStarting = false;
      });

      this.isStarting = false;
    } catch (err) {
      console.error('[RemoteControl] Không thể khởi chạy screen_streamer.py:', err);
      this.isStarting = false;
    }
  }

  public subscribeFrames(listener: (frame: ScreenFramePayload) => void): () => void {
    this.frameListeners.push(listener);
    return () => {
      this.frameListeners = this.frameListeners.filter((l) => l !== listener);
    };
  }

  public startStream(config: ScreenStreamConfig = {}): void {
    this.ensureProcess();
    if (!this.process || !this.process.stdin || this.process.stdin.destroyed) return;

    const cmd = {
      cmd: 'start',
      fps: config.fps || 15,
      quality: config.quality || 60,
      scale: config.scale || 0.67
    };
    this.process.stdin.write(JSON.stringify(cmd) + '\n');
  }

  public stopStream(): void {
    if (!this.process || !this.process.stdin || this.process.stdin.destroyed) return;
    this.process.stdin.write(JSON.stringify({ cmd: 'stop' }) + '\n');
    this.isStreamActive = false;
  }

  public updateConfig(config: ScreenStreamConfig): void {
    if (!this.process || !this.process.stdin || this.process.stdin.destroyed) return;
    this.process.stdin.write(JSON.stringify({ cmd: 'config', ...config }) + '\n');
  }

  public sendInput(payload: RemoteInputPayload): void {
    this.ensureProcess();
    if (!this.process || !this.process.stdin || this.process.stdin.destroyed) return;

    const cmd: Record<string, unknown> = {
      cmd: payload.action,
      ...payload
    };
    this.process.stdin.write(JSON.stringify(cmd) + '\n');
  }

  public isStreaming(): boolean {
    return this.isStreamActive;
  }

  public getScreenSize(): { width: number; height: number } {
    return { width: this.screenWidth, height: this.screenHeight };
  }

  public destroy(): void {
    this.stopStream();
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

export const remoteControlService = RemoteControlService.getInstance();
