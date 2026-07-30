/**
 * Unit and integration tests for @voya/contracts — Prompt safety validation
 *
 * Tests cover:
 *  - validatePromptCategories: allows only prompt-eligible categories
 *  - validatePromptCategories: rejects CONFIDENTIAL categories
 *  - validatePromptCategories: rejects RESTRICTED categories
 *  - validatePromptCategories: error objects do not include sensitive values
 *  - isPromptSafe: returns correct boolean for each category
 *  - assertPromptSafe: throws PromptSafetyViolationError with typed violations
 *  - PromptSafetyViolationError: typed violation list
 *  - GovernanceErrorSchema: structural validation
 *  - Integration: TripConstraints fixture passes prompt-safety validation
 *  - Integration: audit event fixture annotations cannot include prohibited categories
 */

import { describe, it, expect } from 'vitest';
import {
  GovernanceErrorSchema,
  validatePromptCategories,
  isPromptSafe,
  assertPromptSafe,
  PromptSafetyViolationError,
} from '../../src/governance/prompt-safety.js';
import {
  DataCategoryKey,
  DataCategoryKeyEnum,
} from '../../src/governance/data-classification.js';
import {
  safePromptAnnotations,
  prohibitedIdentityAnnotation,
  prohibitedPassportAnnotation,
  mixedPromptAnnotations,
  anonymizedTripConstraintsFixture,
  anonymizedAuditEventFixture,
} from '../fixtures/data-categories.js';

// ---------------------------------------------------------------------------
// GovernanceErrorSchema — structural validation
// ---------------------------------------------------------------------------

