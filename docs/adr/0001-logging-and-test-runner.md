# ADR-0001: Application Log Retention and Test Runner Selection

**Status:** Accepted
**Date:** 2026-07-30
**Ratified by:** Tech Lead / Platform Maintainer

---

## Application Log Retention

**Decision:** Application logs are retained for **30 days** in CloudWatch Logs.

**Rationale:**
- 30 days is sufficient for operational debugging, incident investigation, and SOC 2 audit sampling.
- CloudWatch Logs Insights queries cover a 30-day rolling window by default.
- Application logs contain operational events (request/response, errors, latency).
- Application logs **must not** be confused with the separate immutable audit record store.

**Audit Record Retention:**
- Immutable audit records (booking events, payment events, privilege escalations) are written to a **separate append-only store** with **1-year retention**.
- Audit records are never stored in CloudWatch application log groups.
- This distinction satisfies SOC 2 Type II audit evidence requirements and GDPR Art. 30 record-keeping obligations.

**PII in Application Logs:**
- PII fields (`email`, `passwordHash`, `dateOfBirth`, `passportNumber`, `authorization`, `stripe-signature`) are redacted at logger construction via Pino `redact` paths.
- Error stacks and message strings are additionally scrubbed for email-like and long-digit patterns.
- A log-level redaction failure is a SOC 2 exception and a potential GDPR incident.

---

## Test Runner for @travel/observability

**Decision:** **Jest 29** is the ratified test runner for the `@travel/observability` package and for the observability epic (WO-006 through WO-011).

**Rationale:**
- Jest 29 + ts-jest is already in use across services in this monorepo.
- Using a single test runner for the observability epic avoids dual-runner ambiguity in CI configuration.
- The test assertion layer in `@travel/observability` is independent of the runner — switching to Vitest would require only config changes, not rewriting assertions.

**Note on WO-001 through WO-005:**
- `@travel/contracts` and `@travel/shared` use **Vitest 2.x** as their test runner.
- That choice is ratified separately in `packages/contracts/README.md`.
- Both runners coexist in the monorepo without conflict because Turborepo runs each package's `test` script independently.
