import type { ErrorEnvelope } from "../../src/errors/envelope.js";

/** One representative fixture per HTTP status code in the platform contract. */

export const envelope400: ErrorEnvelope = {
  error: {
    code: "VALIDATION_FAILED",
    message: "Airport code must be a 3-letter IATA code (e.g. JFK, LHR, SYD)",
    field: "origin",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G0",
};

export const envelope401: ErrorEnvelope = {
  error: {
    code: "UNAUTHENTICATED",
    message: "Authentication is required to access this resource",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G1",
};

export const envelope403: ErrorEnvelope = {
  error: {
    code: "FORBIDDEN",
    message: "You do not have permission to perform this action",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G2",
};

export const envelope404: ErrorEnvelope = {
  error: {
    code: "NOT_FOUND",
    message: "Booking was not found",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G3",
};

export const envelope409: ErrorEnvelope = {
  error: {
    code: "LIFECYCLE_CONFLICT",
    message: "Cannot transition from PENDING. Allowed transitions: CONFIRMED, CANCELLED",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G4",
};

export const envelope422: ErrorEnvelope = {
  error: {
    code: "SUPPLIER_REJECTED",
    message: "The supplier rejected this request",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G5",
};

export const envelope429: ErrorEnvelope = {
  error: {
    code: "RATE_LIMITED",
    message: "Rate limit exceeded. Retry after 60 seconds",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G6",
};

export const envelope500: ErrorEnvelope = {
  error: {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred. Please try again or contact support.",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G7",
};

export const envelope502: ErrorEnvelope = {
  error: {
    code: "SUPPLIER_UNAVAILABLE",
    message: "The Amadeus is temporarily unavailable",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G8",
};

export const envelope504: ErrorEnvelope = {
  error: {
    code: "SUPPLIER_TIMEOUT",
    message: "Request to RapidAPI timed out",
  },
  reference: "corr_01J9X0Y2Z3A4B5C6D7E8F9G9",
};
