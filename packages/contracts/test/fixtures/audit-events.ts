/**
 * @voya/contracts — Audit event test fixtures
 *
 * All actor references, resource references, and correlation IDs are synthetic
 * placeholders. No real traveller, Bonvoy, supplier, payment, or employee
 * identifiers are included. Fixture values must not be used as real audit data.
 */

import type { AuditEvent, AuditActor, ResourceRef, RedactionMeta } from '../../src/audit/audit-event.js';
import { buildAuditHashInput } from '../../src/audit/canonicalize.js';

// ---------------------------------------------------------------------------
// Shared synthetic actor references
// ---------------------------------------------------------------------------

export const systemServiceActor: AuditActor = {
  actorType: 'SERVICE_PRINCIPAL',
  actorRef:  'svc_test_sourcing_001',
};

export const agentActor: AuditActor = {
  actorType: 'AGENT_PRINCIPAL',
  actorRef:  'agent_test_pathb_001',
  pathMode:  'PATH_B',
};

export const authenticatedTravellerActor: AuditActor = {
  actorType: 'TRAVELLER_AUTHENTICATED',
  actorRef:  'tok_test_traveller_001',  // tokenized reference — not a Bonvoy number
  pathMode:  'PATH_A',
};

export const guestTravellerActor: AuditActor = {
  actorType: 'TRAVELLER_GUEST',
  actorRef:  'sess_test_guest_001',   // session token — not an email
};

export const loyaltyAdminActor: AuditActor = {
  actorType: 'LOYALTY_ADMINISTRATOR',
  actorRef:  'op_test_loyaltyadmin_001',
};

// ---------------------------------------------------------------------------
// Helper to build a valid canonicalHashInput for fixtures
// ---------------------------------------------------------------------------

function makeHashInput(
  eventId: string,
  eventType: string,
  actor: AuditActor,
  occurredAt: string,
  resource: ResourceRef,
  correlationId: string,
  dataClassification: string,
): string {
  return buildAuditHashInput({
    eventId,
    eventType,
    actorType:          actor.actorType,
    actorRef:           actor.actorRef,
    occurredAt,
    resourceType:       resource.resourceType,
    resourceRef:        resource.resourceRef,
    correlationId,
    dataClassification,
  });
}

const unredacted: RedactionMeta = {
  isRedacted:     false,
  redactedFields: [],
};

const partiallyRedacted: RedactionMeta = {
  isRedacted:      true,
  redactedFields:  ['rawConstraints'],
  redactionReason: 'INTERNAL-tier field omitted from audit payload',
};

// ---------------------------------------------------------------------------
// Sourcing order — HVMI queried first
// ---------------------------------------------------------------------------

