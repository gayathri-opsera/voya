/**
 * CredentialService — single responsibility for all password handling.
 *
 * Security properties:
 * - Argon2id with configurable cost (bcrypt fallback when native module unavailable)
 * - PHC-format stored hashes encoding algorithm + cost for future upgrades
 * - Constant-time verification for unknown users (dummy hash comparison)
 * - Password policy: length bounds, common-password block, email-local-part check
 * - Lockout: exponential backoff after N failures, persisted on credentials row
 * - NEVER logs plaintext passwords — all password arguments are stripped at call site
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { CredentialConfig } from "../config/credentialConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PolicyViolation {
  rule: "TOO_SHORT" | "TOO_LONG" | "COMMON_PASSWORD" | "CONTAINS_EMAIL_PART";
  message: string;
}

export type PolicyResult =
  | { valid: true }
  | { valid: false; violations: PolicyViolation[] };

export interface VerifyResult {
  valid: boolean;
  needsRehash: boolean;
}

export interface LockoutInfo {
  locked: boolean;
  lockedUntil: Date | null;
  retryAfterSeconds: number;
}

export class CredentialError extends Error {
  constructor(
    message: string,
    public readonly operational: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CredentialError";
  }
}

// ─── Common password list ─────────────────────────────────────────────────────

let _commonPasswords: Set<string> | null = null;

function loadCommonPasswords(overridePath?: string): Set<string> {
  if (_commonPasswords) return _commonPasswords;

  const defaultPath = join(__dirname, "../../tests/fixtures/passwords/common-passwords.txt");
  const filePath = overridePath ?? defaultPath;

  if (!existsSync(filePath)) {
    _commonPasswords = new Set<string>();
    return _commonPasswords;
  }

  const lines = readFileSync(filePath, "utf-8")
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);

  _commonPasswords = new Set(lines);
  return _commonPasswords;
}

// ─── Dummy hash for constant-time unknown-user verification ───────────────────

// Pre-computed at service init so unknown-user verification path takes ~same time
let _dummyHash: string | null = null;

async function getDummyHash(hash: (pwd: string) => Promise<string>): Promise<string> {
  if (!_dummyHash) {
    _dummyHash = await hash("__dummy__VoyaDummyConstantTimeHash42!");
  }
  return _dummyHash;
}

// ─── Hashing adapter ──────────────────────────────────────────────────────────

interface HashAdapter {
  hash(password: string, config: CredentialConfig): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
  needsRehash(hash: string, config: CredentialConfig): boolean;
  algorithm: "argon2id" | "bcrypt";
}

async function loadArgon2Adapter(): Promise<HashAdapter | null> {
  try {
    const argon2 = await import("argon2");
    return {
      algorithm: "argon2id" as const,
      async hash(password: string, config: CredentialConfig): Promise<string> {
        return argon2.hash(password, {
          type: argon2.argon2id,
          memoryCost: config.argon.memoryCost,
          timeCost: config.argon.timeCost,
          parallelism: config.argon.parallelism,
        });
      },
      async verify(password: string, storedHash: string): Promise<boolean> {
        try {
          return await argon2.verify(storedHash, password);
        } catch {
          return false;
        }
      },
      needsRehash(storedHash: string, config: CredentialConfig): boolean {
        try {
          return argon2.needsRehash(storedHash, {
            memoryCost: config.argon.memoryCost,
            timeCost: config.argon.timeCost,
            parallelism: config.argon.parallelism,
          });
        } catch {
          return true;
        }
      },
    };
  } catch {
    return null;
  }
}

async function loadBcryptAdapter(): Promise<HashAdapter | null> {
  try {
    const bcrypt = await import("bcrypt");
    const ROUNDS = 12;
    const storedRoundsPattern = /^\$2[ab]?\$(\d{2})\$/;

    return {
      algorithm: "bcrypt" as const,
      async hash(password: string): Promise<string> {
        return bcrypt.hash(password, ROUNDS);
      },
      async verify(password: string, storedHash: string): Promise<boolean> {
        try {
          return await bcrypt.compare(password, storedHash);
        } catch {
          return false;
        }
      },
      needsRehash(storedHash: string): boolean {
        const m = storedRoundsPattern.exec(storedHash);
        if (!m) return true;
        return parseInt(m[1], 10) < ROUNDS;
      },
    };
  } catch {
    return null;
  }
}

// ─── Service factory ──────────────────────────────────────────────────────────

export interface CredentialServiceDeps {
  config: CredentialConfig;
  /** Optional: credentials row updater for lockout persistence */
  credentialRepository?: {
    incrementFailedAttempts(credentialId: string, lockedUntil: Date | null): Promise<void>;
    resetFailedAttempts(credentialId: string): Promise<void>;
  };
  /** For testing: override the common passwords path */
  commonPasswordsPath?: string;
}

