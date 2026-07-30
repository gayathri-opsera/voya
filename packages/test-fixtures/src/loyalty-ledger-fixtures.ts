/**
 * @voya/test-fixtures — Simulated Loyalty Ledger Fixtures
 *
 * Synthetic fixtures for unit and integration tests. ALL fixtures are labelled
 * as SIMULATED or ESTIMATED — no real Bonvoy points, certificates, or balances.
 * All identifiers are synthetic placeholders; no real loyalty account numbers.
 */

import {
  LoyaltyTransactionType,
  LoyaltyLedgerStatus,
  RedemptionMode,
  PointsAdvanceEligibility,
  SimulatedLiabilityCategory,
} from '@voya/domain-model';
import type {
  LoyaltyQuoteRow,
  LoyaltyHoldRow,
  LoyaltyLedgerEntryRow,
  LoyaltyReconciliationSnapshotRow,
  CertificateReferenceRow,
  CreateQuoteInput,
  PlaceHoldInput,
} from '@voya/domain-repositories';

// ---------------------------------------------------------------------------
// Synthetic owner references (tokenized, no real PII or Bonvoy account)
// ---------------------------------------------------------------------------

export const LOYALTY_OWNER_A = 'owner_ref_loyalty_a001';
export const LOYALTY_OWNER_B = 'owner_ref_loyalty_b002';

// ---------------------------------------------------------------------------
// CreateQuoteInput fixtures
// ---------------------------------------------------------------------------

/** Estimated earn quote — Points Advance not eligible, points-only mode. */
export const earnEstimateQuoteInput: CreateQuoteInput = {
  ownerRef:             LOYALTY_OWNER_A,
  idempotencyKey:       'idem_earn_est_001',
  itineraryRef:         'itin-synth-001',
  redemptionMode:       RedemptionMode.POINTS_ONLY,
  pointsAmount:         35000,
  estimatedEarnPoints:  3500,
  pointsAdvanceEligibility: PointsAdvanceEligibility.NOT_ELIGIBLE,
  expiresAt:            new Date('2030-12-31T23:59:59Z'),
};

/** Cash-plus-points quote — mixed redemption mode. */
export const cashPlusPointsQuoteInput: CreateQuoteInput = {
  ownerRef:             LOYALTY_OWNER_A,
  idempotencyKey:       'idem_cpp_quote_001',
  itineraryRef:         'itin-synth-002',
  redemptionMode:       RedemptionMode.CASH_PLUS_POINTS,
  pointsAmount:         15000,
  cashAmountMinorUnits: 9900,
  currencyCode:         'USD',
  estimatedEarnPoints:  1500,
  pointsAdvanceEligibility: PointsAdvanceEligibility.NOT_ELIGIBLE,
  expiresAt:            new Date('2030-12-31T23:59:59Z'),
};

/** Certificate redemption quote — synthetic cert token. */
export const certificateQuoteInput: CreateQuoteInput = {
  ownerRef:             LOYALTY_OWNER_B,
  idempotencyKey:       'idem_cert_quote_001',
  itineraryRef:         'itin-synth-003',
  redemptionMode:       RedemptionMode.CERTIFICATE,
  pointsAmount:         0,
  certificateRef:       'CERT_SYNTH_PLACEHOLDER_001',
  pointsAdvanceEligibility: PointsAdvanceEligibility.NOT_ELIGIBLE,
  expiresAt:            new Date('2030-12-31T23:59:59Z'),
};

/** Points Advance eligible quote. */
export const pointsAdvanceQuoteInput: CreateQuoteInput = {
  ownerRef:             LOYALTY_OWNER_B,
  idempotencyKey:       'idem_pa_quote_001',
  itineraryRef:         'itin-synth-004',
  redemptionMode:       RedemptionMode.POINTS_ADVANCE,
  pointsAmount:         50000,
  pointsAdvanceEligibility: PointsAdvanceEligibility.ELIGIBLE,
  expiresAt:            new Date('2030-12-31T23:59:59Z'),
};

// ---------------------------------------------------------------------------
// PlaceHoldInput fixtures
// ---------------------------------------------------------------------------

export const placeHoldInput: PlaceHoldInput = {
  ownerRef:       LOYALTY_OWNER_A,
  quoteId:        'quote-uuid-earn-est-0001',
  idempotencyKey: 'idem_hold_001',
  pointsAmount:   35000,
  transactionRef: 'txn_ref_synth_hold_001',
  expiresAt:      new Date('2030-12-31T23:59:59Z'),
};

