terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state backend — WO-079
  backend "s3" {
    bucket         = "voya-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "voya-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "voya"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

module "network" {
  source      = "../../modules/network"
  environment = var.environment
  vpc_cidr    = "10.0.0.0/16"
}

module "data_tier" {
  source             = "../../modules/data"
  environment        = var.environment
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
}
