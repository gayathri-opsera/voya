/**
 * @voya/contracts — Supplier Capability Manifest
 *
 * Defines the schema for a Supplier Capability Manifest: the contract-level
 * declaration every supplier connector must satisfy before its inventory can
 * enter a traveller-visible itinerary.
 *
 * A manifest declares:
 *  - Supplier identity and the inventory domain it covers
 *  - Source classification (Marriott-owned, partnered, or exempt-public)
 *  - Bookability mode (fully bookable, deep-link, or unavailable)
 *  - Availability and rate refresh latencies for receipt freshness checks
 *  - Cancellation and refund semantics for checkout and My Trips
 *  - The operations the supplier connector supports
 *  - Certification status backed by a passing book-and-cancel fixture pair
 *
 * Constraints:
 *  - FULLY_BOOKABLE suppliers must be CERTIFIED and have passing fixture evidence.
 *  - DEEP_LINK_ONLY suppliers must not declare checkout operations (HOLD, COMMIT, REVERSE).
 *  - EXEMPT_PUBLIC (public landmark) suppliers must not be priced and must not be FULLY_BOOKABLE.
 *  - Priced suppliers must declare a rate refresh latency.
 *
 * NOTE: This file does not implement any supplier connector. It models capability
 * declarations only. Do not store real credentials, sandbox tokens, or raw
 * fixture execution logs here.
 */

import { z } from 'zod';
import {
  InventoryDomainEnum,
  SourceClassificationEnum,
  SupplierBookabilityEnum,
} from '../common/enums.js';

// ---------------------------------------------------------------------------
// CancellationSemantics
// Declares the cancellation policy offered by the supplier.
// ---------------------------------------------------------------------------

export const CancellationSemanticsEnum = z.enum([
  'FULL_REFUND_72H',    // Full refund when cancelled ≥72 hours before service
  'FULL_REFUND_24H',    // Full refund when cancelled ≥24 hours before service
  'PARTIAL_REFUND',     // Partial refund per supplier schedule; amount varies
  'NON_REFUNDABLE',     // No refund on cancellation
  'NOT_APPLICABLE',     // Source is non-bookable; cancellation is not relevant
]);
export type CancellationSemantics = z.infer<typeof CancellationSemanticsEnum>;
export const CancellationSemantics = CancellationSemanticsEnum.enum;

// ---------------------------------------------------------------------------
// RefundSemantics
// Declares how refunds are processed after cancellation.
// ---------------------------------------------------------------------------

export const RefundSemanticsEnum = z.enum([
  'AUTOMATIC_PLATFORM_REVERSAL', // Platform reverses the PaymentIntent automatically
  'SUPPLIER_INITIATED',          // Supplier processes and initiates the refund
  'MANUAL_RECONCILIATION',       // Finance team performs manual reconciliation
  'NOT_APPLICABLE',              // Source is non-bookable; refund processing not relevant
]);
export type RefundSemantics = z.infer<typeof RefundSemanticsEnum>;
export const RefundSemantics = RefundSemanticsEnum.enum;

// ---------------------------------------------------------------------------
// SupplierOperation
// Declares individual operations the supplier connector can perform.
// ---------------------------------------------------------------------------

export const SupplierOperationEnum = z.enum([
  'QUOTE',     // Real-time rate quoting with live pricing
  'HOLD',      // Place a temporary inventory hold prior to payment
  'COMMIT',    // Confirm and finalise the booking after authorisation
  'REVERSE',   // Cancel or reverse a confirmed booking
  'DEEP_LINK', // Redirect the traveller to the supplier site to complete booking
]);
export type SupplierOperation = z.infer<typeof SupplierOperationEnum>;
export const SupplierOperation = SupplierOperationEnum.enum;

// ---------------------------------------------------------------------------
// SupplierCertificationStatus
// Declares whether the supplier has a passing book-and-cancel fixture pair.
// ---------------------------------------------------------------------------