export const cashPlusPointsHoldInput: PlaceHoldInput = {
  ownerRef:             LOYALTY_OWNER_A,
  quoteId:              'quote-uuid-cpp-0002',
  idempotencyKey:       'idem_cpp_hold_001',
  pointsAmount:         15000,
  cashAmountMinorUnits: 9900,
  currencyCode:         'USD',
  transactionRef:       'txn_ref_synth_hold_002',
  expiresAt:            new Date('2030-12-31T23:59:59Z'),
};

// ---------------------------------------------------------------------------
// LoyaltyQuoteRow fixtures (for unit tests that don't use DB)
// ---------------------------------------------------------------------------

export const testEarnEstimateQuoteRow: LoyaltyQuoteRow = {
  id:                       'quote-uuid-earn-est-0001',
  ownerRef:                 LOYALTY_OWNER_A,
  idempotencyKey:           'idem_earn_est_001',
  itineraryRef:             'itin-synth-001',
  cartRef:                  null,
  lineItemRef:              null,
  redemptionMode:           RedemptionMode.POINTS_ONLY,
  pointsAmount:             35000,
  cashAmountMinorUnits:     null,
  currencyCode:             null,
  estimatedEarnPoints:      3500,
  pointsAdvanceEligibility: PointsAdvanceEligibility.NOT_ELIGIBLE,
  certificateRef:           null,
  simulated:                true,
  status:                   LoyaltyLedgerStatus.PENDING,
  expiresAt:                new Date('2030-12-31T23:59:59Z'),
  dataClassification:       'CONFIDENTIAL' as const,
  createdAt:                new Date('2025-06-01T10:00:00Z'),
  updatedAt:                new Date('2025-06-01T10:00:00Z'),
};

export const testCashPlusPointsQuoteRow: LoyaltyQuoteRow = {
  id:                       'quote-uuid-cpp-0002',
  ownerRef:                 LOYALTY_OWNER_A,
  idempotencyKey:           'idem_cpp_quote_001',
  itineraryRef:             'itin-synth-002',
  cartRef:                  null,
  lineItemRef:              null,
  redemptionMode:           RedemptionMode.CASH_PLUS_POINTS,
  pointsAmount:             15000,
  cashAmountMinorUnits:     9900,
  currencyCode:             'USD',
  estimatedEarnPoints:      1500,
  pointsAdvanceEligibility: PointsAdvanceEligibility.NOT_ELIGIBLE,
  certificateRef:           null,
  simulated:                true,
  status:                   LoyaltyLedgerStatus.PENDING,
  expiresAt:                new Date('2030-12-31T23:59:59Z'),
  dataClassification:       'CONFIDENTIAL' as const,
  createdAt:                new Date('2025-06-01T10:00:00Z'),
  updatedAt:                new Date('2025-06-01T10:00:00Z'),
};

export const testCertificateQuoteRow: LoyaltyQuoteRow = {
  id:                       'quote-uuid-cert-0003',
  ownerRef:                 LOYALTY_OWNER_B,
  idempotencyKey:           'idem_cert_quote_001',
  itineraryRef:             'itin-synth-003',
  cartRef:                  null,
  lineItemRef:              null,
  redemptionMode:           RedemptionMode.CERTIFICATE,
  pointsAmount:             0,
  cashAmountMinorUnits:     null,
  currencyCode:             null,
  estimatedEarnPoints:      null,
  pointsAdvanceEligibility: PointsAdvanceEligibility.NOT_ELIGIBLE,
  certificateRef:           'CERT_SYNTH_PLACEHOLDER_001',
  simulated:                true,
  status:                   LoyaltyLedgerStatus.PENDING,
  expiresAt:                new Date('2030-12-31T23:59:59Z'),
  dataClassification:       'CONFIDENTIAL' as const,
  createdAt:                new Date('2025-06-01T10:00:00Z'),
  updatedAt:                new Date('2025-06-01T10:00:00Z'),
};

