-- Voya — Initial PostgreSQL Schema Migration
-- Migration: 000001_init
-- This migration creates all core Voya domain tables from an empty database.
-- Additive only: no DROP statements, no destructive changes.
-- Run via: prisma migrate deploy

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "InventoryDomain" AS ENUM (
  'ACCOMMODATION',
  'ACTIVITIES',
  'DINING',
  'FLIGHTS',
  'TRANSPORT',
  'WEATHER_ADVISORY'
);

CREATE TYPE "BookingSource" AS ENUM (
  'HVMI',
  'MARRIOTT_BRAND',
  'BONVOY_TOURS_AND_ACTIVITIES',
  'AMADEUS_GDS',
  'MUNICIPAL_PUBLIC'
);

CREATE TYPE "SourceClassification" AS ENUM (
  'MARRIOTT_OWNED',
  'MARRIOTT_PARTNERED',
  'EXEMPT_PUBLIC'
);

CREATE TYPE "SupplierBookability" AS ENUM (
  'FULLY_BOOKABLE',
  'DEEP_LINK_ONLY',
  'UNAVAILABLE'
);

CREATE TYPE "ReceiptOutcome" AS ENUM (
  'PASS',
  'FAIL',
  'BLOCKED',
  'STALE'
);

CREATE TYPE "ItineraryStatus" AS ENUM (
  'DRAFT',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'PRESENTED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TYPE "DataClassificationTier" AS ENUM (
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED'
);

CREATE TYPE "AuditEventType" AS ENUM (
  'SOURCING_ORDER',
  'BRAND_FALLBACK_DISCLOSURE',
  'SUPPLIER_EXCLUSION',
  'SAFETY_GATE_DECISION',
  'RECEIPT_ISSUED',
  'RECEIPT_STALE_BLOCKED',
  'LOYALTY_SIMULATED_DEBIT',
  'CHECKOUT_AUTHORISATION_TAKEN',
  'CHECKOUT_COMPENSATED',
  'ITINERARY_PRESENTED'
);

CREATE TYPE "TravellerIdentityType" AS ENUM (
  'BONVOY_AUTHENTICATED',
  'GUEST_TOKEN'
);

CREATE TYPE "PathMode" AS ENUM (
  'PATH_A',
  'PATH_B'
);

CREATE TYPE "CancellationSemantics" AS ENUM (
  'FULL_REFUND_72H',
  'FULL_REFUND_24H',
  'PARTIAL_REFUND',
  'NON_REFUNDABLE',
  'NOT_APPLICABLE'
);

CREATE TYPE "RefundSemantics" AS ENUM (
  'AUTOMATIC_PLATFORM_REVERSAL',
  'SUPPLIER_INITIATED',
  'MANUAL_RECONCILIATION',
  'NOT_APPLICABLE'
);

CREATE TYPE "SupplierCertificationStatus" AS ENUM (
  'CERTIFIED',
  'UNCERTIFIED',
  'PENDING'
);

CREATE TYPE "RetentionPurgeAction" AS ENUM (
  'DELETE',
  'ANONYMIZE',
  'ARCHIVE'
);

CREATE TYPE "RetentionApprovalStatus" AS ENUM (
  'PROVISIONAL',
  'APPROVED'
);

-- ---------------------------------------------------------------------------
-- traveller_profile
-- ---------------------------------------------------------------------------

CREATE TABLE "traveller_profile" (
    "id"                 UUID                     NOT NULL DEFAULT gen_random_uuid(),
    "ownerRef"           TEXT                     NOT NULL,
    "identityType"       "TravellerIdentityType"  NOT NULL,
    "dataClassification" "DataClassificationTier" NOT NULL DEFAULT 'CONFIDENTIAL',
    "createdAt"          TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)             NOT NULL,

    CONSTRAINT "traveller_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "traveller_profile_ownerRef_key" ON "traveller_profile"("ownerRef");

-- ---------------------------------------------------------------------------
-- traveller_session
-- ---------------------------------------------------------------------------

CREATE TABLE "traveller_session" (
    "id"                 UUID                     NOT NULL DEFAULT gen_random_uuid(),
    "travellerProfileId" UUID                     NOT NULL,
    "pathMode"           "PathMode"               NOT NULL,
    "expiresAt"          TIMESTAMP(3)             NOT NULL,
    "dataClassification" "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
    "createdAt"          TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)             NOT NULL,

    CONSTRAINT "traveller_session_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "traveller_session_travellerProfileId_idx" ON "traveller_session"("travellerProfileId");