export const SupplierCertificationStatusEnum = z.enum([
  'CERTIFIED',   // Passing book+cancel fixture evidence is present and validated
  'UNCERTIFIED', // Missing fixture evidence or evidence has not passed validation
  'PENDING',     // Fixture pair submitted; automated validation in progress
]);
export type SupplierCertificationStatus = z.infer<typeof SupplierCertificationStatusEnum>;
export const SupplierCertificationStatus = SupplierCertificationStatusEnum.enum;

// ---------------------------------------------------------------------------
// FixtureEvidence
// Safe metadata reference for a book-and-cancel fixture pair.
// Must NOT contain sandbox credentials, raw logs, or confidential supplier terms.
// ---------------------------------------------------------------------------

export const FixtureEvidenceSchema = z
  .object({
    /** Stable opaque reference identifier for the fixture run. */
    fixtureId: z.string().min(1, 'fixtureId must not be empty'),

    /** Outcome of the book step in the fixture pair. */
    bookOutcome: z.enum(['PASS', 'FAIL']),

    /** Outcome of the cancel step in the fixture pair. */
    cancelOutcome: z.enum(['PASS', 'FAIL']),

    /**
     * ISO 8601 datetime at which the fixture pair was last executed.
     * Uses UTC (Z suffix) or explicit offset.
     */
    testedAt: z.string().datetime({ offset: true }),

    /** Identifies the agent or system that ran the fixture (e.g. "fixture-runner-v1"). */
    testedByAgent: z.string().min(1, 'testedByAgent must not be empty'),

    /** Optional free-text notes about the fixture run. No raw logs or credentials. */
    notes: z.string().optional(),
  })
  .strict();

export type FixtureEvidence = z.infer<typeof FixtureEvidenceSchema>;

// ---------------------------------------------------------------------------
// SupplierCapabilityManifestSchema
// The complete schema for a supplier capability declaration.
// ---------------------------------------------------------------------------

export const SupplierCapabilityManifestSchema = z.object({
  /** Stable opaque supplier reference identifier (not a supplier contract number). */
  supplierId: z.string().min(1, 'supplierId must not be empty'),

  /** Human-readable display name for operator tooling and audit output. */
  displayName: z.string().min(1, 'displayName must not be empty'),

  /** The inventory domain this supplier covers. */
  domain: InventoryDomainEnum,

  /** Ownership or partnership tier of this supplier. */
  sourceClassification: SourceClassificationEnum,

  /** Declares how the platform can transact with this supplier. */
  bookabilityMode: SupplierBookabilityEnum,

  /**
   * Maximum age of cached availability data (seconds) before it is considered
   * stale. Used by the Trip Confidence Receipt freshness check.
   */
  availabilityRefreshLatencySeconds: z
    .number()
    .int('availabilityRefreshLatencySeconds must be an integer')
    .positive('availabilityRefreshLatencySeconds must be positive'),

  /**
   * Maximum age of cached rate data (seconds) before it is considered stale.
   * Required when `isPriced` is true; omit for non-priced sources.
   */
  rateRefreshLatencySeconds: z
    .number()
    .int('rateRefreshLatencySeconds must be an integer')
    .positive('rateRefreshLatencySeconds must be positive')
    .optional(),

  /**
   * Whether this supplier provides priced inventory (rates and totals).
   * When true, `rateRefreshLatencySeconds` must also be declared.
   */
  isPriced: z.boolean(),

  /** Cancellation policy offered by this supplier. */
  cancellationSemantics: CancellationSemanticsEnum,

  /** How refunds are processed after cancellation. */
  refundSemantics: RefundSemanticsEnum,

  /**
   * Operations this supplier connector supports.
   * Must contain at least one operation.
   * DEEP_LINK_ONLY suppliers must not include HOLD, COMMIT, or REVERSE.
   */
  supportedOperations: z.array(SupplierOperationEnum).min(1, 'at least one operation must be declared'),

  /**
   * Whether this supplier has passed the mandatory book-and-cancel fixture
   * validation. FULLY_BOOKABLE suppliers must be CERTIFIED.
   */
  certificationStatus: SupplierCertificationStatusEnum,

  /**
   * Metadata reference for the most recent book-and-cancel fixture pair.
   * Required for CERTIFIED, FULLY_BOOKABLE suppliers.
   * Must not contain credentials, raw logs, or confidential supplier terms.
   */
  fixtureEvidence: FixtureEvidenceSchema.optional(),

  /** Semantic version of this manifest declaration (e.g. "1.0.0"). */
  manifestVersion: z.string().min(1, 'manifestVersion must not be empty'),

  /** ISO 8601 datetime at which this manifest was last reviewed. */
  lastReviewedAt: z.string().datetime({ offset: true }),

  /** Identifies the team or role that last reviewed this manifest. */
  reviewedBy: z.string().min(1, 'reviewedBy must not be empty'),
});