export const testPointsAdvanceQuoteRow: LoyaltyQuoteRow = {
  id:                       'quote-uuid-pa-0004',
  ownerRef:                 LOYALTY_OWNER_B,
  idempotencyKey:           'idem_pa_quote_001',
  itineraryRef:             'itin-synth-004',
  cartRef:                  null,
  lineItemRef:              null,
  redemptionMode:           RedemptionMode.POINTS_ADVANCE,
  pointsAmount:             50000,
  cashAmountMinorUnits:     null,
  currencyCode:             null,
  estimatedEarnPoints:      null,
  pointsAdvanceEligibility: PointsAdvanceEligibility.ELIGIBLE,
  certificateRef:           null,
  simulated:                true,
  status:                   LoyaltyLedgerStatus.PENDING,
  expiresAt:                new Date('2030-12-31T23:59:59Z'),
  dataClassification:       'CONFIDENTIAL' as const,
  createdAt:                new Date('2025-06-01T10:00:00Z'),
  updatedAt:                new Date('2025-06-01T10:00:00Z'),
};

// ---------------------------------------------------------------------------
// LoyaltyHoldRow fixtures
// ---------------------------------------------------------------------------

export const testActiveHoldRow: LoyaltyHoldRow = {
  id:                   'hold-uuid-active-0001',
  ownerRef:             LOYALTY_OWNER_A,
  quoteId:              testEarnEstimateQuoteRow.id,
  idempotencyKey:       'idem_hold_001',
  pointsAmount:         35000,
  cashAmountMinorUnits: null,
  currencyCode:         null,
  simulated:            true,
  status:               LoyaltyLedgerStatus.ACTIVE,
  expiresAt:            new Date('2030-12-31T23:59:59Z'),
  transactionRef:       'txn_ref_synth_hold_001',
  dataClassification:   'CONFIDENTIAL' as const,
  createdAt:            new Date('2025-06-01T10:05:00Z'),
  updatedAt:            new Date('2025-06-01T10:05:00Z'),
};

export const testCommittedHoldRow: LoyaltyHoldRow = {
  ...testActiveHoldRow,
  id:             'hold-uuid-committed-0002',
  idempotencyKey: 'idem_hold_committed_001',
  status:         LoyaltyLedgerStatus.COMMITTED,
  transactionRef: 'txn_ref_synth_hold_committed_001',
  updatedAt:      new Date('2025-06-01T10:10:00Z'),
};

export const testReversedHoldRow: LoyaltyHoldRow = {
  ...testActiveHoldRow,
  id:             'hold-uuid-reversed-0003',
  idempotencyKey: 'idem_hold_reversed_001',
  status:         LoyaltyLedgerStatus.REVERSED,
  transactionRef: 'txn_ref_synth_hold_reversed_001',
  updatedAt:      new Date('2025-06-01T10:15:00Z'),
};

// ---------------------------------------------------------------------------
// LoyaltyLedgerEntryRow fixtures
// ---------------------------------------------------------------------------

export const testHoldPlacedEntryRow: LoyaltyLedgerEntryRow = {
  id:                   'entry-uuid-hold-placed-0001',
  ownerRef:             LOYALTY_OWNER_A,
  quoteId:              testEarnEstimateQuoteRow.id,
  holdId:               testActiveHoldRow.id,
  idempotencyKey:       'idem_hold_001:ledger',
  transactionType:      LoyaltyTransactionType.HOLD_PLACED,
  liabilityCategory:    SimulatedLiabilityCategory.REDEMPTION_HOLD,
  pointsAmount:         35000,
  cashAmountMinorUnits: null,
  currencyCode:         null,
  itineraryRef:         'itin-synth-001',
  cartRef:              null,
  lineItemRef:          null,
  simulated:            true,
  status:               LoyaltyLedgerStatus.ACTIVE,
  dataClassification:   'CONFIDENTIAL' as const,
  createdAt:            new Date('2025-06-01T10:05:00Z'),
};

export const testHoldCommittedEntryRow: LoyaltyLedgerEntryRow = {
  id:                   'entry-uuid-hold-committed-0002',
  ownerRef:             LOYALTY_OWNER_A,
  quoteId:              testEarnEstimateQuoteRow.id,
  holdId:               testCommittedHoldRow.id,
  idempotencyKey:       'idem_commit_001:commit',
  transactionType:      LoyaltyTransactionType.HOLD_COMMITTED,
  liabilityCategory:    SimulatedLiabilityCategory.REDEMPTION_COMMIT,
  pointsAmount:         35000,
  cashAmountMinorUnits: null,
  currencyCode:         null,
  itineraryRef:         null,
  cartRef:              null,
  lineItemRef:          null,
  simulated:            true,
  status:               LoyaltyLedgerStatus.COMMITTED,
  dataClassification:   'CONFIDENTIAL' as const,
  createdAt:            new Date('2025-06-01T10:10:00Z'),
};

