/**
 * Unit tests for @voya/contracts — Data category classification registry
 *
 * Tests cover:
 *  - Registry completeness: all required launch categories are present
 *  - lookupDataCategory: returns the correct entry for each key
 *  - DataCategoryEntrySchema: validates entry shapes
 *  - validateDataCategoryEntry: rejects RESTRICTED entries missing protections
 *  - validateDataCategoryEntry: rejects CONFIDENTIAL/RESTRICTED prompt-eligible entries
 *  - Classification invariants: all RESTRICTED entries in the registry satisfy protection rules
 *  - Prompt eligibility: only INTERNAL/PUBLIC entries can be prompt-eligible
 *  - Retention policy key coverage: every registry entry references a known policy key
 */

import { describe, it, expect } from 'vitest';
import {
  DataCategoryKeyEnum,
  DataCategoryKey,
  DataCategoryEntrySchema,
  DATA_CATEGORY_REGISTRY,
  lookupDataCategory,
  validateDataCategoryEntry,
} from '../../src/governance/data-classification.js';
import { RETENTION_POLICY_REGISTRY } from '../../src/governance/retention-policy.js';
import {
  safeTravellerTokenEntry,
  safeTripConstraintsEntry,
  prohibitedTravellerIdentityEntry,
  prohibitedPassportEntry,
  invalidRestrictedEntryMissingProtections,
  invalidConfidentialPromptEligibleEntry,
  invalidRestrictedPromptEligibleEntry,
} from '../fixtures/data-categories.js';

// ---------------------------------------------------------------------------
// Registry completeness — all launch categories must be present
// ---------------------------------------------------------------------------

describe('DATA_CATEGORY_REGISTRY — completeness', () => {
  it('contains all DataCategoryKey enum values', () => {
    const registryKeys = Object.keys(DATA_CATEGORY_REGISTRY);
    const enumValues = DataCategoryKeyEnum.options;
    for (const key of enumValues) {
      expect(registryKeys).toContain(key);
    }
  });

  it('contains the TRAVELLER_IDENTITY category', () => {
    expect(DATA_CATEGORY_REGISTRY.TRAVELLER_IDENTITY).toBeDefined();
  });

  it('contains the TRAVELLER_TOKEN category', () => {
    expect(DATA_CATEGORY_REGISTRY.TRAVELLER_TOKEN).toBeDefined();
  });

  it('contains the PASSPORT_NATIONALITY category', () => {
    expect(DATA_CATEGORY_REGISTRY.PASSPORT_NATIONALITY).toBeDefined();
  });

  it('contains the LOYALTY_IDENTIFIER category', () => {
    expect(DATA_CATEGORY_REGISTRY.LOYALTY_IDENTIFIER).toBeDefined();
  });

  it('contains the PAYMENT_TOKEN category', () => {
    expect(DATA_CATEGORY_REGISTRY.PAYMENT_TOKEN).toBeDefined();
  });

  it('contains the AUTHORIZATION_REFUND_RECORD category', () => {
    expect(DATA_CATEGORY_REGISTRY.AUTHORIZATION_REFUND_RECORD).toBeDefined();
  });

  it('contains the AGENT_CONVERSATION_TEXT category', () => {
    expect(DATA_CATEGORY_REGISTRY.AGENT_CONVERSATION_TEXT).toBeDefined();
  });

  it('contains the TRIP_CONSTRAINTS category', () => {
    expect(DATA_CATEGORY_REGISTRY.TRIP_CONSTRAINTS).toBeDefined();
  });

  it('contains the ITINERARY_RECEIPT category', () => {
    expect(DATA_CATEGORY_REGISTRY.ITINERARY_RECEIPT).toBeDefined();
  });

  it('contains the SOURCING_AUDIT_RECORD category', () => {
    expect(DATA_CATEGORY_REGISTRY.SOURCING_AUDIT_RECORD).toBeDefined();
  });

  it('contains the SUPPLIER_CAPABILITY_MANIFEST category', () => {
    expect(DATA_CATEGORY_REGISTRY.SUPPLIER_CAPABILITY_MANIFEST).toBeDefined();
  });

  it('contains the ADMIN_APPROVAL_EVIDENCE category', () => {
    expect(DATA_CATEGORY_REGISTRY.ADMIN_APPROVAL_EVIDENCE).toBeDefined();
  });

  it('has exactly as many entries as DataCategoryKey enum values', () => {
    const registryKeys = Object.keys(DATA_CATEGORY_REGISTRY);
    const enumValues = DataCategoryKeyEnum.options;
    expect(registryKeys).toHaveLength(enumValues.length);
  });
});

// ---------------------------------------------------------------------------
// lookupDataCategory — lookup by key
// ---------------------------------------------------------------------------

