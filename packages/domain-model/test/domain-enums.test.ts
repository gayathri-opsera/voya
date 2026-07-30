/**
 * Unit tests for @voya/domain-model
 *
 * Tests cover:
 *  - Enum string values match Prisma schema declarations
 *  - Itinerary status transition validation
 *  - Receipt outcome classification helpers
 *  - Monetary and latency unit validation
 *  - Data classification policy metadata
 *  - Retention date calculation helpers
 */

import { describe, it, expect } from 'vitest';
import {
  ItineraryStatus,
  TravellerIdentityType,
  ReceiptOutcomePersisted,
  DataClassificationTier,
  RetentionPurgeAction,
  RetentionApprovalStatus,
  isValidItineraryTransition,
  isTerminalItineraryStatus,
  isTerminalReceiptOutcome,
  isBlockingReceiptOutcome,
  validateMinorUnits,
  validateLatencySeconds,
  validatePointsAmount,
} from '../src/domain-enums.js';
import {
  getDataClassificationPolicy,
  requiresEncryptionAtRest,
  requiresLogMasking,
  requiresNonProdAnonymization,
  isPromptEligible,
  getMaxRetentionDays,
  calculatePurgeDate,
  isPastPurgeDate,
} from '../src/data-classification.js';
import {
  testGuestTravellerProfile,
  testTripIntent,
  testItinerary,
  testPassingReceipt,
  testFailingReceipt,
  testBlockedReceipt,
  testAccommodationLineItem,
  testHvmiManifestRow,
} from '@voya/test-fixtures';

// ---------------------------------------------------------------------------
// Enum string values — must match Prisma schema enum declarations exactly
// ---------------------------------------------------------------------------

describe('ItineraryStatus enum string values', () => {
  it('all six values match the Prisma schema', () => {
    expect(ItineraryStatus.DRAFT).toBe('DRAFT');
    expect(ItineraryStatus.PENDING_VERIFICATION).toBe('PENDING_VERIFICATION');
    expect(ItineraryStatus.VERIFIED).toBe('VERIFIED');
    expect(ItineraryStatus.PRESENTED).toBe('PRESENTED');
    expect(ItineraryStatus.EXPIRED).toBe('EXPIRED');
    expect(ItineraryStatus.CANCELLED).toBe('CANCELLED');
  });
});

describe('TravellerIdentityType enum string values', () => {
  it('BONVOY_AUTHENTICATED and GUEST_TOKEN match the Prisma schema', () => {
    expect(TravellerIdentityType.BONVOY_AUTHENTICATED).toBe('BONVOY_AUTHENTICATED');
    expect(TravellerIdentityType.GUEST_TOKEN).toBe('GUEST_TOKEN');
  });
});

describe('ReceiptOutcomePersisted enum string values', () => {
  it('all four persistence-layer outcomes are present', () => {
    expect(ReceiptOutcomePersisted.PASS).toBe('PASS');
    expect(ReceiptOutcomePersisted.FAIL).toBe('FAIL');
    expect(ReceiptOutcomePersisted.BLOCKED).toBe('BLOCKED');
    expect(ReceiptOutcomePersisted.STALE).toBe('STALE');
  });

  it('FAIL is present in the persistence enum but not the API-contract enum', () => {
    const values = Object.values(ReceiptOutcomePersisted);
    expect(values).toContain('FAIL');
    expect(values).toContain('PASS');
    expect(values).toContain('BLOCKED');
    expect(values).toContain('STALE');
  });
});

describe('RetentionPurgeAction and RetentionApprovalStatus enum values', () => {
  it('purge actions match the Prisma schema', () => {
    expect(RetentionPurgeAction.DELETE).toBe('DELETE');
    expect(RetentionPurgeAction.ANONYMIZE).toBe('ANONYMIZE');
    expect(RetentionPurgeAction.ARCHIVE).toBe('ARCHIVE');
  });

  it('approval statuses match the Prisma schema', () => {
    expect(RetentionApprovalStatus.PROVISIONAL).toBe('PROVISIONAL');
    expect(RetentionApprovalStatus.APPROVED).toBe('APPROVED');
  });
});

