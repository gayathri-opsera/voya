/**
 * @voya/test-fixtures — Conversation Checkpoint Fixtures
 *
 * Synthetic fixtures for Path B assistant conversation checkpoint tests.
 * All identifiers are synthetic. No real Bonvoy numbers, emails, PII, or
 * raw prompt transcripts are present.
 *
 * Scenarios covered:
 *  - pendingClarificationCheckpoint: CLARIFICATION phase with missing fields
 *  - intentCompleteCheckpoint: INTENT_COMPLETE outcome after full extraction
 *  - degradedCheckpoint: DEGRADED outcome with a degraded dining agent step
 *  - expiredCheckpoint: past expiresAt, should be blocked from resume
 *  - staleVersionUpdateInput: update with wrong expectedVersion → VERSION_CONFLICT
 */

import {
  OrchestratorPhase,
  AgentStepStatus,
  CheckpointOutcome,
  DataClassificationTier,
  ClarificationFieldKey,
  InventoryDomain,
} from '@voya/domain-model';
import type {
  TripConstraints,
  ClarificationField,
  SafeToolSummary,
} from '@voya/domain-model';
// Minimal input shapes mirroring ConversationCheckpointRepository inputs.
// Defined inline here to avoid a circular devDependency between test-fixtures
// and domain-repositories. Tests cast these to the proper interface types.
interface CheckpointCreateInput {
  sessionRef: string;
  ownerRef: string;
  orchestratorPhase?: OrchestratorPhase;
  tripConstraintsJson?: Record<string, unknown>;
  pendingClarificationJson?: Record<string, unknown>;
  naturalLanguageIntentSummary?: string;
  expiresAt?: Date;
  dataClassification?: DataClassificationTier;
}

interface CheckpointUpdateInput {
  id: string;
  ownerRef: string;
  expectedVersion: number;
  orchestratorPhase?: OrchestratorPhase;
}

// ---------------------------------------------------------------------------
// Synthetic owner references (mirrors repository-fixtures.ts naming)
// ---------------------------------------------------------------------------

export const CHECKPOINT_OWNER_A = 'tok_chk_owner_a_001';
export const CHECKPOINT_OWNER_B = 'tok_chk_owner_b_001';

// ---------------------------------------------------------------------------
// Session references — synthetic, non-reversible
// ---------------------------------------------------------------------------

export const SESSION_REF_PARIS = 'sess_test_paris_2026_001';
export const SESSION_REF_TOKYO = 'sess_test_tokyo_2026_001';

// ---------------------------------------------------------------------------
// Normalized trip constraints — no PII, no raw user input
// ---------------------------------------------------------------------------

export const parisConstraints: TripConstraints = {
  destinationToken:  'dest_test_paris_001',
  checkInDate:       '2026-09-01',
  checkOutDate:      '2026-09-07',
  partySize:         2,
  budgetBandCode:    'PREMIUM',
  interestTags:      ['BEACHFRONT', 'CULINARY'],
};

export const partialTokyoConstraints: TripConstraints = {
  destinationToken: 'dest_test_tokyo_001',
  // checkInDate, checkOutDate, and partySize are still pending
  interestTags:     ['CULTURAL', 'CITY_BREAK'],
};

// ---------------------------------------------------------------------------
// Clarification fields
// ---------------------------------------------------------------------------

export const pendingClarificationFields: readonly ClarificationField[] = [
  { fieldKey: ClarificationFieldKey.CHECK_IN_DATE,  isPending: true },
  { fieldKey: ClarificationFieldKey.CHECK_OUT_DATE, isPending: true },
  { fieldKey: ClarificationFieldKey.PARTY_SIZE,     isPending: true,  hintSummary: 'solo or group travel' },
  { fieldKey: ClarificationFieldKey.DESTINATION,    isPending: false },
];

export const resolvedClarificationFields: readonly ClarificationField[] = [
  { fieldKey: ClarificationFieldKey.CHECK_IN_DATE,  isPending: false },
  { fieldKey: ClarificationFieldKey.CHECK_OUT_DATE, isPending: false },
  { fieldKey: ClarificationFieldKey.PARTY_SIZE,     isPending: false },
  { fieldKey: ClarificationFieldKey.DESTINATION,    isPending: false },
];

// ---------------------------------------------------------------------------
// Safe tool summaries — model-generated text only, no raw tool output
// ---------------------------------------------------------------------------

export const accommodationSearchSummary: SafeToolSummary = {
  domain:           'ACCOMMODATION',
  toolName:         'searchAccommodation',
  summarizedOutput: 'Found 8 HVMI whole-home options in Paris 1st arrondissement matching premium budget band.',
  supplierRef:      'sup_test_hvmi_001',
  executedAt:       '2026-07-30T10:05:00.000Z',
};

export const diningSearchSummary: SafeToolSummary = {
  domain:           'DINING',
  toolName:         'searchDining',
  summarizedOutput: 'Retrieved 3 Marriott-partnered restaurant options near accommodation cluster.',
  supplierRef:      'sup_test_dining_001',
  executedAt:       '2026-07-30T10:06:00.000Z',
};

