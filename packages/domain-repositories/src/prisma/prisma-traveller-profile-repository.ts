/**
 * Prisma-backed TravellerProfileRepository implementation.
 *
 * PrismaClient is injected via constructor; callers may pass a transaction
 * client (Prisma.$transaction callback argument) to compose multiple writes
 * in one atomic operation.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import { TravellerIdentityType, DataClassificationTier } from '@voya/domain-model';
import { ok, notFound, validationFailure, repoError } from '../result.js';
import type { RepositoryResult } from '../result.js';
import type {
  TravellerProfileRow,
  CreateTravellerProfileInput,
  TravellerProfileRepository,
} from '../interfaces/traveller-profile-repository.js';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class PrismaTravellerProfileRepository implements TravellerProfileRepository {
  constructor(private readonly db: PrismaClient | PrismaTransactionClient) {}

  async findByOwnerRef(ownerRef: string): Promise<RepositoryResult<TravellerProfileRow>> {
    if (!ownerRef) return validationFailure(['ownerRef must not be empty']);
    try {
      const row = await (this.db as PrismaClient).travellerProfile.findUnique({
        where: { ownerRef },
      });
      if (!row) return notFound();
      return ok(row as TravellerProfileRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async findById(id: string, ownerRef: string): Promise<RepositoryResult<TravellerProfileRow>> {
    if (!id) return validationFailure(['id must not be empty']);
    try {
      const row = await (this.db as PrismaClient).travellerProfile.findUnique({
        where: { id },
      });
      // Ownership check: treat mismatch as not-found to avoid resource enumeration
      if (!row || row.ownerRef !== ownerRef) return notFound();
      return ok(row as TravellerProfileRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async create(
    input: CreateTravellerProfileInput,
  ): Promise<RepositoryResult<TravellerProfileRow>> {
    const errors = validateCreateProfile(input);
    if (errors.length > 0) return validationFailure(errors);
    try {
      const row = await (this.db as PrismaClient).travellerProfile.create({
        data: {
          ownerRef:           input.ownerRef,
          identityType:       input.identityType as Prisma.TravellerIdentityType,
          dataClassification: (input.dataClassification ?? DataClassificationTier.CONFIDENTIAL) as Prisma.DataClassificationTier,
        },
      });
      return ok(row as TravellerProfileRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateCreateProfile(input: CreateTravellerProfileInput): string[] {
  const errors: string[] = [];
  if (!input.ownerRef || input.ownerRef.trim() === '') {
    errors.push('ownerRef must not be empty');
  }
  if (!Object.values(TravellerIdentityType).includes(input.identityType)) {
    errors.push(`identityType "${input.identityType}" is not a valid TravellerIdentityType`);
  }
  return errors;
}

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/\bpassword\b|\bsecret\b|\btoken\b/gi, '[REDACTED]');
  return 'Unexpected repository error';
}