export type SupplierCapabilityManifest = z.infer<typeof SupplierCapabilityManifestSchema>;

// ---------------------------------------------------------------------------
// ManifestValidationError
// Structured error returned by validateManifest.
// Error messages reference manifest fields and supplier references only.
// ---------------------------------------------------------------------------

export interface ManifestValidationError {
  readonly supplierId: string;
  readonly field: string;
  readonly violatedRule: string;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// CHECKOUT_OPERATIONS
// Operations that are exclusive to bookable (non-deep-link) suppliers.
// ---------------------------------------------------------------------------

const CHECKOUT_OPERATIONS = new Set<SupplierOperation>([
  SupplierOperation.HOLD,
  SupplierOperation.COMMIT,
  SupplierOperation.REVERSE,
]);

// ---------------------------------------------------------------------------
// validateManifest
// ---------------------------------------------------------------------------

/**
 * Validates a SupplierCapabilityManifest against certification and policy
 * business rules beyond what Zod enforces structurally.
 *
 * Rules enforced:
 *  1. FULLY_BOOKABLE suppliers must have CERTIFIED status and a fixture evidence
 *     record where both bookOutcome and cancelOutcome are PASS.
 *  2. DEEP_LINK_ONLY suppliers must not declare checkout operations (HOLD/COMMIT/REVERSE).
 *  3. EXEMPT_PUBLIC suppliers must not be priced and must not be FULLY_BOOKABLE.
 *  4. Priced suppliers (isPriced: true) must declare rateRefreshLatencySeconds.
 *
 * Returns an array of ManifestValidationErrors; empty array means valid.
 * Error messages reference manifest fields only — no confidential supplier terms.
 */
export function validateManifest(
  manifest: SupplierCapabilityManifest,
): ManifestValidationError[] {
  const errors: ManifestValidationError[] = [];

  // Rule 1: FULLY_BOOKABLE requires CERTIFIED status + passing fixture evidence.
  if (manifest.bookabilityMode === 'FULLY_BOOKABLE') {
    if (manifest.certificationStatus !== 'CERTIFIED') {
      errors.push({
        supplierId: manifest.supplierId,
        field: 'certificationStatus',
        violatedRule: 'bookable_requires_certified_status',
        message:
          `Supplier "${manifest.supplierId}" is FULLY_BOOKABLE but certificationStatus is ` +
          `"${manifest.certificationStatus}". FULLY_BOOKABLE suppliers must be CERTIFIED.`,
      });
    }

    if (!manifest.fixtureEvidence) {
      errors.push({
        supplierId: manifest.supplierId,
        field: 'fixtureEvidence',
        violatedRule: 'bookable_requires_fixture_evidence',
        message:
          `Supplier "${manifest.supplierId}" is FULLY_BOOKABLE but fixtureEvidence is absent. ` +
          `A passing book-and-cancel fixture pair is required.`,
      });
    } else {
      if (manifest.fixtureEvidence.bookOutcome !== 'PASS') {
        errors.push({
          supplierId: manifest.supplierId,
          field: 'fixtureEvidence.bookOutcome',
          violatedRule: 'certified_requires_passing_book_fixture',
          message:
            `Supplier "${manifest.supplierId}" fixtureEvidence.bookOutcome is ` +
            `"${manifest.fixtureEvidence.bookOutcome}"; must be "PASS" for CERTIFIED status.`,
        });
      }
      if (manifest.fixtureEvidence.cancelOutcome !== 'PASS') {
        errors.push({
          supplierId: manifest.supplierId,
          field: 'fixtureEvidence.cancelOutcome',
          violatedRule: 'certified_requires_passing_cancel_fixture',
          message:
            `Supplier "${manifest.supplierId}" fixtureEvidence.cancelOutcome is ` +
            `"${manifest.fixtureEvidence.cancelOutcome}"; must be "PASS" for CERTIFIED status.`,
        });
      }
    }
  }

  // Rule 2: DEEP_LINK_ONLY must not include checkout operations.
  if (manifest.bookabilityMode === 'DEEP_LINK_ONLY') {
    for (const op of manifest.supportedOperations) {
      if (CHECKOUT_OPERATIONS.has(op)) {
        errors.push({
          supplierId: manifest.supplierId,
          field: 'supportedOperations',
          violatedRule: 'deep_link_cannot_have_checkout_operation',
          message:
            `Supplier "${manifest.supplierId}" is DEEP_LINK_ONLY but declares checkout ` +
            `operation "${op}". DEEP_LINK_ONLY suppliers must not include HOLD, COMMIT, or REVERSE.`,
        });
      }
    }
  }

  // Rule 3: EXEMPT_PUBLIC must not be priced and must not be FULLY_BOOKABLE.
  if (manifest.sourceClassification === 'EXEMPT_PUBLIC') {
    if (manifest.isPriced) {
      errors.push({
        supplierId: manifest.supplierId,
        field: 'isPriced',
        violatedRule: 'public_landmark_cannot_be_priced',
        message:
          `Supplier "${manifest.supplierId}" is EXEMPT_PUBLIC (public landmark) but isPriced ` +
          `is true. Public landmark content must not carry pricing fields.`,
      });
    }
    if (manifest.bookabilityMode === 'FULLY_BOOKABLE') {
      errors.push({
        supplierId: manifest.supplierId,
        field: 'bookabilityMode',
        violatedRule: 'public_landmark_cannot_be_fully_bookable',
        message:
          `Supplier "${manifest.supplierId}" is EXEMPT_PUBLIC but bookabilityMode is FULLY_BOOKABLE. ` +
          `Public landmark sources must use DEEP_LINK_ONLY or UNAVAILABLE.`,
      });
    }
  }

  // Rule 4: Priced suppliers must declare rate refresh latency.
  if (manifest.isPriced && manifest.rateRefreshLatencySeconds === undefined) {
    errors.push({
      supplierId: manifest.supplierId,
      field: 'rateRefreshLatencySeconds',
      violatedRule: 'priced_supplier_requires_rate_refresh_latency',
      message:
        `Supplier "${manifest.supplierId}" is priced (isPriced: true) but ` +
        `rateRefreshLatencySeconds is absent. Receipt freshness cannot be evaluated ` +
        `without a declared rate refresh latency.`,
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// isExemptPublicLandmark
// ---------------------------------------------------------------------------

/**
 * Returns true if the manifest represents an exempt public landmark source
 * that is not subject to the bookable-supplier certification requirement.
 */
export function isExemptPublicLandmark(manifest: SupplierCapabilityManifest): boolean {
  return (
    manifest.sourceClassification === 'EXEMPT_PUBLIC' &&
    manifest.bookabilityMode !== 'FULLY_BOOKABLE'
  );
}
