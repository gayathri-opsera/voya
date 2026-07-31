/**
 * @voya/domain-model — Simulated Loyalty Ledger Domain Types
 *
 * Voya launches with pseudo/simulated loyalty redemption only. No enum,
 * validator, or fixture in this file may imply that a real Bonvoy balance
 * is read, reserved, debited, or credited. Every ledger entry and quote is
 * labelled simulated=true; the ledger is append-only accounting evidence,
 * not mutable profile state.
 */

// ---------------------------------------------------------------------------
// Enums (mirror the Prisma schema — plain TS, no Zod dependency)
// ---------------------------------------------------------------------------

export enum LoyaltyTransactionType {
  QUOTE      = 'QUOTE',
  HOLD       = 'HOLD',
  COMMIT     = 'COMMIT',
  REVERSAL   = 'REVERSAL',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum LoyaltyLedgerStatus {
  QUOTED    = 'QUOTED',
  HELD      = 'HELD',
  COMMITTED = 'COMMITTED',
  REVERSED  = 'REVERSED',
  EXPIRED   = 'EXPIRED',
  ADJUSTED  = 'ADJUSTED',
}

export enum RedemptionMode {
  STANDARD_AWARD_NIGHT = 'STANDARD_AWARD_NIGHT',
  CASH_PLUS_POINTS     = 'CASH_PLUS_POINTS',
  CERTIFICATE          = 'CERTIFICATE',
  POINTS_ADVANCE       = 'POINTS_ADVANCE',
}

export enum PointsAdvanceEligibility {
  ELIGIBLE      = 'ELIGIBLE',
  INELIGIBLE    = 'INELIGIBLE',
  NOT_EVALUATED = 'NOT_EVALUATED',
}

export enum SimulatedLiabilityCategory {
  ESTIMATED_EARN               = 'ESTIMATED_EARN',
  AWARD_NIGHT_REDEMPTION       = 'AWARD_NIGHT_REDEMPTION',
  CASH_PLUS_POINTS_REDEMPTION  = 'CASH_PLUS_POINTS_REDEMPTION',
  CERTIFICATE_REDEMPTION       = 'CERTIFICATE_REDEMPTION',
  POINTS_ADVANCE_REDEMPTION    = 'POINTS_ADVANCE_REDEMPTION',
  ADJUSTMENT                   = 'ADJUSTMENT',
}

// ---------------------------------------------------------------------------
// Lifecycle transition rules
// ---------------------------------------------------------------------------

/**
 * Ledger statuses from which a hold may still be committed or reversed.
 * A hold whose latest ledger entry is not in this set is no longer active.
 */
const ACTIVE_HOLD_STATUSES: ReadonlySet<LoyaltyLedgerStatus> = new Set([
  LoyaltyLedgerStatus.HELD,
]);

/** Statuses from which a reversal is still permitted (an active hold or an already-committed transaction). */
const REVERSIBLE_STATUSES: ReadonlySet<LoyaltyLedgerStatus> = new Set([
  LoyaltyLedgerStatus.HELD,
  LoyaltyLedgerStatus.COMMITTED,
]);

export function isActiveHoldStatus(status: LoyaltyLedgerStatus): boolean {
  return ACTIVE_HOLD_STATUSES.has(status);
}

export function isReversibleStatus(status: LoyaltyLedgerStatus): boolean {
  return REVERSIBLE_STATUSES.has(status);
}

/**
 * Derives the current status of a hold from its ordered ledger entries
 * (oldest first). Returns null when there are no entries yet (hold placed
 * but no HOLD entry recorded — a configuration error upstream).
 *
 * The ledger is append-only: this function never mutates its input and the
 * caller must supply entries already sorted by createdAt ascending.
 */
export function deriveHoldStatus(
  orderedEntries: ReadonlyArray<{ status: LoyaltyLedgerStatus }>,
): LoyaltyLedgerStatus | null {
  if (orderedEntries.length === 0) return null;
  const last = orderedEntries[orderedEntries.length - 1];
  return last ? last.status : null;
}

// ---------------------------------------------------------------------------
// Points and monetary validation — integer-only, never floating point
// ---------------------------------------------------------------------------

export function isValidPointsAmount(points: number): boolean {
  return Number.isInteger(points) && points >= 0;
}

export function validatePointsAmount(points: number): readonly string[] {
  if (!Number.isInteger(points)) return ['pointsAmount must be an integer'];
  if (points < 0) return ['pointsAmount must not be negative'];
  return [];
}

export function isValidMonetaryMinorUnits(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 0;
}

export function validateMonetaryMinorUnits(amount: number): readonly string[] {
  if (!Number.isInteger(amount)) return ['cashAmountMinorUnits must be an integer'];
  if (amount < 0) return ['cashAmountMinorUnits must not be negative'];
  return [];
}

// ---------------------------------------------------------------------------
// Idempotency key validation
// ---------------------------------------------------------------------------

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidIdempotencyKey(key: string): boolean {
  return typeof key === 'string' && IDEMPOTENCY_KEY_RE.test(key);
}

export function validateIdempotencyKey(key: string): readonly string[] {
  if (!key || key.trim() === '') return ['idempotencyKey must not be empty'];
  if (!isValidIdempotencyKey(key)) {
    return ['idempotencyKey must be 8-128 characters of letters, digits, hyphens, or underscores'];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Synthetic certificate reference validation
// ---------------------------------------------------------------------------

/**
 * Synthetic certificate references use the "cert_sim_" prefix so they can
 * never be confused with a real Bonvoy certificate identifier.
 */
const CERTIFICATE_REF_RE = /^cert_sim_[a-z0-9_]{4,64}$/;

export function isValidCertificateRef(ref: string): boolean {
  return typeof ref === 'string' && CERTIFICATE_REF_RE.test(ref);
}

export function validateCertificateRef(ref: string): readonly string[] {
  if (!ref || ref.trim() === '') return ['certificateRef must not be empty'];
  if (!isValidCertificateRef(ref)) {
    return ['certificateRef must be synthetic (cert_sim_ prefix), never a real Bonvoy certificate identifier'];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Redemption-mode-specific shape validation
// ---------------------------------------------------------------------------

export interface RedemptionModeInput {
  readonly redemptionMode: RedemptionMode;
  readonly pointsAmount: number;
  readonly cashAmountMinorUnits?: number;
  readonly currencyCode?: string;
  readonly certificateRef?: string;
  readonly pointsAdvanceEligibility?: PointsAdvanceEligibility;
}

/**
 * Validates that a redemption input's fields are consistent with its
 * redemptionMode. Cash-plus-points must carry both points and cash+currency
 * (never collapsed into a single amount); certificate mode requires a
 * synthetic certificateRef; Points Advance mode requires an evaluated
 * eligibility (not NOT_EVALUATED).
 */
export function validateRedemptionModeInput(input: RedemptionModeInput): readonly string[] {
  const errors: string[] = [...validatePointsAmount(input.pointsAmount)];

  switch (input.redemptionMode) {
    case RedemptionMode.CASH_PLUS_POINTS: {
      if (input.cashAmountMinorUnits === undefined) {
        errors.push('cashAmountMinorUnits is required for CASH_PLUS_POINTS redemption');
      } else {
        errors.push(...validateMonetaryMinorUnits(input.cashAmountMinorUnits));
      }
      if (!input.currencyCode) {
        errors.push('currencyCode is required for CASH_PLUS_POINTS redemption');
      }
      break;
    }
    case RedemptionMode.CERTIFICATE: {
      if (!input.certificateRef) {
        errors.push('certificateRef is required for CERTIFICATE redemption');
      } else {
        errors.push(...validateCertificateRef(input.certificateRef));
      }
      break;
    }
    case RedemptionMode.POINTS_ADVANCE: {
      if (
        input.pointsAdvanceEligibility === undefined ||
        input.pointsAdvanceEligibility === PointsAdvanceEligibility.NOT_EVALUATED
      ) {
        errors.push('pointsAdvanceEligibility must be evaluated (ELIGIBLE or INELIGIBLE) for POINTS_ADVANCE redemption');
      }
      break;
    }
    case RedemptionMode.STANDARD_AWARD_NIGHT:
      break;
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Reconciliation math — pure, deterministic, integer-only
// ---------------------------------------------------------------------------

export interface LedgerEntryTotals {
  readonly transactionType: LoyaltyTransactionType;
  readonly pointsAmount: number;
  readonly cashAmountMinorUnits: number | null;
}

export interface ReconciliationTotals {
  readonly totalPointsHeld: number;
  readonly totalPointsCommitted: number;
  readonly totalPointsReversed: number;
  readonly totalCashMinorUnitsCommitted: number;
}

/**
 * Computes reconciliation totals from a flat list of ledger entries.
 * Pure function — the caller supplies the entries for the desired period.
 */
export function computeReconciliationTotals(
  entries: ReadonlyArray<LedgerEntryTotals>,
): ReconciliationTotals {
  let totalPointsHeld = 0;
  let totalPointsCommitted = 0;
  let totalPointsReversed = 0;
  let totalCashMinorUnitsCommitted = 0;

  for (const entry of entries) {
    switch (entry.transactionType) {
      case LoyaltyTransactionType.HOLD:
        totalPointsHeld += entry.pointsAmount;
        break;
      case LoyaltyTransactionType.COMMIT:
        totalPointsCommitted += entry.pointsAmount;
        totalCashMinorUnitsCommitted += entry.cashAmountMinorUnits ?? 0;
        break;
      case LoyaltyTransactionType.REVERSAL:
        totalPointsReversed += entry.pointsAmount;
        break;
      case LoyaltyTransactionType.QUOTE:
      case LoyaltyTransactionType.ADJUSTMENT:
        break;
    }
  }

  return {
    totalPointsHeld,
    totalPointsCommitted,
    totalPointsReversed,
    totalCashMinorUnitsCommitted,
  };
}
