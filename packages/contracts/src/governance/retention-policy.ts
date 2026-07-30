/**
 * @voya/contracts — Retention policy registry
 *
 * Provides structured retention rule schemas for all launch data categories.
 * Each policy defines a duration, event anchor, purge action, and approval
 * status. Policies pending legal or finance sign-off are marked PROVISIONAL.
 *
 * NOTE: This file does not assert that legal, PCI-DSS, finance, or
 * privacy-office sign-off has been obtained. All policies in this registry
 * are provisional technical defaults pending the relevant governance reviews.
 * Production purge execution and infrastructure are out of scope.
 */

import { z, ZodError } from 'zod';
import { RetentionTriggerEnum } from '../common/enums.js';

// ---------------------------------------------------------------------------
// RetentionApprovalStatus
// ---------------------------------------------------------------------------

export const RetentionApprovalStatusEnum = z.enum(['PROVISIONAL', 'APPROVED']);
export type RetentionApprovalStatus = z.infer<typeof RetentionApprovalStatusEnum>;

/**
 * PROVISIONAL — policy is defined as technical metadata but has not received
 *               the required legal, finance, or privacy-office sign-off.
 * APPROVED    — all required governance approvals have been obtained.
 *               (None of the entries in this registry are APPROVED at launch.)
 */
export const RetentionApprovalStatus = RetentionApprovalStatusEnum.enum;

// ---------------------------------------------------------------------------
// RetentionPurgeAction
// ---------------------------------------------------------------------------

export const RetentionPurgeActionEnum = z.enum(['DELETE', 'ANONYMIZE', 'ARCHIVE']);
export type RetentionPurgeAction = z.infer<typeof RetentionPurgeActionEnum>;

/**
 * DELETE    — records are hard-deleted after the retention period.
 * ANONYMIZE — identifying fields are overwritten with synthetic values.
 * ARCHIVE   — records are moved to cold storage with restricted access.
 */
export const RetentionPurgeAction = RetentionPurgeActionEnum.enum;

// ---------------------------------------------------------------------------
// RetentionPolicySchema
// ---------------------------------------------------------------------------

export const RetentionPolicySchema = z.object({
  /** Stable identifier for this retention policy. */
  policyKey: z.string().min(1, 'policyKey must not be empty'),

  /** Human-readable description of what this policy governs. */
  description: z.string().min(1, 'description must not be empty'),

  /**
   * Retention duration in days. Must be a positive integer.
   * The purge action is triggered `durationDays` after the `eventAnchor` event.
   */
  durationDays: z
    .number()
    .int('durationDays must be an integer')
    .positive('durationDays must be a positive number greater than zero'),

  /**
   * The lifecycle event that starts or resets the retention clock.
   * Required — a duration without an anchor makes purge timing ambiguous and
   * must be treated as a configuration error.
   */
  eventAnchor: RetentionTriggerEnum,

  /** The action taken when the retention period expires. */
  action: RetentionPurgeActionEnum,

  /**
   * Whether this policy has received the necessary governance approvals.
   * PROVISIONAL policies are valid registry metadata but must not be treated
   * as operationally approved for production purge execution.
   */
  approvalStatus: RetentionApprovalStatusEnum,

  /** Team or role responsible for maintaining this policy. */
  owner: z.string().min(1, 'owner must not be empty'),

  /** Optional free-text rationale or pending review notes. */
  notes: z.string().optional(),
});

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

// ---------------------------------------------------------------------------
// parseRetentionPolicy
// ---------------------------------------------------------------------------

export type RetentionPolicyParseResult =
  | { success: true; data: RetentionPolicy }
  | { success: false; error: ZodError };

/**
 * Parses an unknown payload as a RetentionPolicy without throwing.
 * Returns a typed result union; callers can inspect `success` to branch.
 */
