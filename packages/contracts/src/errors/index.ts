export { ErrorCode, HTTP_STATUS_MAP, resolveHttpStatus } from "./codes.js";
export type { AllowedHttpStatus } from "./codes.js";

export { ErrorDetailSchema, ErrorEnvelopeSchema } from "./envelope.js";
export type { ErrorDetail, ErrorEnvelope } from "./envelope.js";

export {
  AppError,
  validationFailed,
  unauthenticated,
  forbidden,
  notFound,
  conflict,
  lifecycleConflict,
  duplicateEmail,
  supplierRejected,
  rateLimited,
  supplierUnavailable,
  supplierTimeout,
  internalError,
} from "./domain-errors.js";

export { RESTRICTED_FIELDS, serialiseError } from "./serialise.js";
export type { SerialiseResult } from "./serialise.js";
