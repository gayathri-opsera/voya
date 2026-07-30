/**
 * TripConfidenceReceipt — render-gate contract consumed by Path A, Path B,
 * and checkout initiation.
 *
 * RECEIPT INVARIANTS:
 *   1. A receipt with outcome BLOCKED or STALE MUST include at least one
 *      machine-readable blocking reason.
 *   2. receiptValidityDeadline MUST be strictly after generatedAt.
 *   3. generatedAt MUST be >= freshnessSummary.newestDataAt — a receipt
 *      cannot certify data that was produced after the receipt was generated.
 *   4. Blocking reasons MUST identify the offending fieldPath and rule so that
 *      future services can return a 422 with machine-readable context.
 *
 * This schema is composed only from deterministic verification outputs.
 * No LLM involvement. No live supplier calls.
 */

import { z } from 'zod';
import { ReceiptOutcome } from '../common/enums.js';

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

/**
 * Machine-readable blocking reason.
 * fieldPath must identify the offending property in the itinerary payload.
 * rule must identify the invariant that was violated.
 */
export const BlockingReasonSchema = z
  .object({
    /**
     * Short, machine-readable code for this failure class.
     * Examples: 'PROVENANCE_MISSING', 'FRESHNESS_EXPIRED', 'HARD_CONSTRAINT_VIOLATED'
     */
    code: z.string().min(1, { message: 'Blocking reason code must not be empty' }),

    /**
     * Dot-separated path to the offending field in the itinerary or line item.
     * Examples: 'lineItems[2].sourceClassification', 'itinerary.dateWindow.checkIn'
     */
    fieldPath: z
      .string()
      .min(1, { message: 'fieldPath must identify the offending field' }),

    /**
     * Human and machine-readable name of the violated rule or invariant.
     * Suitable for a 422 response body reason field.
     */
    rule: z
      .string()
      .min(1, { message: 'rule must identify the violated invariant' }),

    /**
     * Optional extended detail for debugging or traveller-facing messaging.
     */
    detail: z.string().optional(),

    /**
     * When the reason is scoped to a specific line item, its id.
     */
    lineItemId: z.string().optional(),
  })
  .strict();

export type BlockingReason = z.infer<typeof BlockingReasonSchema>;

/**
 * Summary of deterministic feasibility checks.
 * Produced by the Verification Engine before receipt composition.
 */
export const FeasibilitySummarySchema = z
  .object({
    /** True only when ALL feasibility checks passed. */
    isExecutable: z.boolean(),

    /** Timestamp when the feasibility checks were last evaluated. */
    checkedAt: z.string().datetime({
      message: 'checkedAt must be a valid ISO 8601 UTC datetime string',
    }),

    /**
     * Named hard constraint violations blocking execution.
     * Empty when isExecutable is true.
     */
    hardConstraintViolations: z.array(z.string()).default([]),

    openingHoursVerified: z.boolean(),
    travelTimeVerified: z.boolean(),
    loadBalanceVerified: z.boolean(),
    gapNightsResolved: z.boolean(),
    availabilityConfirmed: z.boolean(),
  })
  .strict();

export type FeasibilitySummary = z.infer<typeof FeasibilitySummarySchema>;

/**
 * Summary of source provenance across all line items.
 * Produced by the Verification Engine alongside feasibility checks.
 */
export const ProvenanceSummarySchema = z
  .object({
    totalLineItems: z
      .number()
      .int()
      .nonnegative({ message: 'totalLineItems must be zero or positive' }),

    marriottOwnedCount: z
      .number()
      .int()
      .nonnegative(),

    marriottPartneredCount: z
      .number()
      .int()
      .nonnegative(),

    /** Count of items admitted under an explicit approved exemption. */
    exemptCount: z
      .number()
      .int()
      .nonnegative(),

    /** True when every line item has a resolved, policy-compliant source. */
    allSourcesResolved: z.boolean(),

    /**
     * True when accommodation sourcing queried HVMI first (mandatory ordering).
     * False triggers disclosure requirement per P2.
     */
    hvmiFirstSatisfied: z.boolean(),

    /**
     * True when at least one brand-fallback accommodation was used and a
     * disclosure notice must be rendered in the UI.
     */
    fallbackDisclosureRequired: z.boolean(),
  })
  .strict();

export type ProvenanceSummary = z.infer<typeof ProvenanceSummarySchema>;

/**
 * Summary of data freshness across all line items.
 * Derived from availabilityCheckedAt and priceFreshnessAt across the itinerary.
 */
