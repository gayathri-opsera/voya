/**
 * Credential hashing configuration.
 * Production floors are enforced — test environments can use lower cost.
 * Never lower the production values without a documented security review.
 */

export interface ArgonCostParams {
  /** Memory cost in KiB. Minimum production floor: 65536 (64 MiB) */
  memoryCost: number;
  /** Time cost (iterations). Minimum production floor: 3 */
  timeCost: number;
  /** Parallelism (degree of parallel threads). */
  parallelism: number;
}

export interface CredentialConfig {
  argon: ArgonCostParams;
  /** Max consecutive failed attempts before lockout */
  lockoutThreshold: number;
  /** Base lockout duration in seconds. Doubles with each additional failure. */
  lockoutBaseSeconds: number;
  /** Maximum lockout cap in seconds (default: 24 hours) */
  lockoutMaxSeconds: number;
  /** Path to common-passwords file (newline-delimited) */
  commonPasswordsPath?: string;
  /** Minimum password length */
  minPasswordLength: number;
  /** Maximum password length (prevents DoS on hash computation) */
  maxPasswordLength: number;
}

const PRODUCTION_FLOOR: ArgonCostParams = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

const TEST_PARAMS: ArgonCostParams = {
  memoryCost: 1024,
  timeCost: 1,
  parallelism: 1,
};

export function loadCredentialConfig(): CredentialConfig {
  const isTest = process.env["NODE_ENV"] === "test";

  const rawMemory = parseInt(process.env["ARGON_MEMORY_COST"] ?? "0", 10);
  const rawTime = parseInt(process.env["ARGON_TIME_COST"] ?? "0", 10);
  const rawParallel = parseInt(process.env["ARGON_PARALLELISM"] ?? "0", 10);

  const argon: ArgonCostParams = isTest
    ? TEST_PARAMS
    : {
        memoryCost: rawMemory >= PRODUCTION_FLOOR.memoryCost ? rawMemory : PRODUCTION_FLOOR.memoryCost,
        timeCost: rawTime >= PRODUCTION_FLOOR.timeCost ? rawTime : PRODUCTION_FLOOR.timeCost,
        parallelism: rawParallel > 0 ? rawParallel : PRODUCTION_FLOOR.parallelism,
      };

  return {
    argon,
    lockoutThreshold: parseInt(process.env["LOCKOUT_THRESHOLD"] ?? "5", 10),
    lockoutBaseSeconds: parseInt(process.env["LOCKOUT_BASE_SECONDS"] ?? "30", 10),
    lockoutMaxSeconds: parseInt(process.env["LOCKOUT_MAX_SECONDS"] ?? "86400", 10),
    minPasswordLength: 12,
    maxPasswordLength: 128,
  };
}
