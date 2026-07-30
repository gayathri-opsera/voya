// Frontend consumes search responses and error envelopes
export const errorEnvelopeFixture = {
  error: {
    code: "VALIDATION_FAILED",
    message: "origin must be a 3-letter IATA code",
    field: "origin",
  },
  reference: "trace_01J9X0Y2Z3A4B5C6D7E8F9",
};
