import { z } from "zod";

/**
 * Standard platform error envelope — the one and only shape every service
 * and the web app uses for all error responses.
 *
 * Shape (wire format):
 * {
 *   "error": {
 *     "code": "VALIDATION_FAILED",
 *     "message": "Origin must be a 3-letter IATA code",
 *     "field": "origin"        // optional — omitted for non-field errors
 *   },
 *   "reference": "01ARZ3NDEKTSV4RRFFQ69G5FAV"
 * }
 *
 * The `reference` is the active trace/correlation ID so a support agent
 * can resolve it to an X-Ray trace directly from a traveler screenshot.
 */
export const ErrorDetailSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    field: z.string().min(1).optional(),
  })
  .strict();

export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

export const ErrorEnvelopeSchema = z
  .object({
    error: ErrorDetailSchema,
    reference: z.string().min(1, "Reference must be a non-empty trace/correlation identifier"),
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
