/**
 * @voya/contracts — Data category classification registry
 *
 * Provides a versioned registry of all launch data categories with typed
 * classification metadata. Each category carries:
 *  - Classification tier (PUBLIC → INTERNAL → CONFIDENTIAL → RESTRICTED)
 *  - Prompt eligibility (whether the category may appear in AI prompt context)
 *  - Masking, encryption, and non-production anonymization requirements
 *  - A reference to the retention policy governing this category
 *
 * Constraints:
 *  - CONFIDENTIAL and RESTRICTED categories must NOT be marked prompt-eligible
 *    unless they are explicitly tokenised references with no reversible PII.
 *  - RESTRICTED categories MUST declare requiresEncryption, requiresLogMasking,
 *    and requiresNonProdAnonymization as true.
 *
 * NOTE: This file does not assert legal, PCI-DSS, finance, data residency, or
 * privacy-office sign-off. All policies are provisional technical defaults.
 */

import { z } from 'zod';
import { DataClassificationTierEnum } from '../common/enums.js';

// ---------------------------------------------------------------------------
// DataCategoryKey
// Stable registry keys for all launch data categories.
// ---------------------------------------------------------------------------

export const DataCategoryKeyEnum = z.enum([
  'TRAVELLER_IDENTITY',          // Full name, email, phone — traveller contact PII
  'TRAVELLER_TOKEN',             // Opaque tokenised traveller reference — prompt-safe
  'PASSPORT_NATIONALITY',        // Passport number, nationality, country of issue
  'LOYALTY_IDENTIFIER',          // Bonvoy member number, loyalty tier
  'PAYMENT_TOKEN',               // Tokenised card reference (Stripe PaymentMethod ID)
  'AUTHORIZATION_REFUND_RECORD', // Payment authorisation and refund ledger entries
  'AGENT_CONVERSATION_TEXT',     // Raw natural-language agent session transcript
  'TRIP_CONSTRAINTS',            // Structured tokenised itinerary constraints — prompt-safe
  'ITINERARY_RECEIPT',           // Trip Confidence Receipt artefact
  'SOURCING_AUDIT_RECORD',       // Immutable sourcing order and disclosure rows
  'SUPPLIER_CAPABILITY_MANIFEST',// Registered supplier connector metadata
  'ADMIN_APPROVAL_EVIDENCE',     // Internal admin approval decision records
]);

export type DataCategoryKey = z.infer<typeof DataCategoryKeyEnum>;
export const DataCategoryKey = DataCategoryKeyEnum.enum;

// ---------------------------------------------------------------------------
// DataCategoryEntry
// Typed metadata for a single data category in the registry.
// ---------------------------------------------------------------------------

export const DataCategoryEntrySchema = z.object({
  /** Stable registry key identifying this category. */
  key: DataCategoryKeyEnum,

  /** Human-readable description of what data this category covers. */
  description: z.string().min(1),

  /** Classification tier governing access, retention, and handling. */
  tier: DataClassificationTierEnum,

  /**
   * Whether this category may appear in AI prompt context.
   * Must be false for CONFIDENTIAL and RESTRICTED categories unless the
   * category is an explicitly tokenised reference (e.g. TRAVELLER_TOKEN).
   */
  promptEligible: z.boolean(),

  /**
   * Whether data in this category must be encrypted at rest and in transit
   * beyond standard TLS. Required for RESTRICTED; required for CONFIDENTIAL.
   */
  requiresEncryption: z.boolean(),

  /**
   * Whether data in this category must be masked in log output (e.g. replaced
   * with [REDACTED]). Required for CONFIDENTIAL and RESTRICTED.
   */
  requiresLogMasking: z.boolean(),

  /**
   * Whether non-production environments must receive anonymised or synthetic
   * values rather than real or production-mirrored data. Required for
   * RESTRICTED and CONFIDENTIAL.
   */
  requiresNonProdAnonymization: z.boolean(),

  /**
   * Key into the RETENTION_POLICY_REGISTRY for the governing retention rule.
   */
  retentionPolicyKey: z.string().min(1),
});

export type DataCategoryEntry = z.infer<typeof DataCategoryEntrySchema>;

// ---------------------------------------------------------------------------
// DATA_CATEGORY_REGISTRY
// Single source of truth for all launch data category classifications.
// ---------------------------------------------------------------------------