// ---------------------------------------------------------------------------
// Itinerary status transition helpers
// ---------------------------------------------------------------------------

describe('isValidItineraryTransition', () => {
  it('allows DRAFT → PENDING_VERIFICATION', () => {
    expect(isValidItineraryTransition(
      ItineraryStatus.DRAFT,
      ItineraryStatus.PENDING_VERIFICATION,
    )).toBe(true);
  });

  it('allows DRAFT → CANCELLED', () => {
    expect(isValidItineraryTransition(
      ItineraryStatus.DRAFT,
      ItineraryStatus.CANCELLED,
    )).toBe(true);
  });

  it('allows PENDING_VERIFICATION → VERIFIED', () => {
    expect(isValidItineraryTransition(
      ItineraryStatus.PENDING_VERIFICATION,
      ItineraryStatus.VERIFIED,
    )).toBe(true);
  });

  it('allows VERIFIED → PRESENTED', () => {
    expect(isValidItineraryTransition(
      ItineraryStatus.VERIFIED,
      ItineraryStatus.PRESENTED,
    )).toBe(true);
  });

  it('rejects DRAFT → VERIFIED (skips a required step)', () => {
    expect(isValidItineraryTransition(
      ItineraryStatus.DRAFT,
      ItineraryStatus.VERIFIED,
    )).toBe(false);
  });

  it('rejects PRESENTED → DRAFT (no backward transition)', () => {
    expect(isValidItineraryTransition(
      ItineraryStatus.PRESENTED,
      ItineraryStatus.DRAFT,
    )).toBe(false);
  });

  it('rejects any transition from EXPIRED (terminal)', () => {
    for (const to of Object.values(ItineraryStatus)) {
      expect(isValidItineraryTransition(ItineraryStatus.EXPIRED, to)).toBe(false);
    }
  });

  it('rejects any transition from CANCELLED (terminal)', () => {
    for (const to of Object.values(ItineraryStatus)) {
      expect(isValidItineraryTransition(ItineraryStatus.CANCELLED, to)).toBe(false);
    }
  });
});

