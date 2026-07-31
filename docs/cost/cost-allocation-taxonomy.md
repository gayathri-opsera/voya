## Cost Allocation Taxonomy — WO-089

### AWS Resource Tagging Strategy

All AWS resources MUST carry the following tags:

| Tag Key | Required | Example Values |
|---------|----------|----------------|
| `Project` | Yes | `marriott-voya` |
| `Environment` | Yes | `production`, `staging`, `development` |
| `Service` | Yes | `user-service`, `booking-service`, `payment-service` |
| `CostCenter` | Yes | `platform`, `ai`, `infrastructure` |
| `Owner` | Yes | `platform-team` |
| `ManagedBy` | Yes | `terraform` |

### Cost Centers

| Center | Resources | Monthly Budget |
|--------|-----------|----------------|
| `platform` | ECS, ALB, RDS, Redis, SQS | $8,000/mo |
| `ai` | LLM API calls, AI service ECS | $2,000/mo |
| `infrastructure` | VPC, CloudFront, WAF, KMS | $1,500/mo |
| `total` | All resources | $11,500/mo |

### Budget Alarms (CloudWatch Budgets)

```hcl
resource "aws_budgets_budget" "total" {
  name         = "marriott-voya-total"
  budget_type  = "COST"
  limit_amount = "12000"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator = "GREATER_THAN"
    threshold           = 80
    threshold_type      = "PERCENTAGE"
    notification_type   = "ACTUAL"
    subscriber_email_addresses = ["platform-team@marriott-voya.com"]
  }

  notification {
    comparison_operator = "GREATER_THAN"
    threshold           = 100
    threshold_type      = "PERCENTAGE"
    notification_type   = "FORECASTED"
    subscriber_email_addresses = ["platform-team@marriott-voya.com"]
  }
}
```

### Cost Reporting Schedule

- **Daily**: Automated Slack notification of prior-day spend by cost center
- **Weekly**: AWS Cost Explorer report emailed to finance team
- **Monthly**: Cost analysis review meeting with engineering leads
