#!/usr/bin/env node
/**
 * Generates JSON Schema baseline files for every schema in the registry.
 *
 * Output: packages/contracts/contract-baselines/<schema-id>.json
 *
 * Keys are sorted deterministically so diffs reflect real schema changes only.
 * Run with: npx tsx scripts/generate-baselines.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SCHEMA_REGISTRY } from "../src/registry.js";

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

mkdirSync(BASELINES_DIR, { recursive: true });

for (const entry of SCHEMA_REGISTRY) {
  const jsonSchema = zodToJsonSchema(entry.schema, {
    $refStrategy: "none",
    errorMessages: false,
  });

  const sorted = sortKeys(jsonSchema);
  const content = JSON.stringify(sorted, null, 2) + "\n";

  const filename = `${entry.id.replace(/\./g, "__")}.json`;
  const filepath = join(BASELINES_DIR, filename);
  writeFileSync(filepath, content, "utf-8");
  console.log(`  ✓ ${entry.id}`);
}

console.log(`\nGenerated ${SCHEMA_REGISTRY.length} baseline files in ${BASELINES_DIR}`);
