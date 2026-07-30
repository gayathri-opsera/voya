/**
 * Unit tests for @voya/contracts — Audit event schema and actor model
 *
 * Tests cover:
 *  - AuditEventSchema: valid event roundtrip
 *  - Actor validation: tokenized references, all actor types
 *  - Redaction enforcement: isRedacted=true requires non-empty redactedFields
 *  - Event details: restricted field name rejection
 *  - Missing required fields: fails closed with structured errors
 */

import { describe, it, expect } from 'vitest';
import {
  AuditEventSchema,
  AuditActorSchema,
  AuditActorTypeEnum,
  AuditActorType,
  ResourceRefSchema,
  RedactionMetaSchema,
  RESTRICTED_FIELD_NAMES,
  parseAuditEvent,
  validateEventDetails,
} from '../../src/audit/audit-event.js';
import { AuditEventType, AuditEventTypeEnum } from '../../src/common/enums.js';
import {
  sourcingOrderEvent,
  hvmiFallbackDisclosureEvent,
  manifestExclusionEvent,
  receiptBlockedEvent,
  promptSafetyRejectionEvent,
  ALL_AUDIT_EVENT_FIXTURES,
} from '../fixtures/audit-events.js';

// ---------------------------------------------------------------------------
// AuditActorSchema
// ---------------------------------------------------------------------------

