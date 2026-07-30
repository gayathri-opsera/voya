/**
 * Unit tests for @voya/contracts — Retention policy registry
 *
 * Tests cover:
 *  - RetentionPolicySchema: accepts valid policies
 *  - RetentionPolicySchema: rejects policies missing required fields
 *  - RetentionPolicySchema: rejects ambiguous policies (no event anchor)
 *  - RetentionPolicySchema: rejects invalid duration values
 *  - parseRetentionPolicy helper: typed result union
 *  - RETENTION_POLICY_REGISTRY: completeness and provisional visibility
 *  - lookupRetentionPolicy: returns correct entries and undefined for unknown keys
 */

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  RetentionPolicySchema,
  RetentionApprovalStatus,
  RetentionApprovalStatusEnum,
  RetentionPurgeAction,
  RetentionPurgeActionEnum,
  RETENTION_POLICY_REGISTRY,
  parseRetentionPolicy,
  lookupRetentionPolicy,
} from '../../src/governance/retention-policy.js';
import {
  provisionalRetentionPolicyFixture,
  approvedRetentionPolicyFixture,
  invalidRetentionPolicyMissingAnchor,
  invalidRetentionPolicyNegativeDuration,
  invalidRetentionPolicyZeroDuration,
  invalidRetentionPolicyFloatDuration,
} from '../fixtures/data-categories.js';

// ---------------------------------------------------------------------------
// RetentionPolicySchema — valid policies
// ---------------------------------------------------------------------------

describe('RetentionPolicySchema — valid policies', () => {
  it('accepts a valid provisional policy fixture', () => {
    const result = RetentionPolicySchema.safeParse(provisionalRetentionPolicyFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.policyKey).toBe('TEST_PROVISIONAL_POLICY');
      expect(result.data.approvalStatus).toBe('PROVISIONAL');
    }
  });

  it('accepts a valid approved policy fixture', () => {
    const result = RetentionPolicySchema.safeParse(approvedRetentionPolicyFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approvalStatus).toBe('APPROVED');
    }
  });

  it('preserves all fields in a valid parse', () => {
    const result = RetentionPolicySchema.safeParse(provisionalRetentionPolicyFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.durationDays).toBe(365);
      expect(result.data.eventAnchor).toBe('BOOKING_CONFIRMED');
      expect(result.data.action).toBe('DELETE');
      expect(result.data.owner).toBe('test-team');
    }
  });

  it('accepts a policy without optional notes field', () => {
    const { notes: _notes, ...withoutNotes } = provisionalRetentionPolicyFixture;
    const result = RetentionPolicySchema.safeParse(withoutNotes);
    expect(result.success).toBe(true);
  });

  it('accepts a policy with the ANONYMIZE action', () => {
    const policy = { ...provisionalRetentionPolicyFixture, action: 'ANONYMIZE' };
    const result = RetentionPolicySchema.safeParse(policy);
    expect(result.success).toBe(true);
  });

  it('accepts a policy with the ARCHIVE action', () => {
    const policy = { ...provisionalRetentionPolicyFixture, action: 'ARCHIVE' };
    const result = RetentionPolicySchema.safeParse(policy);
    expect(result.success).toBe(true);
  });

  it('accepts every valid RetentionTrigger as eventAnchor', () => {
    const triggers = [
      'BOOKING_CONFIRMED',
      'CHECKOUT_FAILED',
      'CHECKOUT_COMPENSATED',
      'SESSION_EXPIRED',
      'ACCOUNT_DELETED',
      'AUDIT_RETENTION_OVERRIDE',
    ] as const;
    for (const trigger of triggers) {
      const policy = { ...provisionalRetentionPolicyFixture, eventAnchor: trigger };
      const result = RetentionPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// RetentionPolicySchema — rejection of invalid policies
// ---------------------------------------------------------------------------

describe('RetentionPolicySchema — invalid policies are rejected', () => {
  it('rejects a policy missing the required eventAnchor field', () => {
    const result = RetentionPolicySchema.safeParse(invalidRetentionPolicyMissingAnchor);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('eventAnchor');
    }
  });

  it('rejects a policy with negative durationDays', () => {
    const result = RetentionPolicySchema.safeParse(invalidRetentionPolicyNegativeDuration);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('durationDays');
    }
  });

  it('rejects a policy with zero durationDays', () => {
    const result = RetentionPolicySchema.safeParse(invalidRetentionPolicyZeroDuration);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('durationDays');
    }
  });

  it('rejects a policy with a non-integer durationDays', () => {
    const result = RetentionPolicySchema.safeParse(invalidRetentionPolicyFloatDuration);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('durationDays');
    }
  });

  it('rejects a policy with an empty policyKey', () => {
    const invalid = { ...provisionalRetentionPolicyFixture, policyKey: '' };
    const result = RetentionPolicySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a policy with an empty description', () => {
    const invalid = { ...provisionalRetentionPolicyFixture, description: '' };
    const result = RetentionPolicySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a policy with an empty owner', () => {
    const invalid = { ...provisionalRetentionPolicyFixture, owner: '' };
    const result = RetentionPolicySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a policy with an invalid approvalStatus', () => {
    const invalid = { ...provisionalRetentionPolicyFixture, approvalStatus: 'PENDING_REVIEW' };
    const result = RetentionPolicySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a policy with an invalid action', () => {
    const invalid = { ...provisionalRetentionPolicyFixture, action: 'SHRED' };
    const result = RetentionPolicySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a policy with an invalid eventAnchor', () => {
    const invalid = { ...provisionalRetentionPolicyFixture, eventAnchor: 'POLICY_EXPIRED' };
    const result = RetentionPolicySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseRetentionPolicy helper
// ---------------------------------------------------------------------------

describe('parseRetentionPolicy helper', () => {
  it('returns { success: true, data } for a valid policy', () => {
    const result = parseRetentionPolicy(provisionalRetentionPolicyFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.policyKey).toBe('TEST_PROVISIONAL_POLICY');
    }
  });

  it('returns { success: false, error: ZodError } for a missing anchor without throwing', () => {
    expect(() => {
      const result = parseRetentionPolicy(invalidRetentionPolicyMissingAnchor);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
      }
    }).not.toThrow();
  });

  it('returns { success: false } for null input', () => {
    const result = parseRetentionPolicy(null);
    expect(result.success).toBe(false);
  });

  it('returns { success: false } for an empty object', () => {
    const result = parseRetentionPolicy({});
    expect(result.success).toBe(false);
  });

  it('error result contains issues describing the missing eventAnchor', () => {
    const result = parseRetentionPolicy(invalidRetentionPolicyMissingAnchor);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('eventAnchor');
    }
  });
});

