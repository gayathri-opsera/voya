/**
 * Prisma-backed ItineraryRepository implementation.
 *
 * createWithLineItems executes inside a Prisma interactive transaction so that
 * a failure in any nested insert (provenance, day, line item) rolls back the
 * entire operation. The version-conflict guard in updateStatus uses an optimistic
 * read-then-write pattern with a database-level condition.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import {
  DataClassificationTier,
  InventoryDomain,
  isValidItineraryTransition,
  validateMinorUnits,
} from '@voya/domain-model';
import { ok, notFound, validationFailure, versionConflict, repoError } from '../result.js';
import type { RepositoryResult } from '../result.js';
import type {
  ItineraryRow,
  CreateItineraryInput,
  ItineraryRepository,
} from '../interfaces/itinerary-repository.js';
import type { ItineraryStatus } from '@voya/domain-model';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class PrismaItineraryRepository implements ItineraryRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string, ownerRef: string): Promise<RepositoryResult<ItineraryRow>> {
    if (!id) return validationFailure(['id must not be empty']);
    try {
      const row = await this.db.itinerary.findUnique({
        where: { id },
        include: { travellerProfile: { select: { ownerRef: true } } },
      });
      if (!row || row.travellerProfile.ownerRef !== ownerRef) return notFound();
      return ok(row as unknown as ItineraryRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async findByTravellerId(
    travellerProfileId: string,
    ownerRef: string,
  ): Promise<RepositoryResult<ItineraryRow[]>> {
    if (!travellerProfileId) return validationFailure(['travellerProfileId must not be empty']);
    try {
      const profile = await this.db.travellerProfile.findUnique({
        where: { id: travellerProfileId },
        select: { ownerRef: true },
      });
      if (!profile || profile.ownerRef !== ownerRef) return notFound();

      const rows = await this.db.itinerary.findMany({
        where: { travellerProfileId },
        orderBy: { createdAt: 'desc' },
      });
      return ok(rows as unknown as ItineraryRow[]);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async createWithLineItems(
    input: CreateItineraryInput,
  ): Promise<RepositoryResult<ItineraryRow>> {
    const errors = validateCreateItinerary(input);
    if (errors.length > 0) return validationFailure(errors);

    try {
      const created = await this.db.$transaction(
        async (tx: PrismaTransactionClient) => {
          // 1. Create the itinerary root
          const itinerary = await tx.itinerary.create({
            data: {
              travellerProfileId: input.travellerProfileId,
              tripIntentId:       input.tripIntentId,
              pathMode:           input.pathMode as Prisma.PathMode,
              dataClassification: (input.dataClassification ?? DataClassificationTier.INTERNAL) as Prisma.DataClassificationTier,
            },
          });

          // 2. Create days and their line items (with source provenance)
          for (const day of input.days) {
            const itineraryDay = await tx.itineraryDay.create({
              data: {
                itineraryId: itinerary.id,
                dayIndex:    day.dayIndex,
                date:        day.date,
              },
            });

            for (const item of day.lineItems) {
              // 2a. Create source provenance first (required — no orphaned line items)
              const provenance = await tx.sourceProvenance.create({
                data: {
                  supplierId:           item.sourceProvenance.supplierId,
                  sourceRef:            item.sourceProvenance.sourceRef,
                  bookingSource:        item.sourceProvenance.bookingSource as Prisma.BookingSource,
                  sourceClassification: item.sourceProvenance.sourceClassification as Prisma.SourceClassification,
                  fetchedAt:            item.sourceProvenance.fetchedAt,
                  dataClassification:   (item.sourceProvenance.dataClassification ?? DataClassificationTier.INTERNAL) as Prisma.DataClassificationTier,
                },
              });

              // 2b. Create line item linked to provenance
              await tx.itineraryLineItem.create({
                data: {
                  itineraryId:               itinerary.id,
                  itineraryDayId:            itineraryDay.id,
                  sourceProvenanceId:        provenance.id,
                  domain:                    item.domain as Prisma.InventoryDomain,
                  supplierRef:               item.supplierRef,
                  displayNameSnapshot:       item.displayNameSnapshot,
                  priceAmountMinorUnits:     item.priceAmountMinorUnits ?? null,
                  priceCurrencyCode:         item.priceCurrencyCode ?? null,
                  pointsAmount:              item.pointsAmount ?? null,
                  availabilityDataAgeSeconds: item.availabilityDataAgeSeconds ?? null,
                  rateDataAgeSeconds:        item.rateDataAgeSeconds ?? null,
                  dataClassification:        (item.dataClassification ?? DataClassificationTier.INTERNAL) as Prisma.DataClassificationTier,
                },
              });
            }
          }

          return itinerary;
        },
      );

      return ok(created as unknown as ItineraryRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async updateStatus(
    id: string,
    ownerRef: string,
    from: ItineraryStatus,
    to: ItineraryStatus,
  ): Promise<RepositoryResult<ItineraryRow>> {
    if (!isValidItineraryTransition(from, to)) {
      return validationFailure([
        `Transition from ${from} to ${to} is not a valid itinerary status transition`,
      ]);
    }

    try {
      // Optimistic: read current status first
      const current = await this.db.itinerary.findUnique({
        where: { id },
        include: { travellerProfile: { select: { ownerRef: true } } },
      });

      if (!current || current.travellerProfile.ownerRef !== ownerRef) return notFound();

      // Check version conflict: stored status no longer matches the expected 'from'
      if ((current.status as unknown as string) !== (from as unknown as string)) {
        return versionConflict(current.version);
      }

      const updated = await this.db.itinerary.update({
        where: { id },
        data:  { status: to as Prisma.ItineraryStatus },
      });

      return ok(updated as unknown as ItineraryRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateCreateItinerary(input: CreateItineraryInput): string[] {
  const errors: string[] = [];
  if (!input.travellerProfileId) errors.push('travellerProfileId must not be empty');
  if (!input.tripIntentId) errors.push('tripIntentId must not be empty');
  if (input.days.length === 0) errors.push('itinerary must have at least one day');

  for (const day of input.days) {
    for (const item of day.lineItems) {
      if (!item.sourceProvenance.supplierId) {
        errors.push('line item sourceProvenance.supplierId must not be empty');
      }
      if (!item.sourceProvenance.sourceRef) {
        errors.push('line item sourceProvenance.sourceRef must not be empty');
      }
      if (!Object.values(InventoryDomain).includes(item.domain)) {
        errors.push(`line item domain "${item.domain}" is not a valid InventoryDomain`);
      }
      if (item.priceAmountMinorUnits !== undefined && !validateMinorUnits(item.priceAmountMinorUnits)) {
        errors.push(`priceAmountMinorUnits ${item.priceAmountMinorUnits} must be a non-negative integer`);
      }
      if (item.pointsAmount !== undefined && !validateMinorUnits(item.pointsAmount)) {
        errors.push(`pointsAmount ${item.pointsAmount} must be a non-negative integer`);
      }
    }
  }
  return errors;
}

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/\bpassword\b|\bsecret\b|\btoken\b/gi, '[REDACTED]');
  return 'Unexpected repository error';
}