describe('lookupDataCategory', () => {
  it('returns the correct entry for TRAVELLER_TOKEN', () => {
    const entry = lookupDataCategory(DataCategoryKey.TRAVELLER_TOKEN);
    expect(entry.key).toBe('TRAVELLER_TOKEN');
    expect(entry.tier).toBe('INTERNAL');
    expect(entry.promptEligible).toBe(true);
  });

  it('returns the correct entry for TRAVELLER_IDENTITY', () => {
    const entry = lookupDataCategory(DataCategoryKey.TRAVELLER_IDENTITY);
    expect(entry.key).toBe('TRAVELLER_IDENTITY');
    expect(entry.tier).toBe('CONFIDENTIAL');
    expect(entry.promptEligible).toBe(false);
  });

  it('returns the correct entry for PASSPORT_NATIONALITY', () => {
    const entry = lookupDataCategory(DataCategoryKey.PASSPORT_NATIONALITY);
    expect(entry.key).toBe('PASSPORT_NATIONALITY');
    expect(entry.tier).toBe('RESTRICTED');
    expect(entry.promptEligible).toBe(false);
  });

  it('returns the correct entry for TRIP_CONSTRAINTS', () => {
    const entry = lookupDataCategory(DataCategoryKey.TRIP_CONSTRAINTS);
    expect(entry.key).toBe('TRIP_CONSTRAINTS');
    expect(entry.tier).toBe('INTERNAL');
    expect(entry.promptEligible).toBe(true);
  });

  it('returns the correct entry for PAYMENT_TOKEN', () => {
    const entry = lookupDataCategory(DataCategoryKey.PAYMENT_TOKEN);
    expect(entry.key).toBe('PAYMENT_TOKEN');
    expect(entry.tier).toBe('RESTRICTED');
    expect(entry.promptEligible).toBe(false);
  });

  it('returns a non-null entry for every registered key', () => {
    for (const key of DataCategoryKeyEnum.options) {
      const entry = lookupDataCategory(key);
      expect(entry).toBeDefined();
      expect(entry.key).toBe(key);
    }
  });
});

// ---------------------------------------------------------------------------
// DataCategoryEntrySchema — structural validation
// ---------------------------------------------------------------------------

