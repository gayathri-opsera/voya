-- Migration 000004: Discovery and Saved Homes
-- Adds destination, curated_collection, home_inventory_reference,
-- collection_home, interest_tag, collection_interest_tag,
-- home_interest_tag, and saved_home tables.
--
-- Constraints:
--   - destination.slug UNIQUE
--   - curated_collection.slug UNIQUE
--   - home_inventory_reference.sourceRef UNIQUE (canonical home identifier)
--   - collection_home.(collectionId, homeRefId) UNIQUE (prevents duplicate membership)
--   - interest_tag.tagKey UNIQUE
--   - collection_interest_tag.(collectionId, tagId) UNIQUE
--   - home_interest_tag.(homeRefId, tagId) UNIQUE
--   - saved_home.(ownerRef, homeRefId) UNIQUE (idempotency for heart actions)
--
-- No image bytes are stored; heroImageRef and heroImageAltText are metadata
-- references only.

-- ---------------------------------------------------------------------------
-- destination
-- ---------------------------------------------------------------------------

CREATE TABLE "destination" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "slug"             TEXT         NOT NULL,
  "displayName"      TEXT         NOT NULL,
  "regionName"       TEXT,
  "countryCode"      TEXT,
  "heroImageRef"     TEXT,
  "heroImageAltText" TEXT,
  "isActive"         BOOLEAN      NOT NULL DEFAULT TRUE,
  "sortOrder"        INTEGER      NOT NULL DEFAULT 0,
  "contentVersion"   INTEGER      NOT NULL DEFAULT 1,
  "dataClassification" "DataClassificationTier" NOT NULL DEFAULT 'PUBLIC',
  "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "destination_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "destination_slug_key"      ON "destination" ("slug");
CREATE        INDEX "destination_active_sort"    ON "destination" ("isActive", "sortOrder");

-- ---------------------------------------------------------------------------
-- curated_collection
-- ---------------------------------------------------------------------------

CREATE TABLE "curated_collection" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "slug"             TEXT         NOT NULL,
  "displayName"      TEXT         NOT NULL,
  "editorialEyebrow" TEXT,
  "description"      TEXT,
  "heroImageRef"     TEXT,
  "heroImageAltText" TEXT,
  "isActive"         BOOLEAN      NOT NULL DEFAULT TRUE,
  "sortOrder"        INTEGER      NOT NULL DEFAULT 0,
  "contentVersion"   INTEGER      NOT NULL DEFAULT 1,
  "destinationId"    UUID,
  "dataClassification" "DataClassificationTier" NOT NULL DEFAULT 'PUBLIC',
  "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "curated_collection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "curated_collection_destinationId_fkey"
    FOREIGN KEY ("destinationId") REFERENCES "destination" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "curated_collection_slug_key"    ON "curated_collection" ("slug");
CREATE        INDEX "curated_collection_active_sort" ON "curated_collection" ("isActive", "sortOrder");

-- ---------------------------------------------------------------------------
-- home_inventory_reference
-- ---------------------------------------------------------------------------

CREATE TABLE "home_inventory_reference" (
  "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  "sourceRef"           TEXT         NOT NULL,
  "supplierId"          TEXT         NOT NULL,
  "bookingSource"       "BookingSource" NOT NULL,
  "displayNameSnapshot" TEXT         NOT NULL,
  "destinationId"       UUID,
  "destinationSlug"     TEXT,
  "heroImageRef"        TEXT,
  "heroImageAltText"    TEXT,
  "isActive"            BOOLEAN      NOT NULL DEFAULT TRUE,
  "dataClassification"  "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
  "createdAt"           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "home_inventory_reference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "home_inventory_reference_destinationId_fkey"
    FOREIGN KEY ("destinationId") REFERENCES "destination" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "home_inventory_reference_sourceRef_key" ON "home_inventory_reference" ("sourceRef");
CREATE        INDEX "home_inventory_reference_destinationId"  ON "home_inventory_reference" ("destinationId");
CREATE        INDEX "home_inventory_reference_isActive"       ON "home_inventory_reference" ("isActive");

-- ---------------------------------------------------------------------------
-- collection_home
-- ---------------------------------------------------------------------------

CREATE TABLE "collection_home" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "collectionId" UUID        NOT NULL,
  "homeRefId"    UUID        NOT NULL,
  "sortOrder"    INTEGER     NOT NULL DEFAULT 0,
  "isActive"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collection_home_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collection_home_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "curated_collection" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "collection_home_homeRefId_fkey"
    FOREIGN KEY ("homeRefId") REFERENCES "home_inventory_reference" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "collection_home_collectionId_homeRefId_key"
  ON "collection_home" ("collectionId", "homeRefId");
CREATE INDEX "collection_home_collectionId_sortOrder"
  ON "collection_home" ("collectionId", "sortOrder");

-- ---------------------------------------------------------------------------
-- interest_tag
-- ---------------------------------------------------------------------------

CREATE TABLE "interest_tag" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tagKey"       TEXT        NOT NULL,
  "displayLabel" TEXT        NOT NULL,
  "sortOrder"    INTEGER     NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interest_tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "interest_tag_tagKey_key" ON "interest_tag" ("tagKey");
CREATE        INDEX "interest_tag_sortOrder"  ON "interest_tag" ("sortOrder");

-- ---------------------------------------------------------------------------
-- collection_interest_tag
-- ---------------------------------------------------------------------------

CREATE TABLE "collection_interest_tag" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "collectionId" UUID        NOT NULL,
  "tagId"        UUID        NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collection_interest_tag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collection_interest_tag_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "curated_collection" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "collection_interest_tag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "interest_tag" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "collection_interest_tag_collectionId_tagId_key"
  ON "collection_interest_tag" ("collectionId", "tagId");
CREATE INDEX "collection_interest_tag_collectionId"
  ON "collection_interest_tag" ("collectionId");

-- ---------------------------------------------------------------------------
-- home_interest_tag
-- ---------------------------------------------------------------------------

CREATE TABLE "home_interest_tag" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "homeRefId" UUID        NOT NULL,
  "tagId"     UUID        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "home_interest_tag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "home_interest_tag_homeRefId_fkey"
    FOREIGN KEY ("homeRefId") REFERENCES "home_inventory_reference" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "home_interest_tag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "interest_tag" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "home_interest_tag_homeRefId_tagId_key"
  ON "home_interest_tag" ("homeRefId", "tagId");
CREATE INDEX "home_interest_tag_homeRefId"
  ON "home_interest_tag" ("homeRefId");

-- ---------------------------------------------------------------------------
-- saved_home
-- ---------------------------------------------------------------------------

CREATE TABLE "saved_home" (
  "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
  "ownerRef"           TEXT        NOT NULL,
  "homeRefId"          UUID        NOT NULL,
  "savedAt"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"              TEXT,
  "dataClassification" "DataClassificationTier" NOT NULL DEFAULT 'INTERNAL',
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_home_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_home_homeRefId_fkey"
    FOREIGN KEY ("homeRefId") REFERENCES "home_inventory_reference" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Idempotency: one row per (owner, home) pair
CREATE UNIQUE INDEX "saved_home_ownerRef_homeRefId_key"
  ON "saved_home" ("ownerRef", "homeRefId");
CREATE INDEX "saved_home_ownerRef_idx"  ON "saved_home" ("ownerRef");
CREATE INDEX "saved_home_homeRefId_idx" ON "saved_home" ("homeRefId");
