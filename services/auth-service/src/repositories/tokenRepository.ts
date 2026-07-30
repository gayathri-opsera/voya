/**
 * In-memory TokenStore for tests; real production implementation would
 * use the DbClient / Prisma delegate.
 */

import type { TokenStore, TokenRow, CreateTokenInput, TokenPurpose } from "../services/tokenService.js";

let idSeq = 0;

export class InMemoryTokenStore implements TokenStore {
  private readonly store = new Map<string, TokenRow>();

  async create(input: CreateTokenInput & { tokenHash: string }): Promise<TokenRow> {
    const id = `token_${++idSeq}`;
    const row: TokenRow = {
      id,
      userId: input.userId,
      purpose: input.purpose,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      consumedAt: null,
      createdAt: new Date(),
    };
    this.store.set(id, row);
    return row;
  }

  async findByHash(hash: string): Promise<TokenRow | null> {
    for (const row of this.store.values()) {
      if (row.tokenHash === hash) return row;
    }
    return null;
  }

  async markConsumed(id: string): Promise<boolean> {
    const row = this.store.get(id);
    if (!row || row.consumedAt !== null) return false;
    row.consumedAt = new Date();
    return true;
  }

  async invalidateAllForUser(userId: string, purpose: TokenPurpose): Promise<void> {
    for (const row of this.store.values()) {
      if (row.userId === userId && row.purpose === purpose && row.consumedAt === null) {
        row.consumedAt = new Date();
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}