export const testHoldReversedEntryRow: LoyaltyLedgerEntryRow = {
  id:                   'entry-uuid-hold-reversed-0003',
  ownerRef:             LOYALTY_OWNER_A,
  quoteId:              testEarnEstimateQuoteRow.id,
  holdId:               testReversedHoldRow.id,
  idempotencyKey:       'idem_reverse_001:reverse',
  transactionType:      LoyaltyTransactionType.HOLD_REVERSED,
  liabilityCategory:    SimulatedLiabilityCategory.REDEMPTION_HOLD,
  pointsAmount:         35000,
  cashAmountMinorUnits: null,
  currencyCode:         null,
  itineraryRef:         null,
  cartRef:              null,
  lineItemRef:          null,
  simulated:            true,
  status:               LoyaltyLedgerStatus.REVERSED,
  dataClassification:   'CONFIDENTIAL' as const,
  createdAt:            new Date('2025-06-01T10:15:00Z'),
};

export const testEarnAdjustmentEntryRow: LoyaltyLedgerEntryRow = {
  id:                   'entry-uuid-earn-adj-0004',
  ownerRef:             LOYALTY_OWNER_A,
  quoteId:              null,
  holdId:               null,
  idempotencyKey:       'idem_earn_adj_001',
  transactionType:      LoyaltyTransactionType.EARN_ESTIMATE,
  liabilityCategory:    SimulatedLiabilityCategory.EARN_ESTIMATE,
  pointsAmount:         3500,
  cashAmountMinorUnits: null,
  currencyCode:         null,
  itineraryRef:         'itin-synth-001',
  cartRef:              null,
  lineItemRef:          null,
  simulated:            true,
  status:               LoyaltyLedgerStatus.ACTIVE,
  dataClassification:   'CONFIDENTIAL' as const,
  createdAt:            new Date('2025-06-01T10:00:00Z'),
};

// ---------------------------------------------------------------------------
// Reconciliation snapshot fixture
// ---------------------------------------------------------------------------

export const testReconciliationSnapshotRow: LoyaltyReconciliationSnapshotRow = {
  id:                            'snap-uuid-0001',
  ownerRef:                      LOYALTY_OWNER_A,
  snapshotPeriod:                '2025-Q2',
  totalSimulatedEarnPoints:      3500,
  totalSimulatedHeldPoints:      35000,
  totalSimulatedCommittedPoints: 35000,
  totalSimulatedReversedPoints:  0,
  totalCashMinorUnits:           0,
  currencyCode:                  null,
  entryCount:                    3,
  simulated:                     true,
  generatedAt:                   new Date('2025-06-01T12:00:00Z'),
  dataClassification:            'CONFIDENTIAL' as const,
  createdAt:                     new Date('2025-06-01T12:00:00Z'),
};

// ---------------------------------------------------------------------------
// Certificate reference fixture
// ---------------------------------------------------------------------------

export const testCertificateReferenceRow: CertificateReferenceRow = {
  id:                 'cert-uuid-0001',
  ownerRef:           LOYALTY_OWNER_B,
  certificateRef:     'CERT_SYNTH_PLACEHOLDER_001',
  certificateType:    'AWARD_NIGHT',
  pointsValue:        35000,
  expiresAt:          new Date('2026-12-31T23:59:59Z'),
  simulated:          true,
  status:             LoyaltyLedgerStatus.ACTIVE,
  dataClassification: 'CONFIDENTIAL' as const,
  createdAt:          new Date('2025-01-01T00:00:00Z'),
  updatedAt:          new Date('2025-01-01T00:00:00Z'),
};

// ---------------------------------------------------------------------------
// Over-reversal test case (rejected scenario)
// ---------------------------------------------------------------------------

/** Input that should be rejected because the reversal exceeds held points. */
export const overReversalScenario = {
  holdId:          testActiveHoldRow.id,
  ownerRef:        LOYALTY_OWNER_A,
  idempotencyKey:  'idem_over_reverse_001',
  pointsToReverse: 99999, // exceeds hold.pointsAmount of 35000
};