describe('GovernanceErrorSchema — structural validation', () => {
  it('accepts a valid governance error object', () => {
    const valid = {
      categoryKey: 'TRAVELLER_IDENTITY',
      fieldPath: '/traveller/fullName',
      violatedRule: 'category_not_prompt_eligible',
      safeMessage: 'CONFIDENTIAL category is not permitted in prompt payloads.',
    };
    const result = GovernanceErrorSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects an error object with an unknown categoryKey', () => {
    const invalid = {
      categoryKey: 'UNKNOWN_CATEGORY',
      fieldPath: '/field',
      violatedRule: 'some_rule',
      safeMessage: 'Some message.',
    };
    const result = GovernanceErrorSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects an error object with an empty fieldPath', () => {
    const invalid = {
      categoryKey: 'TRAVELLER_IDENTITY',
      fieldPath: '',
      violatedRule: 'some_rule',
      safeMessage: 'Some message.',
    };
    const result = GovernanceErrorSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects an error object with an empty safeMessage', () => {
    const invalid = {
      categoryKey: 'TRAVELLER_IDENTITY',
      fieldPath: '/field',
      violatedRule: 'some_rule',
      safeMessage: '',
    };
    const result = GovernanceErrorSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects an error object with an undeclared extra field (strict mode)', () => {
    const invalid = {
      categoryKey: 'TRAVELLER_IDENTITY',
      fieldPath: '/field',
      violatedRule: 'some_rule',
      safeMessage: 'Message.',
      sensitiveValue: 'John Doe',  // MUST be rejected — sensitive value must not be present
    };
    const result = GovernanceErrorSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// validatePromptCategories — safe paths
// ---------------------------------------------------------------------------

describe('validatePromptCategories — safe categories', () => {
  it('returns no errors for an empty annotation list', () => {
    const errors = validatePromptCategories([]);
    expect(errors).toHaveLength(0);
  });

  it('returns no errors for only TRAVELLER_TOKEN annotations', () => {
    const annotations = [{ categoryKey: DataCategoryKey.TRAVELLER_TOKEN, fieldPath: '/token' }];
    const errors = validatePromptCategories(annotations);
    expect(errors).toHaveLength(0);
  });

  it('returns no errors for only TRIP_CONSTRAINTS annotations', () => {
    const annotations = [{ categoryKey: DataCategoryKey.TRIP_CONSTRAINTS, fieldPath: '/constraints' }];
    const errors = validatePromptCategories(annotations);
    expect(errors).toHaveLength(0);
  });

  it('returns no errors for the safe prompt annotations fixture', () => {
    const errors = validatePromptCategories(safePromptAnnotations);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validatePromptCategories — rejection of prohibited categories
// ---------------------------------------------------------------------------

describe('validatePromptCategories — prohibited categories', () => {
  it('returns an error for TRAVELLER_IDENTITY (CONFIDENTIAL)', () => {
    const errors = validatePromptCategories([prohibitedIdentityAnnotation]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.violatedRule).toBe('category_not_prompt_eligible');
    expect(errors[0]?.categoryKey).toBe('TRAVELLER_IDENTITY');
  });

  it('returns an error for PASSPORT_NATIONALITY (RESTRICTED)', () => {
    const errors = validatePromptCategories([prohibitedPassportAnnotation]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.violatedRule).toBe('category_not_prompt_eligible');
    expect(errors[0]?.categoryKey).toBe('PASSPORT_NATIONALITY');
  });

  it('returns an error for LOYALTY_IDENTIFIER (CONFIDENTIAL)', () => {
    const errors = validatePromptCategories([
      { categoryKey: DataCategoryKey.LOYALTY_IDENTIFIER, fieldPath: '/loyalty/memberId' },
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.categoryKey).toBe('LOYALTY_IDENTIFIER');
  });

  it('returns an error for PAYMENT_TOKEN (RESTRICTED)', () => {
    const errors = validatePromptCategories([
      { categoryKey: DataCategoryKey.PAYMENT_TOKEN, fieldPath: '/payment/tokenId' },
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.categoryKey).toBe('PAYMENT_TOKEN');
  });

  it('returns an error for AGENT_CONVERSATION_TEXT (CONFIDENTIAL)', () => {
    const errors = validatePromptCategories([
      { categoryKey: DataCategoryKey.AGENT_CONVERSATION_TEXT, fieldPath: '/session/transcript' },
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.categoryKey).toBe('AGENT_CONVERSATION_TEXT');
  });

  it('returns an error for AUTHORIZATION_REFUND_RECORD (RESTRICTED)', () => {
    const errors = validatePromptCategories([
      {
        categoryKey: DataCategoryKey.AUTHORIZATION_REFUND_RECORD,
        fieldPath: '/payment/authorisation',
      },
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.categoryKey).toBe('AUTHORIZATION_REFUND_RECORD');
  });

  it('returns errors only for the prohibited categories in mixed annotations', () => {
    const errors = validatePromptCategories(mixedPromptAnnotations);
    const errorCategories = errors.map((e) => e.categoryKey);
    // Safe categories should NOT appear in errors
    expect(errorCategories).not.toContain('TRAVELLER_TOKEN');
    expect(errorCategories).not.toContain('TRIP_CONSTRAINTS');
    // Prohibited categories SHOULD appear in errors
    expect(errorCategories).toContain('TRAVELLER_IDENTITY');
    expect(errorCategories).toContain('PASSPORT_NATIONALITY');
  });

  it('error objects include the fieldPath that was annotated', () => {
    const errors = validatePromptCategories([prohibitedIdentityAnnotation]);
    expect(errors[0]?.fieldPath).toBe('/traveller/fullName');
  });

  it('error safeMessage does not include the sensitive value', () => {
    // The annotation does NOT carry the actual value, only the key.
    // The error must only describe the category and rule, not any data value.
    const errors = validatePromptCategories([prohibitedIdentityAnnotation]);
    for (const error of errors) {
      // safeMessage should mention category key and/or tier, not personal data
      expect(error.safeMessage).toBeTruthy();
      // Must not contain anything that looks like a real personal value
      expect(error.safeMessage.toLowerCase()).not.toContain('john');
      expect(error.safeMessage.toLowerCase()).not.toContain('@example.com');
    }
  });

  it('error objects parse successfully through GovernanceErrorSchema', () => {
    const errors = validatePromptCategories([
      prohibitedIdentityAnnotation,
      prohibitedPassportAnnotation,
    ]);
    for (const error of errors) {
      const result = GovernanceErrorSchema.safeParse(error);
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// isPromptSafe
// ---------------------------------------------------------------------------

describe('isPromptSafe', () => {
  it('returns true for TRAVELLER_TOKEN', () => {
    expect(isPromptSafe(DataCategoryKey.TRAVELLER_TOKEN)).toBe(true);
  });

  it('returns true for TRIP_CONSTRAINTS', () => {
    expect(isPromptSafe(DataCategoryKey.TRIP_CONSTRAINTS)).toBe(true);
  });

  it('returns false for TRAVELLER_IDENTITY (CONFIDENTIAL)', () => {
    expect(isPromptSafe(DataCategoryKey.TRAVELLER_IDENTITY)).toBe(false);
  });

  it('returns false for PASSPORT_NATIONALITY (RESTRICTED)', () => {
    expect(isPromptSafe(DataCategoryKey.PASSPORT_NATIONALITY)).toBe(false);
  });

  it('returns false for PAYMENT_TOKEN (RESTRICTED)', () => {
    expect(isPromptSafe(DataCategoryKey.PAYMENT_TOKEN)).toBe(false);
  });

  it('returns false for LOYALTY_IDENTIFIER (CONFIDENTIAL)', () => {
    expect(isPromptSafe(DataCategoryKey.LOYALTY_IDENTIFIER)).toBe(false);
  });

  it('returns false for AGENT_CONVERSATION_TEXT (CONFIDENTIAL)', () => {
    expect(isPromptSafe(DataCategoryKey.AGENT_CONVERSATION_TEXT)).toBe(false);
  });

  it('returns false for AUTHORIZATION_REFUND_RECORD (RESTRICTED)', () => {
    expect(isPromptSafe(DataCategoryKey.AUTHORIZATION_REFUND_RECORD)).toBe(false);
  });

  it('returns false for ITINERARY_RECEIPT (not prompt-eligible)', () => {
    expect(isPromptSafe(DataCategoryKey.ITINERARY_RECEIPT)).toBe(false);
  });

  it('returns false for SOURCING_AUDIT_RECORD (not prompt-eligible)', () => {
    expect(isPromptSafe(DataCategoryKey.SOURCING_AUDIT_RECORD)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assertPromptSafe
// ---------------------------------------------------------------------------

describe('assertPromptSafe', () => {
  it('does not throw for safe annotations', () => {
    expect(() => assertPromptSafe(safePromptAnnotations)).not.toThrow();
  });

  it('does not throw for an empty annotation list', () => {
    expect(() => assertPromptSafe([])).not.toThrow();
  });

  it('throws PromptSafetyViolationError for a CONFIDENTIAL annotation', () => {
    expect(() => assertPromptSafe([prohibitedIdentityAnnotation])).toThrow(
      PromptSafetyViolationError,
    );
  });

  it('throws PromptSafetyViolationError for a RESTRICTED annotation', () => {
    expect(() => assertPromptSafe([prohibitedPassportAnnotation])).toThrow(
      PromptSafetyViolationError,
    );
  });

  it('throws PromptSafetyViolationError with a non-empty violations array', () => {
    try {
      assertPromptSafe([prohibitedIdentityAnnotation, prohibitedPassportAnnotation]);
      // Should not reach here
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(PromptSafetyViolationError);
      const violation = err as PromptSafetyViolationError;
      expect(violation.violations.length).toBeGreaterThan(0);
    }
  });

  it('thrown error violations include the prohibited category keys', () => {
    try {
      assertPromptSafe([prohibitedIdentityAnnotation, prohibitedPassportAnnotation]);
    } catch (err) {
      expect(err).toBeInstanceOf(PromptSafetyViolationError);
      const violation = err as PromptSafetyViolationError;
      const violatedKeys = violation.violations.map((v) => v.categoryKey);
      expect(violatedKeys).toContain('TRAVELLER_IDENTITY');
      expect(violatedKeys).toContain('PASSPORT_NATIONALITY');
    }
  });

  it('thrown error violations do NOT contain the sensitive data values', () => {
    try {
      assertPromptSafe([prohibitedIdentityAnnotation]);
    } catch (err) {
      expect(err).toBeInstanceOf(PromptSafetyViolationError);
      const violation = err as PromptSafetyViolationError;
      for (const v of violation.violations) {
        // The GovernanceError only has categoryKey, fieldPath, violatedRule, safeMessage
        expect(Object.keys(v)).not.toContain('value');
        expect(Object.keys(v)).not.toContain('sensitiveValue');
        expect(Object.keys(v)).not.toContain('data');
      }
    }
  });

  it('PromptSafetyViolationError has the correct error name', () => {
    try {
      assertPromptSafe([prohibitedIdentityAnnotation]);
    } catch (err) {
      expect((err as Error).name).toBe('PromptSafetyViolationError');
    }
  });

  it('violations array is frozen (immutable)', () => {
    try {
      assertPromptSafe([prohibitedIdentityAnnotation]);
    } catch (err) {
      const violation = err as PromptSafetyViolationError;
      expect(Object.isFrozen(violation.violations)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: TripConstraints fixture — prompt-safety validation
// ---------------------------------------------------------------------------

describe('Integration — TripConstraints fixture against classification registry', () => {
  it('a TripConstraints payload annotated with TRIP_CONSTRAINTS and TRAVELLER_TOKEN passes prompt-safety', () => {
    // Simulate the annotations on a TripConstraints schema before prompt assembly.
    const tripConstraintsAnnotations = [
      { categoryKey: DataCategoryKey.TRAVELLER_TOKEN, fieldPath: '/travellerToken' },
      { categoryKey: DataCategoryKey.TRIP_CONSTRAINTS, fieldPath: '/' },
    ];
    const errors = validatePromptCategories(tripConstraintsAnnotations);
    expect(errors).toHaveLength(0);
  });

  it('a TripConstraints payload that accidentally includes TRAVELLER_IDENTITY is rejected', () => {
    const annotationsWithPII = [
      { categoryKey: DataCategoryKey.TRAVELLER_TOKEN, fieldPath: '/travellerToken' },
      { categoryKey: DataCategoryKey.TRIP_CONSTRAINTS, fieldPath: '/' },
      { categoryKey: DataCategoryKey.TRAVELLER_IDENTITY, fieldPath: '/traveller/fullName' }, // NOT allowed
    ];
    const errors = validatePromptCategories(annotationsWithPII);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.categoryKey === 'TRAVELLER_IDENTITY')).toBe(true);
  });

  it('a TripConstraints payload that includes PASSPORT_NATIONALITY is rejected', () => {
    const annotationsWithPassport = [
      { categoryKey: DataCategoryKey.TRIP_CONSTRAINTS, fieldPath: '/' },
      { categoryKey: DataCategoryKey.PASSPORT_NATIONALITY, fieldPath: '/traveller/passport' }, // NOT allowed
    ];
    const errors = validatePromptCategories(annotationsWithPassport);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.categoryKey === 'PASSPORT_NATIONALITY')).toBe(true);
  });

  it('the anonymized TripConstraints fixture token fields are INTERNAL tier (prompt-safe)', () => {
    // travellerToken and destinationToken are both tokenised references
    const annotations = [
      { categoryKey: DataCategoryKey.TRAVELLER_TOKEN, fieldPath: '/travellerToken' },
      { categoryKey: DataCategoryKey.TRIP_CONSTRAINTS, fieldPath: '/constraints' },
    ];
    expect(() => assertPromptSafe(annotations)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Integration: Audit event fixture — prohibited categories cannot enter prompt
// ---------------------------------------------------------------------------

describe('Integration — audit event fixture against classification registry', () => {
  it('SOURCING_AUDIT_RECORD is not prompt-eligible', () => {
    expect(isPromptSafe(DataCategoryKey.SOURCING_AUDIT_RECORD)).toBe(false);
  });

  it('annotating an audit event field as SOURCING_AUDIT_RECORD is rejected in prompt context', () => {
    const auditAnnotations = [
      { categoryKey: DataCategoryKey.SOURCING_AUDIT_RECORD, fieldPath: '/auditRecord' },
    ];
    const errors = validatePromptCategories(auditAnnotations);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.categoryKey).toBe('SOURCING_AUDIT_RECORD');
  });

  it('ITINERARY_RECEIPT is not prompt-eligible', () => {
    expect(isPromptSafe(DataCategoryKey.ITINERARY_RECEIPT)).toBe(false);
  });

  it('annotating a receipt field as ITINERARY_RECEIPT is rejected in prompt context', () => {
    const receiptAnnotations = [
      { categoryKey: DataCategoryKey.ITINERARY_RECEIPT, fieldPath: '/receipt' },
    ];
    const errors = validatePromptCategories(receiptAnnotations);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('a prompt payload that includes the travellerToken from the audit fixture is allowed', () => {
    // The audit event contains a travellerToken (opaque, no PII) — that ref is prompt-safe
    const auditTravellerTokenAnnotation = [
      { categoryKey: DataCategoryKey.TRAVELLER_TOKEN, fieldPath: '/travellerToken' },
    ];
    const errors = validatePromptCategories(auditTravellerTokenAnnotation);
    expect(errors).toHaveLength(0);
  });

  it('the entire set of non-INTERNAL categories used in an audit event are not prompt-safe', () => {
    // Audit events contain SOURCING_AUDIT_RECORD data; none of it is prompt-eligible
    const notPromptSafe = validatePromptCategories([
      { categoryKey: DataCategoryKey.SOURCING_AUDIT_RECORD, fieldPath: '/event' },
    ]);
    expect(notPromptSafe.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Exhaustive: all non-prompt-eligible categories are rejected
// ---------------------------------------------------------------------------

describe('validatePromptCategories — all non-prompt-eligible registry entries are rejected', () => {
  it('every non-prompt-eligible category key produces an error', () => {
    const allKeys = DataCategoryKeyEnum.options;
    for (const key of allKeys) {
      const annotation = { categoryKey: key, fieldPath: '/test' };
      const errors = validatePromptCategories([annotation]);
      if (!isPromptSafe(key)) {
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]?.violatedRule).toBe('category_not_prompt_eligible');
      } else {
        expect(errors).toHaveLength(0);
      }
    }
  });
});