describe('AuditActorSchema', () => {
  it('accepts a valid service principal actor', () => {
    const result = AuditActorSchema.safeParse({
      actorType: 'SERVICE_PRINCIPAL',
      actorRef:  'svc_test_001',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all defined actor types', () => {
    for (const actorType of AuditActorTypeEnum.options) {
      const result = AuditActorSchema.safeParse({
        actorType,
        actorRef: `ref_test_${actorType.toLowerCase()}`,
      });
      expect(result.success, `Actor type ${actorType} should be valid`).toBe(true);
    }
  });

  it('accepts a traveller actor with pathMode', () => {
    const result = AuditActorSchema.safeParse({
      actorType: 'TRAVELLER_AUTHENTICATED',
      actorRef:  'tok_test_traveller_001',
      pathMode:  'PATH_A',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty actorRef', () => {
    const result = AuditActorSchema.safeParse({
      actorType: 'SERVICE_PRINCIPAL',
      actorRef:  '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown actor type', () => {
    const result = AuditActorSchema.safeParse({
      actorType: 'UNKNOWN_ACTOR',
      actorRef:  'ref_test_001',
    });
    expect(result.success).toBe(false);
  });

  it('rejects extra fields via .strict()', () => {
    const result = AuditActorSchema.safeParse({
      actorType: 'SERVICE_PRINCIPAL',
      actorRef:  'ref_test_001',
      email:     'should-not-be-here@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('AuditActorType constant matches enum values', () => {
    expect(AuditActorType.SERVICE_PRINCIPAL).toBe('SERVICE_PRINCIPAL');
    expect(AuditActorType.TRAVELLER_AUTHENTICATED).toBe('TRAVELLER_AUTHENTICATED');
    expect(AuditActorType.SYSTEM_PROCESS).toBe('SYSTEM_PROCESS');
  });
});

// ---------------------------------------------------------------------------
// RedactionMetaSchema
// ---------------------------------------------------------------------------

describe('RedactionMetaSchema', () => {
  it('accepts isRedacted:false with empty redactedFields', () => {
    const result = RedactionMetaSchema.safeParse({
      isRedacted:     false,
      redactedFields: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts isRedacted:true with non-empty redactedFields', () => {
    const result = RedactionMetaSchema.safeParse({
      isRedacted:      true,
      redactedFields:  ['rawConstraints', 'sessionToken'],
      redactionReason: 'INTERNAL-tier field',
    });
    expect(result.success).toBe(true);
  });

  it('rejects isRedacted:true with empty redactedFields', () => {
    const result = RedactionMetaSchema.safeParse({
      isRedacted:     true,
      redactedFields: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('redactedFields');
    }
  });

  it('rejects extra fields via .strict()', () => {
    const result = RedactionMetaSchema.safeParse({
      isRedacted:     false,
      redactedFields: [],
      extraField:     'not allowed',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateEventDetails() — restricted field name detection
// ---------------------------------------------------------------------------

describe('validateEventDetails()', () => {
  it('returns empty array for safe details', () => {
    const violations = validateEventDetails({
      connectorOrder:   ['HVMI'],
      destinationToken: 'dest_test_001',
    });
    expect(violations).toHaveLength(0);
  });

  it('returns restricted field names when present', () => {
    const violations = validateEventDetails({
      itineraryId: 'itin_test_001',
      email:       'user@example.com',  // restricted
      bonvoyNumber: '123456789',         // restricted
    });
    expect(violations).toContain('email');
    expect(violations).toContain('bonvoyNumber');
  });

  it('detects all known restricted field names', () => {
    const details: Record<string, unknown> = {};
    for (const name of RESTRICTED_FIELD_NAMES) {
      details[name] = 'test-value';
    }
    const violations = validateEventDetails(details);
    expect(violations.length).toBe(RESTRICTED_FIELD_NAMES.size);
  });
});

// ---------------------------------------------------------------------------
// AuditEventSchema — valid events
// ---------------------------------------------------------------------------

describe('AuditEventSchema — valid events', () => {
  it('validates the sourcing order fixture', () => {
    const result = AuditEventSchema.safeParse(sourcingOrderEvent);
    expect(result.success).toBe(true);
  });

  it('validates the fallback disclosure fixture', () => {
    const result = AuditEventSchema.safeParse(hvmiFallbackDisclosureEvent);
    expect(result.success).toBe(true);
  });

  it('validates the manifest exclusion fixture', () => {
    const result = AuditEventSchema.safeParse(manifestExclusionEvent);
    expect(result.success).toBe(true);
  });

  it('validates the receipt blocked fixture', () => {
    const result = AuditEventSchema.safeParse(receiptBlockedEvent);
    expect(result.success).toBe(true);
  });

  it('validates the prompt-safety rejection fixture', () => {
    const result = AuditEventSchema.safeParse(promptSafetyRejectionEvent);
    expect(result.success).toBe(true);
  });

  it('validates all fixtures in ALL_AUDIT_EVENT_FIXTURES', () => {
    for (const event of ALL_AUDIT_EVENT_FIXTURES) {
      const result = AuditEventSchema.safeParse(event);
      expect(result.success, `Event ${event.eventType} (${event.eventId}) should be valid`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// AuditEventSchema — invalid events (fail-closed validation)
// ---------------------------------------------------------------------------

describe('AuditEventSchema — invalid events', () => {
  it('rejects an event with a restricted field in eventDetails', () => {
    const invalidEvent = {
      ...sourcingOrderEvent,
      eventDetails: {
        ...sourcingOrderEvent.eventDetails,
        email: 'traveller@example.com',
      },
    };
    const result = AuditEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('email'))).toBe(true);
    }
  });

  it('rejects an event with a bonvoyNumber in eventDetails', () => {
    const invalidEvent = {
      ...sourcingOrderEvent,
      eventDetails: { bonvoyNumber: '123456789' },
    };
    const result = AuditEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });

  it('rejects an event missing eventId', () => {
    const { eventId: _omit, ...withoutId } = sourcingOrderEvent;
    const result = AuditEventSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it('rejects an event with a non-UUID eventId', () => {
    const result = AuditEventSchema.safeParse({
      ...sourcingOrderEvent,
      eventId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an event missing actor', () => {
    const { actor: _omit, ...withoutActor } = sourcingOrderEvent;
    const result = AuditEventSchema.safeParse(withoutActor);
    expect(result.success).toBe(false);
  });

  it('rejects an event missing occurredAt', () => {
    const { occurredAt: _omit, ...withoutTs } = sourcingOrderEvent;
    const result = AuditEventSchema.safeParse(withoutTs);
    expect(result.success).toBe(false);
  });

  it('rejects an event with non-ISO occurredAt', () => {
    const result = AuditEventSchema.safeParse({
      ...sourcingOrderEvent,
      occurredAt: '15 Jan 2026',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an event missing correlationId', () => {
    const { correlationId: _omit, ...without } = sourcingOrderEvent;
    const result = AuditEventSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects an event missing resource', () => {
    const { resource: _omit, ...without } = sourcingOrderEvent;
    const result = AuditEventSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects an event missing canonicalHashInput', () => {
    const { canonicalHashInput: _omit, ...without } = sourcingOrderEvent;
    const result = AuditEventSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects an event with empty canonicalHashInput', () => {
    const result = AuditEventSchema.safeParse({
      ...sourcingOrderEvent,
      canonicalHashInput: '',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseAuditEvent() helper
// ---------------------------------------------------------------------------

describe('parseAuditEvent()', () => {
  it('returns success:true for a valid event', () => {
    const result = parseAuditEvent(sourcingOrderEvent);
    expect(result.success).toBe(true);
  });

  it('returns success:false for invalid input', () => {
    const result = parseAuditEvent({ invalid: true });
    expect(result.success).toBe(false);
  });

  it('returned data matches input on success', () => {
    const result = parseAuditEvent(sourcingOrderEvent);
    if (result.success) {
      expect(result.data.eventId).toBe(sourcingOrderEvent.eventId);
      expect(result.data.eventType).toBe(sourcingOrderEvent.eventType);
    }
  });
});

// ---------------------------------------------------------------------------
// AuditEventType enum coverage
// ---------------------------------------------------------------------------

describe('AuditEventTypeEnum — coverage', () => {
  const requiredTypes: AuditEventType[] = [
    'SOURCING_ORDER',
    'BRAND_FALLBACK_DISCLOSURE',
    'MANIFEST_EXCLUSION',
    'RECEIPT_ISSUED',
    'RECEIPT_BLOCKED',
    'PROMPT_SAFETY_REJECTION',
    'LOYALTY_SIMULATED_QUOTE',
    'LOYALTY_SIMULATED_HOLD',
    'LOYALTY_SIMULATED_COMMIT',
    'LOYALTY_SIMULATED_REVERSAL',
    'CHECKOUT_STATE_TRANSITION',
    'AUTHENTICATION_EVENT',
    'RETENTION_DECISION',
    'ADMIN_APPROVAL_EVIDENCE',
  ];

  for (const eventType of requiredTypes) {
    it(`AuditEventType includes "${eventType}"`, () => {
      expect(AuditEventTypeEnum.options).toContain(eventType);
    });
  }
});
