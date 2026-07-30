/**
 * @voya/contracts — Prompt safety validation
 *
 * Provides helpers that validate whether a set of data category annotations is
 * safe to include in an AI model prompt payload.
 *
 * Rules enforced:
 *  - CONFIDENTIAL and RESTRICTED categories are never prompt-eligible.
 *  - INTERNAL and PUBLIC categories are prompt-eligible only when their
 *    registry entry explicitly declares `promptEligible: true`.
 *  - TRAVELLER_TOKEN and TRIP_CONSTRAINTS are the only currently prompt-safe
 *    categories that carry contextual traveller information.
 *
 * Error objects returned by these helpers MUST NOT include the rejected
 * sensitive value — only the category key, the field path, the violated rule,
 * and a safe human-readable message are returned.
 */

import { z } from 'zod';
import {
  DataCategoryKeyEnum,
  type DataCategoryKey,
  DATA_CATEGORY_REGISTRY,
} from './data-classification.js';

// ---------------------------------------------------------------------------
// GovernanceError
// Structured error returned by prompt-safety validation helpers.
// ---------------------------------------------------------------------------

export const GovernanceErrorSchema = z
  .object({
    /** The data category key that triggered this error. */
    categoryKey: DataCategoryKeyEnum,

    /**
     * JSON Pointer (RFC 6901) to the field path in the schema or payload that
     * contained the prohibited category annotation. e.g. "/traveller/passportNumber".
     */
    fieldPath: z.string().min(1, 'fieldPath must not be empty'),

    /** Machine-readable rule identifier for the violated governance rule. */
    violatedRule: z.string().min(1, 'violatedRule must not be empty'),

    /**
     * Safe human-readable message suitable for logging and support tooling.
     * MUST NOT contain the rejected sensitive value.
     */
    safeMessage: z.string().min(1, 'safeMessage must not be empty'),
  })
  .strict();

export type GovernanceError = z.infer<typeof GovernanceErrorSchema>;

// ---------------------------------------------------------------------------
// CategoryAnnotation
// A single data-category annotation on a payload field.
// ---------------------------------------------------------------------------

export interface CategoryAnnotation {
  /** The data category key assigned to this field. */
  readonly categoryKey: DataCategoryKey;
  /**
   * JSON Pointer (RFC 6901) to the field being annotated.
   * e.g. "/constraints/travellerToken" or "/passport/documentNumber".
   */
  readonly fieldPath: string;
}

// ---------------------------------------------------------------------------
// validatePromptCategories
// ---------------------------------------------------------------------------

/**
 * Validates that none of the given data category annotations are prohibited in
 * AI prompt context. Returns an array of GovernanceErrors for each violation.
 * An empty array means all supplied annotations are prompt-safe.
 *
 * @param annotations  Array of category annotations from the schema or payload
 *                     being validated before prompt assembly.
 */
export function validatePromptCategories(
  annotations: ReadonlyArray<CategoryAnnotation>,
): GovernanceError[] {
  const errors: GovernanceError[] = [];

  for (const annotation of annotations) {
    const entry = DATA_CATEGORY_REGISTRY[annotation.categoryKey];

    if (!entry) {
      // Unknown category key — treat as a configuration error.
      errors.push({
        categoryKey: annotation.categoryKey,
        fieldPath: annotation.fieldPath,
        violatedRule: 'unknown_category_key',
        safeMessage: `Data category key "${annotation.categoryKey}" is not registered in the data category registry.`,
      });
      continue;
    }

    if (!entry.promptEligible) {
      errors.push({
        categoryKey: annotation.categoryKey,
        fieldPath: annotation.fieldPath,
        violatedRule: 'category_not_prompt_eligible',
        safeMessage:
          `Data category "${annotation.categoryKey}" (tier: ${entry.tier}) is not ` +
          `permitted in AI prompt payloads. Use a tokenised INTERNAL reference instead.`,
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// isPromptSafe
// ---------------------------------------------------------------------------

/**
 * Returns true if the given data category key is eligible to appear in an AI
 * prompt payload, false otherwise.
 */
export function isPromptSafe(categoryKey: DataCategoryKey): boolean {
  const entry = DATA_CATEGORY_REGISTRY[categoryKey];
  return entry?.promptEligible === true;
}

// ---------------------------------------------------------------------------
// PromptSafetyViolationError
// ---------------------------------------------------------------------------

/**
 * Thrown by assertPromptSafe when one or more data categories in a prompt
 * payload are not permitted. The `violations` array contains structured
 * GovernanceError objects; it does NOT contain rejected sensitive values.
 */
export class PromptSafetyViolationError extends Error {
  public readonly violations: readonly GovernanceError[];

  constructor(message: string, violations: GovernanceError[]) {
    super(message);
    this.name = 'PromptSafetyViolationError';
    this.violations = Object.freeze([...violations]);
  }
}

// ---------------------------------------------------------------------------
// assertPromptSafe
// ---------------------------------------------------------------------------

/**
 * Asserts that all supplied category annotations are prompt-safe. Throws a
 * PromptSafetyViolationError containing the list of GovernanceErrors if any
 * violation is found.
 *
 * Use this at service boundaries (prompt assembly, logging, persistence) where
 * a violation must be a hard failure rather than a logged warning.
 *
 * @throws {PromptSafetyViolationError} when any annotation is not prompt-safe.
 */
export function assertPromptSafe(
  annotations: ReadonlyArray<CategoryAnnotation>,
): void {
  const errors = validatePromptCategories(annotations);
  if (errors.length > 0) {
    const violatedCategories = errors.map((e) => e.categoryKey).join(', ');
    throw new PromptSafetyViolationError(
      `Prompt payload contains prohibited data categories: ${violatedCategories}`,
      errors,
    );
  }
}
