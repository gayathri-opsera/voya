/**
 * Prisma-backed TripIntentRepository implementation.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import { DataClassificationTier } from '@voya/domain-model';
import { ok, notFound, validationFailure, repoError } from '../result.js';
import type { RepositoryResult } from '../result.js';
import type {
  TripIntentRow,
  CreateTripIntentInput,
  TripIntentRepository,
} from '../interfaces/trip-intent-repository.js';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class PrismaTripIntentRepository implements TripIntentRepository {
  constructor(private readonly db: PrismaClient | PrismaTransactionClient) {}

  async findById(id: string, ownerRef: string): Promise<RepositoryResult<TripIntentRow>> {
    if (!id) return validationFailure(['id must not be empty']);
    try {
      const row = await (this.db as PrismaClient).tripIntent.findUnique({
        where: { id },
        include: { travellerProfile: { select: { ownerRef: true } } },
      });
      if (!row || row.travellerProfile.ownerRef !== ownerRef) return notFound();
      return ok(row as unknown as TripIntentRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async findByTravellerId(
    travellerProfileId: string,
    ownerRef: string,
  ): Promise<RepositoryResult<TripIntentRow[]>> {
    if (!travellerProfileId) return validationFailure(['travellerProfileId must not be empty']);
    try {
      const profile = await (this.db as PrismaClient).travellerProfile.findUnique({
        where: { id: travellerProfileId },
        select: { ownerRef: true },
      });
      if (!profile || profile.ownerRef !== ownerRef) return notFound();

      const rows = await (this.db as PrismaClient).tripIntent.findMany({
        where: { travellerProfileId },
        orderBy: { createdAt: 'desc' },
      });
      return ok(rows as unknown as TripIntentRow[]);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async create(input: CreateTripIntentInput): Promise<RepositoryResult<TripIntentRow>> {
    const errors = validateCreateTripIntent(input);
    if (errors.length > 0) return validationFailure(errors);
    try {
      const row = await (this.db as PrismaClient).tripIntent.create({
        data: {
          travellerProfileId: input.travellerProfileId,
          sessionId:          input.sessionId ?? null,
          pathMode:           input.pathMode as Prisma.PathMode,
          rawConstraintsJson: input.rawConstraintsJson,
          destinationToken:   input.destinationToken,
          checkInDate:        input.checkInDate,
          checkOutDate:       input.checkOutDate,
          partySize:          input.partySize,
          budgetBandCode:     input.budgetBandCode ?? null,
          dataClassification: (input.dataClassification ?? DataClassificationTier.INTERNAL) as Prisma.DataClassificationTier,
        },
      });
      return ok(row as unknown as TripIntentRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }
}

function validateCreateTripIntent(input: CreateTripIntentInput): string[] {
  const errors: string[] = [];
  if (!input.travellerProfileId) errors.push('travellerProfileId must not be empty');
  if (!input.destinationToken || input.destinationToken.trim() === '') {
    errors.push('destinationToken must not be empty');
  }
  if (input.partySize < 1 || !Number.isInteger(input.partySize)) {
    errors.push('partySize must be a positive integer');
  }
  if (input.checkInDate >= input.checkOutDate) {
    errors.push('checkInDate must be before checkOutDate');
  }
  return errors;
}

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/\bpassword\b|\bsecret\b|\btoken\b/gi, '[REDACTED]');
  return 'Unexpected repository error';
}
