/**
 * Unit tests for @voya/contracts — cross-domain enums
 *
 * Tests cover:
 *  - Acceptance of all declared valid enum values via the Zod schema
 *  - Rejection of unknown values, case variants, near-misses, and empty strings
 *  - Verify runtime enum objects expose the expected member names
 */

import { describe, it, expect } from 'vitest';
import {
  PathModeEnum,
  PathMode,
  InventoryDomainEnum,
  InventoryDomain,
  BookingSourceEnum,
  BookingSource,
  SourceClassificationEnum,
  SourceClassification,
  DegradedReasonEnum,
  DegradedReason,
  ReceiptOutcomeEnum,
  ReceiptOutcome,
  SupplierBookabilityEnum,
  SupplierBookability,
  DataClassificationTierEnum,
  DataClassificationTier,
  AuditEventTypeEnum,
  AuditEventType,
  RetentionTriggerEnum,
  RetentionTrigger,
} from '../../src/common/enums.js';
import {
  validPathModes,
  invalidPathModes,
  validInventoryDomains,
  invalidInventoryDomains,
  validBookingSources,
  invalidBookingSources,
  validSourceClassifications,
  invalidSourceClassifications,
  validDegradedReasons,
  invalidDegradedReasons,
  validReceiptOutcomes,
  invalidReceiptOutcomes,
  validSupplierBookabilities,
  invalidSupplierBookabilities,
  validDataClassificationTiers,
  invalidDataClassificationTiers,
  validAuditEventTypes,
  invalidAuditEventTypes,
  validRetentionTriggers,
  invalidRetentionTriggers,
} from '../fixtures/enums.js';

// ---------------------------------------------------------------------------
// PathMode
// ---------------------------------------------------------------------------

describe('PathModeEnum', () => {
  it('accepts all declared valid values', () => {
    for (const value of validPathModes) {
      expect(PathModeEnum.safeParse(value).success).toBe(true);
    }
  });

  it('rejects unknown, near-miss, and wrong-case values', () => {
    for (const value of invalidPathModes) {
      expect(PathModeEnum.safeParse(value).success).toBe(false);
    }
  });

  it('exposes PATH_A and PATH_B as runtime values', () => {
    expect(PathMode.PATH_A).toBe('PATH_A');
    expect(PathMode.PATH_B).toBe('PATH_B');
  });
});

// ---------------------------------------------------------------------------
// InventoryDomain
// ---------------------------------------------------------------------------

describe('InventoryDomainEnum', () => {
  it('accepts all declared valid values', () => {
    for (const value of validInventoryDomains) {
      expect(InventoryDomainEnum.safeParse(value).success).toBe(true);
    }
  });

  it('rejects misspellings, wrong-case, and non-domain values', () => {
    for (const value of invalidInventoryDomains) {
      expect(InventoryDomainEnum.safeParse(value).success).toBe(false);
    }
  });

  it('exposes ACCOMMODATION member', () => {
    expect(InventoryDomain.ACCOMMODATION).toBe('ACCOMMODATION');
  });

  it('exposes WEATHER_ADVISORY member', () => {
    expect(InventoryDomain.WEATHER_ADVISORY).toBe('WEATHER_ADVISORY');
  });
});

// ---------------------------------------------------------------------------
// BookingSource
// ---------------------------------------------------------------------------

describe('BookingSourceEnum', () => {
  it('accepts all declared valid values', () => {
    for (const value of validBookingSources) {
      expect(BookingSourceEnum.safeParse(value).success).toBe(true);
    }
  });

  it('rejects non-Marriott sources and case variants', () => {
    for (const value of invalidBookingSources) {
      expect(BookingSourceEnum.safeParse(value).success).toBe(false);
    }
  });

  it('HVMI is the first declared booking source', () => {
    expect(BookingSource.HVMI).toBe('HVMI');
  });
});

// ---------------------------------------------------------------------------
// SourceClassification
// ---------------------------------------------------------------------------

describe('SourceClassificationEnum', () => {
  it('accepts all declared valid values', () => {
    for (const value of validSourceClassifications) {
      expect(SourceClassificationEnum.safeParse(value).success).toBe(true);
    }
  });

  it('rejects THIRD_PARTY and other undeclared values', () => {
    for (const value of invalidSourceClassifications) {
      expect(SourceClassificationEnum.safeParse(value).success).toBe(false);
    }
  });

  it('explicitly rejects THIRD_PARTY — not a valid Voya source classification', () => {
    expect(SourceClassificationEnum.safeParse('THIRD_PARTY').success).toBe(false);
  });

  it('exposes MARRIOTT_OWNED and MARRIOTT_PARTNERED members', () => {
    expect(SourceClassification.MARRIOTT_OWNED).toBe('MARRIOTT_OWNED');
    expect(SourceClassification.MARRIOTT_PARTNERED).toBe('MARRIOTT_PARTNERED');
  });
});

// ---------------------------------------------------------------------------
// DegradedReason
// ---------------------------------------------------------------------------

