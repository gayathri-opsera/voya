# Voya SLIs, SLOs, and Error Budget Policy — WO-108

## Service Level Indicators (SLIs)

### Booking API (booking-service)
| SLI | Measurement | Good Event |
|-----|-------------|------------|
| Request availability | HTTP status code | 2xx or 4xx (not 5xx) |
| Request latency | p95 response time | < 500ms |
| Checkout success rate | Saga completion rate | Successful saga outcome |

### Payment API (payment-service)
| SLI | Measurement | Good Event |
|-----|-------------|------------|
| PaymentIntent latency | p99 response time | < 1000ms |
| Webhook processing | Processing success | Not duplicate/failed |

### Auth Service (auth-service)
| SLI | Measurement | Good Event |
|-----|-------------|------------|
| Login latency | p95 response time | < 300ms |
| Token validation | Success rate | Valid token returned |

### Search API (search-service)
| SLI | Measurement | Good Event |
|-----|-------------|------------|
| Search latency | p95 response time | < 500ms |
| Cache hit rate | Cache hit percentage | > 70% |

---

## Service Level Objectives (SLOs)

| Service | SLO | 30-day Target | Error Budget (monthly) |
|---------|-----|---------------|------------------------|
| Booking API availability | 99.9% | 43.2min downtime/month | 43.2 minutes |
| Booking API latency p95 | 99.5% requests < 500ms | — | — |
| Payment API availability | 99.95% | 21.6min downtime/month | 21.6 minutes |
| Auth login latency p95 | 99.5% requests < 300ms | — | — |
| Search availability | 99.9% | 43.2min downtime/month | 43.2 minutes |

---

## Error Budget Policy

### Burn Rate Alerts (CloudWatch Alarms)

**1-hour burn rate alert (page-worthy):**
- Threshold: 14.4× burn rate over 1 hour
- Alert: PagerDuty P1 — immediate response required
- Action: Investigate and rollback if necessary

**6-hour burn rate alert:**
- Threshold: 6× burn rate over 6 hours
- Alert: PagerDuty P2 — investigate within 30 minutes
- Action: Engineering lead notified

**3-day burn rate alert:**
- Threshold: 3× burn rate over 3 days
- Alert: Slack engineering channel
- Action: Review and plan remediation in sprint

### Error Budget Freeze

When > 50% of monthly error budget is consumed:
- Feature deployments paused until budget replenishes
- Reliability work becomes top priority
- Weekly error budget review added to engineering standup

---

## CloudWatch Metrics

```hcl
# CloudWatch SLO alarm — booking availability
resource "aws_cloudwatch_metric_alarm" "booking_error_rate_high" {
  alarm_name          = "voya-${var.env}-booking-error-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 0.1  # 0.1% error rate threshold
  alarm_description   = "Booking service 5xx error rate exceeds SLO burn rate"
  alarm_actions       = [var.pagerduty_sns_arn]
}

# CloudWatch SLO alarm — booking latency p95
resource "aws_cloudwatch_metric_alarm" "booking_latency_high" {
  alarm_name          = "voya-${var.env}-booking-latency-p95-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 5
  extended_statistic  = "p95"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  threshold           = 0.5  # 500ms
  alarm_actions       = [var.pagerduty_sns_arn]
}
```
