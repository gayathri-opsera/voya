/**
 * Prisma-backed TripConfidenceReceiptRepository implementation.
 *
 * appendReceipt executes inside a transaction so receipt header and
 * line-item evidence rows are created atomically.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import { DataClassificationTier } from '@voya/domain-model';
import { ok, notFound, validationFailure, repoError } from '../result.js';
import type { RepositoryResult } from '../result.js';
import type {
  ReceiptRow,
  AppendReceiptInput,
  TripConfidenceReceiptRepository,
} from '../interfaces/trip-confidence-receipt-repository.js';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class PrismaTripConfidenceReceiptRepository
  implements TripConfidenceReceiptRepository
{
  constructor(private readonly db: PrismaClient) {}

  async appendReceipt(
    input: AppendReceiptInput,
    ownerRef: string,
  ): Promise<RepositoryResult<ReceiptRow>> {
    const errors = validateAppendReceipt(input);
    if (errors.length > 0) return validationFailure(errors);

    try {
      // Verify ownership before writing
      const itinerary = await this.db.itinerary.findUnique({
        where: { id: input.itineraryId },
        include: { travellerProfile: { select: { ownerRef: true } } },
      });
      if (!itinerary || itinerary.travellerProfile.ownerRef !== ownerRef) {
        return notFound();
      }

      const receipt = await this.db.$transaction(
        async (tx: PrismaTransactionClient) => {
          const row = await tx.tripConfidenceReceipt.create({
            data: {
              itineraryId:       input.itineraryId,
              itineraryVersion:  input.itineraryVersion,
              outcome:           input.outcome as Prisma.ReceiptOutcome,
              feasibilityPassed: input.feasibilityPassed,
              freshnessGrade:    input.freshnessGrade,
              blockedReasonCode: input.blockedReasonCode ?? null,
              evaluatedAt:       input.evaluatedAt,
              dataClassification: (input.dataClassification ?? DataClassificationTier.INTERNAL) as Prisma.DataClassificationTier,
            },
          });

          // Append line-item evidence rows
          for (const li of input.lineItems) {
            await tx.tripConfidenceReceiptLineItem.create({
              data: {
                receiptId:          row.id,
                lineItemId:         li.lineItemId,
                freshnessGrade:     li.freshnessGrade,
                isAvailabilityStale: li.isAvailabilityStale,
                isRateStale:        li.isRateStale,
              },
            });
          }

          return row;
        },
      );

      return ok(receipt as unknown as ReceiptRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async findLatestByItineraryId(
    itineraryId: string,
    ownerRef: string,
  ): Promise<RepositoryResult<ReceiptRow | null>> {
    try {
      const itinerary = await this.db.itinerary.findUnique({
        where: { id: itineraryId },
        include: { travellerProfile: { select: { ownerRef: true } } },
      });
      if (!itinerary || itinerary.travellerProfile.ownerRef !== ownerRef) return notFound();

      const row = await this.db.tripConfidenceReceipt.findFirst({
        where:   { itineraryId },
        orderBy: { createdAt: 'desc' },
      });

      return ok((row ?? null) as unknown as ReceiptRow | null);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async findByItineraryId(
    itineraryId: string,
    ownerRef: string,
  ): Promise<RepositoryResult<ReceiptRow[]>> {
    try {
      const itinerary = await this.db.itinerary.findUnique({
        where: { id: itineraryId },
        include: { travellerProfile: { select: { ownerRef: true } } },
      });
      if (!itinerary || itinerary.travellerProfile.ownerRef !== ownerRef) return notFound();

      const rows = await this.db.tripConfidenceReceipt.findMany({
        where:   { itineraryId },
        orderBy: { createdAt: 'asc' },
      });

      return ok(rows as unknown as ReceiptRow[]);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateAppendReceipt(input: AppendReceiptInput): string[] {
  const errors: string[] = [];
  if (!input.itineraryId) errors.push('itineraryId must not be empty');
  if (input.itineraryVersion < 1) errors.push('itineraryVersion must be a positive integer');
  if (!input.freshnessGrade) errors.push('freshnessGrade must not be empty');
  if (input.outcome === 'PASS' && input.lineItems.length === 0) {
    errors.push('A PASS receipt must include at least one line-item evidence row');
  }
  return errors;
}

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/\bpassword\b|\bsecret\b|\btoken\b/gi, '[REDACTED]');
  return 'Unexpected repository error';
}