// ---------------------------------------------------------------------------
// RETENTION_POLICY_REGISTRY — completeness and provisional visibility
// ---------------------------------------------------------------------------

describe('RETENTION_POLICY_REGISTRY — completeness', () => {
  it('contains policies for all expected launch retention categories', () => {
    const expectedPolicyKeys = [
      'TRAVELLER_PII_POST_BOOKING',
      'SESSION_LIFETIME',
      'GOVT_ID_SHORT_RETENTION',
      'LOYALTY_ID_POST_BOOKING',
      'PAYMENT_TOKEN_POST_CHECKOUT',
      'FINANCIAL_RECORD_LONG_RETENTION',
      'CONVERSATION_POST_SESSION',
      'RECEIPT_POST_BOOKING',
      'AUDIT_LONG_RETENTION',
      'OPERATIONAL_INDEFINITE',
      'ADMIN_RECORD_LONG_RETENTION',
    ];
    for (const key of expectedPolicyKeys) {
      expect(RETENTION_POLICY_REGISTRY[key]).toBeDefined();
    }
  });

  it('all registry entries parse successfully through RetentionPolicySchema', () => {
    for (const policy of Object.values(RETENTION_POLICY_REGISTRY)) {
      const result = RetentionPolicySchema.safeParse(policy);
      expect(result.success).toBe(true);
    }
  });

  it('all registry entries have positive integer durationDays', () => {
    for (const policy of Object.values(RETENTION_POLICY_REGISTRY)) {
      expect(Number.isInteger(policy.durationDays)).toBe(true);
      expect(policy.durationDays).toBeGreaterThan(0);
    }
  });
});

