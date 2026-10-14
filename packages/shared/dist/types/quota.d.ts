export interface QuotaBucket {
    bucketId: string;
    displayName: string;
    description: string;
    window: string;
    remainingFraction: number;
    percentage: number;
    disabled: boolean;
    resetTimeEpochSeconds?: number;
    resetTimeFormatted?: string;
}
export interface QuotaGroup {
    displayName: string;
    description: string;
    buckets: QuotaBucket[];
}
export interface AntigravityQuotaSummary {
    userEmail?: string;
    planName?: string;
    upgradeText?: string;
    upgradeSubscriptionUri?: string;
    groups: QuotaGroup[];
    description?: string;
    lastUpdated: string;
    isLive: boolean;
    statusMessage?: string;
}
//# sourceMappingURL=quota.d.ts.map