describe('DegradedReasonEnum', () => {
  it('accepts all declared valid values', () => {
    for (const value of validDegradedReasons) {
      expect(DegradedReasonEnum.safeParse(value).success).toBe(true);
    }
  });

  it('rejects near-miss and wrong-case values', () => {
    for (const value of invalidDegradedReasons) {
      expect(DegradedReasonEnum.safeParse(value).success).toBe(false);
    }
  });

  it('UNKNOWN is a valid degraded reason for unclassified failures', () => {
    expect(DegradedReason.UNKNOWN).toBe('UNKNOWN');
  });
});

// ---------------------------------------------------------------------------
// ReceiptOutcome
// ---------------------------------------------------------------------------

describe('ReceiptOutcomeEnum', () => {
  it('accepts PASS, BLOCKED, and STALE', () => {
    for (const value of validReceiptOutcomes) {
      expect(ReceiptOutcomeEnum.safeParse(value).success).toBe(true);
    }
  });

  it('rejects FAIL, EXPIRED, and other near-misses', () => {
    for (const value of invalidReceiptOutcomes) {
      expect(ReceiptOutcomeEnum.safeParse(value).success).toBe(false);
    }
  });

  it('exposes PASS, BLOCKED, and STALE as runtime values', () => {
    expect(ReceiptOutcome.PASS).toBe('PASS');
    expect(ReceiptOutcome.BLOCKED).toBe('BLOCKED');
    expect(ReceiptOutcome.STALE).toBe('STALE');
  });
});

// ---------------------------------------------------------------------------
// SupplierBookability
// ---------------------------------------------------------------------------

describe('SupplierBookabilityEnum', () => {
  it('accepts all declared valid values', () => {
    for (const value of validSupplierBookabilities) {
      expect(SupplierBookabilityEnum.safeParse(value).success).toBe(true);
    }
  });

  it('rejects truncated and wrong-case variants', () => {
    for (const value of invalidSupplierBookabilities) {
      expect(SupplierBookabilityEnum.safeParse(value).success).toBe(false);
    }
  });

  it('exposes DEEP_LINK_ONLY member', () => {
    expect(SupplierBookability.DEEP_LINK_ONLY).toBe('DEEP_LINK_ONLY');
  });
});

// ---------------------------------------------------------------------------
// DataClassificationTier
// ---------------------------------------------------------------------------

describe('DataClassificationTierEnum', () => {
  it('accepts all four classification tiers', () => {
    for (const value of validDataClassificationTiers) {
      expect(DataClassificationTierEnum.safeParse(value).success).toBe(true);
    }
  });

  it('rejects PRIVATE, SECRET, and other non-tier values', () => {
    for (const value of invalidDataClassificationTiers) {
      expect(DataClassificationTierEnum.safeParse(value).success).toBe(false);
    }
  });

  it('exposes all four tier members', () => {
    expect(DataClassificationTier.PUBLIC).toBe('PUBLIC');
    expect(DataClassificationTier.INTERNAL).toBe('INTERNAL');
    expect(DataClassificationTier.CONFIDENTIAL).toBe('CONFIDENTIAL');
    expect(DataClassificationTier.RESTRICTED).toBe('RESTRICTED');
  });
});

// ---------------------------------------------------------------------------
// AuditEventType
// ---------------------------------------------------------------------------

describe('AuditEventTypeEnum', () => {
  it('accepts all declared audit event types', () => {
    for (const value of validAuditEventTypes) {
      expect(AuditEventTypeEnum.safeParse(value).success).toBe(true);
    }
  });

  it('rejects truncated and wrong-case variants', () => {
    for (const value of invalidAuditEventTypes) {
      expect(AuditEventTypeEnum.safeParse(value).success).toBe(false);
    }
  });

  it('exposes RECEIPT_ISSUED and BRAND_FALLBACK_DISCLOSURE members', () => {
    expect(AuditEventType.RECEIPT_ISSUED).toBe('RECEIPT_ISSUED');
    expect(AuditEventType.BRAND_FALLBACK_DISCLOSURE).toBe('BRAND_FALLBACK_DISCLOSURE');
  });
});

// ---------------------------------------------------------------------------
// RetentionTrigger
// ---------------------------------------------------------------------------

describe('RetentionTriggerEnum', () => {
  it('accepts all declared retention trigger values', () => {
    for (const value of validRetentionTriggers) {
      expect(RetentionTriggerEnum.safeParse(value).success).toBe(true);
    }
  });

  it('rejects near-misses for BOOKING_CONFIRMED and SESSION_EXPIRED', () => {
    for (const value of invalidRetentionTriggers) {
      expect(RetentionTriggerEnum.safeParse(value).success).toBe(false);
    }
  });

  it('exposes ACCOUNT_DELETED and AUDIT_RETENTION_OVERRIDE members', () => {
    expect(RetentionTrigger.ACCOUNT_DELETED).toBe('ACCOUNT_DELETED');
    expect(RetentionTrigger.AUDIT_RETENTION_OVERRIDE).toBe('AUDIT_RETENTION_OVERRIDE');
  });
});
