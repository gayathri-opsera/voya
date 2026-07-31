# ADR-001: Service-to-Service Communication Pattern
# Status: Accepted
# Date: 2026-07-30
# Deciders: Platform Architecture Team

## Context

The Marriott-Voya travel platform comprises 7+ microservices that need to communicate:
- Synchronous request-response (user-facing APIs)
- Asynchronous event streaming (bookings, notifications)
- Long-running saga orchestration (checkout flow)

## Decision

We adopt a **hybrid communication model**:

1. **HTTP/REST (synchronous)**: For user-facing APIs and inter-service calls that require immediate responses
   - All services expose REST APIs behind an API Gateway
   - Correlation IDs propagated via `X-Correlation-ID` header
   - Circuit breakers protect against downstream failures

2. **Event-Driven (asynchronous)**: For notifications, audit events, reconciliation
   - AWS SQS for durable message delivery
   - RabbitMQ for local development
   - Exactly-once processing via `processed_events` idempotency table

3. **Saga Pattern**: For distributed checkout transactions
   - Orchestrator-based saga in `CheckoutSaga`
   - Compensation actions for each step (rollback on failure)

## Consequences

- **Positive**: Clear boundaries, independent deployability, fault isolation
- **Negative**: Eventual consistency in async flows requires idempotency

---

# ADR-002: Authentication and Authorization
# Status: Accepted

## Decision

- **JWT (RS256)** for stateless auth between services
- **Argon2id** for password hashing (tuned: memory=65536, iterations=3, parallelism=4)
- **Refresh token rotation** with token family invalidation on reuse
- **RBAC** with deny-by-default, ownership predicates for booking access

---

# ADR-003: Data Encryption Strategy
# Status: Accepted

## Decision

- **Envelope encryption via AWS KMS** for identity documents and PII
- **TLS 1.2+** enforced at ALB and CloudFront
- **RDS encryption at rest** using AWS-managed KMS key
- **Tamper-evident audit log** using SHA-256 hash chaining

---

# ADR-004: Observability Strategy
# Status: Accepted

## Decision

- **OpenTelemetry** with AWS ADOT collector sidecar in every ECS task
- **AWS X-Ray** compatible tracing (W3C TraceContext propagation)
- **Pino structured logging** with correlation ID injection
- **CloudWatch** dashboards with SLO-based burn-rate alarms
