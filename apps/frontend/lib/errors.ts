import type { ErrorEnvelope } from "@travel/contracts";

export interface FieldError {
  field?: string;
  message: string;
}

export interface MappedErrors {
  fieldErrors: Record<string, string>;
  formError?: string;
  reference?: string;
}

/**
 * Maps a standard error envelope to form-field errors.
 *
 * - If error.field matches a known form field, the message is attached there.
 * - If error.field is absent or unmatched, the message is shown as a form-level banner.
 * - The reference is always surfaced so the user can quote it to support.
 */
export function mapEnvelopeToFormErrors(
  envelope: ErrorEnvelope,
  knownFields: Set<string>,
): MappedErrors {
  const { error, reference } = envelope;
  const result: MappedErrors = { fieldErrors: {}, reference };

  if (error.field !== undefined && knownFields.has(error.field)) {
    result.fieldErrors[error.field] = error.message;
  } else {
    result.formError = error.message;
  }

  return result;
}

/**
 * Returns true if the envelope contains a field-level error for the given field.
 */
export function hasFieldError(
  envelope: ErrorEnvelope | null,
  field: string,
): boolean {
  return envelope?.error.field === field;
}
