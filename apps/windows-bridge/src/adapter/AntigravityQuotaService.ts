import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  AntigravityQuotaSummary,
  QuotaGroup,
  QuotaBucket,
  getVietnamNowIso
} from '@sep-ai/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheFilePath = path.resolve(__dirname, '../../../data/quota_cache.json');

export class AntigravityQuotaService {
  private static instance: AntigravityQuotaService;
  private cachedQuota: AntigravityQuotaSummary | null = null;
  private devToolsActivePortPath = path.join(
    process.env.APPDATA || path.join(process.env.USERPROFILE || os.homedir(), 'AppData', 'Roaming'),
    'Antigravity',
    'DevToolsActivePort'
  );
  private appStoragePath = path.join(
    process.env.APPDATA || path.join(process.env.USERPROFILE || os.homedir(), 'AppData', 'Roaming'),
    'Antigravity',
    'app_storage.json'
  );
  private isFetching = false;

  private constructor() {
    this.loadCacheFromDisk();
  }

  public static getInstance(): AntigravityQuotaService {
    if (!AntigravityQuotaService.instance) {
      AntigravityQuotaService.instance = new AntigravityQuotaService();
    }
    return AntigravityQuotaService.instance;
  }

  private loadCacheFromDisk(): void {
    try {
      if (fs.existsSync(cacheFilePath)) {
        const raw = fs.readFileSync(cacheFilePath, 'utf-8');
        this.cachedQuota = JSON.parse(raw);
      }
    } catch (_) {}
  }

