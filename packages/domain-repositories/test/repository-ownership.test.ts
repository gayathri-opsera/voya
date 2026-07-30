/**
 * Unit tests for @voya/domain-repositories — ownership semantics, validation,
 * append-only behavior, and not-found semantics.
 *
 * These tests use in-memory fake implementations of the repository interfaces
 * so no database is required. The tests prove:
 *  - Cross-owner reads return NOT_FOUND (not a different error kind)
 *  - Missing resources return NOT_FOUND
 *  - Validation failures are returned for invalid inputs
 *  - Audit repository exposes no update/delete methods
 *  - Version conflicts are detected
 *  - isValidItineraryTransition is enforced before DB writes
 */

import { describe, it, expect } from 'vitest';
import {
  ok,
  notFound,
  validationFailure,
  versionConflict,
  isOk,
  isNotFound,
  isValidationFailure,
  isVersionConflict,
} from '../src/result.js';
import type { RepositoryResult } from '../src/result.js';
import type { TravellerProfileRepository, TravellerProfileRow } from '../src/interfaces/traveller-profile-repository.js';
import type { ItineraryRepository, ItineraryRow } from '../src/interfaces/itinerary-repository.js';
import type { AuditRecordRepository, AuditRecordRow, AuditLedgerRow } from '../src/interfaces/audit-record-repository.js';
import type { TripConfidenceReceiptRepository, ReceiptRow } from '../src/interfaces/trip-confidence-receipt-repository.js';
import type { SupplierManifestRepository, SupplierManifestRow } from '../src/interfaces/supplier-manifest-repository.js';
import {
  TravellerIdentityType,
  DataClassificationTier,
  PathMode,
  InventoryDomain,
  ItineraryStatus,
  AuditEventType,
} from '@voya/domain-model';
import {
  OWNER_A_REF,
  OWNER_B_REF,
  ownerAProfileInput,
  sourcingOrderAuditInput,
  ledgerEntryInput,
  makePassingReceiptInput,
} from './fixtures/repository-fixtures.js';

// ---------------------------------------------------------------------------
// Fake in-memory TravellerProfileRepository
// ---------------------------------------------------------------------------

class FakeTravellerProfileRepository implements TravellerProfileRepository {
  private readonly store = new Map<string, TravellerProfileRow>();

  seed(row: TravellerProfileRow): void { this.store.set(row.id, row); }

  async findByOwnerRef(ownerRef: string): Promise<RepositoryResult<TravellerProfileRow>> {
    const row = [...this.store.values()].find((r) => r.ownerRef === ownerRef);
    return row ? ok(row) : notFound();
  }

  async findById(id: string, ownerRef: string): Promise<RepositoryResult<TravellerProfileRow>> {
    const row = this.store.get(id);
    if (!row || row.ownerRef !== ownerRef) return notFound();
    return ok(row);
  }

  async create(input: { ownerRef: string; identityType: TravellerIdentityType }): Promise<RepositoryResult<TravellerProfileRow>> {
    if (!input.ownerRef) return validationFailure(['ownerRef must not be empty']);
    const row: TravellerProfileRow = {
      id:                 `id_${Date.now()}`,
      ownerRef:           input.ownerRef,
      identityType:       input.identityType,
      dataClassification: DataClassificationTier.CONFIDENTIAL,
      createdAt:          new Date(),
      updatedAt:          new Date(),
    };
    this.store.set(row.id, row);
    return ok(row);
  }
}

// ---------------------------------------------------------------------------
// Fake in-memory ItineraryRepository
// ---------------------------------------------------------------------------

class FakeItineraryRepository implements ItineraryRepository {
  private readonly store = new Map<string, ItineraryRow & { ownerRef: string }>();

  seed(row: ItineraryRow, ownerRef: string): void {
    this.store.set(row.id, { ...row, ownerRef });
  }

  async findById(id: string, ownerRef: string): Promise<RepositoryResult<ItineraryRow>> {
    const row = this.store.get(id);
    if (!row || row.ownerRef !== ownerRef) return notFound();
    return ok(row);
  }

  async findByTravellerId(travellerProfileId: string, ownerRef: string): Promise<RepositoryResult<ItineraryRow[]>> {
    const rows = [...this.store.values()].filter(
      (r) => r.travellerProfileId === travellerProfileId && r.ownerRef === ownerRef,
    );
    return ok(rows);
  }

