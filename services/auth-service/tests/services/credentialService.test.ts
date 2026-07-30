import { describe, it, expect, beforeEach } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createCredentialService,
  CredentialError,
  type CredentialService,
  type PolicyResult,
} from "../../src/services/credentialService.js";
import { loadCredentialConfig } from "../../src/config/credentialConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../fixtures/passwords");

// Use low-cost config for fast tests
const TEST_CONFIG = {
  ...loadCredentialConfig(),
};

async function makeService(): Promise<CredentialService> {
  return createCredentialService({
    config: TEST_CONFIG,
    commonPasswordsPath: join(FIXTURES_DIR, "common-passwords.txt"),
  });
}

// ─── hashPassword ─────────────────────────────────────────────────────────────

describe("hashPassword", () => {
  let svc: CredentialService;

  beforeEach(async () => { svc = await makeService(); });

  it("produces a non-empty hash string", async () => {
    const hash = await svc.hashPassword("SecureP@ssw0rd1!");
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("produces different hashes for the same password (salted)", async () => {
    const h1 = await svc.hashPassword("SecureP@ssw0rd1!");
    const h2 = await svc.hashPassword("SecureP@ssw0rd1!");
    expect(h1).not.toBe(h2);
  });

  it("throws CredentialError when password exceeds max length", async () => {
    const tooLong = "a".repeat(129);
    await expect(svc.hashPassword(tooLong)).rejects.toThrow(CredentialError);
  });
});

// ─── verifyPassword ───────────────────────────────────────────────────────────

describe("verifyPassword", () => {
  let svc: CredentialService;

  beforeEach(async () => { svc = await makeService(); });

  it("returns valid=true for correct password", async () => {
    const password = "ValidP@ss1234!";
    const hash = await svc.hashPassword(password);
    const result = await svc.verifyPassword(password, hash);
    expect(result.valid).toBe(true);
  });

  it("returns valid=false for wrong password", async () => {
    const hash = await svc.hashPassword("correct-password-XYZ99!");
    const result = await svc.verifyPassword("wrong-password", hash);
    expect(result.valid).toBe(false);
  });

  it("returns valid=false for empty stored hash (unknown user path)", async () => {
    const result = await svc.verifyPassword("anyPassword1!", "");
    expect(result.valid).toBe(false);
    expect(result.needsRehash).toBe(false);
  });

  it("returns needsRehash=false for fresh hashes with current params", async () => {
    const password = "FreshHashP@ss1!";
    const hash = await svc.hashPassword(password);
    const result = await svc.verifyPassword(password, hash);
    expect(result.needsRehash).toBe(false);
  });
});

// ─── validatePasswordPolicy ───────────────────────────────────────────────────

describe("validatePasswordPolicy — valid password", () => {
  let svc: CredentialService;

  beforeEach(async () => { svc = await makeService(); });

  it("accepts a strong password", () => {
    const result = svc.validatePasswordPolicy("Tr0ub4dor&3!xYz", "alice@voya.test");
    expect(result.valid).toBe(true);
  });

  it("accepts the minimum-length boundary (12 chars)", () => {
    const result = svc.validatePasswordPolicy("Aa1!xxxxxxxx", "alice@voya.test");
    expect(result.valid).toBe(true);
  });

  it("accepts exactly 128 characters", () => {
    const valid128 = "A1!" + "x".repeat(125);
    const result = svc.validatePasswordPolicy(valid128, "alice@voya.test");
    expect(result.valid).toBe(true);
  });
});

describe("validatePasswordPolicy — too short", () => {
  let svc: CredentialService;

  beforeEach(async () => { svc = await makeService(); });

  it("rejects 11 characters", () => {
    const result = svc.validatePasswordPolicy("Short1!Abcd", "alice@voya.test");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations.some((v) => v.rule === "TOO_SHORT")).toBe(true);
    }
  });

  it("rejects empty password", () => {
    const result = svc.validatePasswordPolicy("", "alice@voya.test");
    expect(result.valid).toBe(false);
  });
});

describe("validatePasswordPolicy — too long", () => {
  let svc: CredentialService;

  beforeEach(async () => { svc = await makeService(); });

  it("rejects 129 characters", () => {
    const tooLong = "A1!" + "x".repeat(126);
    const result = svc.validatePasswordPolicy(tooLong, "alice@voya.test");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations.some((v) => v.rule === "TOO_LONG")).toBe(true);
    }
  });
});

describe("validatePasswordPolicy — common passwords", () => {
  let svc: CredentialService;

  beforeEach(async () => { svc = await makeService(); });

  it("rejects 'password123' (in common list)", () => {
    const result = svc.validatePasswordPolicy("password123", "alice@voya.test");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations.some((v) => v.rule === "COMMON_PASSWORD")).toBe(true);
    }
  });

  it("rejects common password case-insensitively", () => {
    const result = svc.validatePasswordPolicy("PASSWORD123", "alice@voya.test");
    expect(result.valid).toBe(false);
  });
});

