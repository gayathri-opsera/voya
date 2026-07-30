import { z } from "zod";

/**
 * Three-letter IATA airport code — BR-11 wording required exactly as specified.
 * Normalises to uppercase so browser-submitted lowercase values pass.
 */
export const iataCode = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        /^[A-Z]{3}$/,
        "Airport code must be a 3-letter IATA code (e.g. JFK, LHR, SYD)",
      ),
  );

/**
 * ISO-8601 datetime string that coerces to a Date.
 * Accepts the full datetime format produced by browsers (e.g. "2026-06-15T00:00:00.000Z").
 */
export const isoDateTimeString = z
  .string()
  .datetime({ message: "Must be a valid ISO-8601 datetime string" })
  .transform((v) => new Date(v));

/**
 * ISO-8601 date string (YYYY-MM-DD or full datetime) coerced to a Date.
 * Accepts YYYY-MM-DD (browser form input) and ISO-8601 datetime strings
 * (JSON.stringify output) so round-trips survive without transformation.
 */
export const isoDateString = z
  .string()
  .refine(
    (v) => /^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]+)?$/.test(v),
    "Must be a valid date in YYYY-MM-DD format",
  )
  .transform((v) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00.000Z`) : new Date(v),
  )
  .refine((d) => !isNaN(d.getTime()), "Must be a valid calendar date");

/**
 * ISO-8601 date string that must represent a date in the future.
 * "Future" means strictly after the current date (not today).
 * Accepts both YYYY-MM-DD and full ISO-8601 datetime strings.
 */
export const futureDateString = isoDateString.refine(
  (d) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return d.getTime() > today.getTime();
  },
  "Date must be in the future",
);

/**
 * Three-letter ISO-4217 currency code.
 */
export const currencyCode = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO-4217 code (e.g. USD, EUR, GBP)"),
  );

/**
 * Positive monetary amount as a string with at most 2 decimal places
 * to avoid floating-point drift across JSON transport.
 */
export const positiveMoney = z
  .string()
  .regex(
    /^\d+(\.\d{1,2})?$/,
    "Amount must be a positive number with at most 2 decimal places",
  )
  .refine((v) => parseFloat(v) > 0, "Amount must be greater than zero");

/**
 * UUID v4 or ULID identifier used for resource IDs.
 */
export const identifier = z
  .string()
  .min(1, "Identifier must not be empty")
  .regex(
    /^[0-9A-Za-z_-]{10,128}$/,
    "Identifier must be a valid UUID or ULID",
  );

/**
 * Correlation ID — ULID or UUID v4, max 64 chars. Used for distributed tracing.
 */
export const correlationId = z
  .string()
  .min(1)
  .max(64, "Correlation ID must not exceed 64 characters")
  .regex(
    /^[0-9A-Za-z_-]+$/,
    "Correlation ID must contain only alphanumeric characters, hyphens, and underscores",
  );

/**
 * Pagination cursor — opaque base64-encoded string.
 */
export const paginationCursor = z
  .string()
  .base64({ message: "Cursor must be a base64-encoded string" })
  .optional();
