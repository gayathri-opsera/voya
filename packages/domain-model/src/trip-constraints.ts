/**
 * @voya/domain-model — Normalized TripConstraints
 *
 * The structured, non-PII representation of a traveller's trip requirements,
 * extracted from natural-language intent (Path B) or structured form input
 * (Path A). Stored as JSON in AssistantConversationCheckpoint.
 *
 * IMPORTANT: Personal data (name, email, Bonvoy ID, passport, phone, address,
 * payment tokens) must NEVER appear in these structures.
 * Use tokenized references only (ownerRef, sessionRef, destinationToken).
 */

/** Fields that may still require clarification after initial intent parse. */
export enum ClarificationFieldKey {
  DESTINATION = 'DESTINATION',
  CHECK_IN_DATE = 'CHECK_IN_DATE',
  CHECK_OUT_DATE = 'CHECK_OUT_DATE',
  PARTY_SIZE = 'PARTY_SIZE',
  BUDGET_BAND = 'BUDGET_BAND',
  INTEREST_TAGS = 'INTEREST_TAGS',
  ACCOMMODATION_PREFERENCES = 'ACCOMMODATION_PREFERENCES',
}

/** A single field pending clarification from the traveller. */
export interface ClarificationField {
  readonly fieldKey: ClarificationFieldKey;
  readonly isPending: boolean;
  /** Brief, non-PII clarification hint — shown to the assistant only, not stored as PII. */
  readonly hintSummary?: string;
}

/**
 * Normalized trip constraints extracted from natural-language intent.
 * All fields are optional — a partially complete constraint set is valid during
 * the CLARIFICATION orchestrator phase. destinationToken is a normalized
 * identifier produced by the destination normaliser, not a raw user-supplied
 * string. Dates are ISO 8601 strings (YYYY-MM-DD) for JSON portability.
 */
export interface TripConstraints {
  readonly destinationToken?: string;
  readonly checkInDate?: string;
  readonly checkOutDate?: string;
  readonly partySize?: number;
  readonly budgetBandCode?: string;
  readonly interestTags?: readonly string[];
  readonly accommodationPreferences?: readonly string[];
}

/**
 * Safe agent tool output summary — model-generated plain-text summary of a
 * tool call result. Raw tool output, supplier credentials, and traveller PII
 * must be stripped before this object is written. The supplierRef is allowed
 * because it is a platform reference, not traveller PII.
 */
export interface SafeToolSummary {
  readonly domain: string;
  readonly toolName: string;
  readonly summarizedOutput: string;
  readonly supplierRef?: string;
  readonly executedAt: string;  // ISO 8601
}
