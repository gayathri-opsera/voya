/**
 * Prisma-backed SupplierManifestRepository implementation.
 */

import type { PrismaClient } from '@prisma/client';
import { InventoryDomain } from '@voya/domain-model';
import { ok, notFound, validationFailure, repoError } from '../result.js';
import type { RepositoryResult } from '../result.js';
import type {
  SupplierManifestRow,
  SupplierManifestRepository,
} from '../interfaces/supplier-manifest-repository.js';

export class PrismaSupplierManifestRepository implements SupplierManifestRepository {
  constructor(private readonly db: PrismaClient) {}

  async findBySupplierId(supplierId: string): Promise<RepositoryResult<SupplierManifestRow>> {
    if (!supplierId) return validationFailure(['supplierId must not be empty']);
    try {
      const row = await this.db.supplierCapabilityManifest.findUnique({
        where: { supplierId },
      });
      if (!row) return notFound();
      return ok(row as unknown as SupplierManifestRow);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async findCertifiedByDomain(
    domain: InventoryDomain,
  ): Promise<RepositoryResult<SupplierManifestRow[]>> {
    if (!Object.values(InventoryDomain).includes(domain)) {
      return validationFailure([`"${domain}" is not a valid InventoryDomain`]);
    }
    try {
      const rows = await this.db.supplierCapabilityManifest.findMany({
        where: {
          domain:              domain as never,
          certificationStatus: 'CERTIFIED',
        },
        orderBy: { supplierId: 'asc' },
      });
      return ok(rows as unknown as SupplierManifestRow[]);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async findFullyBookable(): Promise<RepositoryResult<SupplierManifestRow[]>> {
    try {
      const rows = await this.db.supplierCapabilityManifest.findMany({
        where: {
          bookabilityMode:     'FULLY_BOOKABLE',
          certificationStatus: 'CERTIFIED',
        },
        orderBy: { supplierId: 'asc' },
      });
      return ok(rows as unknown as SupplierManifestRow[]);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }

  async findByFreshnessWindow(
    maxAvailabilityLatencySeconds: number,
  ): Promise<RepositoryResult<SupplierManifestRow[]>> {
    if (!Number.isInteger(maxAvailabilityLatencySeconds) || maxAvailabilityLatencySeconds <= 0) {
      return validationFailure(['maxAvailabilityLatencySeconds must be a positive integer']);
    }
    try {
      const rows = await this.db.supplierCapabilityManifest.findMany({
        where: {
          availabilityRefreshLatencySeconds: { lte: maxAvailabilityLatencySeconds },
        },
        orderBy: { availabilityRefreshLatencySeconds: 'asc' },
      });
      return ok(rows as unknown as SupplierManifestRow[]);
    } catch (err) {
      return repoError(safeMessage(err));
    }
  }
}

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/\bpassword\b|\bsecret\b|\btoken\b/gi, '[REDACTED]');
  return 'Unexpected repository error';
}
