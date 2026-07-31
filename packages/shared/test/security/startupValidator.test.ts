import { describe, it, expect } from "vitest";
import { validateSecrets, requireSecrets } from "../../src/startupValidator.ts";

describe("StartupSecretValidator", () => {
  it("passes when all required secrets are present", () => {
    const result = validateSecrets(
      { DATABASE_URL: "postgres://localhost/db", JWT_SECRET: "very-long-secret-key-here" },
      [
        { key: "DATABASE_URL" },
        { key: "JWT_SECRET", minLength: 20 },
      ],
    );
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("reports missing secrets", () => {
    const result = validateSecrets(
      {},
      [{ key: "DATABASE_URL" }, { key: "JWT_SECRET" }],
    );
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("DATABASE_URL");
    expect(result.missing).toContain("JWT_SECRET");
  });

  it("reports secrets that are too short", () => {
    const result = validateSecrets(
      { JWT_SECRET: "short" },
      [{ key: "JWT_SECRET", minLength: 32 }],
    );
    expect(result.valid).toBe(false);
    expect(result.invalid.some((i) => i.includes("JWT_SECRET"))).toBe(true);
  });

  it("reports secrets that don't match pattern", () => {
    const result = validateSecrets(
      { API_KEY: "not-a-uuid" },
      [{ key: "API_KEY", pattern: /^[0-9a-f-]{36}$/ }],
    );
    expect(result.valid).toBe(false);
    expect(result.invalid.some((i) => i.includes("API_KEY"))).toBe(true);
  });

  it("requireSecrets calls exit(1) when validation fails", () => {
    const exitCalls: number[] = [];
    requireSecrets({}, [{ key: "MISSING_SECRET" }], (code) => {
      exitCalls.push(code as number);
    });
    expect(exitCalls).toContain(1);
  });

  it("requireSecrets does not exit when all secrets valid", () => {
    const exitCalls: number[] = [];
    requireSecrets(
      { MY_SECRET: "a-valid-secret-value" },
      [{ key: "MY_SECRET" }],
      (code) => { exitCalls.push(code as number); },
    );
    expect(exitCalls).toHaveLength(0);
  });
});
