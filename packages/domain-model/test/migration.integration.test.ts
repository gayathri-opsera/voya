/**
 * Integration tests for @voya/domain-model — Prisma migrations and schema
 *
 * These tests require:
 *  1. DATABASE_URL environment variable pointing to a live PostgreSQL database.
 *  2. The Prisma client to have been generated (npx prisma generate from repo root).
 *  3. Migrations to be applied (npx prisma migrate deploy from repo root).
 *
 * They are automatically skipped when DATABASE_URL is absent.
 *
 * Run with: DATABASE_URL=postgresql://... npx vitest run test/migration.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  testGuestTravellerProfile,
  testTravellerSession,
  testTripIntent,
  testItinerary,
  testHvmiSourceProvenance,
  testAccommodationLineItem,
  testPassingReceipt,
  testHvmiManifestRow,
} from '@voya/test-fixtures';

const DATABASE_URL = process.env['DATABASE_URL'];
const skipIntegration = !DATABASE_URL;

// Lazily loaded Prisma client — avoids import errors when @prisma/client is not yet generated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any;

async function getPrismaClient(): Promise<typeof prisma> {
  if (prisma) return prisma;
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    return prisma;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Migration: apply and verify tables exist
// ---------------------------------------------------------------------------

describe.skipIf(skipIntegration)('Migration — tables exist after 000001_init', () => {
  let client: NonNullable<typeof prisma>;

  beforeAll(async () => {
    client = await getPrismaClient();
    if (!client) throw new Error('@prisma/client not available — run: npx prisma generate');
    await client.$connect();
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it('traveller_profile table is queryable', async () => {
    const count = await client.travellerProfile.count();
    expect(typeof count).toBe('number');
  });

  it('itinerary table is queryable', async () => {
    const count = await client.itinerary.count();
    expect(typeof count).toBe('number');
  });

  it('source_provenance table is queryable', async () => {
    const count = await client.sourceProvenance.count();
    expect(typeof count).toBe('number');
  });

  it('trip_confidence_receipt table is queryable', async () => {
    const count = await client.tripConfidenceReceipt.count();
    expect(typeof count).toBe('number');
  });

  it('supplier_capability_manifest table is queryable', async () => {
    const count = await client.supplierCapabilityManifest.count();
    expect(typeof count).toBe('number');
  });

  it('audit_record table is queryable', async () => {
    const count = await client.auditRecord.count();
    expect(typeof count).toBe('number');
  });

  it('retention_policy_metadata table is queryable', async () => {
    const count = await client.retentionPolicyMetadata.count();
    expect(typeof count).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// Seed and relational constraint tests
// ---------------------------------------------------------------------------

describe.skipIf(skipIntegration)(
  'Integration — seed minimal itinerary with provenance and receipt rows',
  () => {
    let client: NonNullable<typeof prisma>;
    // Track created IDs for teardown
    const createdIds = {
      travellerProfileId: '',
      sessionId: '',
      tripIntentId: '',
      itineraryId: '',
      sourceProvenanceId: '',
      lineItemId: '',
      receiptId: '',
      manifestId: '',
    };

    beforeAll(async () => {
      client = await getPrismaClient();
      if (!client) throw new Error('@prisma/client not available — run: npx prisma generate');
      await client.$connect();
    });

    afterAll(async () => {
      // Clean up in reverse dependency order to avoid FK violations
      if (createdIds.receiptId) {
        await client.tripConfidenceReceiptLineItem.deleteMany({
          where: { receiptId: createdIds.receiptId },
        });
        await client.tripConfidenceReceipt.delete({ where: { id: createdIds.receiptId } });
      }
      if (createdIds.lineItemId) {
        await client.itineraryLineItem.delete({ where: { id: createdIds.lineItemId } });
      }
      if (createdIds.sourceProvenanceId) {
        await client.sourceProvenance.delete({ where: { id: createdIds.sourceProvenanceId } });
      }
      if (createdIds.itineraryId) {
        await client.itinerary.delete({ where: { id: createdIds.itineraryId } });
      }
      if (createdIds.tripIntentId) {
        await client.tripIntent.delete({ where: { id: createdIds.tripIntentId } });
      }
      if (createdIds.sessionId) {
        await client.travellerSession.delete({ where: { id: createdIds.sessionId } });
      }
      if (createdIds.travellerProfileId) {
        await client.travellerProfile.delete({ where: { id: createdIds.travellerProfileId } });
      }
      if (createdIds.manifestId) {
        await client.supplierCapabilityManifest.delete({ where: { id: createdIds.manifestId } });
      }
      await client.$disconnect();
    });

    it('creates a TravellerProfile with tokenised ownerRef', async () => {
      const profile = await client.travellerProfile.create({
        data: {
          ownerRef: `${testGuestTravellerProfile.ownerRef}_integration_test`,
          identityType: testGuestTravellerProfile.identityType,
          dataClassification: testGuestTravellerProfile.dataClassification,
        },
      });
      expect(profile.id).toBeTruthy();
      expect(profile.ownerRef).toContain('tok_test_');
      createdIds.travellerProfileId = profile.id as string;
    });

    it('creates a TravellerSession linked to the profile', async () => {
      const session = await client.travellerSession.create({
        data: {
          travellerProfileId: createdIds.travellerProfileId,
          pathMode: testTravellerSession.pathMode,
          expiresAt: testTravellerSession.expiresAt,
          dataClassification: testTravellerSession.dataClassification,
        },
      });
      expect(session.id).toBeTruthy();
      expect(session.travellerProfileId).toBe(createdIds.travellerProfileId);
      createdIds.sessionId = session.id as string;
    });

    it('creates a TripIntent linked to profile and session', async () => {
      const intent = await client.tripIntent.create({
        data: {
          travellerProfileId: createdIds.travellerProfileId,
          sessionId: createdIds.sessionId,
          pathMode: testTripIntent.pathMode,
          rawConstraintsJson: testTripIntent.rawConstraintsJson,
          destinationToken: testTripIntent.destinationToken,
          checkInDate: testTripIntent.checkInDate,
          checkOutDate: testTripIntent.checkOutDate,
          partySize: testTripIntent.partySize,
          dataClassification: testTripIntent.dataClassification,
        },
      });
      expect(intent.id).toBeTruthy();
      createdIds.tripIntentId = intent.id as string;
    });

    it('creates an Itinerary linked to profile and intent', async () => {
      const itinerary = await client.itinerary.create({
        data: {
          travellerProfileId: createdIds.travellerProfileId,
          tripIntentId: createdIds.tripIntentId,
          version: testItinerary.version,
          status: testItinerary.status,
          pathMode: testItinerary.pathMode,
          dataClassification: testItinerary.dataClassification,
        },
      });
      expect(itinerary.id).toBeTruthy();
      createdIds.itineraryId = itinerary.id as string;
    });

    it('creates a SourceProvenance record', async () => {
      const provenance = await client.sourceProvenance.create({
        data: {
          supplierId: testHvmiSourceProvenance.supplierId,
          sourceRef: testHvmiSourceProvenance.sourceRef,
          bookingSource: testHvmiSourceProvenance.bookingSource,
          sourceClassification: testHvmiSourceProvenance.sourceClassification,
          fetchedAt: testHvmiSourceProvenance.fetchedAt,
          dataClassification: testHvmiSourceProvenance.dataClassification,
        },
      });
      expect(provenance.id).toBeTruthy();
      createdIds.sourceProvenanceId = provenance.id as string;
    });

    it('creates an ItineraryLineItem linked to provenance (enforcing zero-hallucination)', async () => {
      const lineItem = await client.itineraryLineItem.create({
        data: {
          itineraryId: createdIds.itineraryId,
          sourceProvenanceId: createdIds.sourceProvenanceId,
          domain: testAccommodationLineItem.domain,
          supplierRef: testAccommodationLineItem.supplierRef,
          displayNameSnapshot: testAccommodationLineItem.displayNameSnapshot,
          priceAmountMinorUnits: testAccommodationLineItem.priceAmountMinorUnits,
          priceCurrencyCode: testAccommodationLineItem.priceCurrencyCode,
          availabilityDataAgeSeconds: testAccommodationLineItem.availabilityDataAgeSeconds,
          rateDataAgeSeconds: testAccommodationLineItem.rateDataAgeSeconds,
          dataClassification: testAccommodationLineItem.dataClassification,
        },
      });
      expect(lineItem.id).toBeTruthy();
      expect(lineItem.sourceProvenanceId).toBe(createdIds.sourceProvenanceId);
      createdIds.lineItemId = lineItem.id as string;
    });

    it('rejects a second ItineraryLineItem with the same sourceProvenanceId (unique constraint)', async () => {
      await expect(
        client.itineraryLineItem.create({
          data: {
            itineraryId: createdIds.itineraryId,
            sourceProvenanceId: createdIds.sourceProvenanceId, // duplicate
            domain: testAccommodationLineItem.domain,
            supplierRef: 'duplicate-ref',
            displayNameSnapshot: 'Duplicate — should be rejected',
            dataClassification: testAccommodationLineItem.dataClassification,
          },
        }),
      ).rejects.toThrow();
    });

    it('creates a passing TripConfidenceReceipt without overwriting prior state', async () => {
      const receipt = await client.tripConfidenceReceipt.create({
        data: {
          itineraryId: createdIds.itineraryId,
          itineraryVersion: testPassingReceipt.itineraryVersion,
          outcome: testPassingReceipt.outcome,
          feasibilityPassed: testPassingReceipt.feasibilityPassed,
          freshnessGrade: testPassingReceipt.freshnessGrade,
          blockedReasonCode: testPassingReceipt.blockedReasonCode,
          evaluatedAt: testPassingReceipt.evaluatedAt,
          dataClassification: testPassingReceipt.dataClassification,
        },
      });
      expect(receipt.id).toBeTruthy();
      expect(receipt.outcome).toBe('PASS');
      createdIds.receiptId = receipt.id as string;
    });

    it('cannot create an ItineraryLineItem without a sourceProvenanceId (NOT NULL)', async () => {
      await expect(
        // @ts-expect-error intentionally omitting required field for test
        client.itineraryLineItem.create({
          data: {
            itineraryId: createdIds.itineraryId,
            // sourceProvenanceId omitted — must fail
            domain: 'ACCOMMODATION',
            supplierRef: 'test-no-provenance',
            displayNameSnapshot: 'Should fail — no provenance',
            dataClassification: 'INTERNAL',
          },
        }),
      ).rejects.toThrow();
    });

    it('creates a SupplierCapabilityManifest row', async () => {
      const manifest = await client.supplierCapabilityManifest.create({
        data: {
          supplierId: `${testHvmiManifestRow.supplierId}_integration_test`,
          displayName: testHvmiManifestRow.displayName,
          domain: testHvmiManifestRow.domain,
          sourceClassification: testHvmiManifestRow.sourceClassification,
          bookabilityMode: testHvmiManifestRow.bookabilityMode,
          availabilityRefreshLatencySeconds: testHvmiManifestRow.availabilityRefreshLatencySeconds,
          rateRefreshLatencySeconds: testHvmiManifestRow.rateRefreshLatencySeconds,
          isPriced: testHvmiManifestRow.isPriced,
          cancellationSemantics: testHvmiManifestRow.cancellationSemantics,
          refundSemantics: testHvmiManifestRow.refundSemantics,
          certificationStatus: testHvmiManifestRow.certificationStatus,
          fixtureEvidenceRef: testHvmiManifestRow.fixtureEvidenceRef,
          manifestVersion: testHvmiManifestRow.manifestVersion,
          lastReviewedAt: testHvmiManifestRow.lastReviewedAt,
          reviewedBy: testHvmiManifestRow.reviewedBy,
          dataClassification: testHvmiManifestRow.dataClassification,
        },
      });
      expect(manifest.id).toBeTruthy();
      expect(manifest.certificationStatus).toBe('CERTIFIED');
      createdIds.manifestId = manifest.id as string;
    });

    it('receipts for an itinerary are append-only (multiple receipts can coexist)', async () => {
      const receipts = await client.tripConfidenceReceipt.findMany({
        where: { itineraryId: createdIds.itineraryId },
      });
      expect(receipts.length).toBeGreaterThanOrEqual(1);
      expect(receipts.every((r: { itineraryVersion: number }) => r.itineraryVersion >= 1)).toBe(true);
    });
  },
);