describe('RETENTION_POLICY_REGISTRY — provisional visibility', () => {
  it('all launch policies are marked PROVISIONAL (no legal sign-off claimed)', () => {
    for (const policy of Object.values(RETENTION_POLICY_REGISTRY)) {
      expect(policy.approvalStatus).toBe('PROVISIONAL');
    }
  });

  it('lookupRetentionPolicy returns a PROVISIONAL status for TRAVELLER_PII_POST_BOOKING', () => {
    const policy = lookupRetentionPolicy('TRAVELLER_PII_POST_BOOKING');
    expect(policy).toBeDefined();
    expect(policy!.approvalStatus).toBe('PROVISIONAL');
  });

  it('PROVISIONAL status is preserved after parsing through RetentionPolicySchema', () => {
    const raw = RETENTION_POLICY_REGISTRY['TRAVELLER_PII_POST_BOOKING'];
    const result = RetentionPolicySchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approvalStatus).toBe('PROVISIONAL');
    }
  });
});

// ---------------------------------------------------------------------------
// lookupRetentionPolicy
// ---------------------------------------------------------------------------

describe('lookupRetentionPolicy', () => {
  it('returns the correct policy for TRAVELLER_PII_POST_BOOKING', () => {
    const policy = lookupRetentionPolicy('TRAVELLER_PII_POST_BOOKING');
    expect(policy).toBeDefined();
    expect(policy!.policyKey).toBe('TRAVELLER_PII_POST_BOOKING');
    expect(policy!.eventAnchor).toBe('BOOKING_CONFIRMED');
    expect(policy!.action).toBe('DELETE');
  });

  it('returns the correct policy for GOVT_ID_SHORT_RETENTION', () => {
    const policy = lookupRetentionPolicy('GOVT_ID_SHORT_RETENTION');
    expect(policy).toBeDefined();
    expect(policy!.durationDays).toBe(30);
    expect(policy!.eventAnchor).toBe('BOOKING_CONFIRMED');
    expect(policy!.action).toBe('DELETE');
  });

  it('returns the correct policy for FINANCIAL_RECORD_LONG_RETENTION', () => {
    const policy = lookupRetentionPolicy('FINANCIAL_RECORD_LONG_RETENTION');
    expect(policy).toBeDefined();
    expect(policy!.action).toBe('ARCHIVE');
  });

  it('returns undefined for an unknown policy key', () => {
    const policy = lookupRetentionPolicy('NONEXISTENT_POLICY_KEY_XYZ');
    expect(policy).toBeUndefined();
  });

  it('returns a non-undefined result for every key in the registry', () => {
    for (const key of Object.keys(RETENTION_POLICY_REGISTRY)) {
      const policy = lookupRetentionPolicy(key);
      expect(policy).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Enum value objects
// ---------------------------------------------------------------------------

describe('RetentionApprovalStatus and RetentionPurgeAction enums', () => {
  it('RetentionApprovalStatus.PROVISIONAL parses through RetentionApprovalStatusEnum', () => {
    expect(
      RetentionApprovalStatusEnum.safeParse(RetentionApprovalStatus.PROVISIONAL).success,
    ).toBe(true);
  });

  it('RetentionApprovalStatus.APPROVED parses through RetentionApprovalStatusEnum', () => {
    expect(
      RetentionApprovalStatusEnum.safeParse(RetentionApprovalStatus.APPROVED).success,
    ).toBe(true);
  });

  it('RetentionPurgeAction.DELETE parses through RetentionPurgeActionEnum', () => {
    expect(RetentionPurgeActionEnum.safeParse(RetentionPurgeAction.DELETE).success).toBe(true);
  });

  it('RetentionPurgeAction.ANONYMIZE parses through RetentionPurgeActionEnum', () => {
    expect(RetentionPurgeActionEnum.safeParse(RetentionPurgeAction.ANONYMIZE).success).toBe(true);
  });

  it('RetentionPurgeAction.ARCHIVE parses through RetentionPurgeActionEnum', () => {
    expect(RetentionPurgeActionEnum.safeParse(RetentionPurgeAction.ARCHIVE).success).toBe(true);
  });

  it('an unknown approval status is rejected', () => {
    expect(RetentionApprovalStatusEnum.safeParse('PENDING_REVIEW').success).toBe(false);
  });

  it('an unknown purge action is rejected', () => {
    expect(RetentionPurgeActionEnum.safeParse('SHRED').success).toBe(false);
  });
});