export const sourcingOrderEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000001';
  const occurredAt = '2026-01-15T10:00:00.000Z';
  const resource: ResourceRef = {
    resourceType: 'TRIP_INTENT',
    resourceRef:  'tip_test_001_00000000-0000-4000-8000-000000000010',
  };
  return {
    eventId,
    eventType:          'SOURCING_ORDER',
    actor:              systemServiceActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_sourcing_001',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      connectorOrder:  ['HVMI', 'MARRIOTT_BRAND'],
      hvmiQueried:     true,
      destinationToken: 'dest_test_paris_001',
    },
    canonicalHashInput: makeHashInput(eventId, 'SOURCING_ORDER', systemServiceActor, occurredAt, resource, 'corr_test_sourcing_001', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// HVMI fallback disclosure
// ---------------------------------------------------------------------------

export const hvmiFallbackDisclosureEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000002';
  const occurredAt = '2026-01-15T10:00:05.000Z';
  const resource: ResourceRef = {
    resourceType: 'TRIP_INTENT',
    resourceRef:  'tip_test_001_00000000-0000-4000-8000-000000000010',
  };
  return {
    eventId,
    eventType:          'BRAND_FALLBACK_DISCLOSURE',
    actor:              systemServiceActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_sourcing_001',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      hvmiResultCount:     0,
      fallbackSource:      'MARRIOTT_BRAND',
      fallbackResultCount: 12,
      destinationToken:    'dest_test_paris_001',
    },
    canonicalHashInput: makeHashInput(eventId, 'BRAND_FALLBACK_DISCLOSURE', systemServiceActor, occurredAt, resource, 'corr_test_sourcing_001', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// Manifest exclusion
// ---------------------------------------------------------------------------

export const manifestExclusionEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000003';
  const occurredAt = '2026-01-15T10:00:10.000Z';
  const resource: ResourceRef = {
    resourceType: 'SUPPLIER_MANIFEST',
    resourceRef:  'sup_test_deeplink_only_001',
  };
  return {
    eventId,
    eventType:          'MANIFEST_EXCLUSION',
    actor:              systemServiceActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_sourcing_001',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      supplierId:      'sup_test_deeplink_only_001',
      exclusionReason: 'DEEP_LINK_ONLY_FORBIDDEN_AT_CHECKOUT',
      bookabilityMode: 'DEEP_LINK_ONLY',
    },
    canonicalHashInput: makeHashInput(eventId, 'MANIFEST_EXCLUSION', systemServiceActor, occurredAt, resource, 'corr_test_sourcing_001', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// Receipt issuance
// ---------------------------------------------------------------------------

export const receiptIssuedEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000004';
  const occurredAt = '2026-01-15T10:05:00.000Z';
  const resource: ResourceRef = {
    resourceType:    'TRIP_CONFIDENCE_RECEIPT',
    resourceRef:     'rcpt_test_001_00000000-0000-4000-8000-000000000020',
    resourceVersion: 1,
  };
  return {
    eventId,
    eventType:          'RECEIPT_ISSUED',
    actor:              agentActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_checkout_001',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      itineraryId:     'itin_test_001_00000000-0000-4000-8000-000000000030',
      itineraryVersion: 1,
      outcome:         'PASS',
      freshnessGrade:  'FRESH',
    },
    canonicalHashInput: makeHashInput(eventId, 'RECEIPT_ISSUED', agentActor, occurredAt, resource, 'corr_test_checkout_001', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// Receipt blocked (non-freshness)
// ---------------------------------------------------------------------------

export const receiptBlockedEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000005';
  const occurredAt = '2026-01-15T11:00:00.000Z';
  const resource: ResourceRef = {
    resourceType:    'TRIP_CONFIDENCE_RECEIPT',
    resourceRef:     'rcpt_test_002_00000000-0000-4000-8000-000000000021',
    resourceVersion: 1,
  };
  return {
    eventId,
    eventType:          'RECEIPT_BLOCKED',
    actor:              systemServiceActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_checkout_002',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      itineraryId:      'itin_test_002_00000000-0000-4000-8000-000000000031',
      itineraryVersion: 2,
      blockedReasonCode: 'PRICE_CHANGED',
      outcome:          'BLOCKED',
    },
    canonicalHashInput: makeHashInput(eventId, 'RECEIPT_BLOCKED', systemServiceActor, occurredAt, resource, 'corr_test_checkout_002', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// Prompt-safety rejection
// ---------------------------------------------------------------------------

export const promptSafetyRejectionEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000006';
  const occurredAt = '2026-01-15T09:30:00.000Z';
  const resource: ResourceRef = {
    resourceType: 'PROMPT_REQUEST',
    resourceRef:  'preq_test_001_00000000-0000-4000-8000-000000000040',
  };
  return {
    eventId,
    eventType:          'PROMPT_SAFETY_REJECTION',
    actor:              agentActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_pathb_001',
    dataClassification: 'CONFIDENTIAL',
    redactionMeta:      partiallyRedacted,
    eventDetails: {
      categoryViolations: ['TRAVELLER_IDENTITY', 'PAYMENT_DETAILS'],
      promptLength:        142,
      rejectionPolicy:    'GOVERNANCE_V1',
    },
    canonicalHashInput: makeHashInput(eventId, 'PROMPT_SAFETY_REJECTION', agentActor, occurredAt, resource, 'corr_test_pathb_001', 'CONFIDENTIAL'),
  };
})();

// ---------------------------------------------------------------------------
// Simulated loyalty quote
// ---------------------------------------------------------------------------

export const loyaltySimulatedQuoteEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000007';
  const occurredAt = '2026-01-15T10:10:00.000Z';
  const resource: ResourceRef = {
    resourceType: 'LOYALTY_TRANSACTION',
    resourceRef:  'ltxn_test_quote_001_00000000-0000-4000-8000-000000000050',
  };
  return {
    eventId,
    eventType:          'LOYALTY_SIMULATED_QUOTE',
    actor:              agentActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_loyalty_001',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      itineraryId:      'itin_test_001_00000000-0000-4000-8000-000000000030',
      simulatedPoints:  45000,
      isSimulated:      true,
      realBalanceRead:  false,
    },
    canonicalHashInput: makeHashInput(eventId, 'LOYALTY_SIMULATED_QUOTE', agentActor, occurredAt, resource, 'corr_test_loyalty_001', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// Simulated loyalty hold
// ---------------------------------------------------------------------------

export const loyaltySimulatedHoldEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000008';
  const occurredAt = '2026-01-15T10:15:00.000Z';
  const resource: ResourceRef = {
    resourceType: 'LOYALTY_TRANSACTION',
    resourceRef:  'ltxn_test_hold_001_00000000-0000-4000-8000-000000000051',
  };
  return {
    eventId,
    eventType:          'LOYALTY_SIMULATED_HOLD',
    actor:              agentActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_loyalty_001',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      itineraryId:      'itin_test_001_00000000-0000-4000-8000-000000000030',
      simulatedPoints:  45000,
      isSimulated:      true,
      realBalanceFrozen: false,
    },
    canonicalHashInput: makeHashInput(eventId, 'LOYALTY_SIMULATED_HOLD', agentActor, occurredAt, resource, 'corr_test_loyalty_001', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// Simulated loyalty commit
// ---------------------------------------------------------------------------

export const loyaltySimulatedCommitEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000009';
  const occurredAt = '2026-01-15T10:20:00.000Z';
  const resource: ResourceRef = {
    resourceType: 'LOYALTY_TRANSACTION',
    resourceRef:  'ltxn_test_commit_001_00000000-0000-4000-8000-000000000052',
  };
  return {
    eventId,
    eventType:          'LOYALTY_SIMULATED_COMMIT',
    actor:              systemServiceActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_loyalty_001',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      itineraryId:      'itin_test_001_00000000-0000-4000-8000-000000000030',
      simulatedPoints:  45000,
      isSimulated:      true,
      realDebitOccurred: false,
    },
    canonicalHashInput: makeHashInput(eventId, 'LOYALTY_SIMULATED_COMMIT', systemServiceActor, occurredAt, resource, 'corr_test_loyalty_001', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// Simulated loyalty reversal
// ---------------------------------------------------------------------------

export const loyaltySimulatedReversalEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000010';
  const occurredAt = '2026-01-15T10:25:00.000Z';
  const resource: ResourceRef = {
    resourceType: 'LOYALTY_TRANSACTION',
    resourceRef:  'ltxn_test_reversal_001_00000000-0000-4000-8000-000000000053',
  };
  return {
    eventId,
    eventType:          'LOYALTY_SIMULATED_REVERSAL',
    actor:              systemServiceActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_loyalty_001',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      itineraryId:       'itin_test_001_00000000-0000-4000-8000-000000000030',
      reversedPoints:    45000,
      isSimulated:       true,
      realCreditOccurred: false,
    },
    canonicalHashInput: makeHashInput(eventId, 'LOYALTY_SIMULATED_REVERSAL', systemServiceActor, occurredAt, resource, 'corr_test_loyalty_001', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// Checkout state transition
// ---------------------------------------------------------------------------

export const checkoutStateTransitionEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000011';
  const occurredAt = '2026-01-15T10:30:00.000Z';
  const resource: ResourceRef = {
    resourceType: 'CHECKOUT_SESSION',
    resourceRef:  'chk_test_001_00000000-0000-4000-8000-000000000060',
  };
  return {
    eventId,
    eventType:          'CHECKOUT_STATE_TRANSITION',
    actor:              systemServiceActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_checkout_001',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      fromState:   'RECEIPT_VERIFIED',
      toState:     'PAYMENT_AUTHORISED',
      itineraryId: 'itin_test_001_00000000-0000-4000-8000-000000000030',
    },
    canonicalHashInput: makeHashInput(eventId, 'CHECKOUT_STATE_TRANSITION', systemServiceActor, occurredAt, resource, 'corr_test_checkout_001', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// Authentication event
// ---------------------------------------------------------------------------

export const authenticationEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000012';
  const occurredAt = '2026-01-15T09:00:00.000Z';
  const resource: ResourceRef = {
    resourceType: 'TRAVELLER_SESSION',
    resourceRef:  'sess_test_001_00000000-0000-4000-8000-000000000070',
  };
  return {
    eventId,
    eventType:          'AUTHENTICATION_EVENT',
    actor:              authenticatedTravellerActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_auth_001',
    dataClassification: 'CONFIDENTIAL',
    redactionMeta:      partiallyRedacted,
    eventDetails: {
      authMethod:   'BONVOY_SSO',
      pathMode:     'PATH_A',
      sessionCreated: true,
    },
    canonicalHashInput: makeHashInput(eventId, 'AUTHENTICATION_EVENT', authenticatedTravellerActor, occurredAt, resource, 'corr_test_auth_001', 'CONFIDENTIAL'),
  };
})();

// ---------------------------------------------------------------------------
// Retention decision
// ---------------------------------------------------------------------------

export const retentionDecisionEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000013';
  const occurredAt = '2026-06-15T00:00:00.000Z';
  const resource: ResourceRef = {
    resourceType: 'RETENTION_POLICY',
    resourceRef:  'pol_test_session_data_001',
  };
  return {
    eventId,
    eventType:          'RETENTION_DECISION',
    actor:              { actorType: 'SYSTEM_PROCESS', actorRef: 'proc_test_retention_job_001' },
    occurredAt,
    resource,
    correlationId:      'corr_test_retention_001',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      policyKey:        'SESSION_DATA',
      triggerEvent:     'SESSION_EXPIRED',
      retentionDays:    30,
      purgeAction:      'DELETE',
      approvalStatus:   'PROVISIONAL',
      physicalPurge:    false,  // purge jobs are out of scope
    },
    canonicalHashInput: makeHashInput(eventId, 'RETENTION_DECISION', { actorType: 'SYSTEM_PROCESS', actorRef: 'proc_test_retention_job_001' }, occurredAt, resource, 'corr_test_retention_001', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// Admin approval evidence
// ---------------------------------------------------------------------------

export const adminApprovalEvidenceEvent: AuditEvent = (() => {
  const eventId = '00000000-0000-4000-8000-000000000014';
  const occurredAt = '2026-03-01T14:00:00.000Z';
  const resource: ResourceRef = {
    resourceType: 'ADMIN_APPROVAL',
    resourceRef:  'appr_test_001_00000000-0000-4000-8000-000000000080',
  };
  return {
    eventId,
    eventType:          'ADMIN_APPROVAL_EVIDENCE',
    actor:              loyaltyAdminActor,
    occurredAt,
    resource,
    correlationId:      'corr_test_admin_001',
    dataClassification: 'INTERNAL',
    redactionMeta:      unredacted,
    eventDetails: {
      approvalType:     'RETENTION_POLICY_OVERRIDE',
      policyRef:        'pol_test_audit_retention_001',
      approvalRef:      'appr_ref_test_001',
      evidenceNote:     'Synthetic approval record for testing only',
    },
    canonicalHashInput: makeHashInput(eventId, 'ADMIN_APPROVAL_EVIDENCE', loyaltyAdminActor, occurredAt, resource, 'corr_test_admin_001', 'INTERNAL'),
  };
})();

// ---------------------------------------------------------------------------
// Convenience: all fixtures as an array for iteration tests
// ---------------------------------------------------------------------------

export const ALL_AUDIT_EVENT_FIXTURES: ReadonlyArray<AuditEvent> = [
  sourcingOrderEvent,
  hvmiFallbackDisclosureEvent,
  manifestExclusionEvent,
  receiptIssuedEvent,
  receiptBlockedEvent,
  promptSafetyRejectionEvent,
  loyaltySimulatedQuoteEvent,
  loyaltySimulatedHoldEvent,
  loyaltySimulatedCommitEvent,
  loyaltySimulatedReversalEvent,
  checkoutStateTransitionEvent,
  authenticationEvent,
  retentionDecisionEvent,
  adminApprovalEvidenceEvent,
];
