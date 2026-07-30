/**
 * TripConstraints — validated traveller intent contract.
 *
 * Carries destination, date window, party composition, budget band,
 * interest tags, and accessibility needs derived from traveller input.
 *
 * PRIVACY INVARIANT: This schema intentionally omits and actively rejects
 * personally identifiable or financially sensitive fields:
 *   - name, firstName, lastName, displayName
 *   - email, emailAddress
 *   - bonvoyNumber, loyaltyNumber, memberId
 *   - passportNumber, nationalId, documentNumber
 *   - cardNumber, paymentToken, pan, cvv
 *
 * Traveller identity is represented only as a tokenised, opaque `travellerRef`.
 * The LLM and downstream services never receive raw personal data via this contract.
 */

import { z } from 'zod';
import { AccessibilityNeed, BudgetBand } from '../common/enums.js';

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

/**
 * ISO 8601 UTC datetime string.
 * Used throughout contracts for all timestamp fields.
 */
const IsoDatetimeSchema = z.string().datetime({
  message: 'Must be a valid ISO 8601 UTC datetime string (e.g. 2025-09-15T00:00:00.000Z)',
});

/**
 * Check-in / check-out window. checkOut must be strictly after checkIn.
 */
export const DateWindowSchema = z
  .object({
    checkIn: IsoDatetimeSchema,
    checkOut: IsoDatetimeSchema,
  })
  .refine((d) => new Date(d.checkOut) > new Date(d.checkIn), {
    message: 'checkOut must be strictly after checkIn',
    path: ['checkOut'],
  });

export type DateWindow = z.infer<typeof DateWindowSchema>;

/**
 * Geographic coordinates (WGS-84).
 */
export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;

/**
 * Destination intent. Name is required; region/country/coordinates are optional
 * enrichment added by the platform after safety-gate clearing.
 */
export const DestinationSchema = z.object({
  name: z.string().min(1, { message: 'Destination name must not be empty' }),
  regionCode: z.string().optional(),
  countryCode: z
    .string()
    .length(2, { message: 'countryCode must be an ISO 3166-1 alpha-2 code' })
    .optional(),
  coordinates: CoordinatesSchema.optional(),
});

export type Destination = z.infer<typeof DestinationSchema>;

/**
 * Party composition. At least one adult is required for itinerary assembly.
 * Children/infants/pets default to 0 so callers may omit them.
 */
export const PartyCompositionSchema = z
  .object({
    adults: z
      .number()
      .int({ message: 'adults must be a whole number' })
      .min(1, { message: 'At least one adult traveller is required' }),
    children: z
      .number()
      .int({ message: 'children must be a whole number' })
      .min(0)
      .default(0),
    infants: z
      .number()
      .int({ message: 'infants must be a whole number' })
      .min(0)
      .default(0),
    pets: z
      .number()
      .int({ message: 'pets must be a whole number' })
      .min(0)
      .default(0),
  });

export type PartyComposition = z.infer<typeof PartyCompositionSchema>;

// ---------------------------------------------------------------------------
// TripConstraintsSchema
// ---------------------------------------------------------------------------

/**
 * Canonical schema for validated traveller intent.
 *
 * `.strict()` ensures any extra key — including prohibited personal and
 * payment data fields — causes immediate validation failure rather than
 * being silently dropped.
 *
 * AC1: validates destination, date window, party composition, budget band,
 * interest tags, accessibility needs, and tokenised traveller reference
 * without accepting name, email, Bonvoy number, passport data, or payment data.
 */
export const TripConstraintsSchema = z
  .object({
    /**
     * Opaque token representing the traveller. Never a name, email, or
     * Bonvoy account number.
     */
    travellerRef: z
      .string()
      .min(1, { message: 'travellerRef is required and must not be empty' }),

    /** Destination intent. */
    destination: DestinationSchema,

    /** Requested stay window. */
    dateWindow: DateWindowSchema,

    /** Party makeup. At least one adult required. */
    partyComposition: PartyCompositionSchema,

    /** Approximate spend tier selected by the traveller. */
    budgetBand: z.nativeEnum(BudgetBand, {
      errorMap: () => ({
        message: `budgetBand must be one of: ${Object.values(BudgetBand).join(', ')}`,
      }),
    }),

    /**
     * Preference tags from curated collections or saved home history.
     * An empty array is explicitly valid (decisive search with no preference signal).
     */
    interestTags: z.array(z.string().min(1)).default([]),

    /** Declared accessibility requirements. Optional; omission means none declared. */
    accessibilityNeeds: z
      .array(
        z.nativeEnum(AccessibilityNeed, {
          errorMap: () => ({
            message: `Each accessibility need must be one of: ${Object.values(AccessibilityNeed).join(', ')}`,
          }),
        }),
      )
      .optional(),
  })
  .strict({
    message:
      'TripConstraints must not contain personal or payment data fields (name, email, bonvoyNumber, passportNumber, cardNumber, paymentToken, etc.)',
  });

export type TripConstraints = z.infer<typeof TripConstraintsSchema>;