  private saveCacheToDisk(quota: AntigravityQuotaSummary): void {
    try {
      const dir = path.dirname(cacheFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(cacheFilePath, JSON.stringify(quota, null, 2), 'utf-8');
    } catch (_) {}
  }

  private getUserEmail(): string {
    try {
      if (fs.existsSync(this.appStoragePath)) {
        const data = JSON.parse(fs.readFileSync(this.appStoragePath, 'utf-8'));
        if (data['jetski.onboarding.lastLoginUsername']) {
          return String(data['jetski.onboarding.lastLoginUsername']);
        }
      }
    } catch (_) {}
    return '';
  }

  private formatResetTime(epochSeconds?: number): string {
    if (!epochSeconds) return '';
    const diffMs = epochSeconds * 1000 - Date.now();
    if (diffMs <= 0) return 'Đầy lại ngay';

    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const mins = totalMinutes % 60;

    if (days > 0) {
      return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
    }
    if (hours > 0) {
      return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
    }
    if (mins > 0) {
      return `${mins} phút`;
    }
    return '< 1 phút';
  }

  public async getQuotaSummary(forceRefresh = false): Promise<AntigravityQuotaSummary> {
    if (this.cachedQuota && !forceRefresh) {
      const cacheAgeMs = Date.now() - new Date(this.cachedQuota.lastUpdated).getTime();
      // Cache hợp lệ trong vòng 15 giây
      if (cacheAgeMs < 15000) {
        return this.cachedQuota;
      }
    }

    if (this.isFetching && this.cachedQuota) {
      return this.cachedQuota;
    }

    this.isFetching = true;
    try {
      const liveData = await this.fetchLiveQuotaFromAntigravity();
      this.cachedQuota = liveData;
      this.saveCacheToDisk(liveData);
      return liveData;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[QuotaService] Không thể kết nối live Antigravity DevTools:', errMsg);

      if (this.cachedQuota) {
        return {
          ...this.cachedQuota,
          isLive: false,
          statusMessage: 'Antigravity đang đóng (Dữ liệu lưu gần nhất)'
        };
      }

      // Trả về dữ liệu mặc định nếu chưa từng lấy được
      const defaultQuota: AntigravityQuotaSummary = {
        userEmail: this.getUserEmail(),
        planName: 'Google AI Pro',
        upgradeText: 'You can upgrade to a Google AI Ultra plan to receive higher rate limits.',
        groups: [
          {
            displayName: 'Gemini Models',
            description: 'Models within this group: Gemini Flash, Gemini Pro',
            buckets: [
              {
                bucketId: 'gemini-weekly',
                displayName: 'Weekly Limit Remaining',
                description: 'Đang chờ kết nối Antigravity...',
                window: 'weekly',
                remainingFraction: 0.15,
                percentage: 15,
                disabled: false
              },
              {
                bucketId: 'gemini-5h',
                displayName: 'Five Hour Limit Remaining',
                description: 'Đang chờ kết nối Antigravity...',
                window: '5h',
                remainingFraction: 0.95,
                percentage: 95,
                disabled: false
              }
            ]
          },
          {
            displayName: 'Claude and GPT models',
            description: 'Models within this group: Claude Opus, Claude Sonnet, GPT-OSS',
            buckets: [
              {
                bucketId: '3p-weekly',
                displayName: 'Weekly Limit Remaining',
                description: 'Đang chờ kết nối Antigravity...',
                window: 'weekly',
                remainingFraction: 0.43,
                percentage: 43,
                disabled: false
              },
              {
                bucketId: '3p-5h',
                displayName: 'Five Hour Limit Remaining',
                description: 'Đầy 100%',
                window: '5h',
                remainingFraction: 1.0,
                percentage: 100,
                disabled: false
              }
            ]
          }
        ],
        lastUpdated: getVietnamNowIso(),
        isLive: false,
        statusMessage: 'Chưa kết nối phiên Antigravity'
      };

      return defaultQuota;
    } finally {
      this.isFetching = false;
    }
  }

  private async fetchLiveQuotaFromAntigravity(): Promise<AntigravityQuotaSummary> {
    if (!fs.existsSync(this.devToolsActivePortPath)) {
      throw new Error('DevToolsActivePort không tồn tại. Antigravity có thể chưa bật.');
    }

    const portInfo = fs.readFileSync(this.devToolsActivePortPath, 'utf-8').split('\n');
    const port = portInfo[0].trim();
    if (!port) {
      throw new Error('Cổng DevTools trống.');
    }

    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) });
    if (!listRes.ok) {
      throw new Error(`DevTools HTTP ${listRes.status}`);
    }

    const targets = (await listRes.json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
    const pageTarget = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!pageTarget) {
      throw new Error('Không tìm thấy trang Antigravity trong danh sách DevTools targets.');
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
      const timer = setTimeout(() => {
        try { ws.close(); } catch (_) {}
        reject(new Error('DevTools query timeout sau 6 giây'));
      }, 6000);

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            id: 101,
            method: 'Runtime.evaluate',
            params: {
              expression: `
                (async () => {
                  try {
                    const rootEl = document.querySelector('#root');
                    const fiberKey = Object.keys(rootEl || {}).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
                    let rootFiber = rootEl ? rootEl[fiberKey] : null;
                    let found = null;
                    let queue = [rootFiber];
                    let visited = new Set();
                    while (queue.length > 0) {
                      const fiber = queue.shift();
                      if (!fiber || visited.has(fiber)) continue;
                      visited.add(fiber);
                      const props = fiber.memoizedProps;
                      if (props?.value?.retrieveUserQuotaSummary) {
                        found = props.value;
                        break;
                      }
                      if (fiber.child) queue.push(fiber.child);
                      if (fiber.sibling) queue.push(fiber.sibling);
                    }

                    if (!found) return JSON.stringify({ success: false, error: 'Service not found in React tree' });

                    const quotaRes = await found.retrieveUserQuotaSummary({});
                    let userStatus = null;
                    try {
                      userStatus = await found.getUserStatus({});
                    } catch (_) {}

                    return JSON.stringify({
                      success: true,
                      quota: quotaRes?.response,
                      userStatus: userStatus?.response
                    }, (k, v) => typeof v === 'bigint' ? v.toString() : v);
                  } catch (err) {
                    return JSON.stringify({ success: false, error: err.message });
                  }
                })()
              `,
              awaitPromise: true,
              returnByValue: true
            }
          })
        );
      });

      ws.on('message', (raw) => {
        clearTimeout(timer);
        try { ws.close(); } catch (_) {}

        try {
          const msg = JSON.parse(raw.toString());
          const jsonVal = msg.result?.result?.value;
          if (!jsonVal) {
            reject(new Error('DevTools trả về kết quả rỗng'));
            return;
          }

          const parsed = JSON.parse(jsonVal);
          if (!parsed.success) {
            reject(new Error(parsed.error || 'Evaluation error'));
            return;
          }

          const quotaData = parsed.quota;
          const userStatusData = parsed.userStatus;
          const userTier = userStatusData?.userTier;

          const groups: QuotaGroup[] = [];
          for (const g of quotaData?.groups || []) {
            const buckets: QuotaBucket[] = [];
            for (const b of g.buckets || []) {
              const fraction = typeof b.remaining?.value === 'number' ? b.remaining.value : 0;
              const percentage = Math.round(fraction * 100);
              const resetSeconds = b.resetTime?.seconds ? parseInt(b.resetTime.seconds, 10) : undefined;
              buckets.push({
                bucketId: b.bucketId || '',
                displayName: b.displayName || '',
                description: b.description || (percentage === 100 ? 'Đầy 100%' : ''),
                window: b.window || '',
                remainingFraction: fraction,
                percentage,
                disabled: !!b.disabled,
                resetTimeEpochSeconds: resetSeconds,
                resetTimeFormatted: this.formatResetTime(resetSeconds)
              });
            }
            groups.push({
              displayName: g.displayName || '',
              description: g.description || '',
              buckets
            });
          }

          const summary: AntigravityQuotaSummary = {
            userEmail: this.getUserEmail(),
            planName: userTier?.name || 'Google AI Pro',
            upgradeText: userTier?.upgradeSubscriptionText || 'You can upgrade to a Google AI Ultra plan to receive higher rate limits.',
            upgradeSubscriptionUri: userTier?.upgradeSubscriptionUri || 'https://antigravity.google/g1-upgrade',
            groups,
            description: quotaData?.description || 'Within each group, models share a weekly limit and a 5-hour limit.',
            lastUpdated: getVietnamNowIso(),
            isLive: true
          };

          resolve(summary);
        } catch (e) {
          reject(e);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}

export const antigravityQuotaService = AntigravityQuotaService.getInstance();
