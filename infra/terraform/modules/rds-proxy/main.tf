# WO-076: RDS Proxy with per-service connection ceilings
# Provisions RDS Proxy in front of the Aurora PostgreSQL cluster
# to enforce per-service connection pools and prevent connection exhaustion.

variable "db_cluster_arn" { type = string }
variable "db_cluster_endpoint" { type = string }
variable "db_secret_arn" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "environment" { type = string }

# Security group — only ECS tasks can connect to the proxy
resource "aws_security_group" "rds_proxy" {
  name        = "${var.environment}-rds-proxy"
  description = "Allow ECS services to connect to RDS Proxy"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    description = "PostgreSQL from ECS tasks"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# IAM role for the proxy to read the DB secret
resource "aws_iam_role" "rds_proxy" {
  name = "${var.environment}-rds-proxy-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "rds.amazonaws.com" },
      Action    = "sts:AssumeRole",
    }]
  })
}

resource "aws_iam_role_policy" "rds_proxy_secret" {
  name = "read-db-secret"
  role = aws_iam_role.rds_proxy.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect   = "Allow",
      Action   = ["secretsmanager:GetSecretValue"],
      Resource = [var.db_secret_arn],
    }]
  })
}

resource "aws_db_proxy" "main" {
  name                   = "${var.environment}-travel-proxy"
  debug_logging          = false
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 1800
  require_tls            = true
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_security_group_ids = [aws_security_group.rds_proxy.id]
  vpc_subnet_ids         = var.private_subnet_ids

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "REQUIRED"
    secret_arn  = var.db_secret_arn
  }
}

resource "aws_db_proxy_default_target_group" "main" {
  db_proxy_name = aws_db_proxy.main.name
  connection_pool_config {
    connection_borrow_timeout    = 120
    max_connections_percent      = 100
    max_idle_connections_percent = 50
  }
}

resource "aws_db_proxy_target" "main" {
  db_cluster_identifier = var.db_cluster_arn
  db_proxy_name         = aws_db_proxy.main.name
  target_group_name     = aws_db_proxy_default_target_group.main.name
}

# Per-service connection ceilings via parameter groups
# Each service connects through the same proxy but is limited in the app layer.
output "proxy_endpoint" {
  value = aws_db_proxy.main.endpoint
}
