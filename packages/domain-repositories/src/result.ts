/**
 * Typed result union for repository operations.
 *
 * Repositories return typed results for all expected domain conditions rather
 * than throwing. Unexpected database failures are represented by REPOSITORY_ERROR
 * with a safe message (no SQL, stack traces, or secrets in the cause string).
 *
 * Ownership denial returns NOT_FOUND rather than FORBIDDEN to avoid leaking
 * whether a resource exists for another traveller (resource enumeration guard).
 */

export type RepositoryResult<T> =
  | { readonly ok: true;  readonly data: T }
  | { readonly ok: false; readonly kind: 'NOT_FOUND' }
  | { readonly ok: false; readonly kind: 'EXPIRED'; readonly expiredAt: Date }
  | { readonly ok: false; readonly kind: 'VALIDATION_FAILURE'; readonly errors: readonly string[] }
  | { readonly ok: false; readonly kind: 'VERSION_CONFLICT'; readonly currentVersion: number }
  | { readonly ok: false; readonly kind: 'REPOSITORY_ERROR'; readonly cause: string };

// ---------------------------------------------------------------------------
// Constructor helpers — keep call-sites concise
// ---------------------------------------------------------------------------

export function ok<T>(data: T): RepositoryResult<T> {
  return { ok: true, data };
}

export function notFound<T = never>(): RepositoryResult<T> {
  return { ok: false, kind: 'NOT_FOUND' };
}

export function validationFailure<T = never>(errors: readonly string[]): RepositoryResult<T> {
  return { ok: false, kind: 'VALIDATION_FAILURE', errors };
}

export function versionConflict<T = never>(currentVersion: number): RepositoryResult<T> {
  return { ok: false, kind: 'VERSION_CONFLICT', currentVersion };
}

export function expired<T = never>(expiredAt: Date): RepositoryResult<T> {
  return { ok: false, kind: 'EXPIRED', expiredAt };
}

export function repoError<T = never>(cause: string): RepositoryResult<T> {
  return { ok: false, kind: 'REPOSITORY_ERROR', cause };
}

// ---------------------------------------------------------------------------
// Type guard helpers
// ---------------------------------------------------------------------------

export function isOk<T>(r: RepositoryResult<T>): r is { ok: true; data: T } {
  return r.ok;
}

export function isNotFound<T>(r: RepositoryResult<T>): r is { ok: false; kind: 'NOT_FOUND' } {
  return !r.ok && r.kind === 'NOT_FOUND';
}

export function isValidationFailure<T>(
  r: RepositoryResult<T>,
): r is { ok: false; kind: 'VALIDATION_FAILURE'; errors: readonly string[] } {
  return !r.ok && r.kind === 'VALIDATION_FAILURE';
}

export function isVersionConflict<T>(
  r: RepositoryResult<T>,
): r is { ok: false; kind: 'VERSION_CONFLICT'; currentVersion: number } {
  return !r.ok && r.kind === 'VERSION_CONFLICT';
}

export function isExpired<T>(
  r: RepositoryResult<T>,
): r is { ok: false; kind: 'EXPIRED'; expiredAt: Date } {
  return !r.ok && r.kind === 'EXPIRED';
}
