import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SCHEMA_REGISTRY, REGISTRY_IDS } from "../src/registry.js";
import { classifyChange, requiresMajorBump } from "../src/compatibility/classifier.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINES_DIR = join(__dirname, "../contract-baselines");

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as object).sort()) {
      sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}

function generateBaseline(entry: (typeof SCHEMA_REGISTRY)[number]): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(entry.schema, {
    $refStrategy: "none",
    errorMessages: false,
  });
  return sortKeys(jsonSchema) as Record<string, unknown>;
}

function baselineFilePath(id: string): string {
  const filename = `${id.replace(/\./g, "__")}.json`;
  return join(BASELINES_DIR, filename);
}

// ─── Registry completeness ────────────────────────────────────────────────────

describe("Schema registry completeness", () => {
  it("has at least one entry for every domain", () => {
    const domains = new Set(SCHEMA_REGISTRY.map((e) => e.domain));
    expect(domains).toContain("search");
    expect(domains).toContain("booking");
    expect(domains).toContain("payment");
    expect(domains).toContain("auth");
    expect(domains).toContain("user");
    expect(domains).toContain("events");
    expect(domains).toContain("errors");
  });

  it("every registry ID is unique", () => {
    const ids = REGISTRY_IDS;
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("all key schemas are in the registry", () => {
    expect(REGISTRY_IDS).toContain("search.FlightSearchRequest");
    expect(REGISTRY_IDS).toContain("search.UnifiedOffer");
    expect(REGISTRY_IDS).toContain("booking.CreateBookingRequest");
    expect(REGISTRY_IDS).toContain("payment.PaymentIntentRequest");
    expect(REGISTRY_IDS).toContain("auth.RegisterRequest");
    expect(REGISTRY_IDS).toContain("events.BookingConfirmationEvent");
    expect(REGISTRY_IDS).toContain("errors.ErrorEnvelope");
  });
});

// ─── Baseline file existence ──────────────────────────────────────────────────

describe("JSON Schema baselines", () => {
  it("a baseline file exists for every registry entry", () => {
    for (const entry of SCHEMA_REGISTRY) {
      const path = baselineFilePath(entry.id);
      expect(existsSync(path), `Baseline missing for: ${entry.id}`).toBe(true);
    }
  });

  it("regenerated baselines match committed baselines (no drift)", () => {
    const drifted: string[] = [];

    for (const entry of SCHEMA_REGISTRY) {
      const path = baselineFilePath(entry.id);
      if (!existsSync(path)) {
        drifted.push(`${entry.id}: baseline file missing`);
        continue;
      }

      const committed = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
      const regenerated = generateBaseline(entry);

      if (JSON.stringify(committed) !== JSON.stringify(regenerated)) {
        drifted.push(
          `${entry.id}: committed baseline differs from generated schema. ` +
          `Review the change and re-run: npx tsx scripts/generate-baselines.ts`,
        );
      }
    }

    expect(drifted, `Schema drift detected:\n${drifted.join("\n")}`).toHaveLength(0);
  });
});

// ─── Additive-vs-breaking classifier ─────────────────────────────────────────

describe("classifyChange — no-op", () => {
  it("returns none when schemas are identical", () => {
    const schema = { type: "object", properties: { id: { type: "string" } } } as Record<string, unknown>;
    const result = classifyChange(schema, { ...schema }, false);
    expect(result.kind).toBe("none");
    expect(result.reasons).toHaveLength(0);
  });
});

describe("classifyChange — additive changes", () => {
  it("classifies a new optional property as additive", () => {
    const before = {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    } as Record<string, unknown>;

    const after = {
      type: "object",
      properties: { id: { type: "string" }, tag: { type: "string" } },
      required: ["id"],
    } as Record<string, unknown>;

    const result = classifyChange(before, after, false);
    expect(result.kind).toBe("additive");
    expect(result.reasons.some((r) => r.includes("tag"))).toBe(true);
    expect(requiresMajorBump(result)).toBe(false);
  });

  it("classifies a new enum member on a response schema as additive", () => {
    const before = { enum: ["PENDING", "CONFIRMED"] } as Record<string, unknown>;
    const after  = { enum: ["PENDING", "CONFIRMED", "EXPIRED"] } as Record<string, unknown>;
    const result = classifyChange(before, after, false);
    expect(result.kind).toBe("additive");
    expect(requiresMajorBump(result)).toBe(false);
  });

  it("classifies a field becoming optional as additive", () => {
    const before = { type: "object", properties: { id: {}, name: {} }, required: ["id", "name"] } as Record<string, unknown>;
    const after  = { type: "object", properties: { id: {}, name: {} }, required: ["id"] } as Record<string, unknown>;
    const result = classifyChange(before, after, false);
    expect(result.kind).toBe("additive");
    expect(requiresMajorBump(result)).toBe(false);
  });
});

describe("classifyChange — breaking changes", () => {
  it("classifies a removed property as breaking", () => {
    const before = {
      type: "object",
      properties: { id: { type: "string" }, name: { type: "string" } },
      required: ["id"],
    } as Record<string, unknown>;

    const after = {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    } as Record<string, unknown>;

    const result = classifyChange(before, after, false);
    expect(result.kind).toBe("breaking");
    expect(result.reasons.some((r) => r.includes("name"))).toBe(true);
    expect(requiresMajorBump(result)).toBe(true);
  });

  it("classifies a newly required field as breaking", () => {
    const before = { type: "object", properties: { id: {}, name: {} }, required: ["id"] } as Record<string, unknown>;
    const after  = { type: "object", properties: { id: {}, name: {} }, required: ["id", "name"] } as Record<string, unknown>;
    const result = classifyChange(before, after, false);
    expect(result.kind).toBe("breaking");
    expect(requiresMajorBump(result)).toBe(true);
  });

  it("classifies a removed enum member as breaking", () => {
    const before = { enum: ["A", "B", "C"] } as Record<string, unknown>;
    const after  = { enum: ["A", "B"] } as Record<string, unknown>;
    const result = classifyChange(before, after, true);
    expect(result.kind).toBe("breaking");
    expect(result.reasons.some((r) => r.includes("C"))).toBe(true);
    expect(requiresMajorBump(result)).toBe(true);
  });

  it("classifies a new enum member on a REQUEST schema as breaking", () => {
    const before = { enum: ["ECONOMY", "BUSINESS"] } as Record<string, unknown>;
    const after  = { enum: ["ECONOMY", "BUSINESS", "ULTRA"] } as Record<string, unknown>;
    const result = classifyChange(before, after, true); // isRequestSchema = true
    expect(result.kind).toBe("breaking");
    expect(requiresMajorBump(result)).toBe(true);
  });

  it("classifies a top-level type change as breaking", () => {
    const before = { type: "object" } as Record<string, unknown>;
    const after  = { type: "array" }  as Record<string, unknown>;
    const result = classifyChange(before, after, false);
    expect(result.kind).toBe("breaking");
  });
});

// ─── Deliberate breaking edit — gate verification ─────────────────────────────

describe("Gate verification: deliberate breaking edit", () => {
  it("detects removing a required field from FlightSearchRequest as breaking", () => {
    const flightEntry = SCHEMA_REGISTRY.find((e) => e.id === "search.FlightSearchRequest");
    expect(flightEntry).toBeDefined();

    const committed = generateBaseline(flightEntry!);
    const properties = (committed["properties"] as Record<string, unknown>) ?? {};

    // Simulate removing the required 'origin' field
    const { origin: _removed, ...propsWithoutOrigin } = properties;
    const mutated = {
      ...committed,
      properties: propsWithoutOrigin,
    };

    const result = classifyChange(
      committed as Record<string, unknown>,
      mutated as Record<string, unknown>,
      true,
    );
    expect(result.kind).toBe("breaking");
    expect(result.reasons.some((r) => r.includes("origin"))).toBe(true);
    expect(requiresMajorBump(result)).toBe(true);
  });
});