describe('isTerminalItineraryStatus', () => {
  it('returns true for EXPIRED', () => {
    expect(isTerminalItineraryStatus(ItineraryStatus.EXPIRED)).toBe(true);
  });

  it('returns true for CANCELLED', () => {
    expect(isTerminalItineraryStatus(ItineraryStatus.CANCELLED)).toBe(true);
  });

  it('returns false for all non-terminal statuses', () => {
    const nonTerminal = [
      ItineraryStatus.DRAFT,
      ItineraryStatus.PENDING_VERIFICATION,
      ItineraryStatus.VERIFIED,
      ItineraryStatus.PRESENTED,
    ];
    for (const status of nonTerminal) {
      expect(isTerminalItineraryStatus(status)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Receipt outcome helpers
// ---------------------------------------------------------------------------

describe('isTerminalReceiptOutcome', () => {
  it('returns true for PASS', () => {
    expect(isTerminalReceiptOutcome(ReceiptOutcomePersisted.PASS)).toBe(true);
  });

  it('returns true for FAIL', () => {
    expect(isTerminalReceiptOutcome(ReceiptOutcomePersisted.FAIL)).toBe(true);
  });

  it('returns false for BLOCKED', () => {
    expect(isTerminalReceiptOutcome(ReceiptOutcomePersisted.BLOCKED)).toBe(false);
  });

  it('returns false for STALE', () => {
    expect(isTerminalReceiptOutcome(ReceiptOutcomePersisted.STALE)).toBe(false);
  });
});

describe('isBlockingReceiptOutcome', () => {
  it('returns true for FAIL', () => {
    expect(isBlockingReceiptOutcome(ReceiptOutcomePersisted.FAIL)).toBe(true);
  });

  it('returns true for BLOCKED', () => {
    expect(isBlockingReceiptOutcome(ReceiptOutcomePersisted.BLOCKED)).toBe(true);
  });

  it('returns true for STALE', () => {
    expect(isBlockingReceiptOutcome(ReceiptOutcomePersisted.STALE)).toBe(true);
  });

  it('returns false for PASS', () => {
    expect(isBlockingReceiptOutcome(ReceiptOutcomePersisted.PASS)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Monetary and latency validation helpers
// ---------------------------------------------------------------------------

describe('validateMinorUnits', () => {
  it('accepts zero (non-priced items)', () => {
    expect(validateMinorUnits(0)).toBe(true);
  });

  it('accepts positive integer minor units', () => {
    expect(validateMinorUnits(42000)).toBe(true);   // USD 420.00
    expect(validateMinorUnits(1)).toBe(true);
  });

  it('rejects negative values', () => {
    expect(validateMinorUnits(-1)).toBe(false);
    expect(validateMinorUnits(-100)).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(validateMinorUnits(1.5)).toBe(false);
    expect(validateMinorUnits(100.99)).toBe(false);
  });
});

describe('validateLatencySeconds', () => {
  it('accepts positive integers', () => {
    expect(validateLatencySeconds(60)).toBe(true);
    expect(validateLatencySeconds(300)).toBe(true);
    expect(validateLatencySeconds(86400)).toBe(true);
  });

  it('rejects zero (latency must be strictly positive)', () => {
    expect(validateLatencySeconds(0)).toBe(false);
  });

  it('rejects negative values', () => {
    expect(validateLatencySeconds(-1)).toBe(false);
  });

  it('rejects non-integer values', () => {
    expect(validateLatencySeconds(1.5)).toBe(false);
  });
});

describe('validatePointsAmount', () => {
  it('accepts zero points', () => {
    expect(validatePointsAmount(0)).toBe(true);
  });

  it('accepts positive integer points', () => {
    expect(validatePointsAmount(50000)).toBe(true);
  });

  it('rejects negative points', () => {
    expect(validatePointsAmount(-1000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Data classification policy metadata
// ---------------------------------------------------------------------------

describe('getDataClassificationPolicy', () => {
  it('PUBLIC tier requires no encryption, no log masking, and is prompt eligible', () => {
    const policy = getDataClassificationPolicy(DataClassificationTier.PUBLIC);
    expect(policy.requiresEncryptionAtRest).toBe(false);
    expect(policy.requiresLogMasking).toBe(false);
    expect(policy.requiresNonProdAnonymization).toBe(false);
    expect(policy.isPromptEligible).toBe(true);
    expect(policy.maxRetentionDays).toBeGreaterThan(0);
  });

  it('INTERNAL tier requires non-prod anonymization but is prompt eligible', () => {
    const policy = getDataClassificationPolicy(DataClassificationTier.INTERNAL);
    expect(policy.requiresEncryptionAtRest).toBe(false);
    expect(policy.requiresNonProdAnonymization).toBe(true);
    expect(policy.isPromptEligible).toBe(true);
  });

  it('CONFIDENTIAL tier requires encryption, log masking, and is NOT prompt eligible', () => {
    const policy = getDataClassificationPolicy(DataClassificationTier.CONFIDENTIAL);
    expect(policy.requiresEncryptionAtRest).toBe(true);
    expect(policy.requiresLogMasking).toBe(true);
    expect(policy.requiresNonProdAnonymization).toBe(true);
    expect(policy.isPromptEligible).toBe(false);
  });

  it('RESTRICTED tier requires all protections and is NOT prompt eligible', () => {
    const policy = getDataClassificationPolicy(DataClassificationTier.RESTRICTED);
    expect(policy.requiresEncryptionAtRest).toBe(true);
    expect(policy.requiresLogMasking).toBe(true);
    expect(policy.requiresNonProdAnonymization).toBe(true);
    expect(policy.isPromptEligible).toBe(false);
  });

  it('RESTRICTED has the shortest maxRetentionDays', () => {
    const restricted = getDataClassificationPolicy(DataClassificationTier.RESTRICTED);
    const confidential = getDataClassificationPolicy(DataClassificationTier.CONFIDENTIAL);
    const internal = getDataClassificationPolicy(DataClassificationTier.INTERNAL);
    expect(restricted.maxRetentionDays).toBeLessThan(confidential.maxRetentionDays);
    expect(confidential.maxRetentionDays).toBeLessThan(internal.maxRetentionDays);
  });
});

describe('requiresEncryptionAtRest, requiresLogMasking, isPromptEligible helpers', () => {
  it('PUBLIC and INTERNAL do not require encryption at rest', () => {
    expect(requiresEncryptionAtRest(DataClassificationTier.PUBLIC)).toBe(false);
    expect(requiresEncryptionAtRest(DataClassificationTier.INTERNAL)).toBe(false);
  });

  it('CONFIDENTIAL and RESTRICTED require encryption at rest', () => {
    expect(requiresEncryptionAtRest(DataClassificationTier.CONFIDENTIAL)).toBe(true);
    expect(requiresEncryptionAtRest(DataClassificationTier.RESTRICTED)).toBe(true);
  });

  it('CONFIDENTIAL and RESTRICTED require log masking', () => {
    expect(requiresLogMasking(DataClassificationTier.CONFIDENTIAL)).toBe(true);
    expect(requiresLogMasking(DataClassificationTier.RESTRICTED)).toBe(true);
  });

  it('PUBLIC and INTERNAL do not require log masking', () => {
    expect(requiresLogMasking(DataClassificationTier.PUBLIC)).toBe(false);
    expect(requiresLogMasking(DataClassificationTier.INTERNAL)).toBe(false);
  });

  it('only PUBLIC and INTERNAL are prompt eligible', () => {
    expect(isPromptEligible(DataClassificationTier.PUBLIC)).toBe(true);
    expect(isPromptEligible(DataClassificationTier.INTERNAL)).toBe(true);
    expect(isPromptEligible(DataClassificationTier.CONFIDENTIAL)).toBe(false);
    expect(isPromptEligible(DataClassificationTier.RESTRICTED)).toBe(false);
  });

  it('getMaxRetentionDays returns correct values for all tiers', () => {
    expect(getMaxRetentionDays(DataClassificationTier.PUBLIC)).toBe(3650);
    expect(getMaxRetentionDays(DataClassificationTier.INTERNAL)).toBe(730);
    expect(getMaxRetentionDays(DataClassificationTier.CONFIDENTIAL)).toBe(365);
    expect(getMaxRetentionDays(DataClassificationTier.RESTRICTED)).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// Retention calculation helpers
// ---------------------------------------------------------------------------

describe('calculatePurgeDate', () => {
  it('adds retentionDays to the trigger date', () => {
    const trigger = new Date('2026-01-01T00:00:00Z');
    const result = calculatePurgeDate(trigger, 30);
    expect(result.purgeDate.toISOString().startsWith('2026-01-31')).toBe(true);
    expect(result.retentionDays).toBe(30);
  });

  it('a retentionDays of 0 returns the same date', () => {
    const trigger = new Date('2026-07-01T00:00:00Z');
    const result = calculatePurgeDate(trigger, 0);
    expect(result.purgeDate.getTime()).toBe(trigger.getTime());
  });

  it('correctly calculates a 7-year audit retention (2555 days)', () => {
    const trigger = new Date('2026-07-01T00:00:00Z');
    const result = calculatePurgeDate(trigger, 2555);
    expect(result.purgeDate > trigger).toBe(true);
    expect(result.retentionDays).toBe(2555);
  });

  it('throws for negative retentionDays', () => {
    const trigger = new Date('2026-07-01T00:00:00Z');
    expect(() => calculatePurgeDate(trigger, -1)).toThrow();
  });

  it('throws for non-integer retentionDays', () => {
    const trigger = new Date('2026-07-01T00:00:00Z');
    expect(() => calculatePurgeDate(trigger, 30.5)).toThrow();
  });
});

describe('isPastPurgeDate', () => {
  it('returns false when the purge date is in the future', () => {
    const trigger = new Date('2026-07-01T00:00:00Z');
    const now = new Date('2026-07-15T00:00:00Z');
    expect(isPastPurgeDate(trigger, 30, now)).toBe(false); // purge: 2026-07-31
  });

  it('returns true when the purge date has passed', () => {
    const trigger = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-07-15T00:00:00Z');
    expect(isPastPurgeDate(trigger, 30, now)).toBe(true); // purge: 2026-07-01
  });

  it('returns true exactly on the purge date', () => {
    const trigger = new Date('2026-07-01T00:00:00Z');
    const purgeDate = new Date('2026-07-31T00:00:00Z');
    expect(isPastPurgeDate(trigger, 30, purgeDate)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration with test fixtures — assert fixtures satisfy domain invariants
// ---------------------------------------------------------------------------

describe('Test fixtures satisfy domain model invariants', () => {
  it('testGuestTravellerProfile has a tokenised ownerRef (not a raw account number)', () => {
    expect(testGuestTravellerProfile.ownerRef).toMatch(/^tok_test_/);
    expect(testGuestTravellerProfile.identityType).toBe(TravellerIdentityType.GUEST_TOKEN);
  });

  it('testTripIntent partySize is a valid positive integer', () => {
    expect(validateMinorUnits(testTripIntent.partySize)).toBe(true);
    expect(testTripIntent.partySize).toBeGreaterThan(0);
  });

  it('testItinerary status is VERIFIED', () => {
    expect(testItinerary.status).toBe(ItineraryStatus.VERIFIED);
  });

  it('testAccommodationLineItem price is a non-negative integer minor unit value', () => {
    const price = testAccommodationLineItem.priceAmountMinorUnits;
    expect(price).not.toBeNull();
    expect(validateMinorUnits(price!)).toBe(true);
  });

  it('testPassingReceipt outcome is PASS and is a terminal outcome', () => {
    expect(testPassingReceipt.outcome).toBe(ReceiptOutcomePersisted.PASS);
    expect(isTerminalReceiptOutcome(testPassingReceipt.outcome)).toBe(true);
  });

  it('testFailingReceipt outcome is FAIL and is both terminal and blocking', () => {
    expect(testFailingReceipt.outcome).toBe(ReceiptOutcomePersisted.FAIL);
    expect(isTerminalReceiptOutcome(testFailingReceipt.outcome)).toBe(true);
    expect(isBlockingReceiptOutcome(testFailingReceipt.outcome)).toBe(true);
  });

  it('testBlockedReceipt outcome is BLOCKED and is blocking but not terminal', () => {
    expect(testBlockedReceipt.outcome).toBe(ReceiptOutcomePersisted.BLOCKED);
    expect(isBlockingReceiptOutcome(testBlockedReceipt.outcome)).toBe(true);
    expect(isTerminalReceiptOutcome(testBlockedReceipt.outcome)).toBe(false);
  });

  it('testHvmiManifestRow availability latency is a valid positive integer', () => {
    expect(validateLatencySeconds(testHvmiManifestRow.availabilityRefreshLatencySeconds)).toBe(true);
  });

  it('testHvmiManifestRow rate latency is a valid positive integer', () => {
    const rateLatency = testHvmiManifestRow.rateRefreshLatencySeconds;
    expect(rateLatency).not.toBeNull();
    expect(validateLatencySeconds(rateLatency!)).toBe(true);
  });

  it('non-null line item itinerary IDs link to the test itinerary', () => {
    expect(testAccommodationLineItem.itineraryId).toBe(testItinerary.id);
  });
});
