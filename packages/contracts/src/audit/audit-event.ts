/**
 * @voya/contracts — Audit event contract
 *
 * Defines the immutable audit event DTO, actor model, resource reference,
 * and redaction metadata used by all Voya services that write to the audit
 * ledger. Consumers emit events; they never update or delete them.
 *
 * Security rules:
 *  - actorRef must be a tokenized reference, never an email, name, or Bonvoy number.
 *  - eventDetails must not contain fields matching RESTRICTED_FIELD_NAMES.
 *  - isRedacted:true + redactedFields:[] is invalid — if you claim redaction has
 *    occurred, you must list which fields were redacted.
 */

import { z } from 'zod';
import { AuditEventTypeEnum } from '../common/enums.js';
import { DataClassificationTierEnum } from '../common/enums.js';
import { PathModeEnum } from '../common/enums.js';

// ---------------------------------------------------------------------------
// AuditActorType
// Represents the class of principal that triggered the event.
// Traveller actors must use tokenized actorRef values only.
// ---------------------------------------------------------------------------

export const AuditActorTypeEnum = z.enum([
  'TRAVELLER_AUTHENTICATED', // Bonvoy-authenticated traveller (token reference only)
  'TRAVELLER_GUEST',         // Anonymous guest session (session token only)
  'SERVICE_PRINCIPAL',       // Voya backend microservice
  'AGENT_PRINCIPAL',         // AI agent (Path B multi-agent pipeline)
  'CUSTOMER_CARE_OPERATOR',  // Internal CS staff (operator reference only)
  'LOYALTY_ADMINISTRATOR',   // Marriott loyalty admin (reference only)
  'MERCHANDISER',            // Inventory or rate merchandiser (reference only)
  'FRAUD_ANALYST',           // Fraud review analyst (reference only)
  'SYSTEM_PROCESS',          // Scheduled job or async worker
]);
export type AuditActorType = z.infer<typeof AuditActorTypeEnum>;
export const AuditActorType = AuditActorTypeEnum.enum;

// ---------------------------------------------------------------------------
// Field names that must never appear in eventDetails (Restricted / raw PII)
// ---------------------------------------------------------------------------

export const RESTRICTED_FIELD_NAMES = new Set([
  'email',
  'emailAddress',
  'bonvoyNumber',
  'bonvoyAccountNumber',
  'passportNumber',
  'passportId',
  'governmentId',
  'nationalId',
  'cardNumber',
  'creditCardNumber',
  'cvv',
  'cvv2',
  'securityCode',
  'pan',
  'socialSecurityNumber',
  'ssn',
  'dateOfBirth',
  'dob',
  'taxId',
  'password',
  'passwordHash',
  'accessToken',
  'refreshToken',
  'privateKey',
  'secret',
  'rawPayload',
  'requestBody',
]);

// ---------------------------------------------------------------------------
// AuditActor
// Represents a principal without exposing raw personal identifiers.
// ---------------------------------------------------------------------------

export const AuditActorSchema = z.object({
  actorType: AuditActorTypeEnum,
  /** Tokenized reference — must never be an email, name, or Bonvoy account number */
  actorRef:  z.string().min(1, 'actorRef must be a non-empty tokenized reference'),
  pathMode:  PathModeEnum.optional(),
}).strict();
export type AuditActor = z.infer<typeof AuditActorSchema>;

// ---------------------------------------------------------------------------
// ResourceRef
// Identifies the domain object that this audit event concerns.
// ---------------------------------------------------------------------------

export const RESOURCE_TYPES = [
  'ITINERARY',
  'ITINERARY_LINE_ITEM',
  'TRIP_INTENT',
  'TRAVELLER_PROFILE',
  'TRAVELLER_SESSION',
  'TRIP_CONFIDENCE_RECEIPT',
  'SUPPLIER_MANIFEST',
  'RETENTION_POLICY',
  'CHECKOUT_SESSION',
  'PROMPT_REQUEST',
  'LOYALTY_TRANSACTION',
  'ADMIN_APPROVAL',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const ResourceRefSchema = z.object({
  resourceType:    z.string().min(1),
  resourceRef:     z.string().min(1),
  resourceVersion: z.number().int().positive().optional(),
}).strict();
export type ResourceRef = z.infer<typeof ResourceRefSchema>;

// ---------------------------------------------------------------------------
// RedactionMeta
// Describes what was redacted from the event payload before persistence.
// If isRedacted is true, redactedFields must be non-empty.
// ---------------------------------------------------------------------------

export const RedactionMetaSchema = z.object({
  isRedacted:      z.boolean(),
  redactedFields:  z.array(z.string()),
  redactionReason: z.string().optional(),
}).strict().superRefine((meta, ctx) => {
  if (meta.isRedacted && meta.redactedFields.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['redactedFields'],
      message: 'redactedFields must list at least one field when isRedacted is true',
    });
  }
});
export type RedactionMeta = z.infer<typeof RedactionMetaSchema>;

// ---------------------------------------------------------------------------
// AuditEventSchema
// Immutable audit event DTO. All fields are required.
// eventDetails holds structured, redacted context — never raw request bodies.
// ---------------------------------------------------------------------------

export const AuditEventSchema = z.object({
  /** UUID v4 identifying this event uniquely in the audit ledger */
  eventId:            z.string().uuid('eventId must be a valid UUID v4'),
  eventType:          AuditEventTypeEnum,
  actor:              AuditActorSchema,
  /** ISO 8601 UTC timestamp of when the business event occurred */
  occurredAt:         z.string().datetime({ message: 'occurredAt must be an ISO 8601 UTC datetime' }),
  resource:           ResourceRefSchema,
  /** Propagated across the call chain for distributed tracing */
  correlationId:      z.string().min(1),
  dataClassification: DataClassificationTierEnum,
  redactionMeta:      RedactionMetaSchema,
  /** Structured, redacted event context — must not contain restricted field names */
  eventDetails:       z.record(z.string(), z.unknown()),
  /** Pre-hash canonical string used to produce a stable audit integrity hash */
  canonicalHashInput: z.string().min(1),
}).strict().superRefine((event, ctx) => {
  for (const fieldName of Object.keys(event.eventDetails)) {
    if (RESTRICTED_FIELD_NAMES.has(fieldName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventDetails', fieldName],
        message: `eventDetails must not contain the restricted field "${fieldName}"`,
      });
    }
  }
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates an AuditEvent payload, returning a parse result.
 * Validation fails closed — any schema violation is returned as a structured error.
 */
export function parseAuditEvent(raw: unknown): z.SafeParseReturnType<unknown, AuditEvent> {
  return AuditEventSchema.safeParse(raw);
}

/**
 * Validates only the eventDetails object for restricted field names.
 * Returns the list of restricted field names found, or an empty array.
 */
export function validateEventDetails(details: Record<string, unknown>): string[] {
  return Object.keys(details).filter((k) => RESTRICTED_FIELD_NAMES.has(k));
}
