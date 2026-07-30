# @travel/observability

Shared structured logging with PII redaction for the Voya travel platform.

## Quick Start

```ts
import { createLogger, createChildLogger } from "@travel/observability";

// Create once per process, inject into controllers/services
const logger = createLogger({ service: "flight-service" });

// Per-request child logger
const reqLogger = createChildLogger(logger, {
  correlationId: req.headers["x-correlation-id"],
  traceId: req.headers["x-trace-id"],
  userId: actor?.userId,
});

reqLogger.info({ destination: "LHR" }, "Flight search initiated");
```

## Redaction Paths

The following fields are redacted to `[REDACTED]` at logger construction — no call-site opt-in required:

| Field | Notes |
|---|---|
| `email` / `*.email` | Traveler, user, and contact emails |
| `passwordHash` / `*.passwordHash` | Credential hashes |
| `dateOfBirth` / `*.dateOfBirth` | Traveler DOB |
| `passportNumber` / `*.passportNumber` | Travel document numbers |
| `authorization` / `headers.authorization` | JWT bearer tokens |
| `stripe-signature` / `headers.stripe-signature` | Webhook HMAC signatures |
| `passengers[*].email` etc. | Array element PII |

Error `message` and `stack` strings are additionally scrubbed for email-like patterns and long digit sequences.

## Log Retention Decision

> Application logs are retained for **30 days** in CloudWatch Logs.
> This is **explicitly separate** from the 1-year immutable audit record store.
>
> See `docs/adr/0001-logging-and-test-runner.md` for the full rationale.

## Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `LOG_LEVEL` | `info` | One of: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |
| `NODE_ENV` | `development` | `debug` log level is blocked in production |

## Test Runner

> **Ratified:** Jest 29 + ts-jest (ESM mode).
> See `docs/adr/0001-logging-and-test-runner.md`.
> Assertions are runner-agnostic — switching to Vitest requires only config changes.