  async createWithLineItems(input: Parameters<ItineraryRepository['createWithLineItems']>[0]): Promise<RepositoryResult<ItineraryRow>> {
    if (!input.travellerProfileId) return validationFailure(['travellerProfileId must not be empty']);
    if (input.days.length === 0) return validationFailure(['itinerary must have at least one day']);
    for (const day of input.days) {
      for (const item of day.lineItems) {
        if (!item.sourceProvenance.supplierId) {
          return validationFailure(['line item sourceProvenance.supplierId must not be empty']);
        }
        if (item.priceAmountMinorUnits !== undefined && item.priceAmountMinorUnits < 0) {
          return validationFailure([`priceAmountMinorUnits must be non-negative`]);
        }
      }
    }
    const row: ItineraryRow = {
      id:                 `itin_${Date.now()}`,
      travellerProfileId: input.travellerProfileId,
      tripIntentId:       input.tripIntentId,
      version:            1,
      status:             ItineraryStatus.DRAFT,
      pathMode:           input.pathMode,
      dataClassification: input.dataClassification ?? DataClassificationTier.INTERNAL,
      createdAt:          new Date(),
      updatedAt:          new Date(),
    };
    this.store.set(row.id, { ...row, ownerRef: input.ownerRef });
    return ok(row);
  }

  async updateStatus(
    id: string,
    ownerRef: string,
    from: ItineraryStatus,
    to: ItineraryStatus,
  ): Promise<RepositoryResult<ItineraryRow>> {
    const row = this.store.get(id);
    if (!row || row.ownerRef !== ownerRef) return notFound();
    if (row.status !== from) return versionConflict(row.version);

    const { isValidItineraryTransition } = await import('@voya/domain-model');
    if (!isValidItineraryTransition(from, to)) {
      return validationFailure([`Transition ${from} → ${to} is invalid`]);
    }

    const updated = { ...row, status: to, version: row.version + 1, updatedAt: new Date() };
    this.store.set(id, updated);
    return ok(updated);
  }
}

// ---------------------------------------------------------------------------
// Fake in-memory AuditRecordRepository (append-only)
// ---------------------------------------------------------------------------

class FakeAuditRecordRepository implements AuditRecordRepository {
  private readonly records: AuditRecordRow[] = [];
  private readonly ledger: AuditLedgerRow[]  = [];

  async append(input: Parameters<AuditRecordRepository['append']>[0]): Promise<RepositoryResult<AuditRecordRow>> {
    if (!input.payloadJson || Object.keys(input.payloadJson).length === 0) {
      return validationFailure(['payloadJson must not be empty']);
    }
    const row: AuditRecordRow = {
      id:                 `ar_${Date.now()}`,
      eventType:          input.eventType,
      travellerProfileId: input.travellerProfileId ?? null,
      itineraryId:        input.itineraryId ?? null,
      sessionRef:         input.sessionRef ?? null,
      supplierId:         input.supplierId ?? null,
      payloadJson:        input.payloadJson,
      pathMode:           input.pathMode ?? null,
      dataClassification: input.dataClassification ?? DataClassificationTier.INTERNAL,
      createdAt:          new Date(),
    };
    this.records.push(row);
    return ok(row);
  }

  async appendLedgerEntry(input: Parameters<AuditRecordRepository['appendLedgerEntry']>[0]): Promise<RepositoryResult<AuditLedgerRow>> {
    if (!input.actorRef) return validationFailure(['actorRef must not be empty']);
    if (!input.correlationId) return validationFailure(['correlationId must not be empty']);
    const row: AuditLedgerRow = {
      id:                  `al_${Date.now()}`,
      eventType:           input.eventType,
      actorType:           input.actorType,
      actorRef:            input.actorRef,
      resourceType:        input.resourceType,
      resourceRef:         input.resourceRef,
      occurredAt:          input.occurredAt,
      correlationId:       input.correlationId,
      classificationTier:  input.classificationTier ?? DataClassificationTier.INTERNAL,
      redactedPayloadJson: input.redactedPayloadJson,
      canonicalHash:       input.canonicalHash,
      createdAt:           new Date(),
    };
    this.ledger.push(row);
    return ok(row);
  }

  async findByCorrelationId(correlationId: string): Promise<RepositoryResult<AuditLedgerRow[]>> {
    return ok(this.ledger.filter((r) => r.correlationId === correlationId));
  }

  async findByResourceRef(resourceType: string, resourceRef: string): Promise<RepositoryResult<AuditLedgerRow[]>> {
    return ok(this.ledger.filter((r) => r.resourceType === resourceType && r.resourceRef === resourceRef));
  }

