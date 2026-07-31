/**
 * Terraform network foundation — WO-079: VPC, subnets, NAT gateway, remote state.
 *
 * This file documents the Terraform configuration structure.
 * The actual .tf files are in infra/terraform/modules/network/.
 */

# VPC configuration
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "environment" {
  description = "Deployment environment (staging, production)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "voya-${var.environment}-vpc"
    Environment = var.environment
    Project     = "voya"
    ManagedBy   = "terraform"
  }
}

# Public subnets (ALB, NAT gateways)
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name        = "voya-${var.environment}-public-${count.index + 1}"
    Environment = var.environment
    Tier        = "public"
  }
}

# Private subnets (ECS tasks, RDS, ElastiCache)
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "voya-${var.environment}-private-${count.index + 1}"
    Environment = var.environment
    Tier        = "private"
  }
}

# Internet gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "voya-${var.environment}-igw"
    Environment = var.environment
  }
}

# NAT gateway (one per AZ for HA)
resource "aws_eip" "nat" {
  count  = 2
  domain = "vpc"

  tags = {
    Name        = "voya-${var.environment}-nat-eip-${count.index + 1}"
    Environment = var.environment
  }
}

resource "aws_nat_gateway" "main" {
  count         = 2
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name        = "voya-${var.environment}-nat-${count.index + 1}"
    Environment = var.environment
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# Outputs
output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}
