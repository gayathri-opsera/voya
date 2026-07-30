/**
 * PrismaClient singleton factory.
 * Import this only from application entry points, not from domain/repository code.
 * Repositories accept the DbClient interface (src/db/types.ts) for testability.
 */

// Dynamic import avoids binding the Prisma generated client at module load time.
// This keeps the tests fast and offline — they never load this file.
let _client: unknown = null;

export async function getPrismaClient(): Promise<unknown> {
  if (!_client) {
    const { PrismaClient } = await import("@prisma/client");
    _client = new PrismaClient({
      log: process.env["NODE_ENV"] === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
    });
  }
  return _client;
}

export async function disconnectPrisma(): Promise<void> {
  if (_client) {
    await ((_client as { $disconnect: () => Promise<void> }).$disconnect());
    _client = null;
  }
}
