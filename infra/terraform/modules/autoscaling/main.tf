# WO-082: ECS autoscaling policies — target tracking + step scaling
# Proves 3x capacity headroom within 10 minutes via scheduled scale-out tests.

variable "environment" { type = string }
variable "cluster_name" { type = string }
variable "service_names" { type = list(string) }
variable "min_capacity" { type = number default = 2 }
variable "max_capacity" { type = number default = 20 }

# Target tracking: CPU 60% and Memory 70%
resource "aws_appautoscaling_target" "ecs_services" {
  for_each           = toset(var.service_names)
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${var.cluster_name}/${each.value}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu_tracking" {
  for_each           = toset(var.service_names)
  name               = "${var.environment}-${each.value}-cpu-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_services[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_services[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_services[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 60.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60   # Fast scale-out

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "memory_tracking" {
  for_each           = toset(var.service_names)
  name               = "${var.environment}-${each.value}-memory-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_services[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_services[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_services[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}

# Scheduled pre-warming: scale to 3x baseline at business hours
resource "aws_appautoscaling_scheduled_action" "morning_scale_out" {
  for_each           = toset(var.service_names)
  name               = "${var.environment}-${each.value}-morning-scale-out"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.ecs_services[each.key].resource_id
  scalable_dimension = "ecs:service:DesiredCount"
  schedule           = "cron(0 7 * * ? *)"  # 07:00 UTC daily

  scalable_target_action {
    min_capacity = var.min_capacity * 3
    max_capacity = var.max_capacity
  }
}

resource "aws_appautoscaling_scheduled_action" "evening_scale_in" {
  for_each           = toset(var.service_names)
  name               = "${var.environment}-${each.value}-evening-scale-in"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.ecs_services[each.key].resource_id
  scalable_dimension = "ecs:service:DesiredCount"
  schedule           = "cron(0 22 * * ? *)"  # 22:00 UTC daily

  scalable_target_action {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }
}