  async countByEventType(eventType: AuditEventType): Promise<RepositoryResult<number>> {
    return ok(this.records.filter((r) => r.eventType === eventType).length);
  }

  get recordCount(): number { return this.records.length; }
  get ledgerCount(): number { return this.ledger.length; }
}

// ---------------------------------------------------------------------------
// Fake SupplierManifestRepository
// ---------------------------------------------------------------------------

class FakeSupplierManifestRepository implements SupplierManifestRepository {
  private readonly store = new Map<string, SupplierManifestRow>();

  seed(row: SupplierManifestRow): void { this.store.set(row.supplierId, row); }

  async findBySupplierId(supplierId: string): Promise<RepositoryResult<SupplierManifestRow>> {
    const row = this.store.get(supplierId);
    return row ? ok(row) : notFound();
  }

  async findCertifiedByDomain(domain: InventoryDomain): Promise<RepositoryResult<SupplierManifestRow[]>> {
    return ok([...this.store.values()].filter((r) => r.domain === domain && r.certificationStatus === 'CERTIFIED'));
  }

  async findFullyBookable(): Promise<RepositoryResult<SupplierManifestRow[]>> {
    return ok([...this.store.values()].filter((r) => r.bookabilityMode === 'FULLY_BOOKABLE' && r.certificationStatus === 'CERTIFIED'));
  }

  async findByFreshnessWindow(max: number): Promise<RepositoryResult<SupplierManifestRow[]>> {
    return ok([...this.store.values()].filter((r) => r.availabilityRefreshLatencySeconds <= max));
  }
}

// ---------------------------------------------------------------------------
// Fake TripConfidenceReceiptRepository
// ---------------------------------------------------------------------------

class FakeTripConfidenceReceiptRepository implements TripConfidenceReceiptRepository {
  private readonly store: ReceiptRow[] = [];
  private readonly ownerByItinerary = new Map<string, string>();

  seedOwnership(itineraryId: string, ownerRef: string): void {
    this.ownerByItinerary.set(itineraryId, ownerRef);
  }

  async appendReceipt(input: Parameters<TripConfidenceReceiptRepository['appendReceipt']>[0], ownerRef: string): Promise<RepositoryResult<ReceiptRow>> {
    const owner = this.ownerByItinerary.get(input.itineraryId);
    if (!owner || owner !== ownerRef) return notFound();
    if (input.outcome === 'PASS' && input.lineItems.length === 0) {
      return validationFailure(['A PASS receipt must include at least one line-item evidence row']);
    }
    const row: ReceiptRow = {
      id:               `rcpt_${Date.now()}`,
      itineraryId:      input.itineraryId,
      itineraryVersion: input.itineraryVersion,
      outcome:          input.outcome,
      feasibilityPassed: input.feasibilityPassed,
      freshnessGrade:   input.freshnessGrade,
      blockedReasonCode: input.blockedReasonCode ?? null,
      evaluatedAt:      input.evaluatedAt,
      dataClassification: input.dataClassification ?? DataClassificationTier.INTERNAL,
      createdAt:        new Date(),
    };
    this.store.push(row);
    return ok(row);
  }

  async findLatestByItineraryId(itineraryId: string, ownerRef: string): Promise<RepositoryResult<ReceiptRow | null>> {
    const owner = this.ownerByItinerary.get(itineraryId);
    if (!owner || owner !== ownerRef) return notFound();
    const rows = this.store.filter((r) => r.itineraryId === itineraryId);
    return ok(rows.length > 0 ? (rows[rows.length - 1] ?? null) : null);
  }

  async findByItineraryId(itineraryId: string, ownerRef: string): Promise<RepositoryResult<ReceiptRow[]>> {
    const owner = this.ownerByItinerary.get(itineraryId);
    if (!owner || owner !== ownerRef) return notFound();
    return ok(this.store.filter((r) => r.itineraryId === itineraryId));
  }
}

// ===========================================================================
// Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// RepositoryResult helpers
// ---------------------------------------------------------------------------

