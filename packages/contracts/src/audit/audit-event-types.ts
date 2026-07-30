/**
 * @voya/contracts — Canonical audit event type registry
 *
 * Provides richer metadata per event type: category, description, severity,
 * and the actor types that are valid producers of each event.
 * This registry is the authoritative reference for future service implementations.
 */

import type { AuditEventType } from '../common/enums.js';
import { AuditEventType as AuditEventTypeValues } from '../common/enums.js';
import type { AuditActorType } from './audit-event.js';
import { AuditActorType as AuditActorTypeValues } from './audit-event.js';

// ---------------------------------------------------------------------------
// Event categories
// ---------------------------------------------------------------------------

export const AUDIT_EVENT_CATEGORY = {
  SOURCING:       'SOURCING',
  RECEIPT:        'RECEIPT',
  LOYALTY:        'LOYALTY',
  CHECKOUT:       'CHECKOUT',
  SAFETY:         'SAFETY',
  RETENTION:      'RETENTION',
  ADMIN:          'ADMIN',
  AUTHENTICATION: 'AUTHENTICATION',
  ITINERARY:      'ITINERARY',
} as const;
export type AuditEventCategory = (typeof AUDIT_EVENT_CATEGORY)[keyof typeof AUDIT_EVENT_CATEGORY];

// ---------------------------------------------------------------------------
// Event type metadata
// ---------------------------------------------------------------------------

export interface AuditEventTypeMetadata {
  readonly eventType:          AuditEventType;
  readonly category:           AuditEventCategory;
  readonly description:        string;
  readonly isHighSeverity:     boolean;
  /** Actor types that are valid producers of this event */
  readonly validActorTypes:    ReadonlyArray<AuditActorType>;
}

// ---------------------------------------------------------------------------
// Registry — one entry per AuditEventType value
// ---------------------------------------------------------------------------

