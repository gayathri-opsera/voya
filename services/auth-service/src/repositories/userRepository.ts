import type { DbClient } from "../db/types.js";
import type { User, CreateUserInput } from "../models/user.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class UserConflictError extends Error {
  constructor(email: string) {
    super(`User with email "${email}" already exists`);
    this.name = "UserConflictError";
  }
}

export class UserNotFoundError extends Error {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`);
    this.name = "UserNotFoundError";
  }
}

export function createUserRepository(db: DbClient) {
  return {
    async create(input: CreateUserInput): Promise<User> {
      const normalizedEmail = normalizeEmail(input.email);
      try {
        const user = await db.user.create({
          data: {
            email: normalizedEmail,
            displayName: input.displayName ?? null,
            status: input.status ?? "pending",
          },
        });
        return mapUser(user);
      } catch (err: unknown) {
        if (isUniqueViolation(err)) {
          throw new UserConflictError(normalizedEmail);
        }
        throw err;
      }
    },

    async findById(id: string): Promise<User | null> {
      const user = await db.user.findUnique({ where: { id } });
      return user ? mapUser(user) : null;
    },

    async findByEmail(email: string): Promise<User | null> {
      const normalizedEmail = normalizeEmail(email);
      const user = await db.user.findUnique({ where: { email: normalizedEmail } });
      return user ? mapUser(user) : null;
    },

    async updateStatus(id: string, status: User["status"]): Promise<User> {
      try {
        const user = await db.user.update({ where: { id }, data: { status } });
        return mapUser(user);
      } catch (err: unknown) {
        if (isRecordNotFound(err)) throw new UserNotFoundError(id);
        throw err;
      }
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapUser(raw: {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  displayName: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: raw.id,
    email: raw.email,
    emailVerifiedAt: raw.emailVerifiedAt,
    displayName: raw.displayName,
    status: raw.status as User["status"],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

function isRecordNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2025"
  );
}
