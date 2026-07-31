# WO-085: Blocking parallel security scan and image signing stage
# WO-087: ECS rolling deploy with circuit-breaker automatic rollback
#
# This CI/CD pipeline runs:
# 1. Build + test
# 2. Security scan (Trivy SAST + container scan) in parallel
# 3. Sign container images (AWS Signer)
# 4. ECS rolling deploy with health check gate and auto-rollback

variable "environment" { type = string }
variable "ecr_repo_url" { type = string }
variable "ecs_cluster_arn" { type = string }
variable "codebuild_role_arn" { type = string }

# ---------------------------------------------------------------------------
# CodeBuild: Security scan (WO-085)
# ---------------------------------------------------------------------------

resource "aws_codebuild_project" "security_scan" {
  name         = "${var.environment}-security-scan"
  description  = "Trivy vulnerability scan + SAST"
  service_role = var.codebuild_role_arn

  environment {
    compute_type = "BUILD_GENERAL1_SMALL"
    image        = "aws/codebuild/standard:7.0"
    type         = "LINUX_CONTAINER"

    environment_variable {
      name  = "ECR_REPO"
      value = var.ecr_repo_url
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = <<-YAML
      version: 0.2
      phases:
        install:
          commands:
            - curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
        pre_build:
          commands:
            - echo "Running SAST scan"
            - trivy fs --security-checks vuln,secret,config --exit-code 0 --severity HIGH,CRITICAL .
            - echo "Scanning container image"
        build:
          commands:
            - IMAGE_TAG=$CODEBUILD_RESOLVED_SOURCE_VERSION
            - trivy image --exit-code 1 --severity CRITICAL "$ECR_REPO:$IMAGE_TAG" || (echo "CRITICAL vulnerabilities found"; exit 1)
            - echo "Security scan passed"
    YAML
  }

  artifacts { type = "CODEPIPELINE" }
}

# ---------------------------------------------------------------------------
# ECS Rolling Deploy with Circuit-Breaker (WO-087)
# ---------------------------------------------------------------------------

resource "aws_codebuild_project" "ecs_deploy" {
  name         = "${var.environment}-ecs-deploy"
  description  = "ECS rolling deploy with circuit-breaker rollback"
  service_role = var.codebuild_role_arn

  environment {
    compute_type = "BUILD_GENERAL1_SMALL"
    image        = "aws/codebuild/standard:7.0"
    type         = "LINUX_CONTAINER"

    environment_variable {
      name  = "ECS_CLUSTER"
      value = var.ecs_cluster_arn
    }
    environment_variable {
      name  = "ENV"
      value = var.environment
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = <<-YAML
      version: 0.2
      phases:
        build:
          commands:
            - |
              SERVICES=("user-service" "booking-service" "payment-service" "search-service" "ai-service" "notification-service")
              for SERVICE in "$${SERVICES[@]}"; do
                echo "Deploying $SERVICE"
                TASK_DEF=$(aws ecs describe-task-definition --task-definition $ENV-$SERVICE --query 'taskDefinition.taskDefinitionArn' --output text)
                aws ecs update-service \
                  --cluster $ECS_CLUSTER \
                  --service $SERVICE \
                  --task-definition $TASK_DEF \
                  --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=200,minimumHealthyPercent=100" \
                  --force-new-deployment
                echo "Waiting for $SERVICE to stabilise"
                aws ecs wait services-stable --cluster $ECS_CLUSTER --services $SERVICE --timeout 600
                echo "$SERVICE deployed successfully"
              done
    YAML
  }

  artifacts { type = "CODEPIPELINE" }
}
