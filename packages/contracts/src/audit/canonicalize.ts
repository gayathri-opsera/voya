/**
 * @voya/contracts — Deterministic audit hash input canonicalization
 *
 * Produces a stable string representation of an audit event payload for use
 * as input to a hash function. Stability guarantees:
 *  - Object keys are sorted lexicographically at every nesting level.
 *  - Two semantically identical objects with different insertion order produce
 *    the same canonical string.
 *  - Unsupported value types (undefined, function, symbol, bigint, circular
 *    references) throw a CanonicalizationError rather than being silently
 *    omitted, preventing hash integrity gaps.
 */

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class CanonicalizationError extends Error {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(`CanonicalizationError at "${path}": ${message}`);
    this.name = 'CanonicalizationError';
  }
}

// ---------------------------------------------------------------------------
// Internal recursive canonicalization
// ---------------------------------------------------------------------------

function canonicalizeValue(value: unknown, path: string, seen: Set<object>): unknown {
  // Primitives that JSON.stringify handles natively
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CanonicalizationError(
        `Non-finite number (${value}) is not JSON-safe`,
        path,
      );
    }
    return value;
  }

  // Explicitly rejected types
  if (typeof value === 'undefined') {
    throw new CanonicalizationError('undefined is not a JSON-safe value', path);
  }
  if (typeof value === 'function') {
    throw new CanonicalizationError('function values cannot be canonicalized', path);
  }
  if (typeof value === 'symbol') {
    throw new CanonicalizationError('symbol values cannot be canonicalized', path);
  }
  if (typeof value === 'bigint') {
    throw new CanonicalizationError('bigint values cannot be canonicalized', path);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new CanonicalizationError('circular reference detected', path);
    }
    seen.add(value);
    const result = value.map((item: unknown, i: number) =>
      canonicalizeValue(item, `${path}[${i}]`, seen),
    );
    seen.delete(value);
    return result;
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      throw new CanonicalizationError('circular reference detected', path);
    }
    seen.add(value as object);

    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const sorted: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      // noUncheckedIndexedAccess: key is definitely present since we got it from Object.keys
      const v: unknown = obj[key];
      sorted[key] = canonicalizeValue(v, path === '$' ? key : `${path}.${key}`, seen);
    }

    seen.delete(value as object);
    return sorted;
  }

  throw new CanonicalizationError(`Unsupported value type "${typeof value}"`, path);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Produces a deterministic JSON string from any JSON-compatible object.
 *
 * Keys at every nesting level are sorted lexicographically, so two objects
 * with the same keys and values but different insertion order produce
 * identical output.
 *
 * @throws {CanonicalizationError} if the input contains undefined, function,
 *   symbol, bigint, non-finite number, or circular reference values.
 */
export function canonicalizeObject(obj: Record<string, unknown>): string {
  return JSON.stringify(canonicalizeValue(obj, '$', new Set()));
}

/**
 * Subset of AuditEvent fields that form the canonical hash input.
 * Excludes canonicalHashInput itself (which is derived from this) and
 * excludes eventDetails (which is separately validated for redaction).
 */
export interface AuditEventHashInputFields {
  eventId:            string;
  eventType:          string;
  actorType:          string;
  actorRef:           string;
  occurredAt:         string;
  resourceType:       string;
  resourceRef:        string;
  correlationId:      string;
  dataClassification: string;
}

/**
 * Produces a canonical string from the immutable identity fields of an
 * audit event. This string is stored in canonicalHashInput and can be passed
 * to a hash function to produce the audit integrity hash.
 */
export function buildAuditHashInput(fields: AuditEventHashInputFields): string {
  return canonicalizeObject(fields as Record<string, unknown>);
}