describe("validatePasswordPolicy — email containment", () => {
  let svc: CredentialService;

  beforeEach(async () => { svc = await makeService(); });

  it("rejects password containing email local part", () => {
    const result = svc.validatePasswordPolicy("alice!VoyaPass99", "alice@voya.test");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violations.some((v) => v.rule === "CONTAINS_EMAIL_PART")).toBe(true);
    }
  });

  it("rejects password containing email local part case-insensitively", () => {
    const result = svc.validatePasswordPolicy("ALICE!VoyaPass99", "alice@voya.test");
    expect(result.valid).toBe(false);
  });

  it("accepts password that does not contain email local part", () => {
    const result = svc.validatePasswordPolicy("Tr0ub4dor&3!xYz", "alice@voya.test");
    expect(result.valid).toBe(true);
  });
});

// ─── isLocked / computeLockoutExpiry ─────────────────────────────────────────

describe("isLocked", () => {
  let svc: CredentialService;

  beforeEach(async () => { svc = await makeService(); });

  it("returns locked=false when lockedUntil is null", () => {
    const info = svc.isLocked(3, null);
    expect(info.locked).toBe(false);
  });

  it("returns locked=false when lockedUntil is in the past", () => {
    const past = new Date(Date.now() - 1000);
    const info = svc.isLocked(5, past);
    expect(info.locked).toBe(false);
  });

  it("returns locked=true when lockedUntil is in the future", () => {
    const future = new Date(Date.now() + 60_000);
    const info = svc.isLocked(5, future);
    expect(info.locked).toBe(true);
    expect(info.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("computeLockoutExpiry", () => {
  let svc: CredentialService;

  beforeEach(async () => { svc = await makeService(); });

  it("returns null when failedCount is below threshold", () => {
    expect(svc.computeLockoutExpiry(4, 5)).toBeNull();
    expect(svc.computeLockoutExpiry(0, 5)).toBeNull();
  });

  it("returns expiry at threshold (base delay)", () => {
    const expiry = svc.computeLockoutExpiry(5, 5);
    expect(expiry).not.toBeNull();
    const secondsFromNow = (expiry!.getTime() - Date.now()) / 1000;
    // base = 30s, excess = 0, delay = 30 * 2^0 = 30
    expect(secondsFromNow).toBeGreaterThan(28);
    expect(secondsFromNow).toBeLessThan(35);
  });

  it("doubles the delay for each additional failure (exponential backoff)", () => {
    const at5 = svc.computeLockoutExpiry(5, 5)!;
    const at6 = svc.computeLockoutExpiry(6, 5)!;
    const delay5 = at5.getTime() - Date.now();
    const delay6 = at6.getTime() - Date.now();
    // delay6 ≈ 2 * delay5
    expect(delay6 / delay5).toBeGreaterThan(1.8);
    expect(delay6 / delay5).toBeLessThan(2.3);
  });

  it("caps lockout at the maximum configured window", () => {
    // With default max of 86400s and base 30s: 30 * 2^N caps at 86400
    const expiry = svc.computeLockoutExpiry(100, 5)!;
    const secondsFromNow = (expiry.getTime() - Date.now()) / 1000;
    expect(secondsFromNow).toBeLessThanOrEqual(TEST_CONFIG.lockoutMaxSeconds + 1);
  });
});

// ─── Constant-time unknown-user path ─────────────────────────────────────────

describe("constant-time unknown user", () => {
  it("empty hash verification completes without throwing", async () => {
    const svc = await makeService();
    await expect(svc.verifyPassword("anything", "")).resolves.toMatchObject({
      valid: false,
    });
  });

  it("timing delta between known and unknown user is within tolerance", async () => {
    const svc = await makeService();
    const hash = await svc.hashPassword("KnownUserP@ss99!");

    // Warm-up round to avoid JIT/lazy-init skew
    await svc.verifyPassword("KnownUserP@ss99!", hash);
    await svc.verifyPassword("SomePassword99!", "");

    const ITERATIONS = 10;
    const knownTimes: number[] = [];
    const unknownTimes: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const t1 = performance.now();
      await svc.verifyPassword("KnownUserP@ss99!", hash);
      knownTimes.push(performance.now() - t1);

      const t2 = performance.now();
      await svc.verifyPassword("SomePassword99!", "");
      unknownTimes.push(performance.now() - t2);
    }

    // Use median to reduce impact of outliers
    const median = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
    };

    const knownMed = median(knownTimes);
    const unknownMed = median(unknownTimes);

    // Both medians must be > 0 (actual work happened)
    expect(knownMed).toBeGreaterThan(0);
    expect(unknownMed).toBeGreaterThan(0);

    // Relative difference must stay within 75% tolerance (generous for CI variation)
    const maxMed = Math.max(knownMed, unknownMed);
    const delta = Math.abs(knownMed - unknownMed) / maxMed;
    expect(delta).toBeLessThan(0.75);
  }, 30_000);
});
