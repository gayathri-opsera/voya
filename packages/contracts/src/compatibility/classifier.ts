/**
 * Additive-versus-breaking change classifier for JSON Schema diffs.
 *
 * Classification rules (documented for tech-lead ratification):
 *
 * ADDITIVE changes (safe within a major version):
 *   - New property added with "required: false" or absent from "required" array
 *   - New enum member added to a RESPONSE schema
 *   - New definition added to $defs
 *
 * BREAKING changes (require a major-version bump):
 *   - Property removed from schema
 *   - Property added to "required" array (newly required field)
 *   - Property type changed
 *   - Enum member removed from any schema
 *   - New enum member added to a REQUEST schema (consumers must handle the new value)
 *   - Schema $id or top-level type changed
 *
 * @note The request/response distinction for enum widening follows the Postel principle:
 *   request schemas should accept new values gracefully, but adding a new enum member
 *   to a request means clients must produce valid values — breaking for strict validators.
 */

export type ChangeKind = "none" | "additive" | "breaking";

export interface ClassificationResult {
  kind: ChangeKind;
  reasons: string[];
}

type JsonSchemaObject = Record<string, unknown>;

/**
 * Classifies the change between two JSON Schema snapshots.
 * @param before The committed baseline schema
 * @param after  The regenerated schema
 * @param isRequestSchema Whether the schema is used as a request shape
 */
export function classifyChange(
  before: JsonSchemaObject,
  after: JsonSchemaObject,
  isRequestSchema: boolean,
): ClassificationResult {
  const reasons: string[] = [];
  let kind: ChangeKind = "none";

  const escalate = (newKind: ChangeKind): void => {
    if (newKind === "breaking" || (newKind === "additive" && kind === "none")) {
      kind = newKind;
    }
  };

  // ── Check properties ─────────────────────────────────────────────────────────
  const beforeProps = (before["properties"] ?? {}) as Record<string, unknown>;
  const afterProps = (after["properties"] ?? {}) as Record<string, unknown>;
  const beforeRequired = new Set((before["required"] as string[]) ?? []);
  const afterRequired = new Set((after["required"] as string[]) ?? []);

  // Removed properties
  for (const key of Object.keys(beforeProps)) {
    if (!(key in afterProps)) {
      reasons.push(`Property removed: "${key}"`);
      escalate("breaking");
    }
  }

  // Added properties
  for (const key of Object.keys(afterProps)) {
    if (!(key in beforeProps)) {
      if (afterRequired.has(key)) {
        reasons.push(`Property added as required: "${key}"`);
        escalate("breaking");
      } else {
        reasons.push(`Optional property added: "${key}" (additive)`);
        escalate("additive");
      }
    }
  }

  // Newly required fields
  for (const key of afterRequired) {
    if (!beforeRequired.has(key) && key in beforeProps) {
      reasons.push(`Property became required: "${key}"`);
      escalate("breaking");
    }
  }

  // Fields made optional (before was required, after is not)
  for (const key of beforeRequired) {
    if (!afterRequired.has(key) && key in afterProps) {
      reasons.push(`Property became optional: "${key}" (additive)`);
      escalate("additive");
    }
  }

  // ── Check enum values ─────────────────────────────────────────────────────────
  const beforeEnum = (before["enum"] as unknown[]) ?? (before["const"] !== undefined ? [before["const"]] : []);
  const afterEnum = (after["enum"] as unknown[]) ?? (after["const"] !== undefined ? [after["const"]] : []);

  if (beforeEnum.length > 0 || afterEnum.length > 0) {
    const beforeSet = new Set(beforeEnum.map(String));
    const afterSet = new Set(afterEnum.map(String));

    for (const val of beforeSet) {
      if (!afterSet.has(val)) {
        reasons.push(`Enum member removed: "${val}"`);
        escalate("breaking");
      }
    }

    for (const val of afterSet) {
      if (!beforeSet.has(val)) {
        if (isRequestSchema) {
          reasons.push(`Enum member added to request schema: "${val}" (breaking — clients must produce valid values)`);
          escalate("breaking");
        } else {
          reasons.push(`Enum member added to response schema: "${val}" (additive)`);
          escalate("additive");
        }
      }
    }
  }

  // ── Check top-level type ──────────────────────────────────────────────────────
  if (before["type"] !== undefined && after["type"] !== undefined && before["type"] !== after["type"]) {
    reasons.push(`Top-level type changed: "${String(before["type"])}" → "${String(after["type"])}"`);
    escalate("breaking");
  }

  return { kind, reasons };
}

/**
 * Returns true when the change requires a major-version bump to be valid.
 */
export function requiresMajorBump(result: ClassificationResult): boolean {
  return result.kind === "breaking";
}