export const FreshnessSummarySchema = z
  .object({
    /**
     * The earliest (oldest) data timestamp across all line items.
     * Used to determine the overall staleness age of the itinerary.
     */
    oldestDataAt: z.string().datetime({
      message: 'oldestDataAt must be a valid ISO 8601 UTC datetime string',
    }),

    /**
     * The latest data timestamp across all line items.
     * The receipt generatedAt MUST be >= this value (see receipt superRefine).
     */
    newestDataAt: z.string().datetime({
      message: 'newestDataAt must be a valid ISO 8601 UTC datetime string',
    }),

    /**
     * Domain names (e.g. 'accommodation', 'dining') whose freshness window
     * has been exceeded per their Supplier Capability Manifest entry.
     * Empty when allWithinFreshnessWindow is true.
     */
    staleDomains: z.array(z.string()).default([]),

    /** True when all line item data is within its per-domain freshness window. */
    allWithinFreshnessWindow: z.boolean(),
  })
  .strict()
  .refine(
    (d) => new Date(d.newestDataAt) >= new Date(d.oldestDataAt),
    {
      message: 'newestDataAt must be >= oldestDataAt',
      path: ['newestDataAt'],
    },
  );

export type FreshnessSummary = z.infer<typeof FreshnessSummarySchema>;

// ---------------------------------------------------------------------------
// TripConfidenceReceiptSchema
// ---------------------------------------------------------------------------

/**
 * Canonical render-gate contract.
 *
 * AC3 requirements:
 *   - outcome: pass | blocked | stale
 *   - feasibilitySummary
 *   - provenanceSummary
 *   - freshnessSummary
 *   - blockingReasons (required for blocked/stale)
 *   - generatedAt
 *   - receiptValidityDeadline
 *
 * Consumed by:
 *   - Path A portal — blocks itinerary presentation on non-pass outcome
 *   - Path B assistant — blocks itinerary render on non-pass outcome
 *   - Checkout saga — re-evaluates before authorisation; fails on non-pass
 */
export const TripConfidenceReceiptSchema = z
  .object({
    /** Stable identifier for this receipt artifact. */
    receiptId: z
      .string()
      .min(1, { message: 'receiptId must not be empty' }),

    /** The itinerary this receipt certifies. */
    itineraryId: z
      .string()
      .min(1, { message: 'itineraryId must not be empty' }),

    /**
     * Render-gate outcome.
     *   PASS    → may present and check out
     *   BLOCKED → hard constraint or provenance failure; must not present
     *   STALE   → freshness window expired; must re-verify before presenting
     */
    outcome: z.nativeEnum(ReceiptOutcome, {
      errorMap: () => ({
        message: `outcome must be one of: ${Object.values(ReceiptOutcome).join(', ')}`,
      }),
    }),

    /** Results of deterministic feasibility verification. */
    feasibilitySummary: FeasibilitySummarySchema,

    /** Provenance coverage across all itinerary line items. */
    provenanceSummary: ProvenanceSummarySchema,

    /** Freshness of the data underlying each line item. */
    freshnessSummary: FreshnessSummarySchema,

    /**
     * Machine-readable reasons for a BLOCKED or STALE outcome.
     * Each reason identifies the fieldPath and rule for 422 response construction.
     * Must be non-empty when outcome is BLOCKED or STALE.
     */
    blockingReasons: z.array(BlockingReasonSchema).default([]),

    /** ISO 8601 UTC timestamp when this receipt was generated. */
    generatedAt: z.string().datetime({
      message: 'generatedAt must be a valid ISO 8601 UTC datetime string',
    }),

    /**
     * ISO 8601 UTC timestamp after which this receipt expires.
     * Must be strictly after generatedAt.
     * After this deadline the receipt is treated as STALE regardless of outcome.
     */
    receiptValidityDeadline: z.string().datetime({
      message:
        'receiptValidityDeadline must be a valid ISO 8601 UTC datetime string',
    }),
  })
  .strict()
  .superRefine((receipt, ctx) => {
    // -------------------------------------------------------------------
    // Rule 1: BLOCKED and STALE outcomes must carry machine-readable reasons.
    // -------------------------------------------------------------------
    if (
      (receipt.outcome === ReceiptOutcome.BLOCKED ||
        receipt.outcome === ReceiptOutcome.STALE) &&
      receipt.blockingReasons.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `A receipt with outcome '${receipt.outcome}' must include at least one blockingReason ` +
          'with fieldPath and rule to enable machine-readable 422 responses',
        path: ['blockingReasons'],
      });
    }

    // -------------------------------------------------------------------
    // Rule 2: receiptValidityDeadline must be strictly after generatedAt.
    // -------------------------------------------------------------------
    if (
      new Date(receipt.receiptValidityDeadline) <=
      new Date(receipt.generatedAt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'receiptValidityDeadline must be strictly after generatedAt — ' +
          'a receipt cannot expire before it is issued',
        path: ['receiptValidityDeadline'],
      });
    }

    // -------------------------------------------------------------------
    // Rule 3: generatedAt must be >= freshnessSummary.newestDataAt.
    //         A receipt cannot certify data that was produced after the receipt
    //         was generated (edge case from the work order).
    // -------------------------------------------------------------------
    if (
      new Date(receipt.generatedAt) <
      new Date(receipt.freshnessSummary.newestDataAt)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'generatedAt must be >= freshnessSummary.newestDataAt — ' +
          'a receipt cannot certify data it did not evaluate',
        path: ['generatedAt'],
      });
    }
  });

export type TripConfidenceReceipt = z.infer<typeof TripConfidenceReceiptSchema>;
