/**
 * Unit tests for @voya/contracts — Supplier Capability Manifest
 *
 * Tests cover:
 *  - Schema validation: accepts valid manifests of all supplier types
 *  - Schema validation: rejects structurally invalid manifests
 *  - validateManifest: certification enforcement for FULLY_BOOKABLE suppliers
 *  - validateManifest: deep-link suppliers must not have checkout operations
 *  - validateManifest: public landmark exemption rules
 *  - validateManifest: priced supplier must declare rate refresh latency
 *  - validateManifest: failing fixture outcomes rejected
 *  - isExemptPublicLandmark helper
 *  - FixtureEvidenceSchema validation
 */

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  SupplierCapabilityManifestSchema,
  FixtureEvidenceSchema,
  SupplierCertificationStatus,
  SupplierCertificationStatusEnum,
  CancellationSemantics,
  CancellationSemanticsEnum,
  RefundSemantics,
  RefundSemanticsEnum,
  SupplierOperation,
  SupplierOperationEnum,
  validateManifest,
  isExemptPublicLandmark,
} from '../../src/supplier/capability-manifest.js';
import {
  hvmiManifest,
  marriottBrandManifest,
  amadeusManifest,
  bonvoyToursManifest,
  publicLandmarkManifest,
  uncertifiedSupplierManifest,
  failingBookFixtureManifest,
  deepLinkWithCheckoutOpsManifest,
  pricedWithoutRateLatencyManifest,
  pricedPublicLandmarkManifest,
} from '../fixtures/supplier-manifests.js';

// ---------------------------------------------------------------------------
// SupplierCapabilityManifestSchema — valid manifests
// ---------------------------------------------------------------------------

