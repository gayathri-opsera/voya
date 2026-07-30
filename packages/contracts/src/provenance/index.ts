import { z } from "zod";

/**
 * Extensible provenance vocabulary.
 *
 * - AMADEUS, RAPIDAPI_HOTEL, RAPIDAPI_CAR: certified supplier channels
 * - ILLUSTRATIVE: synthetic/demo offers — always non-bookable
 * - Adding a new certified partner requires extending this enum + a migration.
 */
export const ProvenanceSchema = z.enum([
  "AMADEUS",
  "RAPIDAPI_HOTEL",
  "RAPIDAPI_CAR",
  "ILLUSTRATIVE",
]);

export type Provenance = z.infer<typeof ProvenanceSchema>;

/** The set of provenance values that may be booked (bookable=true in DB). */
export const BOOKABLE_PROVENANCES: ReadonlySet<Provenance> = new Set<Provenance>([
  "AMADEUS",
  "RAPIDAPI_HOTEL",
  "RAPIDAPI_CAR",
]);

/** Returns true iff the provenance allows booking. */
export function isBookableProvenance(provenance: string): boolean {
  return BOOKABLE_PROVENANCES.has(provenance as Provenance);
}

/**
 * Validate that an offer has a bookable provenance.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateProvenance(
  provenance: unknown,
): { valid: true } | { valid: false; reason: string } {
  const parsed = ProvenanceSchema.safeParse(provenance);
  if (!parsed.success) {
    return {
      valid: false,
      reason: `Unknown provenance value: ${String(provenance)}`,
    };
  }
  if (!isBookableProvenance(parsed.data)) {
    return {
      valid: false,
      reason: `Provenance ${parsed.data} is not bookable`,
    };
  }
  return { valid: true };
}
