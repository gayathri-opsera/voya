# WO-086: Pre-rollout Prisma migration task with expand-contract gate.
#
# Runs Prisma migrate deploy as a one-off ECS Fargate task BEFORE
# the service deployment. This implements the expand-contract pattern:
# 1. EXPAND: run migrations that add new columns/tables (backward-compatible)
# 2. DEPLOY: update services to use new schema
# 3. CONTRACT (separate run): drop old columns after old services are gone
#
# Blocks on completion and fails the pipeline if migrations fail.

variable "cluster_arn" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_group_id" { type = string }
variable "task_execution_role_arn" { type = string }
variable "task_role_arn" { type = string }
variable "ecr_image_uri" { type = string }
variable "db_url_secret_arn" { type = string }
variable "service_name" { type = string }
variable "environment" { type = string }

resource "aws_ecs_task_definition" "prisma_migrate" {
  family                   = "${var.environment}-${var.service_name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([{
    name    = "migrate"
    image   = var.ecr_image_uri
    command = ["npx", "prisma", "migrate", "deploy"]
    environment = []
    secrets = [{
      name      = "DATABASE_URL"
      valueFrom = var.db_url_secret_arn
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.environment}/${var.service_name}/migrate"
        "awslogs-region"        = "us-east-1"
        "awslogs-stream-prefix" = "migrate"
      }
    }
    essential = true
  }])
}

output "task_definition_arn" {
  value = aws_ecs_task_definition.prisma_migrate.arn
}