describe('SupplierCapabilityManifestSchema — valid manifests', () => {
  it('accepts the HVMI certified fully-bookable manifest', () => {
    const result = SupplierCapabilityManifestSchema.safeParse(hvmiManifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.supplierId).toBe('sup_test_hvmi_accommodation_001');
      expect(result.data.certificationStatus).toBe('CERTIFIED');
      expect(result.data.bookabilityMode).toBe('FULLY_BOOKABLE');
    }
  });

  it('accepts the Marriott brand certified fully-bookable manifest', () => {
    const result = SupplierCapabilityManifestSchema.safeParse(marriottBrandManifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceClassification).toBe('MARRIOTT_OWNED');
    }
  });

  it('accepts the Amadeus GDS flights manifest', () => {
    const result = SupplierCapabilityManifestSchema.safeParse(amadeusManifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe('FLIGHTS');
      expect(result.data.cancellationSemantics).toBe('PARTIAL_REFUND');
      expect(result.data.refundSemantics).toBe('SUPPLIER_INITIATED');
    }
  });

  it('accepts the Bonvoy Tours and Activities manifest', () => {
    const result = SupplierCapabilityManifestSchema.safeParse(bonvoyToursManifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe('ACTIVITIES');
    }
  });

  it('accepts the public landmark non-priced deep-link manifest', () => {
    const result = SupplierCapabilityManifestSchema.safeParse(publicLandmarkManifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceClassification).toBe('EXEMPT_PUBLIC');
      expect(result.data.bookabilityMode).toBe('DEEP_LINK_ONLY');
      expect(result.data.isPriced).toBe(false);
      expect(result.data.fixtureEvidence).toBeUndefined();
    }
  });

  it('accepts the uncertified supplier manifest (structurally valid)', () => {
    const result = SupplierCapabilityManifestSchema.safeParse(uncertifiedSupplierManifest);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SupplierCapabilityManifestSchema — structural rejection
// ---------------------------------------------------------------------------

describe('SupplierCapabilityManifestSchema — structural rejection', () => {
  it('rejects a manifest with an empty supplierId', () => {
    const invalid = { ...hvmiManifest, supplierId: '' };
    const result = SupplierCapabilityManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      expect(result.error.issues.some((i) => i.path.includes('supplierId'))).toBe(true);
    }
  });

  it('rejects a manifest with negative availabilityRefreshLatencySeconds', () => {
    const invalid = { ...hvmiManifest, availabilityRefreshLatencySeconds: -1 };
    const result = SupplierCapabilityManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with zero availabilityRefreshLatencySeconds', () => {
    const invalid = { ...hvmiManifest, availabilityRefreshLatencySeconds: 0 };
    const result = SupplierCapabilityManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with a float availabilityRefreshLatencySeconds', () => {
    const invalid = { ...hvmiManifest, availabilityRefreshLatencySeconds: 300.5 };
    const result = SupplierCapabilityManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with an empty supportedOperations array', () => {
    const invalid = { ...hvmiManifest, supportedOperations: [] };
    const result = SupplierCapabilityManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with an invalid domain value', () => {
    const invalid = { ...hvmiManifest, domain: 'HOTELS' };
    const result = SupplierCapabilityManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with an invalid sourceClassification', () => {
    const invalid = { ...hvmiManifest, sourceClassification: 'THIRD_PARTY' };
    const result = SupplierCapabilityManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with an invalid bookabilityMode', () => {
    const invalid = { ...hvmiManifest, bookabilityMode: 'PARTIALLY_BOOKABLE' };
    const result = SupplierCapabilityManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with an invalid certificationStatus', () => {
    const invalid = { ...hvmiManifest, certificationStatus: 'APPROVED' };
    const result = SupplierCapabilityManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with a malformed lastReviewedAt datetime', () => {
    const invalid = { ...hvmiManifest, lastReviewedAt: 'not-a-date' };
    const result = SupplierCapabilityManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a manifest with an empty manifestVersion', () => {
    const invalid = { ...hvmiManifest, manifestVersion: '' };
    const result = SupplierCapabilityManifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FixtureEvidenceSchema
// ---------------------------------------------------------------------------

describe('FixtureEvidenceSchema', () => {
  it('accepts a valid passing fixture evidence', () => {
    const result = FixtureEvidenceSchema.safeParse(hvmiManifest.fixtureEvidence);
    expect(result.success).toBe(true);
  });

  it('accepts a fixture evidence with FAIL outcomes (structurally valid)', () => {
    const evidence = {
      fixtureId: 'fix_test_001',
      bookOutcome: 'FAIL',
      cancelOutcome: 'PASS',
      testedAt: '2026-07-01T09:00:00Z',
      testedByAgent: 'fixture-runner-v1',
    };
    const result = FixtureEvidenceSchema.safeParse(evidence);
    expect(result.success).toBe(true);
  });

  it('rejects fixture evidence with an empty fixtureId', () => {
    const invalid = { ...hvmiManifest.fixtureEvidence!, fixtureId: '' };
    const result = FixtureEvidenceSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects fixture evidence with a malformed testedAt datetime', () => {
    const invalid = { ...hvmiManifest.fixtureEvidence!, testedAt: 'yesterday' };
    const result = FixtureEvidenceSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects fixture evidence with an undeclared field (strict mode)', () => {
    const invalid = {
      ...hvmiManifest.fixtureEvidence!,
      rawLog: 'POST /book 200 OK', // must be rejected — no raw logs allowed
    };
    const result = FixtureEvidenceSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// validateManifest — certification enforcement
// ---------------------------------------------------------------------------

describe('validateManifest — certification enforcement', () => {
  it('returns no errors for the HVMI certified manifest', () => {
    expect(validateManifest(hvmiManifest)).toHaveLength(0);
  });

  it('returns no errors for the Marriott brand certified manifest', () => {
    expect(validateManifest(marriottBrandManifest)).toHaveLength(0);
  });

  it('returns no errors for the Amadeus certified manifest', () => {
    expect(validateManifest(amadeusManifest)).toHaveLength(0);
  });

  it('returns no errors for the Bonvoy Tours certified manifest', () => {
    expect(validateManifest(bonvoyToursManifest)).toHaveLength(0);
  });

  it('rejects an uncertified FULLY_BOOKABLE supplier (missing fixture evidence)', () => {
    const errors = validateManifest(uncertifiedSupplierManifest);
    expect(errors.length).toBeGreaterThan(0);
    const rules = errors.map((e) => e.violatedRule);
    expect(rules).toContain('bookable_requires_certified_status');
    expect(rules).toContain('bookable_requires_fixture_evidence');
  });

  it('rejects a manifest with a PENDING certificationStatus for FULLY_BOOKABLE', () => {
    const manifest = {
      ...hvmiManifest,
      supplierId: 'sup_test_pending_001',
      certificationStatus: SupplierCertificationStatus.PENDING,
    };
    const errors = validateManifest(manifest);
    expect(errors.some((e) => e.violatedRule === 'bookable_requires_certified_status')).toBe(true);
  });

  it('rejects a manifest with a failing book fixture outcome', () => {
    const errors = validateManifest(failingBookFixtureManifest);
    expect(errors.some((e) => e.violatedRule === 'certified_requires_passing_book_fixture')).toBe(true);
  });

  it('rejects a manifest with both failing fixture outcomes', () => {
    const manifest = {
      ...hvmiManifest,
      supplierId: 'sup_test_both_fail_001',
      fixtureEvidence: {
        ...hvmiManifest.fixtureEvidence!,
        bookOutcome: 'FAIL' as const,
        cancelOutcome: 'FAIL' as const,
      },
    };
    const errors = validateManifest(manifest);
    const rules = errors.map((e) => e.violatedRule);
    expect(rules).toContain('certified_requires_passing_book_fixture');
    expect(rules).toContain('certified_requires_passing_cancel_fixture');
  });

  it('error messages reference only supplierId and field, not confidential content', () => {
    const errors = validateManifest(uncertifiedSupplierManifest);
    for (const error of errors) {
      expect(error.supplierId).toBeTruthy();
      expect(error.field).toBeTruthy();
      expect(error.violatedRule).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

// ---------------------------------------------------------------------------
// validateManifest — deep-link operation constraints
// ---------------------------------------------------------------------------

describe('validateManifest — deep-link operation constraints', () => {
  it('returns no errors for the public landmark deep-link manifest', () => {
    expect(validateManifest(publicLandmarkManifest)).toHaveLength(0);
  });

  it('rejects a DEEP_LINK_ONLY manifest that declares the HOLD operation', () => {
    const errors = validateManifest(deepLinkWithCheckoutOpsManifest);
    expect(errors.some((e) => e.violatedRule === 'deep_link_cannot_have_checkout_operation')).toBe(true);
  });

  it('rejects a DEEP_LINK_ONLY manifest with COMMIT declared', () => {
    const manifest = {
      ...publicLandmarkManifest,
      supplierId: 'sup_test_deep_link_commit_001',
      isPriced: false,
      supportedOperations: ['DEEP_LINK', 'COMMIT'] as const,
    };
    const errors = validateManifest(manifest);
    expect(errors.some((e) => e.violatedRule === 'deep_link_cannot_have_checkout_operation')).toBe(true);
  });

  it('rejects a DEEP_LINK_ONLY manifest with REVERSE declared', () => {
    const manifest = {
      ...publicLandmarkManifest,
      supplierId: 'sup_test_deep_link_reverse_001',
      isPriced: false,
      supportedOperations: ['DEEP_LINK', 'REVERSE'] as const,
    };
    const errors = validateManifest(manifest);
    expect(errors.some((e) => e.violatedRule === 'deep_link_cannot_have_checkout_operation')).toBe(true);
  });

  it('accepts a DEEP_LINK_ONLY manifest with QUOTE and DEEP_LINK operations', () => {
    const manifest = {
      ...publicLandmarkManifest,
      supplierId: 'sup_test_deep_link_quote_001',
      sourceClassification: 'MARRIOTT_PARTNERED' as const,
      isPriced: true,
      rateRefreshLatencySeconds: 300,
      cancellationSemantics: 'NOT_APPLICABLE' as const,
      supportedOperations: ['QUOTE', 'DEEP_LINK'] as const,
      certificationStatus: 'UNCERTIFIED' as const,
    };
    const errors = validateManifest(manifest);
    expect(errors.every((e) => e.violatedRule !== 'deep_link_cannot_have_checkout_operation')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateManifest — public landmark exemption
// ---------------------------------------------------------------------------

describe('validateManifest — public landmark exemption', () => {
  it('returns no errors for a valid non-priced public landmark manifest', () => {
    expect(validateManifest(publicLandmarkManifest)).toHaveLength(0);
  });

  it('rejects a public landmark manifest with isPriced: true', () => {
    const errors = validateManifest(pricedPublicLandmarkManifest);
    expect(errors.some((e) => e.violatedRule === 'public_landmark_cannot_be_priced')).toBe(true);
  });

  it('rejects a public landmark manifest with FULLY_BOOKABLE bookabilityMode', () => {
    const manifest = {
      ...publicLandmarkManifest,
      supplierId: 'sup_test_exempt_public_bookable_001',
      bookabilityMode: 'FULLY_BOOKABLE' as const,
    };
    const errors = validateManifest(manifest);
    expect(errors.some((e) => e.violatedRule === 'public_landmark_cannot_be_fully_bookable')).toBe(true);
  });

  it('does not require fixture evidence for EXEMPT_PUBLIC deep-link manifests', () => {
    // The public landmark has no fixtureEvidence and should not be flagged for it
    const errors = validateManifest(publicLandmarkManifest);
    expect(errors.every((e) => e.violatedRule !== 'bookable_requires_fixture_evidence')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateManifest — priced supplier freshness latency
// ---------------------------------------------------------------------------

describe('validateManifest — priced supplier rate refresh latency', () => {
  it('rejects a priced manifest with no rateRefreshLatencySeconds', () => {
    const errors = validateManifest(pricedWithoutRateLatencyManifest);
    expect(errors.some((e) => e.violatedRule === 'priced_supplier_requires_rate_refresh_latency')).toBe(true);
  });

  it('accepts a non-priced manifest without rateRefreshLatencySeconds', () => {
    const errors = validateManifest(publicLandmarkManifest);
    expect(errors.every((e) => e.violatedRule !== 'priced_supplier_requires_rate_refresh_latency')).toBe(true);
  });

  it('accepts a priced manifest that declares rateRefreshLatencySeconds', () => {
    const errors = validateManifest(hvmiManifest);
    expect(errors.every((e) => e.violatedRule !== 'priced_supplier_requires_rate_refresh_latency')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isExemptPublicLandmark helper
// ---------------------------------------------------------------------------

describe('isExemptPublicLandmark', () => {
  it('returns true for the public landmark manifest', () => {
    expect(isExemptPublicLandmark(publicLandmarkManifest)).toBe(true);
  });

  it('returns false for HVMI (MARRIOTT_PARTNERED)', () => {
    expect(isExemptPublicLandmark(hvmiManifest)).toBe(false);
  });

  it('returns false for Marriott brand (MARRIOTT_OWNED)', () => {
    expect(isExemptPublicLandmark(marriottBrandManifest)).toBe(false);
  });

  it('returns false for an EXEMPT_PUBLIC manifest with FULLY_BOOKABLE (invalid state)', () => {
    const manifest = {
      ...publicLandmarkManifest,
      supplierId: 'sup_test_exempt_bookable_001',
      bookabilityMode: 'FULLY_BOOKABLE' as const,
    };
    expect(isExemptPublicLandmark(manifest)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Enum value objects
// ---------------------------------------------------------------------------

describe('Supplier manifest enums', () => {
  it('CancellationSemantics values parse through CancellationSemanticsEnum', () => {
    const values = [
      CancellationSemantics.FULL_REFUND_72H,
      CancellationSemantics.FULL_REFUND_24H,
      CancellationSemantics.PARTIAL_REFUND,
      CancellationSemantics.NON_REFUNDABLE,
      CancellationSemantics.NOT_APPLICABLE,
    ];
    for (const v of values) {
      expect(CancellationSemanticsEnum.safeParse(v).success).toBe(true);
    }
  });

  it('RefundSemantics values parse through RefundSemanticsEnum', () => {
    const values = [
      RefundSemantics.AUTOMATIC_PLATFORM_REVERSAL,
      RefundSemantics.SUPPLIER_INITIATED,
      RefundSemantics.MANUAL_RECONCILIATION,
      RefundSemantics.NOT_APPLICABLE,
    ];
    for (const v of values) {
      expect(RefundSemanticsEnum.safeParse(v).success).toBe(true);
    }
  });

  it('SupplierOperation values parse through SupplierOperationEnum', () => {
    const values = [
      SupplierOperation.QUOTE,
      SupplierOperation.HOLD,
      SupplierOperation.COMMIT,
      SupplierOperation.REVERSE,
      SupplierOperation.DEEP_LINK,
    ];
    for (const v of values) {
      expect(SupplierOperationEnum.safeParse(v).success).toBe(true);
    }
  });

  it('SupplierCertificationStatus values parse through SupplierCertificationStatusEnum', () => {
    const values = [
      SupplierCertificationStatus.CERTIFIED,
      SupplierCertificationStatus.UNCERTIFIED,
      SupplierCertificationStatus.PENDING,
    ];
    for (const v of values) {
      expect(SupplierCertificationStatusEnum.safeParse(v).success).toBe(true);
    }
  });

  it('an unknown CancellationSemantics value is rejected', () => {
    expect(CancellationSemanticsEnum.safeParse('FREE_CANCELLATION').success).toBe(false);
  });

  it('an unknown SupplierOperation value is rejected', () => {
    expect(SupplierOperationEnum.safeParse('BOOK').success).toBe(false);
  });
});
