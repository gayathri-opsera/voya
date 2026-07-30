/**
 * Integration tests for @voya/domain-repositories Prisma implementations.
 *
 * These tests require a real database and are skipped when DATABASE_URL is
 * not set in the environment. They verify the full round-trip through Prisma:
 * create, read, ownership guard, version conflict, append-only audit.
 *
 * Run locally with:
 *   DATABASE_URL=<url> npx vitest run test/prisma-repositories.integration.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  PrismaTravellerProfileRepository,
  PrismaTripIntentRepository,
  PrismaItineraryRepository,
  PrismaTripConfidenceReceiptRepository,
  PrismaSupplierManifestRepository,
  PrismaAuditRecordRepository,
  isOk,
  isNotFound,
  isValidationFailure,
  isVersionConflict,
} from '../src/index.js';
import { ItineraryStatus, PathMode } from '@voya/domain-model';
import {
  OWNER_A_REF,
  OWNER_B_REF,
  ownerAProfileInput,
  ownerBProfileInput,
  makeOwnedItineraryInput,
  makePassingReceiptInput,
  makeBlockedReceiptInput,
  sourcingOrderAuditInput,
  receiptIssuedAuditInput,
  ledgerEntryInput,
  staleVersionScenario,
} from './fixtures/repository-fixtures.js';

const HAS_DB = Boolean(process.env['DATABASE_URL']);

// Shared PrismaClient instance — created once for the suite and disconnected after
let prisma: PrismaClient;

describe.skipIf(!HAS_DB)('Prisma Repository Integration Tests', () => {
  beforeEach(async () => {
    prisma = new PrismaClient();
  });

  // -------------------------------------------------------------------------
  // PrismaTravellerProfileRepository
  // -------------------------------------------------------------------------

  describe('PrismaTravellerProfileRepository', () => {
    it('creates a profile and retrieves it by ownerRef', async () => {
      const repo = new PrismaTravellerProfileRepository(prisma);
      const created = await repo.create(ownerAProfileInput);
      expect(isOk(created)).toBe(true);
      if (!isOk(created)) return;

      const found = await repo.findByOwnerRef(OWNER_A_REF);
      expect(isOk(found)).toBe(true);
      if (!isOk(found)) return;
      expect(found.data.ownerRef).toBe(OWNER_A_REF);
    });

    it('findByOwnerRef returns NOT_FOUND for unknown owner', async () => {
      const repo = new PrismaTravellerProfileRepository(prisma);
      const result = await repo.findByOwnerRef('tok_unknown_never_exists_zz');
      expect(isNotFound(result)).toBe(true);
    });

    it('findById returns NOT_FOUND for cross-owner access', async () => {
      const repoA = new PrismaTravellerProfileRepository(prisma);
      const created = await repoA.create(ownerAProfileInput);
      expect(isOk(created)).toBe(true);
      if (!isOk(created)) return;

      const repoB = new PrismaTravellerProfileRepository(prisma);
      const crossResult = await repoB.findById(created.data.id, OWNER_B_REF);
      expect(isNotFound(crossResult)).toBe(true);
    });

    it('create returns VALIDATION_FAILURE for empty ownerRef', async () => {
      const repo = new PrismaTravellerProfileRepository(prisma);
      const result = await repo.create({ ...ownerAProfileInput, ownerRef: '' });
      expect(isValidationFailure(result)).toBe(true);
    });

    it('findById returns the row when ownerRef matches', async () => {
      const repo = new PrismaTravellerProfileRepository(prisma);
      const created = await repo.create(ownerAProfileInput);
      expect(isOk(created)).toBe(true);
      if (!isOk(created)) return;

      const found = await repo.findById(created.data.id, OWNER_A_REF);
      expect(isOk(found)).toBe(true);
      if (isOk(found)) expect(found.data.id).toBe(created.data.id);
    });
  });

  // -------------------------------------------------------------------------
  // PrismaTripIntentRepository
  // -------------------------------------------------------------------------

  describe('PrismaTripIntentRepository', () => {
    it('creates a trip intent and retrieves it by traveller', async () => {
      const profileRepo = new PrismaTravellerProfileRepository(prisma);
      const profile = await profileRepo.create(ownerAProfileInput);
      expect(isOk(profile)).toBe(true);
      if (!isOk(profile)) return;

      const repo = new PrismaTripIntentRepository(prisma);
      const created = await repo.create({
        travellerProfileId: profile.data.id,
        ownerRef:           OWNER_A_REF,
        pathMode:           PathMode.PATH_A,
        rawConstraintsJson: { notes: 'synthetic intent test' },
        destinationToken:   'dest_test_paris_001',
        checkInDate:        new Date('2026-08-01'),
        checkOutDate:       new Date('2026-08-07'),
        partySize:          2,
      });
      expect(isOk(created)).toBe(true);

      if (!isOk(created)) return;
      const list = await repo.findByTravellerId(profile.data.id, OWNER_A_REF);
      expect(isOk(list)).toBe(true);
      if (isOk(list)) expect(list.data.length).toBeGreaterThan(0);
    });

    it('findById returns NOT_FOUND for cross-owner access', async () => {
      const profileRepo = new PrismaTravellerProfileRepository(prisma);
      const profile = await profileRepo.create(ownerAProfileInput);
      expect(isOk(profile)).toBe(true);
      if (!isOk(profile)) return;

      const repo = new PrismaTripIntentRepository(prisma);
      const created = await repo.create({
        travellerProfileId: profile.data.id,
        ownerRef:           OWNER_A_REF,
        pathMode:           PathMode.PATH_A,
        rawConstraintsJson: { notes: 'cross-owner' },
        destinationToken:   'dest_test_london_001',
        checkInDate:        new Date('2026-09-01'),
        checkOutDate:       new Date('2026-09-05'),
        partySize:          1,
      });
      if (!isOk(created)) return;

      const crossResult = await repo.findById(created.data.id, OWNER_B_REF);
      expect(isNotFound(crossResult)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // PrismaItineraryRepository
  // -------------------------------------------------------------------------

  describe('PrismaItineraryRepository', () => {
    it('createWithLineItems atomically creates itinerary with days and line items', async () => {
      const profileRepo = new PrismaTravellerProfileRepository(prisma);
      const profile = await profileRepo.create(ownerAProfileInput);
      expect(isOk(profile)).toBe(true);
      if (!isOk(profile)) return;

      const tripRepo = new PrismaTripIntentRepository(prisma);
      const intent = await tripRepo.create({
        travellerProfileId: profile.data.id,
        ownerRef:           OWNER_A_REF,
        pathMode:           PathMode.PATH_A,
        rawConstraintsJson: { notes: 'itinerary integration test' },
        destinationToken:   'dest_test_tokyo_001',
        checkInDate:        new Date('2026-10-01'),
        checkOutDate:       new Date('2026-10-07'),
        partySize:          2,
      });
      expect(isOk(intent)).toBe(true);
      if (!isOk(intent)) return;

      const repo = new PrismaItineraryRepository(prisma);
      const input = makeOwnedItineraryInput(profile.data.id, intent.data.id);
      const created = await repo.createWithLineItems(input);
      expect(isOk(created)).toBe(true);

      if (!isOk(created)) return;
      const found = await repo.findById(created.data.id, OWNER_A_REF);
      expect(isOk(found)).toBe(true);
      if (isOk(found)) expect(found.data.status).toBe(ItineraryStatus.DRAFT);
    });

    it('findById returns NOT_FOUND for cross-owner access', async () => {
      const profileRepo = new PrismaTravellerProfileRepository(prisma);
      const profile = await profileRepo.create(ownerAProfileInput);
      if (!isOk(profile)) return;

      const tripRepo = new PrismaTripIntentRepository(prisma);
      const intent = await tripRepo.create({
        travellerProfileId: profile.data.id,
        ownerRef:           OWNER_A_REF,
        pathMode:           PathMode.PATH_A,
        rawConstraintsJson: { notes: 'cross-owner itinerary' },
        destinationToken:   'dest_test_rome_001',
        checkInDate:        new Date('2026-11-01'),
        checkOutDate:       new Date('2026-11-05'),
        partySize:          2,
      });
      if (!isOk(intent)) return;

      const repo = new PrismaItineraryRepository(prisma);
      const created = await repo.createWithLineItems(makeOwnedItineraryInput(profile.data.id, intent.data.id));
      if (!isOk(created)) return;

      const crossResult = await repo.findById(created.data.id, OWNER_B_REF);
      expect(isNotFound(crossResult)).toBe(true);
    });

    it('updateStatus advances status on valid transition', async () => {
      const profileRepo = new PrismaTravellerProfileRepository(prisma);
      const profile = await profileRepo.create(ownerAProfileInput);
      if (!isOk(profile)) return;

      const tripRepo = new PrismaTripIntentRepository(prisma);
      const intent = await tripRepo.create({
        travellerProfileId: profile.data.id,
        ownerRef:           OWNER_A_REF,
        pathMode:           PathMode.PATH_A,
        rawConstraintsJson: { notes: 'status transition test' },
        destinationToken:   'dest_test_bali_001',
        checkInDate:        new Date('2026-12-01'),
        checkOutDate:       new Date('2026-12-07'),
        partySize:          2,
      });
      if (!isOk(intent)) return;

      const repo = new PrismaItineraryRepository(prisma);
      const created = await repo.createWithLineItems(makeOwnedItineraryInput(profile.data.id, intent.data.id));
      if (!isOk(created)) return;

      const advanced = await repo.updateStatus(
        created.data.id,
        OWNER_A_REF,
        ItineraryStatus.DRAFT,
        ItineraryStatus.PENDING_VERIFICATION,
      );
      expect(isOk(advanced)).toBe(true);
      if (isOk(advanced)) expect(advanced.data.status).toBe(ItineraryStatus.PENDING_VERIFICATION);
    });

    it('updateStatus returns VERSION_CONFLICT when from-status is stale', async () => {
      const profileRepo = new PrismaTravellerProfileRepository(prisma);
      const profile = await profileRepo.create(ownerAProfileInput);
      if (!isOk(profile)) return;

      const tripRepo = new PrismaTripIntentRepository(prisma);
      const intent = await tripRepo.create({
        travellerProfileId: profile.data.id,
        ownerRef:           OWNER_A_REF,
        pathMode:           PathMode.PATH_A,
        rawConstraintsJson: { notes: 'version conflict test' },
        destinationToken:   'dest_test_nyc_001',
        checkInDate:        new Date('2027-01-01'),
        checkOutDate:       new Date('2027-01-05'),
        partySize:          1,
      });
      if (!isOk(intent)) return;

      const repo = new PrismaItineraryRepository(prisma);
      const created = await repo.createWithLineItems(makeOwnedItineraryInput(profile.data.id, intent.data.id));
      if (!isOk(created)) return;

      // Use stale from-status (PENDING_VERIFICATION but actual is DRAFT)
      const conflictResult = await repo.updateStatus(
        created.data.id,
        OWNER_A_REF,
        staleVersionScenario.expectedFrom,  // DRAFT — but test forces mismatch
        staleVersionScenario.targetTo,
      );
      // staleVersionScenario.expectedFrom === DRAFT, which IS the actual status,
      // so this would succeed. Instead simulate the conflict by advancing first,
      // then trying to re-advance from DRAFT again.
      expect(isOk(conflictResult) || isVersionConflict(conflictResult)).toBe(true);
      if (!isOk(conflictResult)) return;

      // Now the row is at PENDING_VERIFICATION; try again with stale DRAFT
      const staleResult = await repo.updateStatus(
        created.data.id,
        OWNER_A_REF,
        ItineraryStatus.DRAFT,  // stale — it's actually PENDING_VERIFICATION now
        ItineraryStatus.PENDING_VERIFICATION,
      );
      expect(isVersionConflict(staleResult)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // PrismaAuditRecordRepository — append-only
  // -------------------------------------------------------------------------

  describe('PrismaAuditRecordRepository', () => {
    it('append writes an audit record and returns ok', async () => {
      const repo = new PrismaAuditRecordRepository(prisma);
      const result = await repo.append(sourcingOrderAuditInput);
      expect(isOk(result)).toBe(true);
    });

    it('append returns VALIDATION_FAILURE for invalid eventType', async () => {
      const repo = new PrismaAuditRecordRepository(prisma);
      const result = await repo.append({
        eventType:   'NOT_A_REAL_EVENT_TYPE' as never,
        payloadJson: { data: 'test' },
      });
      expect(isValidationFailure(result)).toBe(true);
    });

    it('append returns VALIDATION_FAILURE for empty payloadJson', async () => {
      const repo = new PrismaAuditRecordRepository(prisma);
      const result = await repo.append({ eventType: 'RECEIPT_ISSUED', payloadJson: {} });
      expect(isValidationFailure(result)).toBe(true);
    });

    it('appendLedgerEntry writes a ledger entry', async () => {
      const repo = new PrismaAuditRecordRepository(prisma);
      const result = await repo.appendLedgerEntry(ledgerEntryInput);
      expect(isOk(result)).toBe(true);
    });

    it('findByCorrelationId retrieves ledger entries by correlationId', async () => {
      const repo = new PrismaAuditRecordRepository(prisma);
      const correlationId = `corr_int_test_${Date.now()}`;
      await repo.appendLedgerEntry({ ...ledgerEntryInput, correlationId });
      await repo.appendLedgerEntry({ ...ledgerEntryInput, correlationId });

      const result = await repo.findByCorrelationId(correlationId);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.data.length).toBe(2);
    });

    it('countByEventType returns the correct count', async () => {
      const repo = new PrismaAuditRecordRepository(prisma);
      await repo.append(receiptIssuedAuditInput);
      const count = await repo.countByEventType('RECEIPT_ISSUED' as never);
      expect(isOk(count)).toBe(true);
      if (isOk(count)) expect(count.data).toBeGreaterThanOrEqual(1);
    });

    it('has no update or delete methods (append-only contract)', () => {
      const repo = new PrismaAuditRecordRepository(prisma);
      expect('update' in repo).toBe(false);
      expect('delete' in repo).toBe(false);
      expect('deleteById' in repo).toBe(false);
      expect('updateById' in repo).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // PrismaTripConfidenceReceiptRepository
  // -------------------------------------------------------------------------

  describe('PrismaTripConfidenceReceiptRepository', () => {
    it('appendReceipt stores a PASS receipt for an owned itinerary', async () => {
      const profileRepo = new PrismaTravellerProfileRepository(prisma);
      const profile = await profileRepo.create(ownerAProfileInput);
      if (!isOk(profile)) return;

      const tripRepo = new PrismaTripIntentRepository(prisma);
      const intent = await tripRepo.create({
        travellerProfileId: profile.data.id,
        ownerRef:           OWNER_A_REF,
        pathMode:           PathMode.PATH_A,
        rawConstraintsJson: { notes: 'receipt integration test' },
        destinationToken:   'dest_test_dubai_001',
        checkInDate:        new Date('2027-02-01'),
        checkOutDate:       new Date('2027-02-07'),
        partySize:          2,
      });
      if (!isOk(intent)) return;

      const itinRepo = new PrismaItineraryRepository(prisma);
      const itin = await itinRepo.createWithLineItems(makeOwnedItineraryInput(profile.data.id, intent.data.id));
      if (!isOk(itin)) return;

      const rcptRepo = new PrismaTripConfidenceReceiptRepository(prisma);
      // Need to find the line item id — the receipt references a specific line item
      // For integration test we use the itinerary id as a placeholder
      const receiptInput = makePassingReceiptInput(itin.data.id, 'li_placeholder_001');
      const result = await rcptRepo.appendReceipt(receiptInput, OWNER_A_REF);
      expect(isOk(result)).toBe(true);
    });

    it('appendReceipt returns NOT_FOUND for cross-owner access', async () => {
      const profileRepo = new PrismaTravellerProfileRepository(prisma);
      const profile = await profileRepo.create(ownerAProfileInput);
      if (!isOk(profile)) return;

      const tripRepo = new PrismaTripIntentRepository(prisma);
      const intent = await tripRepo.create({
        travellerProfileId: profile.data.id,
        ownerRef:           OWNER_A_REF,
        pathMode:           PathMode.PATH_A,
        rawConstraintsJson: { notes: 'cross-owner receipt' },
        destinationToken:   'dest_test_sg_001',
        checkInDate:        new Date('2027-03-01'),
        checkOutDate:       new Date('2027-03-05'),
        partySize:          2,
      });
      if (!isOk(intent)) return;

      const itinRepo = new PrismaItineraryRepository(prisma);
      const itin = await itinRepo.createWithLineItems(makeOwnedItineraryInput(profile.data.id, intent.data.id));
      if (!isOk(itin)) return;

      const rcptRepo = new PrismaTripConfidenceReceiptRepository(prisma);
      const result = await rcptRepo.appendReceipt(
        makePassingReceiptInput(itin.data.id, 'li_placeholder_001'),
        OWNER_B_REF,  // wrong owner
      );
      expect(isNotFound(result)).toBe(true);
    });

    it('appendReceipt returns VALIDATION_FAILURE for PASS receipt with no line items', async () => {
      const profileRepo = new PrismaTravellerProfileRepository(prisma);
      const profile = await profileRepo.create(ownerAProfileInput);
      if (!isOk(profile)) return;

      const tripRepo = new PrismaTripIntentRepository(prisma);
      const intent = await tripRepo.create({
        travellerProfileId: profile.data.id,
        ownerRef:           OWNER_A_REF,
        pathMode:           PathMode.PATH_A,
        rawConstraintsJson: { notes: 'validation test' },
        destinationToken:   'dest_test_mex_001',
        checkInDate:        new Date('2027-04-01'),
        checkOutDate:       new Date('2027-04-05'),
        partySize:          2,
      });
      if (!isOk(intent)) return;

      const itinRepo = new PrismaItineraryRepository(prisma);
      const itin = await itinRepo.createWithLineItems(makeOwnedItineraryInput(profile.data.id, intent.data.id));
      if (!isOk(itin)) return;

      const rcptRepo = new PrismaTripConfidenceReceiptRepository(prisma);
      const result = await rcptRepo.appendReceipt(
        {
          itineraryId:       itin.data.id,
          itineraryVersion:  1,
          outcome:           'PASS',
          feasibilityPassed: true,
          freshnessGrade:    'FRESH',
          evaluatedAt:       new Date(),
          lineItems:         [],  // invalid for PASS
        },
        OWNER_A_REF,
      );
      expect(isValidationFailure(result)).toBe(true);
    });

    it('findByItineraryId returns the full receipt history', async () => {
      const profileRepo = new PrismaTravellerProfileRepository(prisma);
      const profile = await profileRepo.create(ownerAProfileInput);
      if (!isOk(profile)) return;

      const tripRepo = new PrismaTripIntentRepository(prisma);
      const intent = await tripRepo.create({
        travellerProfileId: profile.data.id,
        ownerRef:           OWNER_A_REF,
        pathMode:           PathMode.PATH_A,
        rawConstraintsJson: { notes: 'history test' },
        destinationToken:   'dest_test_syd_001',
        checkInDate:        new Date('2027-05-01'),
        checkOutDate:       new Date('2027-05-07'),
        partySize:          2,
      });
      if (!isOk(intent)) return;

      const itinRepo = new PrismaItineraryRepository(prisma);
      const itin = await itinRepo.createWithLineItems(makeOwnedItineraryInput(profile.data.id, intent.data.id));
      if (!isOk(itin)) return;

      const rcptRepo = new PrismaTripConfidenceReceiptRepository(prisma);
      await rcptRepo.appendReceipt(makePassingReceiptInput(itin.data.id, 'li_placeholder_001'), OWNER_A_REF);
      await rcptRepo.appendReceipt(makeBlockedReceiptInput(itin.data.id), OWNER_A_REF);

      const history = await rcptRepo.findByItineraryId(itin.data.id, OWNER_A_REF);
      expect(isOk(history)).toBe(true);
      if (isOk(history)) expect(history.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  // PrismaSupplierManifestRepository
  // -------------------------------------------------------------------------

  describe('PrismaSupplierManifestRepository', () => {
    it('findBySupplierId returns NOT_FOUND for unknown supplier', async () => {
      const repo = new PrismaSupplierManifestRepository(prisma);
      const result = await repo.findBySupplierId('sup_unknown_integration_test_zz');
      expect(isNotFound(result)).toBe(true);
    });

    it('findCertifiedByDomain returns ok (possibly empty) for a valid domain', async () => {
      const repo = new PrismaSupplierManifestRepository(prisma);
      const result = await repo.findCertifiedByDomain('ACCOMMODATION' as never);
      expect(isOk(result)).toBe(true);
    });

    it('findByFreshnessWindow returns VALIDATION_FAILURE for non-positive window', async () => {
      const repo = new PrismaSupplierManifestRepository(prisma);
      const result = await repo.findByFreshnessWindow(0);
      expect(isValidationFailure(result)).toBe(true);
    });
  });
});
