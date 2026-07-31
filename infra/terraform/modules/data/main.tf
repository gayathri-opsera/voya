# Data tier — WO-083: RDS Proxy, ElastiCache, SQS, KMS, security groups
#
# This module provisions the data tier:
# - RDS PostgreSQL (Multi-AZ) with RDS Proxy for connection pooling
# - ElastiCache Redis (cluster mode for auth session cache)
# - SQS FIFO queues (booking-events, notification-events)
# - KMS CMKs for database, cache, and PII encryption

variable "environment" {}
variable "vpc_id" {}
variable "private_subnet_ids" { type = list(string) }

# ─── KMS Keys ────────────────────────────────────────────────────────────────

resource "aws_kms_key" "database" {
  description             = "voya-${var.environment}: RDS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = { Name = "voya-${var.environment}-rds-key", Purpose = "database" }
}

resource "aws_kms_key" "pii" {
  description             = "voya-${var.environment}: PII envelope encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = { Name = "voya-${var.environment}-pii-key", Purpose = "pii", Classification = "restricted" }
}

resource "aws_kms_key" "cache" {
  description             = "voya-${var.environment}: ElastiCache encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = { Name = "voya-${var.environment}-cache-key", Purpose = "cache" }
}

# ─── Security Groups ─────────────────────────────────────────────────────────

resource "aws_security_group" "rds" {
  name_prefix = "voya-${var.environment}-rds-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.rds_proxy.id]
    description     = "PostgreSQL from RDS Proxy only"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds_proxy" {
  name_prefix = "voya-${var.environment}-rds-proxy-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "PostgreSQL from private subnets"
  }
}

resource "aws_security_group" "redis" {
  name_prefix = "voya-${var.environment}-redis-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "Redis from private subnets"
  }
}

# ─── RDS PostgreSQL ──────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "main" {
  name       = "voya-${var.environment}"
  subnet_ids = var.private_subnet_ids
}

resource "aws_db_instance" "postgres" {
  identifier        = "voya-${var.environment}"
  engine            = "postgres"
  engine_version    = "16.3"
  instance_class    = "db.t3.medium"
  allocated_storage = 50
  storage_encrypted = true
  kms_key_id        = aws_kms_key.database.arn

  db_name  = "voya"
  username = "voya_admin"
  password = aws_secretsmanager_secret_version.db_password.secret_string

  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  deletion_protection = true
  skip_final_snapshot = false

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = { Name = "voya-${var.environment}-postgres" }
}

# ─── RDS Proxy ───────────────────────────────────────────────────────────────

resource "aws_db_proxy" "main" {
  name                   = "voya-${var.environment}-proxy"
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
    secret_arn  = aws_secretsmanager_secret.db_password.arn
  }
}

# ─── ElastiCache Redis ───────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "main" {
  name       = "voya-${var.environment}"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_replication_group" "session_cache" {
  replication_group_id = "voya-${var.environment}-cache"
  description          = "Session cache for auth service"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t3.micro"
  num_cache_clusters   = 2

  at_rest_encryption_enabled = true
  kms_key_id                 = aws_kms_key.cache.arn
  transit_encryption_enabled = true

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]
}

# ─── SQS FIFO Queues ─────────────────────────────────────────────────────────

resource "aws_sqs_queue" "booking_events" {
  name                        = "voya-${var.environment}-booking-events.fifo"
  fifo_queue                  = true
  content_based_deduplication = false
  sqs_managed_sse_enabled     = false
  kms_master_key_id           = aws_kms_key.database.arn
  message_retention_seconds   = 86400
  visibility_timeout_seconds  = 60
}

resource "aws_sqs_queue" "notification_events" {
  name                        = "voya-${var.environment}-notification-events.fifo"
  fifo_queue                  = true
  content_based_deduplication = false
  sqs_managed_sse_enabled     = false
  kms_master_key_id           = aws_kms_key.database.arn
  message_retention_seconds   = 86400
  visibility_timeout_seconds  = 60
}

# Dead-letter queues
resource "aws_sqs_queue" "booking_events_dlq" {
  name                    = "voya-${var.environment}-booking-events-dlq.fifo"
  fifo_queue              = true
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "notification_events_dlq" {
  name                    = "voya-${var.environment}-notification-events-dlq.fifo"
  fifo_queue              = true
  message_retention_seconds = 1209600
}

# ─── Secrets ─────────────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "voya/${var.environment}/db-password"
  recovery_window_in_days = 7
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

# ─── IAM for RDS Proxy ───────────────────────────────────────────────────────

resource "aws_iam_role" "rds_proxy" {
  name = "voya-${var.environment}-rds-proxy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "rds.amazonaws.com" }
    }]
  })
}

# ─── Outputs ─────────────────────────────────────────────────────────────────

output "rds_proxy_endpoint" {
  value     = aws_db_proxy.main.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = aws_elasticache_replication_group.session_cache.primary_endpoint_address
  sensitive = true
}

output "booking_events_queue_url" {
  value = aws_sqs_queue.booking_events.id
}

output "pii_kms_key_arn" {
  value     = aws_kms_key.pii.arn
  sensitive = true
}
