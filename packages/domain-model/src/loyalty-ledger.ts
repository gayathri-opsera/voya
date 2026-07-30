/**
 * @voya/domain-model — Simulated Loyalty Ledger Domain Types
 *
 * Enums, type guards, and validators for the append-only simulated loyalty
 * ledger. ALL loyalty activity in Voya is SIMULATED — no real Bonvoy balance
 * is ever debited. Every helper in this file enforces that invariant.
 *
 * No Prisma, Zod, or HTTP dependency.
 */

// ---------------------------------------------------------------------------
// Enums — kept in sync with prisma/schema.prisma
// ---------------------------------------------------------------------------

export enum LoyaltyTransactionType {
  EARN_ESTIMATE         = 'EARN_ESTIMATE',
  AWARD_NIGHT           = 'AWARD_NIGHT',
  CASH_PLUS_POINTS      = 'CASH_PLUS_POINTS',
  CERTIFICATE_REDEMPTION = 'CERTIFICATE_REDEMPTION',
  POINTS_ADVANCE        = 'POINTS_ADVANCE',
  ADJUSTMENT            = 'ADJUSTMENT',
  HOLD_PLACED           = 'HOLD_PLACED',
  HOLD_COMMITTED        = 'HOLD_COMMITTED',
  HOLD_REVERSED         = 'HOLD_REVERSED',
}

export enum LoyaltyLedgerStatus {
  PENDING   = 'PENDING',
  ACTIVE    = 'ACTIVE',
  COMMITTED = 'COMMITTED',
  REVERSED  = 'REVERSED',
  EXPIRED   = 'EXPIRED',
  REJECTED  = 'REJECTED',
}

export enum RedemptionMode {
  CASH_ONLY        = 'CASH_ONLY',
  POINTS_ONLY      = 'POINTS_ONLY',
  CASH_PLUS_POINTS = 'CASH_PLUS_POINTS',
  CERTIFICATE      = 'CERTIFICATE',
  POINTS_ADVANCE   = 'POINTS_ADVANCE',
}

export enum PointsAdvanceEligibility {
  NOT_ELIGIBLE = 'NOT_ELIGIBLE',
  ELIGIBLE     = 'ELIGIBLE',
  APPLIED      = 'APPLIED',
}

export enum SimulatedLiabilityCategory {
  EARN_ESTIMATE    = 'EARN_ESTIMATE',
  REDEMPTION_HOLD  = 'REDEMPTION_HOLD',
  REDEMPTION_COMMIT = 'REDEMPTION_COMMIT',
  ADJUSTMENT       = 'ADJUSTMENT',
  CERTIFICATE_HOLD = 'CERTIFICATE_HOLD',
}

// ---------------------------------------------------------------------------
// Terminal and transition helpers
// ---------------------------------------------------------------------------

/** Terminal statuses — no further lifecycle transitions are permitted. */
const TERMINAL_LEDGER_STATUSES = new Set<LoyaltyLedgerStatus>([
  LoyaltyLedgerStatus.COMMITTED,
  LoyaltyLedgerStatus.REVERSED,
  LoyaltyLedgerStatus.EXPIRED,
  LoyaltyLedgerStatus.REJECTED,
]);

export function isTerminalLedgerStatus(status: LoyaltyLedgerStatus): boolean {
  return TERMINAL_LEDGER_STATUSES.has(status);
}

/**
 * Valid hold lifecycle transitions:
 *   ACTIVE → COMMITTED | REVERSED | EXPIRED
 *   PENDING → ACTIVE
 */
const VALID_HOLD_TRANSITIONS: ReadonlyMap<LoyaltyLedgerStatus, readonly LoyaltyLedgerStatus[]> =
  new Map([
    [LoyaltyLedgerStatus.PENDING,   [LoyaltyLedgerStatus.ACTIVE]],
    [LoyaltyLedgerStatus.ACTIVE,    [LoyaltyLedgerStatus.COMMITTED, LoyaltyLedgerStatus.REVERSED, LoyaltyLedgerStatus.EXPIRED]],
    [LoyaltyLedgerStatus.COMMITTED, []],
    [LoyaltyLedgerStatus.REVERSED,  []],
    [LoyaltyLedgerStatus.EXPIRED,   []],
    [LoyaltyLedgerStatus.REJECTED,  []],
  ]);

