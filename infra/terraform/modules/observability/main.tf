# WO-010: ADOT collector sidecar and telemetry IAM permissions
# WO-011: CloudWatch dashboards and SLO-driven alerting

variable "environment" { type = string }
variable "region" { type = string default = "us-east-1" }
variable "log_group_name" { type = string default = "/ecs/travel" }
variable "alarm_sns_arn" { type = string }
variable "availability_slo_pct" { type = number default = 99.9 }
variable "latency_p99_ms" { type = number default = 3000 }

# ---------------------------------------------------------------------------
# ADOT Collector Task Definition (sidecar)
# ---------------------------------------------------------------------------

resource "aws_iam_role" "adot_task_role" {
  name = "${var.environment}-adot-task-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "adot_xray" {
  name = "xray-otel"
  role = aws_iam_role.adot_task_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["xray:PutTraceSegments", "xray:PutTelemetryRecords", "xray:GetSamplingRules",
                    "xray:GetSamplingTargets", "xray:GetSamplingStatisticSummaries"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData", "logs:CreateLogStream", "logs:PutLogEvents",
                    "logs:CreateLogGroup", "logs:DescribeLogGroups", "logs:DescribeLogStreams"]
        Resource = "*"
      }
    ]
  })
}

# ADOT sidecar container definition (injected into every ECS task)
locals {
  adot_sidecar = jsonencode({
    name      = "aws-otel-collector"
    image     = "public.ecr.aws/aws-observability/aws-otel-collector:latest"
    essential = false
    command   = ["--config=/etc/ecs/ecs-default-config.yaml"]
    portMappings = [
      { containerPort = 4317, protocol = "tcp" },  # OTLP gRPC
      { containerPort = 4318, protocol = "tcp" },  # OTLP HTTP
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "${var.log_group_name}/adot"
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "adot"
      }
    }
  })
}

# ---------------------------------------------------------------------------
# CloudWatch Dashboard — WO-011
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_dashboard" "travel_ops" {
  dashboard_name = "${var.environment}-travel-ops"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          title  = "API Availability (5xx error rate)"
          period = 60
          stat   = "Average"
          metrics = [["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count"]]
        }
      },
      {
        type = "metric"
        properties = {
          title  = "API p99 Latency (ms)"
          period = 60
          stat   = "p99"
          metrics = [["AWS/ApplicationELB", "TargetResponseTime"]]
        }
      },
      {
        type = "metric"
        properties = {
          title  = "Booking Funnel Conversion"
          period = 300
          stat   = "Sum"
          metrics = [
            ["TravelPlatform/Funnel", "SearchInitiated"],
            ["TravelPlatform/Funnel", "BookingConfirmed"],
          ]
        }
      },
      {
        type = "metric"
        properties = {
          title   = "Error Budget Burn Rate"
          period  = 300
          stat    = "Sum"
          metrics = [["TravelPlatform/SLO", "ErrorBudgetBurnRate"]]
        }
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# SLO-Driven CloudWatch Alarms — WO-011
# ---------------------------------------------------------------------------

# Availability alarm: fires when 5xx rate > 0.1% (99.9% SLO)
resource "aws_cloudwatch_metric_alarm" "availability_slo" {
  alarm_name          = "${var.environment}-availability-slo-breach"
  alarm_description   = "API availability SLO breach — 5xx rate > 0.1%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 3   # 3 errors per minute threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alarm_sns_arn]
  ok_actions          = [var.alarm_sns_arn]
}

# p99 latency alarm
resource "aws_cloudwatch_metric_alarm" "latency_p99_slo" {
  alarm_name          = "${var.environment}-p99-latency-slo-breach"
  alarm_description   = "p99 latency > ${var.latency_p99_ms}ms SLO breach"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 5
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p99"
  threshold           = var.latency_p99_ms / 1000.0  # Convert ms to seconds
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alarm_sns_arn]
}

# Fast burn alarm: 14.4x burn rate (1 hour budget burn in 5 minutes)
resource "aws_cloudwatch_metric_alarm" "fast_burn" {
  alarm_name          = "${var.environment}-error-budget-fast-burn"
  alarm_description   = "Error budget fast burn — 14.4x burn rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FastBurnRate"
  namespace           = "TravelPlatform/SLO"
  period              = 300
  statistic           = "Average"
  threshold           = 14.4
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alarm_sns_arn]
}

output "adot_sidecar_definition" {
  value = local.adot_sidecar
}

output "dashboard_url" {
  value = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${var.environment}-travel-ops"
}
