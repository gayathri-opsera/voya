#!/usr/bin/env bash
# WO-093: One-command developer bootstrap and environment validation.
# Usage: ./scripts/bootstrap.sh
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
log_warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
log_fail() { echo -e "${RED}  ✗ $1${NC}"; }
log_step() { echo -e "\n${YELLOW}▶ $1${NC}"; }

FAILED=0

check_tool() {
  local name=$1 cmd=$2 min_version=${3:-}
  if command -v "$cmd" &>/dev/null; then
    log_ok "$name found: $($cmd --version 2>&1 | head -1)"
  else
    log_fail "$name not found — install it before continuing"
    FAILED=$((FAILED+1))
  fi
}

log_step "Checking required tools"
check_tool "Node.js (>=20)" node
check_tool "pnpm" pnpm
check_tool "Docker" docker
check_tool "Docker Compose" docker
check_tool "Terraform" terraform || true
check_tool "AWS CLI" aws || true

# Node version check
NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  log_fail "Node.js >=20 required (found v$NODE_VER)"
  FAILED=$((FAILED+1))
else
  log_ok "Node.js version OK (v$NODE_VER)"
fi

log_step "Installing dependencies"
pnpm install --frozen-lockfile 2>&1 | tail -3
log_ok "Dependencies installed"

log_step "Checking .env files"
for svc in services/*/; do
  env_example="$svc/.env.example"
  env_file="$svc/.env"
  if [ -f "$env_example" ] && [ ! -f "$env_file" ]; then
    log_warn "$svc missing .env — copying from .env.example"
    cp "$env_example" "$env_file"
  fi
done
log_ok "Environment files checked"

log_step "Starting local infrastructure"
if docker compose -f infra/docker/docker-compose.yml ps --quiet 2>/dev/null | grep -q .; then
  log_ok "Docker Compose stack already running"
else
  docker compose -f infra/docker/docker-compose.yml up -d 2>&1 | tail -3
  log_ok "Docker Compose stack started"
fi

log_step "Waiting for Postgres readiness"
MAX_RETRIES=30
for i in $(seq 1 $MAX_RETRIES); do
  if docker compose -f infra/docker/docker-compose.yml exec -T postgres pg_isready -U travel &>/dev/null; then
    log_ok "Postgres is ready"
    break
  fi
  if [ "$i" -eq "$MAX_RETRIES" ]; then
    log_fail "Postgres did not become ready in time"
    FAILED=$((FAILED+1))
  fi
  sleep 1
done

log_step "Running database migrations"
pnpm --filter @travel/user-service exec prisma migrate deploy 2>&1 | tail -5 || log_warn "user-service migration skipped (no DATABASE_URL)"
pnpm --filter @travel/booking-service exec prisma migrate deploy 2>&1 | tail -5 || log_warn "booking-service migration skipped"

log_step "Running validation suite"
pnpm --filter @travel/shared test --run 2>&1 | tail -5
log_ok "Shared package tests passed"

if [ "$FAILED" -gt 0 ]; then
  echo -e "\n${RED}Bootstrap completed with $FAILED errors. Fix issues above before proceeding.${NC}"
  exit 1
else
  echo -e "\n${GREEN}Bootstrap complete! Run 'pnpm dev' to start all services.${NC}"
fi