// ---------------------------------------------------------------------------
// CreateCheckpointInput fixtures
// ---------------------------------------------------------------------------

/** Checkpoint entering the CLARIFICATION phase — trip constraints partially known. */
export const pendingClarificationCheckpointInput: CheckpointCreateInput = {
  sessionRef:                   SESSION_REF_TOKYO,
  ownerRef:                     CHECKPOINT_OWNER_A,
  orchestratorPhase:            OrchestratorPhase.CLARIFICATION,
  tripConstraintsJson:          partialTokyoConstraints as unknown as Record<string, unknown>,
  pendingClarificationJson:     {
    fields: pendingClarificationFields.map((f) => ({
      fieldKey:    f.fieldKey,
      isPending:   f.isPending,
      hintSummary: f.hintSummary ?? null,
    })),
  },
  naturalLanguageIntentSummary: 'Traveller wants to visit Tokyo for a cultural trip — exact dates and party size not yet provided.',
  expiresAt:                    new Date('2026-12-31T23:59:59.000Z'),
  dataClassification:           DataClassificationTier.INTERNAL,
};

/** Checkpoint ready for sourcing — all constraints resolved. */
export const intentCompleteCheckpointInput: CheckpointCreateInput = {
  sessionRef:                   SESSION_REF_PARIS,
  ownerRef:                     CHECKPOINT_OWNER_A,
  orchestratorPhase:            OrchestratorPhase.SOURCING,
  tripConstraintsJson:          parisConstraints as unknown as Record<string, unknown>,
  pendingClarificationJson:     {
    fields: resolvedClarificationFields.map((f) => ({
      fieldKey:  f.fieldKey,
      isPending: f.isPending,
    })),
  },
  naturalLanguageIntentSummary: 'Two-person premium culinary trip to Paris, 1–7 September 2026.',
  expiresAt:                    new Date('2026-12-31T23:59:59.000Z'),
  dataClassification:           DataClassificationTier.INTERNAL,
};

// ---------------------------------------------------------------------------
// Versioned update input (stale version — should produce VERSION_CONFLICT)
// ---------------------------------------------------------------------------

export function makeStaleVersionUpdateInput(id: string): CheckpointUpdateInput {
  return {
    id,
    ownerRef:          CHECKPOINT_OWNER_A,
    expectedVersion:   999,  // deliberately wrong version
    orchestratorPhase: OrchestratorPhase.SOURCING,
  };
}

// ---------------------------------------------------------------------------
// Degraded agent step scenario
// ---------------------------------------------------------------------------

export const degradedDiningStep = {
  domain:            InventoryDomain.DINING,
  status:            AgentStepStatus.DEGRADED,
  stepIndex:         2,
  degradedReasonCode: 'SUPPLIER_TIMEOUT',
  safeOutputSummaryJson: {
    summarizedOutput: 'Dining agent timed out after 5 s. Partial results may be available.',
    domain:           'DINING',
    toolName:         'searchDining',
    executedAt:       '2026-07-30T10:06:05.000Z',
  } satisfies Record<string, unknown>,
} as const;

// ---------------------------------------------------------------------------
// Expired checkpoint scenario
// ---------------------------------------------------------------------------

export const expiredCheckpointInput: CheckpointCreateInput = {
  sessionRef:                   'sess_test_expired_001',
  ownerRef:                     CHECKPOINT_OWNER_A,
  orchestratorPhase:            OrchestratorPhase.INTENT_CAPTURE,
  naturalLanguageIntentSummary: 'Expired session — should not be resumable.',
  // expiresAt in the past simulates a session that timed out
  expiresAt:                    new Date('2026-01-01T00:00:00.000Z'),
  dataClassification:           DataClassificationTier.INTERNAL,
};

// ---------------------------------------------------------------------------
// Sensitive field rejection fixture
// ---------------------------------------------------------------------------

/** Payload containing a sensitive field — must be rejected by validateCheckpointPayload. */
export const sensitivePayloadFixture: Record<string, unknown> = {
  destinationToken: 'dest_test_001',
  partySize:        2,
  email:            'traveller@example.invalid',  // sensitive — must be rejected
};

/** Payload containing nested sensitive field — must be rejected. */
export const nestedSensitivePayloadFixture: Record<string, unknown> = {
  destinationToken: 'dest_test_001',
  partyDetails: {
    count:   2,
    bonvoyId: 'bn_XXXXXXXX',  // sensitive nested field — must be rejected
  },
};

/** Clean payload with no sensitive fields — must pass validation. */
export const cleanConstraintsPayload: Record<string, unknown> = {
  destinationToken:  'dest_test_paris_001',
  checkInDate:       '2026-09-01',
  checkOutDate:      '2026-09-07',
  partySize:         2,
  budgetBandCode:    'PREMIUM',
  interestTags:      ['BEACHFRONT', 'CULINARY'],
};