describe('DataCategoryEntrySchema — structural validation', () => {
  it('accepts a valid INTERNAL prompt-eligible entry (TRAVELLER_TOKEN fixture)', () => {
    const result = DataCategoryEntrySchema.safeParse(safeTravellerTokenEntry);
    expect(result.success).toBe(true);
  });

  it('accepts a valid INTERNAL prompt-eligible entry (TRIP_CONSTRAINTS fixture)', () => {
    const result = DataCategoryEntrySchema.safeParse(safeTripConstraintsEntry);
    expect(result.success).toBe(true);
  });

  it('accepts a valid CONFIDENTIAL entry (TRAVELLER_IDENTITY fixture)', () => {
    const result = DataCategoryEntrySchema.safeParse(prohibitedTravellerIdentityEntry);
    expect(result.success).toBe(true);
  });

  it('accepts a valid RESTRICTED entry (PASSPORT_NATIONALITY fixture)', () => {
    const result = DataCategoryEntrySchema.safeParse(prohibitedPassportEntry);
    expect(result.success).toBe(true);
  });

  it('rejects an entry with an empty description', () => {
    const invalid = { ...safeTravellerTokenEntry, description: '' };
    const result = DataCategoryEntrySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects an entry with an empty retentionPolicyKey', () => {
    const invalid = { ...safeTravellerTokenEntry, retentionPolicyKey: '' };
    const result = DataCategoryEntrySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects an entry with an invalid tier value', () => {
    const invalid = { ...safeTravellerTokenEntry, tier: 'TOP_SECRET' };
    const result = DataCategoryEntrySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects an entry with an invalid category key', () => {
    const invalid = { ...safeTravellerTokenEntry, key: 'UNKNOWN_KEY' };
    const result = DataCategoryEntrySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateDataCategoryEntry — business rule validation
// ---------------------------------------------------------------------------

describe('validateDataCategoryEntry — RESTRICTED protection requirements', () => {
  it('returns no errors for a valid RESTRICTED entry (PASSPORT_NATIONALITY)', () => {
    const entry = lookupDataCategory(DataCategoryKey.PASSPORT_NATIONALITY);
    const errors = validateDataCategoryEntry(entry);
    expect(errors).toHaveLength(0);
  });

  it('returns no errors for a valid RESTRICTED entry (PAYMENT_TOKEN)', () => {
    const entry = lookupDataCategory(DataCategoryKey.PAYMENT_TOKEN);
    const errors = validateDataCategoryEntry(entry);
    expect(errors).toHaveLength(0);
  });

  it('returns errors for a RESTRICTED entry missing all protection requirements', () => {
    const errors = validateDataCategoryEntry(invalidRestrictedEntryMissingProtections);
    expect(errors.length).toBeGreaterThan(0);
    const rules = errors.map((e) => e.violatedRule);
    expect(rules).toContain('restricted_requires_encryption');
    expect(rules).toContain('restricted_requires_log_masking');
    expect(rules).toContain('restricted_requires_non_prod_anonymization');
  });

  it('error objects do not include sensitive category data values', () => {
    const errors = validateDataCategoryEntry(invalidRestrictedEntryMissingProtections);
    for (const error of errors) {
      // safeMessage should describe the rule violation, not the data value
      expect(error.safeMessage).not.toContain('passport');
      expect(error.safeMessage).not.toContain('document');
      expect(error.safeMessage).not.toContain(invalidRestrictedEntryMissingProtections.description);
    }
  });

  it('reports violated rule identifiers in a machine-readable form', () => {
    const errors = validateDataCategoryEntry(invalidRestrictedEntryMissingProtections);
    for (const error of errors) {
      // Rule identifiers should be lowercase_snake_case
      expect(error.violatedRule).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

describe('validateDataCategoryEntry — prompt eligibility rules', () => {
  it('returns an error for a CONFIDENTIAL entry marked prompt-eligible', () => {
    const errors = validateDataCategoryEntry(invalidConfidentialPromptEligibleEntry);
    const rules = errors.map((e) => e.violatedRule);
    expect(rules).toContain('confidential_restricted_not_prompt_eligible');
  });

  it('returns an error for a RESTRICTED entry marked prompt-eligible', () => {
    const errors = validateDataCategoryEntry(invalidRestrictedPromptEligibleEntry);
    const rules = errors.map((e) => e.violatedRule);
    expect(rules).toContain('confidential_restricted_not_prompt_eligible');
  });

  it('returns no errors for a valid INTERNAL prompt-eligible entry (TRAVELLER_TOKEN)', () => {
    const errors = validateDataCategoryEntry(safeTravellerTokenEntry);
    expect(errors).toHaveLength(0);
  });

  it('returns no errors for a valid INTERNAL prompt-eligible entry (TRIP_CONSTRAINTS)', () => {
    const errors = validateDataCategoryEntry(safeTripConstraintsEntry);
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Registry-wide invariant checks
// ---------------------------------------------------------------------------

describe('DATA_CATEGORY_REGISTRY — classification invariants', () => {
  it('all RESTRICTED registry entries pass validateDataCategoryEntry', () => {
    for (const entry of Object.values(DATA_CATEGORY_REGISTRY)) {
      if (entry.tier === 'RESTRICTED') {
        const errors = validateDataCategoryEntry(entry);
        expect(errors).toHaveLength(0);
      }
    }
  });

  it('no CONFIDENTIAL or RESTRICTED registry entry is prompt-eligible', () => {
    for (const entry of Object.values(DATA_CATEGORY_REGISTRY)) {
      if (entry.tier === 'CONFIDENTIAL' || entry.tier === 'RESTRICTED') {
        expect(entry.promptEligible).toBe(false);
      }
    }
  });

  it('all RESTRICTED entries declare requiresEncryption, requiresLogMasking, and requiresNonProdAnonymization', () => {
    for (const entry of Object.values(DATA_CATEGORY_REGISTRY)) {
      if (entry.tier === 'RESTRICTED') {
        expect(entry.requiresEncryption).toBe(true);
        expect(entry.requiresLogMasking).toBe(true);
        expect(entry.requiresNonProdAnonymization).toBe(true);
      }
    }
  });

  it('TRAVELLER_TOKEN is the only TRAVELLER category that is prompt-eligible', () => {
    const travellerToken = lookupDataCategory(DataCategoryKey.TRAVELLER_TOKEN);
    const travellerIdentity = lookupDataCategory(DataCategoryKey.TRAVELLER_IDENTITY);
    expect(travellerToken.promptEligible).toBe(true);
    expect(travellerIdentity.promptEligible).toBe(false);
  });

  it('every registry entry references a known retention policy key', () => {
    const policyKeys = Object.keys(RETENTION_POLICY_REGISTRY);
    for (const entry of Object.values(DATA_CATEGORY_REGISTRY)) {
      expect(policyKeys).toContain(entry.retentionPolicyKey);
    }
  });

  it('all registry entries parse successfully through DataCategoryEntrySchema', () => {
    for (const entry of Object.values(DATA_CATEGORY_REGISTRY)) {
      const result = DataCategoryEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    }
  });

  it('TRAVELLER_TOKEN tier is INTERNAL (tokenised references must not be CONFIDENTIAL)', () => {
    expect(DATA_CATEGORY_REGISTRY.TRAVELLER_TOKEN.tier).toBe('INTERNAL');
  });

  it('TRIP_CONSTRAINTS tier is INTERNAL and prompt-eligible', () => {
    const entry = DATA_CATEGORY_REGISTRY.TRIP_CONSTRAINTS;
    expect(entry.tier).toBe('INTERNAL');
    expect(entry.promptEligible).toBe(true);
  });

  it('SUPPLIER_CAPABILITY_MANIFEST tier is PUBLIC', () => {
    expect(DATA_CATEGORY_REGISTRY.SUPPLIER_CAPABILITY_MANIFEST.tier).toBe('PUBLIC');
  });
});