export function isValidHoldTransition(
  from: LoyaltyLedgerStatus,
  to: LoyaltyLedgerStatus,
): boolean {
  return VALID_HOLD_TRANSITIONS.get(from)?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Amount validators
// ---------------------------------------------------------------------------

/**
 * Points amounts must be non-negative integers. Fractional points are not
 * allowed; never use floating-point for loyalty math.
 */
export function isValidPointsAmount(points: number): boolean {
  return Number.isInteger(points) && points >= 0;
}

export function validatePointsAmountLoyalty(points: number): readonly string[] {
  if (!isValidPointsAmount(points)) {
    return [`points amount must be a non-negative integer, got ${points}`];
  }
  return [];
}

/**
 * Cash amounts in minor units (cents/pence). Must be non-negative integers.
 */
export function isValidCashMinorUnits(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 0;
}

export function validateCashMinorUnits(amount: number): readonly string[] {
  if (!isValidCashMinorUnits(amount)) {
    return [`cash amount must be a non-negative integer in minor units, got ${amount}`];
  }
  return [];
}

/** ISO 4217 currency code: exactly 3 uppercase letters. */
export function isValidCurrencyCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

export function validateCurrencyCode(code: string): readonly string[] {
  if (!isValidCurrencyCode(code)) {
    return [`currencyCode must be a 3-letter ISO 4217 code, got "${code}"`];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Idempotency key validation
// ---------------------------------------------------------------------------

/** Idempotency key: non-empty, no whitespace, max 128 chars. */
export function isValidIdempotencyKey(key: string): boolean {
  return typeof key === 'string' && key.trim().length > 0 && !/\s/.test(key) && key.length <= 128;
}

export function validateIdempotencyKey(key: string): readonly string[] {
  if (!key || key.trim() === '') return ['idempotencyKey must not be empty'];
  if (/\s/.test(key)) return ['idempotencyKey must not contain whitespace'];
  if (key.length > 128) return ['idempotencyKey must not exceed 128 characters'];
  return [];
}

// ---------------------------------------------------------------------------
// Transaction reference validation
// ---------------------------------------------------------------------------

/** Transaction reference: non-empty, no whitespace, max 128 chars. */
export function isValidTransactionRef(ref: string): boolean {
  return typeof ref === 'string' && ref.trim().length > 0 && !/\s/.test(ref) && ref.length <= 128;
}

// ---------------------------------------------------------------------------
// Reversal guard
// ---------------------------------------------------------------------------

/**
 * Validates that a reversal does not exceed the currently held/committed
 * points for a transaction. Returns error strings if invalid.
 */
export function validateReversalAmount(
  reversalPoints: number,
  heldPoints: number,
): readonly string[] {
  const pointsErrors = validatePointsAmountLoyalty(reversalPoints);
  if (pointsErrors.length > 0) return pointsErrors;
  if (reversalPoints > heldPoints) {
    return [
      `reversal of ${reversalPoints} points exceeds held/committed amount of ${heldPoints} points (simulated over-reversal guard)`,
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Simulated label guard
// ---------------------------------------------------------------------------

/**
 * All loyalty ledger fixtures and persisted entries must include the word
 * "simulated" or "estimated" in any traveller-visible label string. This
 * prevents test artifacts from implying real Bonvoy balance movement.
 */
export function hasSimulatedLabel(label: string): boolean {
  const lower = label.toLowerCase();
  return lower.includes('simulated') || lower.includes('estimated');
}

export function validateSimulatedLabel(label: string): readonly string[] {
  if (!hasSimulatedLabel(label)) {
    return [
      `traveller-visible loyalty label must include "simulated" or "estimated" wording: "${label}"`,
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Reconciliation helpers
// ---------------------------------------------------------------------------

export interface ReconciliationSummary {
  readonly totalSimulatedEarnPoints:      number;
  readonly totalSimulatedHeldPoints:      number;
  readonly totalSimulatedCommittedPoints: number;
  readonly totalSimulatedReversedPoints:  number;
  readonly totalCashMinorUnits:           number;
  readonly entryCount:                    number;
}

export interface LedgerEntryInput {
  readonly transactionType:   LoyaltyTransactionType;
  readonly liabilityCategory: SimulatedLiabilityCategory;
  readonly pointsAmount:      number;
  readonly cashAmountMinorUnits?: number;
  readonly status:            LoyaltyLedgerStatus;
}

/**
 * Derives a reconciliation summary from a list of ledger entries.
 * Pure function — no database dependency.
 */
export function computeReconciliationSummary(
  entries: readonly LedgerEntryInput[],
): ReconciliationSummary {
  let totalSimulatedEarnPoints      = 0;
  let totalSimulatedHeldPoints      = 0;
  let totalSimulatedCommittedPoints = 0;
  let totalSimulatedReversedPoints  = 0;
  let totalCashMinorUnits           = 0;

  for (const entry of entries) {
    const pts  = entry.pointsAmount;
    const cash = entry.cashAmountMinorUnits ?? 0;

    if (entry.transactionType === LoyaltyTransactionType.EARN_ESTIMATE) {
      totalSimulatedEarnPoints += pts;
    } else if (entry.transactionType === LoyaltyTransactionType.HOLD_PLACED) {
      totalSimulatedHeldPoints += pts;
      totalCashMinorUnits      += cash;
    } else if (entry.transactionType === LoyaltyTransactionType.HOLD_COMMITTED) {
      totalSimulatedCommittedPoints += pts;
      totalCashMinorUnits           += cash;
    } else if (entry.transactionType === LoyaltyTransactionType.HOLD_REVERSED) {
      totalSimulatedReversedPoints += pts;
    }
  }

  return {
    totalSimulatedEarnPoints,
    totalSimulatedHeldPoints,
    totalSimulatedCommittedPoints,
    totalSimulatedReversedPoints,
    totalCashMinorUnits,
    entryCount: entries.length,
  };
}
