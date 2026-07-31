# Operational Runbooks — WO-109
## Critical Failure Mode Playbooks

---

## Runbook: High Payment Failure Rate

**Alert**: `payment-service-5xx > 1% for 5 minutes`

### Triage Steps
1. Check CloudWatch logs: `/ecs/production/payment-service`
2. Verify Stripe status: [status.stripe.com](https://status.stripe.com)
3. Check RDS connection count via CloudWatch `DatabaseConnections` metric

### Mitigation
- **Stripe outage**: Activate `PAYMENT_FALLBACK_MODE=true` env var → returns `503 Retry-After`
- **DB connection exhaustion**: Scale down non-critical services, increase RDS Proxy `max_connections_percent`
- **Circuit breaker open**: Check `payment_circuit_state` metric; wait for auto-recovery or manually reset via admin API

### Escalation
- P0 (>5% failure rate for >10 min): Page on-call engineer via PagerDuty

---

## Runbook: Booking Service Stuck PENDING Bookings

**Alert**: `pending_bookings_age_p99 > 35 minutes`

### Triage Steps
1. Check if `BookingExpirySweep` cron job is running (ECS scheduled task)
2. Verify no lock contention in `bookings` table: `SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock'`
3. Check queue depth: SQS `ApproximateNumberOfMessagesNotVisible`

### Mitigation
- Manually trigger expiry sweep: `aws ecs run-task --cluster prod --task-definition expiry-sweep`
- If DB locked: kill blocking queries via RDS console

---

## Runbook: AI Service Token Budget Exhaustion

**Alert**: `token_budget_exceeded_rate > 10% of sessions`

### Triage Steps
1. Check which sessions are hitting limits: CloudWatch Insights query on `BudgetExceededError`
2. Review recent prompt changes in `PromptInjectionDefence`

### Mitigation
- Increase `MAX_TOKENS_PER_SESSION` env var (requires redeployment)
- Activate `STREAMING_CHAT=false` feature flag to disable AI features temporarily

---

## Runbook: RDS Proxy Connection Saturation

**Alert**: `rds_proxy_connection_borrow_timeout > 5/min`

### Steps
1. Identify which service is holding connections: CloudWatch RDS Proxy `ClientConnections` by source
2. Verify `idle_client_timeout` is set to 1800s in Terraform
3. Restart the offending service pod: `aws ecs update-service --force-new-deployment`

---

## Runbook: SLO Error Budget Burn-Rate Alert

**Alert**: `error_budget_fast_burn > 14.4x`

### Response SLAs
| Burn Rate | Response Time |
|-----------|---------------|
| >14.4x (1h burn in 5min) | Immediate page |
| >6x (2h burn in 20min)  | Page in 15 min |
| >3x (6h burn in 1h)     | Ticket next hour |
| >1x (normal burn)       | Daily review |

### Steps
1. Identify error class (5xx vs latency)
2. Check `HTTPCode_Target_5XX_Count` by service
3. Roll back last deployment if error rate spiked post-deploy: `aws ecs update-service --task-definition PREVIOUS_ARN`
