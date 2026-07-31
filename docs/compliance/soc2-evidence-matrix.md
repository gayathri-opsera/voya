# SOC 2 Continuous Evidence Collection — WO-105
# Status: Implemented
# Last Updated: 2026-07-30

## SOC 2 Type II Control Matrix — Evidence Automation

### CC6 Logical and Physical Access Controls

| Control | Automated Evidence | Cadence | Owner |
|---------|-------------------|---------|-------|
| CC6.1 User authentication enforced | Auth middleware test coverage report | Per-commit | CI |
| CC6.2 MFA for privileged access | AWS IAM access advisor export | Weekly | SecOps |
| CC6.3 Access reviews | IAM unused credentials report | Monthly | SecOps |
| CC6.6 Network segmentation | VPC flow logs + security group audit | Daily | CloudWatch |
| CC6.7 Encryption in transit | Certificate expiry + TLS config scan | Daily | CloudWatch |
| CC6.8 Encryption at rest | RDS/S3 encryption status report | Daily | AWS Config |

### CC7 System Operations

| Control | Automated Evidence | Cadence |
|---------|-------------------|---------|
| CC7.1 Vulnerability management | Trivy scan results in CI artifacts | Per-commit |
| CC7.2 Malware protection | ECR image scan results | Per image push |
| CC7.4 Security incidents | CloudWatch alarm history export | Monthly |
| CC7.5 Change management | Git commit history + deployment records | Per-deployment |

### CC8 Change Management

| Control | Evidence | Cadence |
|---------|----------|---------|
| CC8.1 Change authorization | PR approvals + CI gate pass records | Per-commit |
| CC8.2 Rollback capability | ECS deployment circuit-breaker logs | Per-deployment |

### CC9 Risk Mitigation

| Control | Evidence | Cadence |
|---------|----------|---------|
| CC9.2 Vendor risk | SupplierPort allow-list config + egress audit | Monthly |

---

## Automated Evidence Collection Lambda

Deploy `infra/lambda/soc2-evidence-collector` on a monthly schedule to:
1. Export IAM credential reports
2. Pull AWS Config compliance snapshots
3. Export CloudTrail management events
4. Archive to S3 `travel-audit-evidence-{year}-{month}`
5. Notify compliance team via SNS

## Compliance Alerting

CloudWatch alarms tied to SOC 2 controls:
- `soc2-access-review-overdue`: Fires if access review >31 days old
- `soc2-cert-expiry`: Fires 30 days before TLS cert expiry
- `soc2-vuln-scan-failed`: Fires if CI Trivy scan fails
