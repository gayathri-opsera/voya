/**
 * @voya/domain-model — Saved Home Domain Types and Validators
 *
 * Helpers for owner-scoped saved-home persistence. All methods are pure
 * functions with no Prisma or HTTP dependency.
 */

/** Maximum length for the optional notes field. */
const NOTES_MAX_LENGTH = 500;

export function validateSavedHomeNotes(notes: string): readonly string[] {
  if (notes.length > NOTES_MAX_LENGTH) {
    return [`notes must not exceed ${NOTES_MAX_LENGTH} characters`];
  }
  return [];
}

/**
 * Deduplicates and deterministically orders a list of tag keys.
 * Ordering is alphabetical by tagKey so results are stable across calls.
 */
export function deduplicateTagKeys(tagKeys: readonly string[]): readonly string[] {
  return [...new Set(tagKeys)].sort();
}

/**
 * Derives the set of interest tag keys from a list of tag keys associated
 * with saved homes. Deduplicates and returns in stable alphabetical order.
 */
export function deriveInterestTagsFromSavedHomes(
  tagKeysBySavedHome: ReadonlyArray<readonly string[]>,
): readonly string[] {
  const all = tagKeysBySavedHome.flat();
  return deduplicateTagKeys(all);
}