export const DATA_CATEGORY_REGISTRY: Readonly<Record<DataCategoryKey, DataCategoryEntry>> = {
  TRAVELLER_IDENTITY: {
    key: DataCategoryKey.TRAVELLER_IDENTITY,
    description:
      'Full name, email address, and phone number for the booking traveller. ' +
      'Classified CONFIDENTIAL; must not appear in prompt context.',
    tier: 'CONFIDENTIAL',
    promptEligible: false,
    requiresEncryption: true,
    requiresLogMasking: true,
    requiresNonProdAnonymization: true,
    retentionPolicyKey: 'TRAVELLER_PII_POST_BOOKING',
  },
  TRAVELLER_TOKEN: {
    key: DataCategoryKey.TRAVELLER_TOKEN,
    description:
      'Opaque, non-reversible tokenised reference to a traveller account. ' +
      'Contains no embedded PII. Safe for AI prompt context.',
    tier: 'INTERNAL',
    promptEligible: true,
    requiresEncryption: false,
    requiresLogMasking: false,
    requiresNonProdAnonymization: false,
    retentionPolicyKey: 'SESSION_LIFETIME',
  },
  PASSPORT_NATIONALITY: {
    key: DataCategoryKey.PASSPORT_NATIONALITY,
    description:
      'Passport document number, nationality, and country of issue used for ' +
      'destination safety checks. RESTRICTED; must never appear in logs or prompts.',
    tier: 'RESTRICTED',
    promptEligible: false,
    requiresEncryption: true,
    requiresLogMasking: true,
    requiresNonProdAnonymization: true,
    retentionPolicyKey: 'GOVT_ID_SHORT_RETENTION',
  },
  LOYALTY_IDENTIFIER: {
    key: DataCategoryKey.LOYALTY_IDENTIFIER,
    description:
      'Marriott Bonvoy member number and loyalty tier used for rate and benefit ' +
      'resolution. CONFIDENTIAL; must not appear in prompt context.',
    tier: 'CONFIDENTIAL',
    promptEligible: false,
    requiresEncryption: true,
    requiresLogMasking: true,
    requiresNonProdAnonymization: true,
    retentionPolicyKey: 'LOYALTY_ID_POST_BOOKING',
  },
  PAYMENT_TOKEN: {
    key: DataCategoryKey.PAYMENT_TOKEN,
    description:
      'Tokenised payment method reference (Stripe PaymentMethod ID). ' +
      'No PAN or CVV stored. RESTRICTED by PCI-DSS scope.',
    tier: 'RESTRICTED',
    promptEligible: false,
    requiresEncryption: true,
    requiresLogMasking: true,
    requiresNonProdAnonymization: true,
    retentionPolicyKey: 'PAYMENT_TOKEN_POST_CHECKOUT',
  },
  AUTHORIZATION_REFUND_RECORD: {
    key: DataCategoryKey.AUTHORIZATION_REFUND_RECORD,
    description:
      'Payment authorisation and refund ledger entries including amounts, ' +
      'timestamps, and saga state. RESTRICTED; part of PCI-DSS scope.',
    tier: 'RESTRICTED',
    promptEligible: false,
    requiresEncryption: true,
    requiresLogMasking: true,
    requiresNonProdAnonymization: true,
    retentionPolicyKey: 'FINANCIAL_RECORD_LONG_RETENTION',
  },
  AGENT_CONVERSATION_TEXT: {
    key: DataCategoryKey.AGENT_CONVERSATION_TEXT,
    description:
      'Raw natural-language turns of agent session transcripts that may contain ' +
      'incidental PII. CONFIDENTIAL; must not be re-used as prompt input.',
    tier: 'CONFIDENTIAL',
    promptEligible: false,
    requiresEncryption: true,
    requiresLogMasking: true,
    requiresNonProdAnonymization: true,
    retentionPolicyKey: 'CONVERSATION_POST_SESSION',
  },
  TRIP_CONSTRAINTS: {
    key: DataCategoryKey.TRIP_CONSTRAINTS,
    description:
      'Structured itinerary constraints: destination token, date window, party ' +
      'size, budget band, interest tags. Uses tokenised traveller reference only; ' +
      'safe for AI prompt context.',
    tier: 'INTERNAL',
    promptEligible: true,
    requiresEncryption: false,
    requiresLogMasking: false,
    requiresNonProdAnonymization: false,
    retentionPolicyKey: 'SESSION_LIFETIME',
  },
  ITINERARY_RECEIPT: {
    key: DataCategoryKey.ITINERARY_RECEIPT,
    description:
      'Trip Confidence Receipt artefact recording feasibility outcome, provenance, ' +
      'and freshness. INTERNAL; persisted against the itinerary.',
    tier: 'INTERNAL',
    promptEligible: false,
    requiresEncryption: false,
    requiresLogMasking: false,
    requiresNonProdAnonymization: false,
    retentionPolicyKey: 'RECEIPT_POST_BOOKING',
  },
  SOURCING_AUDIT_RECORD: {
    key: DataCategoryKey.SOURCING_AUDIT_RECORD,
    description:
      'Immutable sourcing order and brand-fallback disclosure rows written to the ' +
      'audit ledger. INTERNAL; append-only.',
    tier: 'INTERNAL',
    promptEligible: false,
    requiresEncryption: false,
    requiresLogMasking: false,
    requiresNonProdAnonymization: false,
    retentionPolicyKey: 'AUDIT_LONG_RETENTION',
  },
  SUPPLIER_CAPABILITY_MANIFEST: {
    key: DataCategoryKey.SUPPLIER_CAPABILITY_MANIFEST,
    description:
      'Registered supplier connector metadata: bookability status, refresh latency, ' +
      'cancellation semantics. PUBLIC operational metadata.',
    tier: 'PUBLIC',
    promptEligible: false,
    requiresEncryption: false,
    requiresLogMasking: false,
    requiresNonProdAnonymization: false,
    retentionPolicyKey: 'OPERATIONAL_INDEFINITE',
  },
  ADMIN_APPROVAL_EVIDENCE: {
    key: DataCategoryKey.ADMIN_APPROVAL_EVIDENCE,
    description:
      'Internal admin approval decision records including approver identity and ' +
      'decision timestamps. CONFIDENTIAL; must not appear in prompt context.',
    tier: 'CONFIDENTIAL',
    promptEligible: false,
    requiresEncryption: true,
    requiresLogMasking: true,
    requiresNonProdAnonymization: true,
    retentionPolicyKey: 'ADMIN_RECORD_LONG_RETENTION',
  },
} as const;