export const AUDIT_EVENT_TYPE_REGISTRY: Readonly<Record<AuditEventType, AuditEventTypeMetadata>> = {
  [AuditEventTypeValues.SOURCING_ORDER]: {
    eventType:       'SOURCING_ORDER',
    category:        AUDIT_EVENT_CATEGORY.SOURCING,
    description:     'Records the ordered list of connectors queried for a sourcing request, proving HVMI-first policy compliance.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.BRAND_FALLBACK_DISCLOSURE]: {
    eventType:       'BRAND_FALLBACK_DISCLOSURE',
    category:        AUDIT_EVENT_CATEGORY.SOURCING,
    description:     'Records that Marriott brand inventory was used after HVMI returned no eligible results, satisfying fallback disclosure requirements.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.SUPPLIER_EXCLUSION]: {
    eventType:       'SUPPLIER_EXCLUSION',
    category:        AUDIT_EVENT_CATEGORY.SOURCING,
    description:     'Records that an uncertified supplier was dropped from the response path.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.MANIFEST_EXCLUSION]: {
    eventType:       'MANIFEST_EXCLUSION',
    category:        AUDIT_EVENT_CATEGORY.SOURCING,
    description:     'Records that a supplier was excluded via a capability manifest policy rule (e.g. DEEP_LINK_ONLY forbidden for checkout).',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.SAFETY_GATE_DECISION]: {
    eventType:       'SAFETY_GATE_DECISION',
    category:        AUDIT_EVENT_CATEGORY.SAFETY,
    description:     'Records a destination safety gate decision (cleared or blocked).',
    isHighSeverity:  true,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL, AuditActorTypeValues.SYSTEM_PROCESS],
  },
  [AuditEventTypeValues.PROMPT_SAFETY_REJECTION]: {
    eventType:       'PROMPT_SAFETY_REJECTION',
    category:        AUDIT_EVENT_CATEGORY.SAFETY,
    description:     'Records that a prompt was blocked by the safety gate with the specific rejection reason and category violations.',
    isHighSeverity:  true,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL, AuditActorTypeValues.SYSTEM_PROCESS],
  },
  [AuditEventTypeValues.RECEIPT_ISSUED]: {
    eventType:       'RECEIPT_ISSUED',
    category:        AUDIT_EVENT_CATEGORY.RECEIPT,
    description:     'Records that a Trip Confidence Receipt was produced and persisted for an itinerary version.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.RECEIPT_STALE_BLOCKED]: {
    eventType:       'RECEIPT_STALE_BLOCKED',
    category:        AUDIT_EVENT_CATEGORY.RECEIPT,
    description:     'Records that a receipt was blocked because it failed the freshness re-check at checkout.',
    isHighSeverity:  true,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.RECEIPT_BLOCKED]: {
    eventType:       'RECEIPT_BLOCKED',
    category:        AUDIT_EVENT_CATEGORY.RECEIPT,
    description:     'Records that a receipt was blocked for a non-freshness policy reason (e.g. price change, availability change).',
    isHighSeverity:  true,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.LOYALTY_SIMULATED_DEBIT]: {
    eventType:       'LOYALTY_SIMULATED_DEBIT',
    category:        AUDIT_EVENT_CATEGORY.LOYALTY,
    description:     'Records a pseudo-redemption. No real Bonvoy balance was changed.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.LOYALTY_SIMULATED_QUOTE]: {
    eventType:       'LOYALTY_SIMULATED_QUOTE',
    category:        AUDIT_EVENT_CATEGORY.LOYALTY,
    description:     'Records a simulated points quote. No real Bonvoy balance was read or reserved.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.LOYALTY_SIMULATED_HOLD]: {
    eventType:       'LOYALTY_SIMULATED_HOLD',
    category:        AUDIT_EVENT_CATEGORY.LOYALTY,
    description:     'Records a simulated points hold. No real Bonvoy balance was frozen.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.LOYALTY_SIMULATED_COMMIT]: {
    eventType:       'LOYALTY_SIMULATED_COMMIT',
    category:        AUDIT_EVENT_CATEGORY.LOYALTY,
    description:     'Records a simulated points commit. No real Bonvoy debit occurred.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.LOYALTY_SIMULATED_REVERSAL]: {
    eventType:       'LOYALTY_SIMULATED_REVERSAL',
    category:        AUDIT_EVENT_CATEGORY.LOYALTY,
    description:     'Records a simulated points reversal. No real Bonvoy credit occurred.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.CHECKOUT_AUTHORISATION_TAKEN]: {
    eventType:       'CHECKOUT_AUTHORISATION_TAKEN',
    category:        AUDIT_EVENT_CATEGORY.CHECKOUT,
    description:     'Records that a Payment Intent was authorised.',
    isHighSeverity:  true,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL],
  },
  [AuditEventTypeValues.CHECKOUT_COMPENSATED]: {
    eventType:       'CHECKOUT_COMPENSATED',
    category:        AUDIT_EVENT_CATEGORY.CHECKOUT,
    description:     'Records that a saga compensation was executed after a partial checkout failure.',
    isHighSeverity:  true,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.SYSTEM_PROCESS],
  },
  [AuditEventTypeValues.CHECKOUT_STATE_TRANSITION]: {
    eventType:       'CHECKOUT_STATE_TRANSITION',
    category:        AUDIT_EVENT_CATEGORY.CHECKOUT,
    description:     'Records a checkout state machine transition with from/to states.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL, AuditActorTypeValues.SYSTEM_PROCESS],
  },
  [AuditEventTypeValues.ITINERARY_PRESENTED]: {
    eventType:       'ITINERARY_PRESENTED',
    category:        AUDIT_EVENT_CATEGORY.ITINERARY,
    description:     'Records that an itinerary was surfaced to a traveller.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.AGENT_PRINCIPAL],
  },
  [AuditEventTypeValues.AUTHENTICATION_EVENT]: {
    eventType:       'AUTHENTICATION_EVENT',
    category:        AUDIT_EVENT_CATEGORY.AUTHENTICATION,
    description:     'Records an authentication or de-authentication event for a traveller.',
    isHighSeverity:  true,
    validActorTypes: [AuditActorTypeValues.SERVICE_PRINCIPAL, AuditActorTypeValues.TRAVELLER_AUTHENTICATED, AuditActorTypeValues.TRAVELLER_GUEST],
  },
  [AuditEventTypeValues.RETENTION_DECISION]: {
    eventType:       'RETENTION_DECISION',
    category:        AUDIT_EVENT_CATEGORY.RETENTION,
    description:     'Records a data retention policy decision. Does not trigger physical data deletion.',
    isHighSeverity:  false,
    validActorTypes: [AuditActorTypeValues.SYSTEM_PROCESS, AuditActorTypeValues.CUSTOMER_CARE_OPERATOR],
  },
  [AuditEventTypeValues.ADMIN_APPROVAL_EVIDENCE]: {
    eventType:       'ADMIN_APPROVAL_EVIDENCE',
    category:        AUDIT_EVENT_CATEGORY.ADMIN,
    description:     'Records an administrative approval with reference evidence. Captures who approved what, when, and the policy reference.',
    isHighSeverity:  true,
    validActorTypes: [AuditActorTypeValues.CUSTOMER_CARE_OPERATOR, AuditActorTypeValues.LOYALTY_ADMINISTRATOR, AuditActorTypeValues.MERCHANDISER, AuditActorTypeValues.FRAUD_ANALYST],
  },
} as const;

/**
 * Returns the metadata for a given audit event type.
 */
export function getAuditEventTypeMetadata(eventType: AuditEventType): AuditEventTypeMetadata {
  return AUDIT_EVENT_TYPE_REGISTRY[eventType];
}

/**
 * Returns all high-severity event types.
 */
export function getHighSeverityEventTypes(): ReadonlyArray<AuditEventType> {
  return Object.values(AUDIT_EVENT_TYPE_REGISTRY)
    .filter((m) => m.isHighSeverity)
    .map((m) => m.eventType);
}

/**
 * Returns all event types in a given category.
 */
export function getEventTypesByCategory(category: AuditEventCategory): ReadonlyArray<AuditEventType> {
  return Object.values(AUDIT_EVENT_TYPE_REGISTRY)
    .filter((m) => m.category === category)
    .map((m) => m.eventType);
}
