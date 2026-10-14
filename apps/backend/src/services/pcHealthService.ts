import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface DiskInfo {
  drive: string;
  totalGb: number;
  freeGb: number;
  usedGb: number;
  percent: number;
}

export interface PcHealthData {
  cpu: {
    percent: number;
    model: string;
    cores: number;
  };
  memory: {
    totalGb: number;
    freeGb: number;
    usedGb: number;
    percent: number;
  };
  disks: DiskInfo[];
  uptime: {
    seconds: number;
    formatted: string;
  };
  platform: {
    hostname: string;
    osType: string;
    release: string;
  };
  timestamp: string;
}

export class PcHealthService {
  public static async getCpuUsage(): Promise<number> {
    const cpus1 = os.cpus();
    return new Promise((resolve) => {
      setTimeout(() => {
        const cpus2 = os.cpus();
        let idleDiff = 0;
        let totalDiff = 0;
        for (let i = 0; i < cpus1.length; i++) {
          const c1 = cpus1[i].times;
          const c2 = cpus2[i].times;
          const idle1 = c1.idle;
          const idle2 = c2.idle;
          const total1 = c1.user + c1.nice + c1.sys + c1.idle + c1.irq;
          const total2 = c2.user + c2.nice + c2.sys + c2.idle + c2.irq;
          idleDiff += idle2 - idle1;
          totalDiff += total2 - total1;
        }
        const usage = totalDiff > 0 ? 100 - Math.round((100 * idleDiff) / totalDiff) : 0;
        resolve(Math.max(0, Math.min(100, usage)));
      }, 250);
    });
  }

  public static getDisksInfo(): DiskInfo[] {
    const drives = ['C:/', 'D:/', 'E:/', 'F:/'];
    const result: DiskInfo[] = [];
    for (const d of drives) {
      try {
        if (fs.existsSync(d)) {
          const s = fs.statfsSync(d);
          const total = (s.blocks * s.bsize) / (1024 * 1024 * 1024);
          const free = (s.bfree * s.bsize) / (1024 * 1024 * 1024);
          const used = total - free;
          if (total > 0) {
            result.push({
              drive: d.replace('/', ''),
              totalGb: Math.round(total * 10) / 10,
              freeGb: Math.round(free * 10) / 10,
              usedGb: Math.round(used * 10) / 10,
              percent: Math.round((used / total) * 100)
            });
          }
        }
      } catch (_) {}
    }
    return result;
  }

  public static formatUptime(seconds: number): string {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d} ngày ${h}h ${m}m`;
    if (h > 0) return `${h} giờ ${m} phút`;
    return `${m} phút`;
  }

  public static async getHealthData(): Promise<PcHealthData> {
    const cpuPercent = await this.getCpuUsage();
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const uptimeSec = os.uptime();

    return {
      cpu: {
        percent: cpuPercent,
        model: cpus.length > 0 ? cpus[0].model.trim() : 'Intel / AMD',
        cores: cpus.length
      },
      memory: {
        totalGb: Math.round((totalMem / (1024 * 1024 * 1024)) * 10) / 10,
        freeGb: Math.round((freeMem / (1024 * 1024 * 1024)) * 10) / 10,
        usedGb: Math.round((usedMem / (1024 * 1024 * 1024)) * 10) / 10,
        percent: Math.round((usedMem / totalMem) * 100)
      },
      disks: this.getDisksInfo(),
      uptime: {
        seconds: Math.floor(uptimeSec),
        formatted: this.formatUptime(uptimeSec)
      },
      platform: {
        hostname: os.hostname(),
        osType: os.type(),
        release: os.release()
      },
      timestamp: new Date().toISOString()
    };
  }

  public static async captureScreen(): Promise<{ success: boolean; url?: string; error?: string }> {
    const scriptPath = path.resolve(process.cwd(), 'scripts/capture_screen.py');
    try {
      await execFileAsync('python', [scriptPath]);
      return {
        success: true,
        url: `/uploads/pc_screen.png?t=${Date.now()}`
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }
}