// ---------------------------------------------------------------------------
// lookupDataCategory
// ---------------------------------------------------------------------------

/**
 * Looks up a data category entry by key.
 *
 * All valid DataCategoryKey values are guaranteed to be in the registry.
 * This function is a typed convenience wrapper over a direct registry lookup.
 */
export function lookupDataCategory(key: DataCategoryKey): DataCategoryEntry {
  return DATA_CATEGORY_REGISTRY[key];
}

// ---------------------------------------------------------------------------
// DataCategoryValidationError
// Returned by validateDataCategoryEntry; does NOT include sensitive values.
// ---------------------------------------------------------------------------

export interface DataCategoryValidationError {
  readonly categoryKey: DataCategoryKey;
  readonly violatedRule: string;
  readonly safeMessage: string;
}

// ---------------------------------------------------------------------------
// validateDataCategoryEntry
// ---------------------------------------------------------------------------

/**
 * Validates that a DataCategoryEntry satisfies all classification invariants
 * beyond what Zod enforces structurally:
 *
 *  - RESTRICTED categories must declare all three protection requirements
 *    (encryption, log masking, non-prod anonymization).
 *  - CONFIDENTIAL and RESTRICTED categories must not be marked prompt-eligible.
 *
 * Returns an array of validation errors; an empty array means the entry is
 * valid.  Error objects do NOT include the entry's data values.
 */
export function validateDataCategoryEntry(
  entry: DataCategoryEntry,
): DataCategoryValidationError[] {
  const errors: DataCategoryValidationError[] = [];

  if (entry.tier === 'RESTRICTED') {
    if (!entry.requiresEncryption) {
      errors.push({
        categoryKey: entry.key,
        violatedRule: 'restricted_requires_encryption',
        safeMessage: 'RESTRICTED categories must declare requiresEncryption as true.',
      });
    }
    if (!entry.requiresLogMasking) {
      errors.push({
        categoryKey: entry.key,
        violatedRule: 'restricted_requires_log_masking',
        safeMessage: 'RESTRICTED categories must declare requiresLogMasking as true.',
      });
    }
    if (!entry.requiresNonProdAnonymization) {
      errors.push({
        categoryKey: entry.key,
        violatedRule: 'restricted_requires_non_prod_anonymization',
        safeMessage: 'RESTRICTED categories must declare requiresNonProdAnonymization as true.',
      });
    }
  }

  if (
    (entry.tier === 'CONFIDENTIAL' || entry.tier === 'RESTRICTED') &&
    entry.promptEligible
  ) {
    errors.push({
      categoryKey: entry.key,
      violatedRule: 'confidential_restricted_not_prompt_eligible',
      safeMessage:
        'CONFIDENTIAL and RESTRICTED categories must not be marked prompt-eligible. ' +
        'Use a tokenised INTERNAL reference instead.',
    });
  }

  return errors;
}
