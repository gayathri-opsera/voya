/**
 * @voya/domain-model — Data Classification Helpers
 *
 * Provides per-tier data classification policy constants and helper functions
 * for use by persistence and service layers. Mirrors the governance rules
 * established in @voya/contracts/governance/data-classification.
 *
 * These helpers operate on DataClassificationTier values (plain TS enum) and
 * do not depend on Zod or the Prisma client.
 */

import { DataClassificationTier } from './domain-enums.js';

// ---------------------------------------------------------------------------
// Policy descriptor per tier
// ---------------------------------------------------------------------------

export interface DataClassificationPolicy {
  readonly tier: DataClassificationTier;
  readonly requiresEncryptionAtRest: boolean;
  readonly requiresLogMasking: boolean;
  readonly requiresNonProdAnonymization: boolean;
  readonly maxRetentionDays: number;
  readonly isPromptEligible: boolean;
}

const POLICIES: Readonly<Record<DataClassificationTier, DataClassificationPolicy>> = {
  [DataClassificationTier.PUBLIC]: {
    tier: DataClassificationTier.PUBLIC,
    requiresEncryptionAtRest: false,
    requiresLogMasking: false,
    requiresNonProdAnonymization: false,
    maxRetentionDays: 3650,
    isPromptEligible: true,
  },
  [DataClassificationTier.INTERNAL]: {
    tier: DataClassificationTier.INTERNAL,
    requiresEncryptionAtRest: false,
    requiresLogMasking: false,
    requiresNonProdAnonymization: true,
    maxRetentionDays: 730,
    isPromptEligible: true,
  },
  [DataClassificationTier.CONFIDENTIAL]: {
    tier: DataClassificationTier.CONFIDENTIAL,
    requiresEncryptionAtRest: true,
    requiresLogMasking: true,
    requiresNonProdAnonymization: true,
    maxRetentionDays: 365,
    isPromptEligible: false,
  },
  [DataClassificationTier.RESTRICTED]: {
    tier: DataClassificationTier.RESTRICTED,
    requiresEncryptionAtRest: true,
    requiresLogMasking: true,
    requiresNonProdAnonymization: true,
    maxRetentionDays: 90,
    isPromptEligible: false,
  },
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function getDataClassificationPolicy(
  tier: DataClassificationTier,
): DataClassificationPolicy {
  const policy = POLICIES[tier];
  if (policy === undefined) {
    throw new Error(`Unknown DataClassificationTier: ${String(tier)}`);
  }
  return policy;
}

export function requiresEncryptionAtRest(tier: DataClassificationTier): boolean {
  return getDataClassificationPolicy(tier).requiresEncryptionAtRest;
}

export function requiresLogMasking(tier: DataClassificationTier): boolean {
  return getDataClassificationPolicy(tier).requiresLogMasking;
}

export function requiresNonProdAnonymization(tier: DataClassificationTier): boolean {
  return getDataClassificationPolicy(tier).requiresNonProdAnonymization;
}

export function isPromptEligible(tier: DataClassificationTier): boolean {
  return getDataClassificationPolicy(tier).isPromptEligible;
}

export function getMaxRetentionDays(tier: DataClassificationTier): number {
  return getDataClassificationPolicy(tier).maxRetentionDays;
}

// ---------------------------------------------------------------------------
// Retention calculation helpers
// ---------------------------------------------------------------------------

export interface RetentionCalculationResult {
  readonly triggerDate: Date;
  readonly retentionDays: number;
  readonly purgeDate: Date;
}

export function calculatePurgeDate(
  triggerDate: Date,
  retentionDays: number,
): RetentionCalculationResult {
  if (retentionDays < 0) {
    throw new Error(`retentionDays must be >= 0, received: ${retentionDays}`);
  }
  if (!Number.isInteger(retentionDays)) {
    throw new Error(`retentionDays must be an integer, received: ${retentionDays}`);
  }
  const purgeDate = new Date(triggerDate.getTime());
  purgeDate.setDate(purgeDate.getDate() + retentionDays);
  return { triggerDate, retentionDays, purgeDate };
}

export function isPastPurgeDate(triggerDate: Date, retentionDays: number, now: Date): boolean {
  const { purgeDate } = calculatePurgeDate(triggerDate, retentionDays);
  return now >= purgeDate;
}
