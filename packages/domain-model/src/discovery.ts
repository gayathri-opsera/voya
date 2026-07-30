/**
 * @voya/domain-model — Discovery Domain Types
 *
 * Types and validators for destinations, curated collections, home inventory
 * references, and interest tags. These mirror the Prisma discovery schema but
 * carry no Zod or Prisma dependency.
 */

// ---------------------------------------------------------------------------
// Slug validation
// ---------------------------------------------------------------------------

/** Slug pattern: lowercase alphanumeric with hyphens, 2–80 characters. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$|^[a-z0-9]{1,2}$/;

export function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

export function validateSlug(slug: string): readonly string[] {
  if (!slug || slug.trim() === '') return ['slug must not be empty'];
  if (!isValidSlug(slug))
    return [`slug "${slug}" must be lowercase alphanumeric with hyphens (2–80 chars)`];
  return [];
}

// ---------------------------------------------------------------------------
// Source reference validation
// ---------------------------------------------------------------------------

/** Source reference must be a non-empty string without whitespace. */
export function isValidSourceRef(ref: string): boolean {
  return typeof ref === 'string' && ref.trim().length > 0 && !/\s/.test(ref);
}

export function validateSourceRef(ref: string): readonly string[] {
  if (!ref || ref.trim() === '') return ['sourceRef must not be empty'];
  if (/\s/.test(ref)) return ['sourceRef must not contain whitespace'];
  return [];
}

// ---------------------------------------------------------------------------
// Image metadata reference (placeholder URL pattern)
// ---------------------------------------------------------------------------

/**
 * Validates an image metadata reference. Accepts:
 *   - Relative paths: /images/hero/collections/beachfront.jpg
 *   - Placeholder tokens: img_ref_beachfront_hero_001
 *   - Empty/null (optional fields)
 *
 * Rejects absolute URLs to external domains (not stored in the DB).
 */
export function isValidImageRef(ref: string): boolean {
  if (!ref) return false;
  if (ref.startsWith('http://') || ref.startsWith('https://')) return false;
  return ref.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Content version
// ---------------------------------------------------------------------------

export function isValidContentVersion(v: number): boolean {
  return Number.isInteger(v) && v >= 1;
}

// ---------------------------------------------------------------------------
// Interest tag key validation
// ---------------------------------------------------------------------------

/** Tag key pattern: SCREAMING_SNAKE_CASE, 2–60 characters. */
const TAG_KEY_RE = /^[A-Z][A-Z0-9_]{0,58}[A-Z0-9]$|^[A-Z]{1,2}$/;

export function isValidTagKey(key: string): boolean {
  return typeof key === 'string' && TAG_KEY_RE.test(key);
}

export function validateTagKey(key: string): readonly string[] {
  if (!key || key.trim() === '') return ['tagKey must not be empty'];
  if (!isValidTagKey(key)) return [`tagKey "${key}" must be SCREAMING_SNAKE_CASE (2–60 chars)`];
  return [];
}

// ---------------------------------------------------------------------------
// Well-known interest tag keys (not exhaustive — additional tags can be added)
// ---------------------------------------------------------------------------

export const INTEREST_TAG_KEYS = {
  BEACHFRONT:       'BEACHFRONT',
  SKI_IN_SKI_OUT:   'SKI_IN_SKI_OUT',
  VINEYARD:         'VINEYARD',
  NATIONAL_PARK:    'NATIONAL_PARK',
  MONTHLY_RENTAL:   'MONTHLY_RENTAL',
  OCEANVIEW:        'OCEANVIEW',
  MOUNTAIN_VIEW:    'MOUNTAIN_VIEW',
  LAKEFRONT:        'LAKEFRONT',
  CITY_CENTRE:      'CITY_CENTRE',
  RURAL_RETREAT:    'RURAL_RETREAT',
} as const;

export type InterestTagKey = typeof INTEREST_TAG_KEYS[keyof typeof INTEREST_TAG_KEYS];

// ---------------------------------------------------------------------------
// Well-known collection slugs (stable identifiers for the 5 Marriott-inspired
// Homes & Villas collections)
// ---------------------------------------------------------------------------

export const COLLECTION_SLUGS = {
  BEACHFRONT_RENTALS:     'beachfront-rentals',
  SKI_IN_SKI_OUT:         'ski-in-ski-out',
  VINEYARD_WINERY_HOMES:  'vineyard-winery-homes',
  NATIONAL_PARK_HOMES:    'national-park-homes',
  MONTHLY_RENTALS:        'monthly-rentals',
} as const;

export type CollectionSlug = typeof COLLECTION_SLUGS[keyof typeof COLLECTION_SLUGS];
