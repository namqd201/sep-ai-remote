export interface QuotaBucket {
  bucketId: string;
  displayName: string;
  description: string;
  window: string; // e.g. "weekly", "5h"
  remainingFraction: number; // 0.0 - 1.0
  percentage: number; // 0 - 100
  disabled: boolean;
  resetTimeEpochSeconds?: number;
  resetTimeFormatted?: string; // e.g. "6 giờ 29 phút", "4 ngày 9 giờ"
}

export interface QuotaGroup {
  displayName: string; // e.g. "Gemini Models", "Claude and GPT models"
  description: string;
  buckets: QuotaBucket[];
}

export interface AntigravityQuotaSummary {
  userEmail?: string;
  planName?: string; // e.g. "Google AI Pro"
  upgradeText?: string;
  upgradeSubscriptionUri?: string;
  groups: QuotaGroup[];
  description?: string;
  lastUpdated: string; // ISO string
  isLive: boolean; // true if connected directly to active Antigravity session
  statusMessage?: string;
}
