/**
 * Vitest globalSetup — generates JSON Schema baselines before the test run.
 *
 * Behaviour:
 *   - If GENERATE_BASELINES=1: always regenerates all baseline files (for intentional schema updates).
 *   - Otherwise: generates only missing baseline files (first-time setup).
 *
 * This keeps the harness offline — no network or external service dependency.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SCHEMA_REGISTRY } from "../../src/registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINES_DIR = join(__dirname, "../../contract-baselines");

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

export async function setup() {
  const force = process.env["GENERATE_BASELINES"] === "1";
  mkdirSync(BASELINES_DIR, { recursive: true });

  let generated = 0;
  for (const entry of SCHEMA_REGISTRY) {
    const filename = `${entry.id.replace(/\./g, "__")}.json`;
    const filepath = join(BASELINES_DIR, filename);

    if (force || !existsSync(filepath)) {
      const jsonSchema = zodToJsonSchema(entry.schema, {
        $refStrategy: "none",
        errorMessages: false,
      });
      const sorted = sortKeys(jsonSchema);
      writeFileSync(filepath, JSON.stringify(sorted, null, 2) + "\n", "utf-8");
      generated++;
    }
  }

  if (generated > 0) {
    console.log(`[WO-005] Generated ${generated} baseline files in contract-baselines/`);
  }
}