ALTER TABLE "traveller_session"
    ADD CONSTRAINT "traveller_session_travellerProfileId_fkey"
    FOREIGN KEY ("travellerProfileId")
    REFERENCES "traveller_profile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- trip_intent
-- ---------------------------------------------------------------------------

CREATE TABLE "trip_intent" (
    "id"                 UUID                     NOT NULL DEFAULT gen_random_uuid(),
    "travellerProfileId" UUID                     NOT NULL,
    "sessionId"          UUID,
    "pathMode"           "PathMode"               NOT NULL,
    "rawConstraintsJson" JSONB                    NOT NULL,
    "destinationToken"   TEXT                     NOT NULL,
    "checkInDate"        DATE                     NOT NULL,
    "checkOutDate"       DATE                     NOT NULL,
    "partySize"          INTEGER                  NOT NULL,
    "budgetBandCode"     TEXT,
    "dataClassification" "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
    "createdAt"          TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)             NOT NULL,

    CONSTRAINT "trip_intent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trip_intent_travellerProfileId_idx" ON "trip_intent"("travellerProfileId");

ALTER TABLE "trip_intent"
    ADD CONSTRAINT "trip_intent_travellerProfileId_fkey"
    FOREIGN KEY ("travellerProfileId")
    REFERENCES "traveller_profile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "trip_intent"
    ADD CONSTRAINT "trip_intent_sessionId_fkey"
    FOREIGN KEY ("sessionId")
    REFERENCES "traveller_session"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- itinerary
-- ---------------------------------------------------------------------------

CREATE TABLE "itinerary" (
    "id"                 UUID                     NOT NULL DEFAULT gen_random_uuid(),
    "travellerProfileId" UUID                     NOT NULL,
    "tripIntentId"       UUID                     NOT NULL,
    "version"            INTEGER                  NOT NULL DEFAULT 1,
    "status"             "ItineraryStatus"        NOT NULL DEFAULT 'DRAFT',
    "pathMode"           "PathMode"               NOT NULL,
    "dataClassification" "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
    "createdAt"          TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)             NOT NULL,

    CONSTRAINT "itinerary_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "itinerary_travellerProfileId_idx" ON "itinerary"("travellerProfileId");
CREATE INDEX "itinerary_status_idx" ON "itinerary"("status");
CREATE INDEX "itinerary_createdAt_idx" ON "itinerary"("createdAt");

ALTER TABLE "itinerary"
    ADD CONSTRAINT "itinerary_travellerProfileId_fkey"
    FOREIGN KEY ("travellerProfileId")
    REFERENCES "traveller_profile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "itinerary"
    ADD CONSTRAINT "itinerary_tripIntentId_fkey"
    FOREIGN KEY ("tripIntentId")
    REFERENCES "trip_intent"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- itinerary_day
-- ---------------------------------------------------------------------------

CREATE TABLE "itinerary_day" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "itineraryId" UUID         NOT NULL,
    "dayIndex"    INTEGER      NOT NULL,
    "date"        DATE         NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itinerary_day_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "itinerary_day_itineraryId_idx" ON "itinerary_day"("itineraryId");

ALTER TABLE "itinerary_day"
    ADD CONSTRAINT "itinerary_day_itineraryId_fkey"
    FOREIGN KEY ("itineraryId")
    REFERENCES "itinerary"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- source_provenance
-- Immutable; no updatedAt column. Every itinerary_line_item references
-- exactly one source_provenance row (enforced by UNIQUE on sourceProvenanceId
-- in itinerary_line_item).
-- ---------------------------------------------------------------------------