export function parseRetentionPolicy(input: unknown): RetentionPolicyParseResult {
  const result = RetentionPolicySchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// ---------------------------------------------------------------------------
// RETENTION_POLICY_REGISTRY
// Provisional retention policies for all launch data categories.
// ---------------------------------------------------------------------------

export const RETENTION_POLICY_REGISTRY: Readonly<Record<string, RetentionPolicy>> = {
  TRAVELLER_PII_POST_BOOKING: {
    policyKey: 'TRAVELLER_PII_POST_BOOKING',
    description:
      'Traveller identity and contact details retained for 7 years after booking ' +
      'confirmation for legal and dispute resolution purposes.',
    durationDays: 2555, // ~7 years (365 × 7)
    eventAnchor: 'BOOKING_CONFIRMED',
    action: 'DELETE',
    approvalStatus: 'PROVISIONAL',
    owner: 'privacy-team',
    notes:
      'Pending privacy office and legal review. Duration derived from standard travel ' +
      'merchant retention guidance; exact period subject to change on sign-off.',
  },
  SESSION_LIFETIME: {
    policyKey: 'SESSION_LIFETIME',
    description:
      'Tokenised session data, TRAVELLER_TOKEN references, and TRIP_CONSTRAINTS ' +
      'retained for 90 days after session expiry.',
    durationDays: 90,
    eventAnchor: 'SESSION_EXPIRED',
    action: 'DELETE',
    approvalStatus: 'PROVISIONAL',
    owner: 'platform-team',
    notes: 'Pending privacy office review.',
  },
  GOVT_ID_SHORT_RETENTION: {
    policyKey: 'GOVT_ID_SHORT_RETENTION',
    description:
      'Passport and nationality data deleted within 30 days of booking confirmation. ' +
      'Short retention reflects sensitivity of government-issued identity documents.',
    durationDays: 30,
    eventAnchor: 'BOOKING_CONFIRMED',
    action: 'DELETE',
    approvalStatus: 'PROVISIONAL',
    owner: 'privacy-team',
    notes:
      'Pending privacy office review. Data must not be retained beyond the minimum ' +
      'necessary for destination safety checks.',
  },
  LOYALTY_ID_POST_BOOKING: {
    policyKey: 'LOYALTY_ID_POST_BOOKING',
    description:
      'Loyalty identifier retained for 7 years post-booking for earn calculation ' +
      'and dispute resolution; anonymised rather than deleted.',
    durationDays: 2555,
    eventAnchor: 'BOOKING_CONFIRMED',
    action: 'ANONYMIZE',
    approvalStatus: 'PROVISIONAL',
    owner: 'loyalty-team',
    notes: 'Pending privacy office and Bonvoy programme governance review.',
  },
  PAYMENT_TOKEN_POST_CHECKOUT: {
    policyKey: 'PAYMENT_TOKEN_POST_CHECKOUT',
    description:
      'Tokenised payment method reference retained for 90 days after checkout ' +
      'completion or compensation for dispute and refund handling.',
    durationDays: 90,
    eventAnchor: 'CHECKOUT_COMPENSATED',
    action: 'DELETE',
    approvalStatus: 'PROVISIONAL',
    owner: 'payments-team',
    notes: 'Pending PCI-DSS SAQ-A review and finance sign-off.',
  },
  FINANCIAL_RECORD_LONG_RETENTION: {
    policyKey: 'FINANCIAL_RECORD_LONG_RETENTION',
    description:
      'Payment authorisation and refund ledger entries retained for 7 years for ' +
      'regulatory, audit, and dispute resolution compliance.',
    durationDays: 2555,
    eventAnchor: 'BOOKING_CONFIRMED',
    action: 'ARCHIVE',
    approvalStatus: 'PROVISIONAL',
    owner: 'finance-team',
    notes:
      'Pending finance and legal review for applicable jurisdictions. 7-year figure ' +
      'is a common baseline; exact duration may vary by market.',
  },
  CONVERSATION_POST_SESSION: {
    policyKey: 'CONVERSATION_POST_SESSION',
    description:
      'Agent conversation transcripts retained for 90 days after session expiry ' +
      'for AI safety and quality review purposes.',
    durationDays: 90,
    eventAnchor: 'SESSION_EXPIRED',
    action: 'DELETE',
    approvalStatus: 'PROVISIONAL',
    owner: 'ai-safety-team',
    notes:
      'Pending privacy office review. Duration balances safety review needs ' +
      'with the data minimisation principle.',
  },
  RECEIPT_POST_BOOKING: {
    policyKey: 'RECEIPT_POST_BOOKING',
    description:
      'Trip Confidence Receipt artefacts retained for 7 years post-booking ' +
      'to support dispute resolution and the zero-hallucinated-inventory audit.',
    durationDays: 2555,
    eventAnchor: 'BOOKING_CONFIRMED',
    action: 'ARCHIVE',
    approvalStatus: 'PROVISIONAL',
    owner: 'receipts-team',
    notes: 'Pending legal review.',
  },
  AUDIT_LONG_RETENTION: {
    policyKey: 'AUDIT_LONG_RETENTION',
    description:
      'Sourcing audit records retained for 7 years as an immutable ledger ' +
      'supporting HVMI-first compliance and disclosure requirements.',
    durationDays: 2555,
    eventAnchor: 'AUDIT_RETENTION_OVERRIDE',
    action: 'ARCHIVE',
    approvalStatus: 'PROVISIONAL',
    owner: 'compliance-team',
    notes: 'Pending legal and compliance review.',
  },
  OPERATIONAL_INDEFINITE: {
    policyKey: 'OPERATIONAL_INDEFINITE',
    description:
      'Supplier capability manifests retained for the operational lifetime of the ' +
      'supplier relationship (10-year rolling archive).',
    durationDays: 3650, // ~10 years (365 × 10)
    eventAnchor: 'AUDIT_RETENTION_OVERRIDE',
    action: 'ARCHIVE',
    approvalStatus: 'PROVISIONAL',
    owner: 'supplier-team',
    notes: 'Pending operational and legal review. Duration is a conservative upper bound.',
  },
  ADMIN_RECORD_LONG_RETENTION: {
    policyKey: 'ADMIN_RECORD_LONG_RETENTION',
    description:
      'Admin approval evidence records retained for 7 years for internal audit ' +
      'and dispute resolution.',
    durationDays: 2555,
    eventAnchor: 'BOOKING_CONFIRMED',
    action: 'ARCHIVE',
    approvalStatus: 'PROVISIONAL',
    owner: 'admin-team',
    notes: 'Pending legal and compliance review.',
  },
} as const;

// ---------------------------------------------------------------------------
// lookupRetentionPolicy
// ---------------------------------------------------------------------------

/**
 * Looks up a retention policy by key.
 * Returns undefined when the key is not registered; callers should treat a
 * missing key as a configuration error (a data category declared a policy key
 * that was never added to the registry).
 */
export function lookupRetentionPolicy(policyKey: string): RetentionPolicy | undefined {
  return RETENTION_POLICY_REGISTRY[policyKey];
}
