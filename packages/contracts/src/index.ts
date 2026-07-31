/**
 * @voya/contracts — Public API surface
 *
 * All symbols exported from this file constitute the stable public contract
 * for the @voya/contracts package. Downstream services must import from
 * '@voya/contracts' rather than from internal subpaths.
 *
 * Adding symbols is a non-breaking (additive) change.
 * Removing or renaming exported symbols is a BREAKING change and requires a
 * semver major bump.
 *
 * Package version: see package.json (0.1.0)
 */

// ---------------------------------------------------------------------------
// Common: enums — Zod schemas (runtime validation)
// ---------------------------------------------------------------------------

export {
  PathModeEnum,
  InventoryDomainEnum,
  BookingSourceEnum,
  SourceClassificationEnum,
  DegradedReasonEnum,
  ReceiptOutcomeEnum,
  SupplierBookabilityEnum,
  DataClassificationTierEnum,
  AuditEventTypeEnum,
  RetentionTriggerEnum,
} from './common/enums.js';

// ---------------------------------------------------------------------------
// Common: enums — runtime value objects (e.g. PathMode.PATH_A)
//
// NOTE: InventoryDomain, SourceClassification, and ReceiptOutcome are plain
// TypeScript enums consumed by the itinerary contracts (TripConstraints,
// ItineraryLineItem, TripConfidenceReceipt) via z.nativeEnum(...). Their
// Zod-schema, uppercase-vocabulary counterparts are the *Enum exports above
// (InventoryDomainEnum, SourceClassificationEnum, ReceiptOutcomeEnum).
// ---------------------------------------------------------------------------

export {
  PathMode,
  InventoryDomain,
  SourceClassification,
  ApprovedExemptionType,
  BookingSource,
  DegradedReason,
  ReceiptOutcome,
  BudgetBand,
  AccessibilityNeed,
  PricingUnit,
  SupplierBookability,
  DataClassificationTier,
  AuditEventType,
  RetentionTrigger,
} from './common/enums.js';

// ---------------------------------------------------------------------------
// Common: enums — inferred TypeScript types
// ---------------------------------------------------------------------------

export type {
  PathMode as PathModeType,
  InventoryDomainType,
  BookingSource as BookingSourceType,
  SourceClassificationType,
  DegradedReason as DegradedReasonType,
  ReceiptOutcomeType,
  SupplierBookability as SupplierBookabilityType,
  DataClassificationTier as DataClassificationTierType,
  AuditEventType as AuditEventTypeType,
  RetentionTrigger as RetentionTriggerType,
} from './common/enums.js';

// ---------------------------------------------------------------------------
// Common: API error envelope — schema, types, and helpers
// ---------------------------------------------------------------------------

export {
  ApiErrorDetailSchema,
  ApiErrorSchema,
  parseApiError,
} from './common/api-error.js';

export type {
  ApiErrorDetail,
  ApiError,
  ApiErrorParseResult,
} from './common/api-error.js';

// ---------------------------------------------------------------------------
// Itinerary — TripConstraints
// ---------------------------------------------------------------------------

export {
  CoordinatesSchema,
  DateWindowSchema,
  DestinationSchema,
  PartyCompositionSchema,
  TripConstraintsSchema,
} from './itinerary/trip-constraints.js';

export type {
  Coordinates,
  DateWindow,
  Destination,
  PartyComposition,
  TripConstraints,
} from './itinerary/trip-constraints.js';

// ---------------------------------------------------------------------------
// Itinerary — ItineraryLineItem
// ---------------------------------------------------------------------------

export {
  AmadeusFlightExemptionSchema,
  ApprovedExemptionSchema,
  ItineraryLineItemSchema,
  LineItemPricingSchema,
  MunicipalLandmarkExemptionSchema,
  PublicLandmarkExemptionSchema,
} from './itinerary/line-item.js';

export type {
  AmadeusFlightExemption,
  ApprovedExemption,
  ItineraryLineItem,
  LineItemPricing,
  MunicipalLandmarkExemption,
  PublicLandmarkExemption,
} from './itinerary/line-item.js';

// ---------------------------------------------------------------------------
// Itinerary — TripConfidenceReceipt
// ---------------------------------------------------------------------------

export {
  BlockingReasonSchema,
  FeasibilitySummarySchema,
  FreshnessSummarySchema,
  ProvenanceSummarySchema,
  TripConfidenceReceiptSchema,
} from './itinerary/trip-confidence-receipt.js';

export type {
  BlockingReason,
  FeasibilitySummary,
  FreshnessSummary,
  ProvenanceSummary,
  TripConfidenceReceipt,
} from './itinerary/trip-confidence-receipt.js';

// ---------------------------------------------------------------------------
// Governance: data classification registry — schema, types, registry, helpers
// ---------------------------------------------------------------------------

