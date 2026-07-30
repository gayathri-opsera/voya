# SOC 2 Type II — Observation Window

**Version:** 0.1 (Draft — WO-100)  
**Last updated:** 2026-07-30

---

## Observation Window Start Date

| Field | Value |
|---|---|
| **Start date** | Phase 0 exit (target: TBD — must be set before first enterprise customer onboarding) |
| **Duration** | 3 months minimum (Type II) |
| **Earliest Type II report date** | Start date + 3 months |
| **Auditor** | TBD |

> **Critical:** The observation window must begin at Phase 0 exit, not at the first enterprise sales conversation. Delaying the start date makes the Type II report the critical path to enterprise revenue. The Compliance and Risk Lead must confirm the start date before the platform enters production.

---

## Controls Operating Continuously from Start Date

The following controls must be in continuous operation from the observation window start date. Gaps or lapses in evidence collection will require explaining to auditors.

| Control ID | Description | Evidence cadence | Evidence destination |
|---|---|---|---|
| SOC2-CC6-1-LOGICAL-ACCESS | RBAC enforced at all service boundaries | Every access event (real-time) | CloudWatch `/voya/audit/access` |
| SOC2-CC7-2-ANOMALY-DETECTION | Structured logs with anomaly alerting | Real-time; alert review weekly | CloudWatch Alarms + runbook |
| SOC2-CC8-1-CHANGE-MANAGEMENT | All changes via reviewed PRs; WO traceability | Every merge (real-time) | GitHub PR history; Forge WO records |
| PCI-REQ-10-LOG-ACCESS | Auth and payment audit logs retained 1 year | Daily export to S3 evidence bucket | S3 `voya-audit-evidence/` |
| OWASP-A09-SECURITY-LOGGING | PII-redacted structured logs for all services | Continuous | CloudWatch `/voya/services/*` |
| PCI-REQ-6-SECURE-DEVELOPMENT | SAST scan on every PR; no critical findings merged | Per PR (real-time) | CI pipeline scan results |

---

## Evidence Cadence Detail

### Daily Evidence

- Auth audit log export to S3 `voya-audit-evidence/auth/YYYY/MM/DD/`
- Payment audit log export to S3 `voya-audit-evidence/payment/YYYY/MM/DD/`
- Failed-login count metric (CloudWatch custom metric)
- Active-session count metric

### Weekly Evidence

- Security alert review runbook executed; outcome documented in incident tracker
- Dependency vulnerability scan output reviewed; findings triaged

### Monthly Evidence

- Access review: confirm no stale user accounts or over-privileged roles
- Log retention compliance check: confirm 30-day app logs and 1-year audit logs are intact

### Per-PR Evidence

- CI security scan output attached to PR as check annotation
- Forge WO reference present in commit message
- Code review approval recorded in GitHub

---

## Gaps and Remediation Plan

| Gap | Target resolution | Story |
|---|---|---|
| Health endpoints not yet implemented for services | Before observation window start | planned |
| CloudWatch alert configuration not yet deployed | Before observation window start | planned |
| S3 evidence-archive bucket and daily export pipeline not yet created | Before observation window start | planned |
| RBAC enforcement only partial (auth-service role tables exist; enforcement middleware planned) | Before observation window start | WO-021 (planned) |
