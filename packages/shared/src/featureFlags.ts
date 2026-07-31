/**
 * FeatureFlagService — WO-030: Gate illustrative results behind audited feature flags.
 *
 * Provides a type-safe feature flag system with:
 * - Per-user/per-environment overrides
 * - Audit trail for every flag evaluation
 * - Built-in "ILLUSTRATIVE_RESULTS" flag for AI-generated content
 */

export type FlagKey =
  | "ILLUSTRATIVE_RESULTS"      // AI-generated/estimated prices shown
  | "STREAMING_CHAT"            // Streaming AI chat enabled
  | "MULTI_CURRENCY_DISPLAY"    // Multi-currency UI
  | "EXPERIMENTAL_RANKING"      // A/B preference ranker
  | "PDF_TRIP_DOCUMENTS";       // Trip PDF generation

export interface FlagContext {
  userId?: string;
  environment: string;
  userAttributes?: Record<string, string | boolean | number>;
}

export interface FlagAuditRecord {
  flagKey: FlagKey;
  enabled: boolean;
  context: FlagContext;
  evaluatedAt: Date;
  ruleApplied: string;
}

export interface FlagAuditStore {
  record(entry: FlagAuditRecord): Promise<void>;
}

export class InMemoryFlagAuditStore implements FlagAuditStore {
  readonly records: FlagAuditRecord[] = [];
  async record(entry: FlagAuditRecord): Promise<void> {
    this.records.push(entry);
  }
}

export interface FlagDefinition {
  defaultValue: boolean;
  description: string;
  // Optional rollout percentage (0-100)
  rolloutPct?: number;
}

export const DEFAULT_FLAGS: Record<FlagKey, FlagDefinition> = {
  ILLUSTRATIVE_RESULTS:   { defaultValue: false, description: "Show AI-estimated prices with disclaimer", rolloutPct: 0 },
  STREAMING_CHAT:         { defaultValue: true,  description: "Enable streaming AI assistant responses" },
  MULTI_CURRENCY_DISPLAY: { defaultValue: true,  description: "Show prices in user's preferred currency" },
  EXPERIMENTAL_RANKING:   { defaultValue: false, description: "Use ML-based preference ranking", rolloutPct: 10 },
  PDF_TRIP_DOCUMENTS:     { defaultValue: false, description: "Enable PDF trip itinerary generation", rolloutPct: 100 },
};

export class FeatureFlagService {
  constructor(
    private readonly audit: FlagAuditStore,
    private readonly flags: Record<FlagKey, FlagDefinition> = DEFAULT_FLAGS,
    private readonly envOverrides: Partial<Record<FlagKey, boolean>> = {},
  ) {}

  async isEnabled(flagKey: FlagKey, ctx: FlagContext): Promise<boolean> {
    const def = this.flags[flagKey];
    if (!def) return false;

    // Environment override takes precedence
    let enabled = this.envOverrides[flagKey] ?? def.defaultValue;

    // Rollout percentage (deterministic per user)
    if (def.rolloutPct !== undefined && ctx.userId) {
      const hash = this.hashCode(ctx.userId + flagKey);
      const bucket = Math.abs(hash) % 100;
      enabled = bucket < def.rolloutPct;
    }

    const rule = ctx.userId ? "user-rollout" : "default";
    await this.audit.record({ flagKey, enabled, context: ctx, evaluatedAt: new Date(), ruleApplied: rule });
    return enabled;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash;
  }
}