CREATE TABLE "source_provenance" (
    "id"                   UUID                     NOT NULL DEFAULT gen_random_uuid(),
    "supplierId"           TEXT                     NOT NULL,
    "sourceRef"            TEXT                     NOT NULL,
    "bookingSource"        "BookingSource"          NOT NULL,
    "sourceClassification" "SourceClassification"   NOT NULL,
    "fetchedAt"            TIMESTAMP(3)             NOT NULL,
    "dataClassification"   "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
    "createdAt"            TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_provenance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "source_provenance_sourceRef_idx" ON "source_provenance"("sourceRef");
CREATE INDEX "source_provenance_bookingSource_idx" ON "source_provenance"("bookingSource");

-- ---------------------------------------------------------------------------
-- itinerary_line_item
-- sourceProvenanceId is UNIQUE — one provenance record per line item, making
-- orphaned (hallucinated) line items structurally impossible.
-- ---------------------------------------------------------------------------

CREATE TABLE "itinerary_line_item" (
    "id"                         UUID                     NOT NULL DEFAULT gen_random_uuid(),
    "itineraryId"                UUID                     NOT NULL,
    "itineraryDayId"             UUID,
    "sourceProvenanceId"         UUID                     NOT NULL,
    "domain"                     "InventoryDomain"        NOT NULL,
    "supplierRef"                TEXT                     NOT NULL,
    "displayNameSnapshot"        TEXT                     NOT NULL,
    "priceAmountMinorUnits"      INTEGER,
    "priceCurrencyCode"          TEXT,
    "pointsAmount"               INTEGER,
    "availabilityDataAgeSeconds" INTEGER,
    "rateDataAgeSeconds"         INTEGER,
    "dataClassification"         "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
    "createdAt"                  TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                  TIMESTAMP(3)             NOT NULL,

    CONSTRAINT "itinerary_line_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "itinerary_line_item_sourceProvenanceId_key" ON "itinerary_line_item"("sourceProvenanceId");
CREATE INDEX "itinerary_line_item_itineraryId_idx" ON "itinerary_line_item"("itineraryId");
CREATE INDEX "itinerary_line_item_domain_idx" ON "itinerary_line_item"("domain");

ALTER TABLE "itinerary_line_item"
    ADD CONSTRAINT "itinerary_line_item_itineraryId_fkey"
    FOREIGN KEY ("itineraryId")
    REFERENCES "itinerary"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "itinerary_line_item"
    ADD CONSTRAINT "itinerary_line_item_itineraryDayId_fkey"
    FOREIGN KEY ("itineraryDayId")
    REFERENCES "itinerary_day"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "itinerary_line_item"
    ADD CONSTRAINT "itinerary_line_item_sourceProvenanceId_fkey"
    FOREIGN KEY ("sourceProvenanceId")
    REFERENCES "source_provenance"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- trip_confidence_receipt
-- Append-only — new row per re-evaluation. itineraryVersion ties the receipt
-- to the exact itinerary state, preserving historical evidence.
-- ---------------------------------------------------------------------------

CREATE TABLE "trip_confidence_receipt" (
    "id"                 UUID                     NOT NULL DEFAULT gen_random_uuid(),
    "itineraryId"        UUID                     NOT NULL,
    "itineraryVersion"   INTEGER                  NOT NULL,
    "outcome"            "ReceiptOutcome"         NOT NULL,
    "feasibilityPassed"  BOOLEAN                  NOT NULL,
    "freshnessGrade"     TEXT                     NOT NULL,
    "blockedReasonCode"  TEXT,
    "evaluatedAt"        TIMESTAMP(3)             NOT NULL,
    "dataClassification" "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
    "createdAt"          TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_confidence_receipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trip_confidence_receipt_itineraryId_idx" ON "trip_confidence_receipt"("itineraryId");
CREATE INDEX "trip_confidence_receipt_outcome_idx" ON "trip_confidence_receipt"("outcome");
CREATE INDEX "trip_confidence_receipt_createdAt_idx" ON "trip_confidence_receipt"("createdAt");

ALTER TABLE "trip_confidence_receipt"
    ADD CONSTRAINT "trip_confidence_receipt_itineraryId_fkey"
    FOREIGN KEY ("itineraryId")
    REFERENCES "itinerary"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- trip_confidence_receipt_line_item
-- Immutable freshness evidence per line item at receipt evaluation time.
-- ---------------------------------------------------------------------------

CREATE TABLE "trip_confidence_receipt_line_item" (
    "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    "receiptId"           UUID         NOT NULL,
    "lineItemId"          UUID         NOT NULL,
    "freshnessGrade"      TEXT         NOT NULL,
    "isAvailabilityStale" BOOLEAN      NOT NULL,
    "isRateStale"         BOOLEAN      NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_confidence_receipt_line_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trip_confidence_receipt_line_item_receiptId_idx"
    ON "trip_confidence_receipt_line_item"("receiptId");

ALTER TABLE "trip_confidence_receipt_line_item"
    ADD CONSTRAINT "trip_confidence_receipt_line_item_receiptId_fkey"
    FOREIGN KEY ("receiptId")
    REFERENCES "trip_confidence_receipt"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "trip_confidence_receipt_line_item"
    ADD CONSTRAINT "trip_confidence_receipt_line_item_lineItemId_fkey"
    FOREIGN KEY ("lineItemId")
    REFERENCES "itinerary_line_item"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- supplier_capability_manifest
-- ---------------------------------------------------------------------------

CREATE TABLE "supplier_capability_manifest" (
    "id"                                UUID                        NOT NULL DEFAULT gen_random_uuid(),
    "supplierId"                        TEXT                        NOT NULL,
    "displayName"                       TEXT                        NOT NULL,
    "domain"                            "InventoryDomain"           NOT NULL,
    "sourceClassification"              "SourceClassification"      NOT NULL,
    "bookabilityMode"                   "SupplierBookability"       NOT NULL,
    "availabilityRefreshLatencySeconds" INTEGER                     NOT NULL,
    "rateRefreshLatencySeconds"         INTEGER,
    "isPriced"                          BOOLEAN                     NOT NULL,
    "cancellationSemantics"             "CancellationSemantics"     NOT NULL,
    "refundSemantics"                   "RefundSemantics"           NOT NULL,
    "certificationStatus"               "SupplierCertificationStatus" NOT NULL,
    "fixtureEvidenceRef"                TEXT,
    "manifestVersion"                   TEXT                        NOT NULL,
    "lastReviewedAt"                    TIMESTAMP(3)                NOT NULL,
    "reviewedBy"                        TEXT                        NOT NULL,
    "dataClassification"                "DataClassificationTier"    NOT NULL DEFAULT 'INTERNAL',
    "createdAt"                         TIMESTAMP(3)                NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                         TIMESTAMP(3)                NOT NULL,

    CONSTRAINT "supplier_capability_manifest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_capability_manifest_supplierId_key"
    ON "supplier_capability_manifest"("supplierId");
CREATE INDEX "supplier_capability_manifest_domain_idx"
    ON "supplier_capability_manifest"("domain");
CREATE INDEX "supplier_capability_manifest_certificationStatus_idx"
    ON "supplier_capability_manifest"("certificationStatus");

-- ---------------------------------------------------------------------------
-- audit_record
-- Append-only ledger. No updatedAt. No PII in payloadJson.
-- ---------------------------------------------------------------------------

CREATE TABLE "audit_record" (
    "id"                 UUID                     NOT NULL DEFAULT gen_random_uuid(),
    "eventType"          "AuditEventType"         NOT NULL,
    "travellerProfileId" UUID,
    "itineraryId"        UUID,
    "sessionRef"         TEXT,
    "supplierId"         TEXT,
    "payloadJson"        JSONB                    NOT NULL,
    "pathMode"           "PathMode",
    "dataClassification" "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
    "createdAt"          TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_record_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_record_travellerProfileId_idx" ON "audit_record"("travellerProfileId");
CREATE INDEX "audit_record_itineraryId_idx" ON "audit_record"("itineraryId");
CREATE INDEX "audit_record_eventType_idx" ON "audit_record"("eventType");
CREATE INDEX "audit_record_createdAt_idx" ON "audit_record"("createdAt");

ALTER TABLE "audit_record"
    ADD CONSTRAINT "audit_record_travellerProfileId_fkey"
    FOREIGN KEY ("travellerProfileId")
    REFERENCES "traveller_profile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_record"
    ADD CONSTRAINT "audit_record_itineraryId_fkey"
    FOREIGN KEY ("itineraryId")
    REFERENCES "itinerary"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- retention_policy_metadata
-- ---------------------------------------------------------------------------

CREATE TABLE "retention_policy_metadata" (
    "id"                 UUID                      NOT NULL DEFAULT gen_random_uuid(),
    "policyKey"          TEXT                      NOT NULL,
    "targetTable"        TEXT                      NOT NULL,
    "targetColumn"       TEXT,
    "triggerEvent"       TEXT                      NOT NULL,
    "retentionDays"      INTEGER                   NOT NULL,
    "purgeAction"        "RetentionPurgeAction"    NOT NULL,
    "approvalStatus"     "RetentionApprovalStatus" NOT NULL,
    "notes"              TEXT,
    "dataClassification" "DataClassificationTier"  NOT NULL DEFAULT 'INTERNAL',
    "createdAt"          TIMESTAMP(3)              NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)              NOT NULL,

    CONSTRAINT "retention_policy_metadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "retention_policy_metadata_policyKey_key"
    ON "retention_policy_metadata"("policyKey");
