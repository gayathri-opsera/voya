import type { ErrorEnvelope } from "@travel/contracts";

export const envelope400: ErrorEnvelope = {
  error: {
    code: "VALIDATION_FAILED",
    message: "Airport code must be a 3-letter IATA code (e.g. JFK, LHR, SYD)",
    field: "origin",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G0",
};

export const envelope401: ErrorEnvelope = {
  error: { code: "UNAUTHENTICATED", message: "Authentication is required" },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G1",
};

export const envelope403: ErrorEnvelope = {
  error: { code: "FORBIDDEN", message: "You do not have permission" },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G2",
};

export const envelope409: ErrorEnvelope = {
  error: {
    code: "LIFECYCLE_CONFLICT",
    message: "Cannot transition from PENDING",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G3",
};

export const envelope502: ErrorEnvelope = {
  error: { code: "SUPPLIER_UNAVAILABLE", message: "Supplier is temporarily unavailable" },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G4",
};