export {
  DataCategoryKeyEnum,
  DataCategoryKey,
  DataCategoryEntrySchema,
  DATA_CATEGORY_REGISTRY,
  lookupDataCategory,
  validateDataCategoryEntry,
} from './governance/data-classification.js';

export type {
  DataCategoryKey as DataCategoryKeyType,
  DataCategoryEntry,
  DataCategoryValidationError,
} from './governance/data-classification.js';

// ---------------------------------------------------------------------------
// Governance: retention policy registry — schema, types, registry, helpers
// ---------------------------------------------------------------------------

export {
  RetentionApprovalStatusEnum,
  RetentionApprovalStatus,
  RetentionPurgeActionEnum,
  RetentionPurgeAction,
  RetentionPolicySchema,
  RETENTION_POLICY_REGISTRY,
  parseRetentionPolicy,
  lookupRetentionPolicy,
} from './governance/retention-policy.js';

export type {
  RetentionApprovalStatus as RetentionApprovalStatusType,
  RetentionPurgeAction as RetentionPurgeActionType,
  RetentionPolicy,
  RetentionPolicyParseResult,
} from './governance/retention-policy.js';

// ---------------------------------------------------------------------------
// Governance: prompt safety validation — schema, types, helpers, error class
// ---------------------------------------------------------------------------

export {
  GovernanceErrorSchema,
  validatePromptCategories,
  isPromptSafe,
  assertPromptSafe,
  PromptSafetyViolationError,
} from './governance/prompt-safety.js';

export type {
  GovernanceError,
  CategoryAnnotation,
} from './governance/prompt-safety.js';

// ---------------------------------------------------------------------------
// Supplier: capability manifest — schema, types, enums, registry helpers
// ---------------------------------------------------------------------------

export {
  CancellationSemanticsEnum,
  CancellationSemantics,
  RefundSemanticsEnum,
  RefundSemantics,
  SupplierOperationEnum,
  SupplierOperation,
  SupplierCertificationStatusEnum,
  SupplierCertificationStatus,
  FixtureEvidenceSchema,
  SupplierCapabilityManifestSchema,
  validateManifest,
  isExemptPublicLandmark,
} from './supplier/capability-manifest.js';

export type {
  CancellationSemantics as CancellationSemanticsType,
  RefundSemantics as RefundSemanticsType,
  SupplierOperation as SupplierOperationType,
  SupplierCertificationStatus as SupplierCertificationStatusType,
  FixtureEvidence,
  SupplierCapabilityManifest,
  ManifestValidationError,
} from './supplier/capability-manifest.js';

// ---------------------------------------------------------------------------
// Supplier: freshness window helpers — types and functions
// ---------------------------------------------------------------------------

export {
  getAvailabilityMaxAgeSeconds,
  getRateMaxAgeSeconds,
  isAvailabilityStale,
  isRateStale,
  evaluateFreshness,
} from './supplier/freshness-window.js';

export type {
  FreshnessGrade,
  FreshnessWindowInput,
} from './supplier/freshness-window.js';

// ---------------------------------------------------------------------------
// Audit: actor model, event schema, redaction — schemas, types, helpers
// ---------------------------------------------------------------------------

export {
  AuditActorTypeEnum,
  AuditActorType,
  AuditActorSchema,
  ResourceRefSchema,
  RedactionMetaSchema,
  AuditEventSchema,
  RESTRICTED_FIELD_NAMES,
  RESOURCE_TYPES,
  parseAuditEvent,
  validateEventDetails,
} from './audit/audit-event.js';

export type {
  AuditActorType as AuditActorTypeType,
  AuditActor,
  ResourceType,
  ResourceRef,
  RedactionMeta,
  AuditEvent,
} from './audit/audit-event.js';

// ---------------------------------------------------------------------------
// Audit: event type registry — metadata, categories, helpers
// ---------------------------------------------------------------------------

export {
  AUDIT_EVENT_CATEGORY,
  AUDIT_EVENT_TYPE_REGISTRY,
  getAuditEventTypeMetadata,
  getHighSeverityEventTypes,
  getEventTypesByCategory,
} from './audit/audit-event-types.js';

export type {
  AuditEventCategory,
  AuditEventTypeMetadata,
} from './audit/audit-event-types.js';

// ---------------------------------------------------------------------------
// Audit: canonicalization — deterministic hash input helpers
// ---------------------------------------------------------------------------

export {
  CanonicalizationError,
  canonicalizeObject,
  buildAuditHashInput,
} from './audit/canonicalize.js';

export type {
  AuditEventHashInputFields,
} from './audit/canonicalize.js';

// ---------------------------------------------------------------------------
// Audit: ledger row mapping — AuditEvent -> AuditLedger persistence shape
// ---------------------------------------------------------------------------

export { toAuditLedgerRow } from './audit/ledger-row.js';

export type { AuditLedgerRow } from './audit/ledger-row.js';