export interface CredentialService {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, storedHash: string): Promise<VerifyResult>;
  validatePasswordPolicy(password: string, userEmail: string): PolicyResult;
  isLocked(failedCount: number, lockedUntil: Date | null): LockoutInfo;
  computeLockoutExpiry(failedCount: number, threshold: number): Date | null;
  algorithm: "argon2id" | "bcrypt";
}

export async function createCredentialService(
  deps: CredentialServiceDeps,
): Promise<CredentialService> {
  const { config } = deps;

  // Load adapter with Argon2id → bcrypt fallback
  let adapter = await loadArgon2Adapter();
  if (!adapter) {
    process.stderr.write(
      "[auth] WARNING: argon2 native module unavailable, falling back to bcrypt\n",
    );
    adapter = await loadBcryptAdapter();
  }
  if (!adapter) {
    throw new CredentialError(
      "No hashing library available (tried argon2, bcrypt). " +
      "Install argon2 or bcrypt as a dependency.",
      false,
    );
  }

  const hashAdapter = adapter;
  const commonPasswords = loadCommonPasswords(deps.commonPasswordsPath);

  // Pre-compute dummy hash for constant-time unknown-user verification
  await getDummyHash((pwd) => hashAdapter.hash(pwd, config));

  return {
    algorithm: hashAdapter.algorithm,

    async hashPassword(password: string): Promise<string> {
      if (password.length > config.maxPasswordLength) {
        throw new CredentialError("Password exceeds maximum length", false);
      }
      try {
        return await hashAdapter.hash(password, config);
      } catch (err) {
        throw new CredentialError("Hashing failed", true, err);
      }
    },

    async verifyPassword(password: string, storedHash: string): Promise<VerifyResult> {
      if (!storedHash) {
        // Unknown user — run dummy comparison for constant-time behavior
        const dummyHash = await getDummyHash((pwd) => hashAdapter.hash(pwd, config));
        await hashAdapter.verify(password, dummyHash);
        return { valid: false, needsRehash: false };
      }

      try {
        const valid = await hashAdapter.verify(password, storedHash);
        const needsRehash = valid && hashAdapter.needsRehash(storedHash, config);
        return { valid, needsRehash };
      } catch {
        // Corrupted or unrecognized hash format — log and return invalid
        process.stderr.write(
          "[auth] ERROR: could not verify hash — unknown or corrupted format. " +
          "Treat as invalid and investigate.\n",
        );
        return { valid: false, needsRehash: false };
      }
    },

    validatePasswordPolicy(password: string, userEmail: string): PolicyResult {
      const violations: PolicyViolation[] = [];

      if (password.length < config.minPasswordLength) {
        violations.push({
          rule: "TOO_SHORT",
          message: `Password must be at least ${config.minPasswordLength} characters`,
        });
      }

      if (password.length > config.maxPasswordLength) {
        violations.push({
          rule: "TOO_LONG",
          message: `Password must not exceed ${config.maxPasswordLength} characters`,
        });
      }

      if (commonPasswords.has(password.toLowerCase())) {
        violations.push({
          rule: "COMMON_PASSWORD",
          message: "This password is too common. Please choose a more unique password.",
        });
      }

      const emailLocalPart = userEmail.split("@")[0]?.toLowerCase() ?? "";
      if (emailLocalPart && password.toLowerCase().includes(emailLocalPart)) {
        violations.push({
          rule: "CONTAINS_EMAIL_PART",
          message: "Password must not contain part of your email address.",
        });
      }

      return violations.length === 0 ? { valid: true } : { valid: false, violations };
    },

    isLocked(failedCount: number, lockedUntil: Date | null): LockoutInfo {
      if (!lockedUntil || lockedUntil <= new Date()) {
        return { locked: false, lockedUntil: null, retryAfterSeconds: 0 };
      }
      const retryAfterSeconds = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
      return { locked: true, lockedUntil, retryAfterSeconds };
    },

    computeLockoutExpiry(failedCount: number, threshold: number): Date | null {
      if (failedCount < threshold) return null;
      const excessFailures = failedCount - threshold;
      const delaySeconds = Math.min(
        config.lockoutBaseSeconds * Math.pow(2, excessFailures),
        config.lockoutMaxSeconds,
      );
      return new Date(Date.now() + delaySeconds * 1000);
    },
  };
}
