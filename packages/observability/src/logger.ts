import pino, { type Logger, type SerializedError } from "pino";
import type { LogContext } from "./context.js";

// ─── PII redaction paths ───────────────────────────────────────────────────────

/**
 * Redacted at logger construction so masking cannot be forgotten at call sites.
 * Includes nested occurrences at any depth and occurrences inside HTTP header objects.
 *
 * @see docs/adr/0001-logging-and-test-runner.md for the ratification record.
 */
const PII_PATHS = [
  "email",
  "*.email",
  "traveler.email",
  "user.email",
  "passenger.email",
  "contact.email",
  "passwordHash",
  "*.passwordHash",
  "dateOfBirth",
  "*.dateOfBirth",
  "traveler.dateOfBirth",
  "passenger.dateOfBirth",
  "passportNumber",
  "*.passportNumber",
  "traveler.passportNumber",
  "passenger.passportNumber",
  // HTTP headers
  "authorization",
  "Authorization",
  "headers.authorization",
  "headers.Authorization",
  "req.headers.authorization",
  "req.headers.Authorization",
  "stripe-signature",
  "headers.stripe-signature",
  "req.headers.stripe-signature",
  // nested arrays (e.g. booking.passengers)
  "passengers[*].email",
  "passengers[*].dateOfBirth",
  "passengers[*].passportNumber",
  "travelers[*].email",
  "travelers[*].dateOfBirth",
  "travelers[*].passportNumber",
];

// ─── Email / long-digit pattern scrubber ──────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const LONG_DIGIT_RE = /\b\d{8,}\b/g; // passport numbers, long card-like patterns

function scrubString(value: string): string {
  return value
    .replace(EMAIL_RE, "[REDACTED-EMAIL]")
    .replace(LONG_DIGIT_RE, "[REDACTED-NUM]");
}

function makeScrubErrorSerializer() {
  const base = pino.stdSerializers.err;
  return function scrubError(err: unknown): SerializedError | unknown {
    try {
      const serialized = base(err as Error);
      if (serialized?.message) {
        serialized.message = scrubString(serialized.message);
      }
      if (serialized?.stack) {
        serialized.stack = scrubString(serialized.stack);
      }
      return serialized;
    } catch {
      const fallback = err instanceof Error ? err.name : "UnknownError";
      return { type: fallback, message: "Error serialization failed" };
    }
  };
}

// ─── Valid log levels ──────────────────────────────────────────────────────────

const VALID_LEVELS = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

function resolveLogLevel(): string {
  const raw = process.env["LOG_LEVEL"];
  if (!raw) return "info";
  if (!VALID_LEVELS.has(raw)) {
    throw new Error(
      `LOG_LEVEL "${raw}" is not a valid Pino log level. ` +
      `Must be one of: ${[...VALID_LEVELS].join(", ")}`,
    );
  }
  if (raw === "debug" && process.env["NODE_ENV"] === "production") {
    process.stderr.write(
      '[observability] LOG_LEVEL=debug is not allowed in production; using "info"\n',
    );
    return "info";
  }
  return raw;
}

// ─── Logger options ───────────────────────────────────────────────────────────

export interface CreateLoggerOptions {
  /** Required: identifies the emitting service in every log line. */
  service: string;
  /** Optional: application version for base bindings. */
  version?: string;
  /**
   * Optional: override the output destination.
   * Intended for tests only — do not use in production services.
   * @internal
   */
  _destination?: NodeJS.WritableStream;
}

/**
 * Exported for unit testing the error serializer directly.
 * @internal — not part of the public API contract.
 */
export const _scrubString = scrubString;

// ─── Public factory ───────────────────────────────────────────────────────────

/**
 * Creates a Pino JSON logger with PII redaction and typed context support.
 *
 * Emits single-line JSON to stdout — CloudWatch-friendly.
 * Pretty-printing is enabled only when NODE_ENV=development.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  if (!options.service || options.service.trim() === "") {
    throw new Error("createLogger: service name is required and must not be empty");
  }

  const level = resolveLogLevel();
  const env = process.env["NODE_ENV"] ?? "development";

  const baseOptions: pino.LoggerOptions = {
    level,
    serializers: {
      err: makeScrubErrorSerializer() as (err: unknown) => SerializedError,
    },
    redact: {
      paths: PII_PATHS,
      censor: "[REDACTED]",
      remove: false,
    },
    base: {
      service: options.service,
      env,
      ...(options.version ? { version: options.version } : {}),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (options._destination) {
    return pino(baseOptions, options._destination);
  }

  if (env === "development") {
    return pino(
      baseOptions,
      pino.transport({ target: "pino-pretty", options: { colorize: true } }),
    );
  }

  return pino(baseOptions);
}

// ─── Child logger factory ─────────────────────────────────────────────────────

/**
 * Creates a Pino child logger merging only typed LogContext fields.
 * Inherits redaction and serializers from the parent logger.
 */
export function createChildLogger(parent: Logger, context: LogContext): Logger {
  const bindings: Record<string, string> = {};
  if (context.correlationId) bindings["correlationId"] = context.correlationId;
  if (context.traceId)       bindings["traceId"]       = context.traceId;
  if (context.userId)        bindings["userId"]         = context.userId;
  if (context.service)       bindings["service"]        = context.service;
  if (context.operation)     bindings["operation"]      = context.operation;
  if (context.resource)      bindings["resource"]       = context.resource;
  if (context.supplierName)  bindings["supplierName"]   = context.supplierName;
  if (context.bookingId)     bindings["bookingId"]      = context.bookingId;
  return parent.child(bindings);
}
