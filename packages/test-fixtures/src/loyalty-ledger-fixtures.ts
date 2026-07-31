/**
 * @voya/test-fixtures — Simulated Loyalty Ledger Fixtures
 *
 * Every fixture in this file is a SIMULATED / ESTIMATED artifact. None of it
 * implies that a real Bonvoy balance was read, reserved, debited, or
 * credited. All owner references, hold/entry ids, and certificate
 * references are synthetic placeholders — never real Bonvoy identifiers.
 */

import {
  RedemptionMode,
  PointsAdvanceEligibility,
  SimulatedLiabilityCategory,
  DataClassificationTier,
} from '@voya/domain-model';
import type {
  CreateQuoteInput,
  PlaceHoldInput,
  CommitHoldInput,
  ReverseHoldInput,
} from '@voya/domain-repositories';

// ---------------------------------------------------------------------------
// Synthetic owner references
// ---------------------------------------------------------------------------

export const LOYALTY_OWNER_A = 'tok_loyalty_owner_a_001';
export const LOYALTY_OWNER_B = 'tok_loyalty_owner_b_001';

// ---------------------------------------------------------------------------
// Quote fixtures — all estimates, never a real Bonvoy balance read
// ---------------------------------------------------------------------------

/** Estimated earn quote — simulated points a traveller would earn from a stay. */
export const simulatedEarnQuoteInput: CreateQuoteInput = {
  ownerRef:          LOYALTY_OWNER_A,
  itineraryRef:      'itin_test_loyalty_001',
  sourceLineRef:     'li_test_hvmi_accom_001',
  redemptionMode:    RedemptionMode.STANDARD_AWARD_NIGHT,
  pointsAmount:      45000,
  liabilityCategory: SimulatedLiabilityCategory.ESTIMATED_EARN,
  idempotencyKey:    'idem_quote_earn_test_00000001',
  dataClassification: DataClassificationTier.INTERNAL,
};

/** Cash-plus-points quote — points and cash minor units preserved separately, never collapsed. */
export const cashPlusPointsQuoteInput: CreateQuoteInput = {
  ownerRef:          LOYALTY_OWNER_A,
  itineraryRef:      'itin_test_loyalty_001',
  sourceLineRef:     'li_test_hvmi_accom_001',
  redemptionMode:    RedemptionMode.CASH_PLUS_POINTS,
  pointsAmount:      20000,
  cashAmountMinorUnits: 15000, // USD 150.00 (synthetic)
  currencyCode:      'USD',
  liabilityCategory: SimulatedLiabilityCategory.CASH_PLUS_POINTS_REDEMPTION,
  idempotencyKey:    'idem_quote_cashpts_test_0000001',
  dataClassification: DataClassificationTier.INTERNAL,
};

/** Certificate eligibility quote — synthetic certificateRef only, never a real Bonvoy certificate. */
export const certificateEligibilityQuoteInput: CreateQuoteInput = {
  ownerRef:          LOYALTY_OWNER_A,
  itineraryRef:      'itin_test_loyalty_002',
  sourceLineRef:     'li_test_hvmi_accom_002',
  redemptionMode:    RedemptionMode.CERTIFICATE,
  pointsAmount:      0,
  certificateRef:    'cert_sim_free_night_0001',
  liabilityCategory: SimulatedLiabilityCategory.CERTIFICATE_REDEMPTION,
  idempotencyKey:    'idem_quote_cert_test_000000001',
  dataClassification: DataClassificationTier.INTERNAL,
};

/** Points Advance eligible quote — eligibility explicitly evaluated, never left NOT_EVALUATED. */
export const pointsAdvanceEligibleQuoteInput: CreateQuoteInput = {
  ownerRef:                 LOYALTY_OWNER_A,
  itineraryRef:             'itin_test_loyalty_003',
  sourceLineRef:            'li_test_hvmi_accom_003',
  redemptionMode:           RedemptionMode.POINTS_ADVANCE,
  pointsAmount:             30000,
  pointsAdvanceEligibility: PointsAdvanceEligibility.ELIGIBLE,
  liabilityCategory:        SimulatedLiabilityCategory.POINTS_ADVANCE_REDEMPTION,
  idempotencyKey:           'idem_quote_ptsadv_test_0000001',
  dataClassification:       DataClassificationTier.INTERNAL,
};

/** Points Advance ineligible quote — used to prove ineligible traveller flows are represented too. */
export const pointsAdvanceIneligibleQuoteInput: CreateQuoteInput = {
  ownerRef:                 LOYALTY_OWNER_B,
  itineraryRef:             'itin_test_loyalty_004',
  sourceLineRef:            'li_test_hvmi_accom_004',
  redemptionMode:           RedemptionMode.POINTS_ADVANCE,
  pointsAmount:             30000,
  pointsAdvanceEligibility: PointsAdvanceEligibility.INELIGIBLE,
  liabilityCategory:        SimulatedLiabilityCategory.POINTS_ADVANCE_REDEMPTION,
  idempotencyKey:           'idem_quote_ptsadv_test_0000002',
  dataClassification:       DataClassificationTier.INTERNAL,
};

// ---------------------------------------------------------------------------
// Hold fixture
// ---------------------------------------------------------------------------

/** Hold record placed against the standard award-night quote. */
export const standardHoldInput: PlaceHoldInput = {
  ownerRef:          LOYALTY_OWNER_A,
  itineraryRef:      'itin_test_loyalty_001',
  sourceLineRef:     'li_test_hvmi_accom_001',
  redemptionMode:    RedemptionMode.STANDARD_AWARD_NIGHT,
  pointsAmount:      45000,
  idempotencyKey:    'idem_hold_standard_test_0000001',
};

// ---------------------------------------------------------------------------
// Commit fixture — applied against standardHoldInput once placed
// ---------------------------------------------------------------------------

/** Commit input builder — holdId is assigned once the hold has been persisted. */
export function makeCommitInput(holdId: string, ownerRef = LOYALTY_OWNER_A): CommitHoldInput {
  return {
    holdId,
    ownerRef,
    idempotencyKey:    'idem_commit_standard_test_0000001',
    liabilityCategory: SimulatedLiabilityCategory.AWARD_NIGHT_REDEMPTION,
    pointsAmount:      45000,
  };
}

// ---------------------------------------------------------------------------
// Reversal fixtures — a valid partial reversal and a rejected over-reversal
// ---------------------------------------------------------------------------

/** Valid reversal — reverses less than the full held/committed amount. */
export function makeValidReversalInput(holdId: string, ownerRef = LOYALTY_OWNER_A): ReverseHoldInput {
  return {
    holdId,
    ownerRef,
    idempotencyKey: 'idem_reversal_valid_test_0000001',
    pointsAmount:   45000,
  };
}

/**
 * Rejected over-reversal case — attempts to reverse more points than were
 * ever held or committed for the referenced hold. The repository must
 * return VALIDATION_FAILURE rather than persisting this entry.
 */
export function makeOverReversalInput(holdId: string, ownerRef = LOYALTY_OWNER_A): ReverseHoldInput {
  return {
    holdId,
    ownerRef,
    idempotencyKey: 'idem_reversal_over_test_00000001',
    pointsAmount:   999999, // deliberately exceeds any fixture hold amount
  };
}

// ---------------------------------------------------------------------------
// Cross-owner attempt reference
// ---------------------------------------------------------------------------

/** Wrong-owner reference for cross-owner rejection tests (mirrors repository-fixtures.ts naming). */
export const crossOwnerLoyaltyRef = LOYALTY_OWNER_B;
