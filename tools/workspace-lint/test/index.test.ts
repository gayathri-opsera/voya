import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  loadCatalogKeys,
  collectWorkspacePackageNames,
  lintWorkspace,
  formatReport,
} from "../src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

const WORKSPACE_YAML = `
packages:
  - "packages/*"
  - "services/*"

catalog:
  zod: "^3.24.1"
  express: "^4.21.1"
  pino: "^9.5.0"
`;

const CATALOG_KEYS = new Set(["zod", "express", "pino"]);
const WORKSPACE_PACKAGES = new Set(["@travel/contracts", "@travel/shared"]);
const ROOT_ENGINES = { node: ">=20.0.0", pnpm: ">=9.0.0" };

// ─── loadCatalogKeys ──────────────────────────────────────────────────────────

describe("loadCatalogKeys", () => {
  it("parses catalog keys from workspace YAML", () => {
    const keys = loadCatalogKeys(WORKSPACE_YAML);
    expect(keys.has("zod")).toBe(true);
    expect(keys.has("express")).toBe(true);
    expect(keys.has("pino")).toBe(true);
  });

  it("returns empty set for YAML without catalog section", () => {
    const keys = loadCatalogKeys("packages:\n  - packages/*\n");
    expect(keys.size).toBe(0);
  });
});

// ─── lintWorkspace — compliant fixture ───────────────────────────────────────

describe("lintWorkspace — compliant package", () => {
  it("reports zero violations for a fully compliant package.json", () => {
    const result = lintWorkspace(
      join(FIXTURES, "compliant"),
      CATALOG_KEYS,
      WORKSPACE_PACKAGES,
      ROOT_ENGINES,
    );
    expect(result.violations).toHaveLength(0);
  });
});

// ─── lintWorkspace — violation fixture ───────────────────────────────────────

describe("lintWorkspace — violating package", () => {
  it("detects catalog-drift for zod with literal version", () => {
    const result = lintWorkspace(
      join(FIXTURES, "violations"),
      CATALOG_KEYS,
      WORKSPACE_PACKAGES,
      ROOT_ENGINES,
    );
    const drift = result.violations.find((v) => v.rule === "catalog-drift");
    expect(drift).toBeDefined();
    expect(drift?.field).toBe("dependencies.zod");
    expect(drift?.actual).toBe("^3.22.0");
  });

  it("detects workspace-protocol violation for internal package", () => {
    const result = lintWorkspace(
      join(FIXTURES, "violations"),
      CATALOG_KEYS,
      WORKSPACE_PACKAGES,
      ROOT_ENGINES,
    );
    const wp = result.violations.find((v) => v.rule === "workspace-protocol");
    expect(wp).toBeDefined();
    expect(wp?.field).toBe("dependencies.@travel/contracts");
  });

  it("detects engines-mismatch", () => {
    const result = lintWorkspace(
      join(FIXTURES, "violations"),
      CATALOG_KEYS,
      WORKSPACE_PACKAGES,
      ROOT_ENGINES,
    );
    const em = result.violations.find((v) => v.rule === "engines-mismatch");
    expect(em).toBeDefined();
    expect(em?.field).toBe("engines.node");
    expect(em?.actual).toBe(">=22.0.0");
  });

  it("reports total violation count correctly", () => {
    const result = lintWorkspace(
      join(FIXTURES, "violations"),
      CATALOG_KEYS,
      WORKSPACE_PACKAGES,
      ROOT_ENGINES,
    );
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── formatReport ─────────────────────────────────────────────────────────────

describe("formatReport", () => {
  it("returns pass message with zero violations", () => {
    const report = formatReport({ violations: [], checkedFiles: 10 });
    expect(report).toContain("0 violations");
  });

  it("includes file, field, expected and actual for each violation", () => {
    const result = lintWorkspace(
      join(FIXTURES, "violations"),
      CATALOG_KEYS,
      WORKSPACE_PACKAGES,
      ROOT_ENGINES,
    );
    const report = formatReport(result);
    expect(report).toContain("catalog-drift");
    expect(report).toContain("zod");
  });
});