describe('RepositoryResult helpers', () => {
  it('ok() creates a successful result', () => {
    const r = ok({ id: '1' });
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    if (r.ok) expect(r.data).toEqual({ id: '1' });
  });

  it('notFound() creates a NOT_FOUND result', () => {
    const r = notFound();
    expect(r.ok).toBe(false);
    expect(isNotFound(r)).toBe(true);
    if (!r.ok) expect(r.kind).toBe('NOT_FOUND');
  });

  it('validationFailure() creates a VALIDATION_FAILURE result', () => {
    const r = validationFailure(['field required']);
    expect(r.ok).toBe(false);
    expect(isValidationFailure(r)).toBe(true);
    if (!r.ok && r.kind === 'VALIDATION_FAILURE') {
      expect(r.errors).toContain('field required');
    }
  });

  it('versionConflict() includes the current version', () => {
    const r = versionConflict(3);
    expect(r.ok).toBe(false);
    expect(isVersionConflict(r)).toBe(true);
    if (!r.ok && r.kind === 'VERSION_CONFLICT') expect(r.currentVersion).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Ownership semantics
// ---------------------------------------------------------------------------

describe('TravellerProfileRepository — ownership semantics', () => {
  it('findByOwnerRef returns ok for matching owner', async () => {
    const repo = new FakeTravellerProfileRepository();
    await repo.create(ownerAProfileInput);
    const result = await repo.findByOwnerRef(OWNER_A_REF);
    expect(isOk(result)).toBe(true);
  });

  it('findByOwnerRef returns NOT_FOUND for unknown owner', async () => {
    const repo = new FakeTravellerProfileRepository();
    const result = await repo.findByOwnerRef('tok_unknown_999');
    expect(isNotFound(result)).toBe(true);
  });

  it('findById returns NOT_FOUND when ownerRef does not match (cross-owner guard)', async () => {
    const repo = new FakeTravellerProfileRepository();
    const created = await repo.create(ownerAProfileInput);
    if (!isOk(created)) throw new Error('setup failed');
    const result = await repo.findById(created.data.id, OWNER_B_REF);
    // Must return NOT_FOUND, not FORBIDDEN — to prevent resource enumeration
    expect(isNotFound(result)).toBe(true);
  });

  it('findById returns ok for correct owner', async () => {
    const repo = new FakeTravellerProfileRepository();
    const created = await repo.create(ownerAProfileInput);
    if (!isOk(created)) throw new Error('setup failed');
    const result = await repo.findById(created.data.id, OWNER_A_REF);
    expect(isOk(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Itinerary ownership and validation
// ---------------------------------------------------------------------------

describe('ItineraryRepository — ownership and validation', () => {
  function makeSeededItinerary(): { repo: FakeItineraryRepository; row: ItineraryRow } {
    const repo = new FakeItineraryRepository();
    const row: ItineraryRow = {
      id:                 'itin_test_001',
      travellerProfileId: 'prof_test_001',
      tripIntentId:       'tip_test_001',
      version:            1,
      status:             ItineraryStatus.DRAFT,
      pathMode:           PathMode.PATH_A,
      dataClassification: DataClassificationTier.INTERNAL,
      createdAt:          new Date(),
      updatedAt:          new Date(),
    };
    repo.seed(row, OWNER_A_REF);
    return { repo, row };
  }

  it('findById returns NOT_FOUND for cross-owner access (resource enumeration guard)', async () => {
    const { repo, row } = makeSeededItinerary();
    const result = await repo.findById(row.id, OWNER_B_REF);
    expect(isNotFound(result)).toBe(true);
  });

  it('findById returns ok for correct owner', async () => {
    const { repo, row } = makeSeededItinerary();
    const result = await repo.findById(row.id, OWNER_A_REF);
    expect(isOk(result)).toBe(true);
  });

  it('createWithLineItems returns VALIDATION_FAILURE for empty days', async () => {
    const repo = new FakeItineraryRepository();
    const result = await repo.createWithLineItems({
      travellerProfileId: 'prof_test_001',
      ownerRef:           OWNER_A_REF,
      tripIntentId:       'tip_test_001',
      pathMode:           PathMode.PATH_A,
      days:               [],
    });
    expect(isValidationFailure(result)).toBe(true);
  });

  it('createWithLineItems returns VALIDATION_FAILURE for line item missing supplierId', async () => {
    const repo = new FakeItineraryRepository();
    const result = await repo.createWithLineItems({
      travellerProfileId: 'prof_test_001',
      ownerRef:           OWNER_A_REF,
      tripIntentId:       'tip_test_001',
      pathMode:           PathMode.PATH_A,
      days: [{
        dayIndex: 0,
        date: new Date('2026-07-01'),
        lineItems: [{
          sourceProvenance: {
            supplierId:           '',  // empty — invalid
            sourceRef:            'ref_001',
            bookingSource:        'HVMI' as never,
            sourceClassification: 'MARRIOTT_PARTNERED' as never,
            fetchedAt:            new Date(),
          },
          domain:              'ACCOMMODATION' as never,
          supplierRef:         'prop_001',
          displayNameSnapshot: 'Test Villa',
        }],
      }],
    });
    expect(isValidationFailure(result)).toBe(true);
  });

  it('createWithLineItems returns VALIDATION_FAILURE for negative price', async () => {
    const repo = new FakeItineraryRepository();
    const result = await repo.createWithLineItems({
      travellerProfileId: 'prof_test_001',
      ownerRef:           OWNER_A_REF,
      tripIntentId:       'tip_test_001',
      pathMode:           PathMode.PATH_A,
      days: [{
        dayIndex: 0,
        date:     new Date('2026-07-01'),
        lineItems: [{
          sourceProvenance: {
            supplierId:           'sup_test_001',
            sourceRef:            'ref_001',
            bookingSource:        'HVMI' as never,
            sourceClassification: 'MARRIOTT_PARTNERED' as never,
            fetchedAt:            new Date(),
          },
          domain:                 'ACCOMMODATION' as never,
          supplierRef:            'prop_001',
          displayNameSnapshot:    'Test Villa',
          priceAmountMinorUnits:  -100,  // invalid
        }],
      }],
    });
    expect(isValidationFailure(result)).toBe(true);
  });

  it('updateStatus returns VERSION_CONFLICT when current status differs from expected from', async () => {
    const { repo, row } = makeSeededItinerary();
    // Row is in DRAFT; attempt to transition from PENDING_VERIFICATION (stale assumption)
    const result = await repo.updateStatus(
      row.id,
      OWNER_A_REF,
      ItineraryStatus.PENDING_VERIFICATION,  // wrong expected state
      ItineraryStatus.VERIFIED,
    );
    expect(isVersionConflict(result)).toBe(true);
    if (!result.ok && result.kind === 'VERSION_CONFLICT') {
      expect(result.currentVersion).toBe(1);
    }
  });

  it('updateStatus returns VALIDATION_FAILURE for invalid transition', async () => {
    const { repo, row } = makeSeededItinerary();
    // DRAFT → EXPIRED is not a valid transition
    const result = await repo.updateStatus(
      row.id,
      OWNER_A_REF,
      ItineraryStatus.DRAFT,
      ItineraryStatus.EXPIRED,
    );
    expect(isValidationFailure(result)).toBe(true);
  });

  it('updateStatus succeeds for valid transition with correct from-state', async () => {
    const { repo, row } = makeSeededItinerary();
    const result = await repo.updateStatus(
      row.id,
      OWNER_A_REF,
      ItineraryStatus.DRAFT,
      ItineraryStatus.PENDING_VERIFICATION,
    );
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.data.status).toBe(ItineraryStatus.PENDING_VERIFICATION);
  });

  it('updateStatus returns NOT_FOUND for cross-owner attempt', async () => {
    const { repo, row } = makeSeededItinerary();
    const result = await repo.updateStatus(
      row.id,
      OWNER_B_REF,  // wrong owner
      ItineraryStatus.DRAFT,
      ItineraryStatus.PENDING_VERIFICATION,
    );
    expect(isNotFound(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Audit repository — append-only behavior
// ---------------------------------------------------------------------------

describe('AuditRecordRepository — append-only behavior', () => {
  it('append() adds a record and returns ok', async () => {
    const repo = new FakeAuditRecordRepository();
    const result = await repo.append(sourcingOrderAuditInput);
    expect(isOk(result)).toBe(true);
    expect(repo.recordCount).toBe(1);
  });

  it('append() returns VALIDATION_FAILURE for empty payloadJson', async () => {
    const repo = new FakeAuditRecordRepository();
    const result = await repo.append({ eventType: 'SOURCING_ORDER', payloadJson: {} });
    expect(isValidationFailure(result)).toBe(true);
  });

  it('appendLedgerEntry() returns VALIDATION_FAILURE for empty actorRef', async () => {
    const repo = new FakeAuditRecordRepository();
    const result = await repo.appendLedgerEntry({ ...ledgerEntryInput, actorRef: '' });
    expect(isValidationFailure(result)).toBe(true);
  });

  it('appendLedgerEntry() returns ok for valid input', async () => {
    const repo = new FakeAuditRecordRepository();
    const result = await repo.appendLedgerEntry(ledgerEntryInput);
    expect(isOk(result)).toBe(true);
    expect(repo.ledgerCount).toBe(1);
  });

  it('AuditRecordRepository interface has no update or delete methods', () => {
    const repo = new FakeAuditRecordRepository();
    // TypeScript compile check: these properties must not exist on the interface
    expect('update' in repo).toBe(false);
    expect('delete' in repo).toBe(false);
    expect('deleteById' in repo).toBe(false);
    expect('updateById' in repo).toBe(false);
  });

  it('countByEventType returns correct count after multiple appends', async () => {
    const repo = new FakeAuditRecordRepository();
    await repo.append(sourcingOrderAuditInput);
    await repo.append(sourcingOrderAuditInput);
    await repo.append({ eventType: 'RECEIPT_ISSUED', payloadJson: { outcome: 'PASS' } });
    const countResult = await repo.countByEventType(AuditEventType.SOURCING_ORDER);
    expect(isOk(countResult)).toBe(true);
    if (isOk(countResult)) expect(countResult.data).toBe(2);
  });

  it('findByCorrelationId returns entries in append order', async () => {
    const repo = new FakeAuditRecordRepository();
    await repo.appendLedgerEntry({ ...ledgerEntryInput, correlationId: 'corr_search' });
    await repo.appendLedgerEntry({ ...ledgerEntryInput, correlationId: 'corr_search' });
    await repo.appendLedgerEntry({ ...ledgerEntryInput, correlationId: 'corr_other' });
    const result = await repo.findByCorrelationId('corr_search');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.data).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// TripConfidenceReceiptRepository — ownership and append-only
// ---------------------------------------------------------------------------

describe('TripConfidenceReceiptRepository — ownership and append-only', () => {
  it('appendReceipt returns NOT_FOUND for cross-owner attempt', async () => {
    const repo = new FakeTripConfidenceReceiptRepository();
    const itineraryId = 'itin_test_001';
    repo.seedOwnership(itineraryId, OWNER_A_REF);

    const result = await repo.appendReceipt(
      makePassingReceiptInput(itineraryId, 'li_test_001'),
      OWNER_B_REF,  // wrong owner
    );
    expect(isNotFound(result)).toBe(true);
  });

  it('appendReceipt returns VALIDATION_FAILURE for PASS receipt with no line items', async () => {
    const repo = new FakeTripConfidenceReceiptRepository();
    const itineraryId = 'itin_test_001';
    repo.seedOwnership(itineraryId, OWNER_A_REF);

    const result = await repo.appendReceipt(
      {
        itineraryId,
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

  it('multiple receipts can be appended for the same itinerary (version history)', async () => {
    const repo = new FakeTripConfidenceReceiptRepository();
    const itineraryId = 'itin_test_001';
    repo.seedOwnership(itineraryId, OWNER_A_REF);

    const r1 = await repo.appendReceipt(makePassingReceiptInput(itineraryId, 'li_001'), OWNER_A_REF);
    const r2 = await repo.appendReceipt(
      { itineraryId, itineraryVersion: 2, outcome: 'BLOCKED', feasibilityPassed: false, freshnessGrade: 'STALE', evaluatedAt: new Date(), lineItems: [] },
      OWNER_A_REF,
    );

    expect(isOk(r1)).toBe(true);
    expect(isOk(r2)).toBe(true);

    const history = await repo.findByItineraryId(itineraryId, OWNER_A_REF);
    expect(isOk(history)).toBe(true);
    if (isOk(history)) expect(history.data).toHaveLength(2);
  });

  it('findLatestByItineraryId returns NOT_FOUND for cross-owner access', async () => {
    const repo = new FakeTripConfidenceReceiptRepository();
    repo.seedOwnership('itin_test_001', OWNER_A_REF);
    const result = await repo.findLatestByItineraryId('itin_test_001', OWNER_B_REF);
    expect(isNotFound(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SupplierManifestRepository — not-found for unknown suppliers
// ---------------------------------------------------------------------------

describe('SupplierManifestRepository — unknown supplier semantics', () => {
  it('findBySupplierId returns NOT_FOUND for unknown supplierId', async () => {
    const repo = new FakeSupplierManifestRepository();
    const result = await repo.findBySupplierId('sup_unknown_999');
    expect(isNotFound(result)).toBe(true);
  });

  it('findCertifiedByDomain returns empty array when no certified manifests', async () => {
    const repo = new FakeSupplierManifestRepository();
    const result = await repo.findCertifiedByDomain(InventoryDomain.ACCOMMODATION);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.data).toHaveLength(0);
  });
});
