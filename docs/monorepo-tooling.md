# Monorepo Tooling Guide

## Overview

The Voya platform is a pnpm workspace monorepo with 9 services, 1 web app, and 4 shared packages, orchestrated by Turborepo.

## Workspace Layout

```
marriott-voya/
├── apps/
│   └── frontend/          # Next.js 14 App Router
├── packages/
│   ├── contracts/         # @travel/contracts — Zod schemas + inferred types
│   ├── observability/     # @travel/observability — Pino logger + OTel
│   ├── shared/            # @travel/shared — validation middleware, utilities
│   └── queue/             # @travel/queue — AMQP/SQS port
├── services/
│   ├── auth-service/
│   ├── booking-service/
│   ├── payment-service/
│   ├── flight-service/
│   ├── hotel-service/
│   ├── car-service/
│   ├── user-service/
│   ├── ai-orchestration/
│   └── api-gateway/
└── tools/
    └── workspace-lint/    # Catalog drift and workspace protocol checker
```

## Version Catalog

All shared runtime dependencies are pinned in `pnpm-workspace.yaml` under `catalog:`.

**Rule**: every `package.json` that uses a catalogued dependency MUST reference it as `"catalog:"`, not a literal version. The `workspace-lint` tool enforces this and runs as a CI gate.

To add a new catalogued dependency:
1. Add it to the `catalog:` section in `pnpm-workspace.yaml`
2. Reference it as `"catalog:"` in your package's `dependencies`

For a legitimately different major version, use a named catalog:
```yaml
catalogs:
  legacy:
    zod: "^2.21.0"
```
Then reference as `"catalog:legacy"` with a comment justifying the divergence.

## Turborepo Task Graph

```
contract:gen → typecheck → build → test:unit → test:integration
lint (parallel, no deps)
dev (persistent, uncached)
```

Key task properties:
- `build` — cacheable, outputs: `dist/`, `.next/`
- `typecheck` — depends on `contract:gen` + upstream `build`
- `test:unit` — cacheable per package inputs
- `test:integration` — never cached (requires Docker Compose stack)
- `dev` — persistent, never cached

## Remote Caching

Configure remote caching via environment variables:

```bash
export TURBO_TOKEN=<your-vercel-token>
export TURBO_TEAM=<your-team-slug>
export TURBO_REMOTE_CACHE_SIGNATURE_KEY=<signing-secret>  # never commit
```

Cache misses fall back to local computation silently. Missing token ≠ build failure.

## Toolchain Pins

| Tool  | Version  |
|-------|----------|
| Node  | >=20.0.0 |
| pnpm  | 11.18.0  |

The `packageManager` field in `package.json` pins the exact pnpm version. pnpm's `use-node-version` or `.nvmrc` can pin Node.

## Workspace Lint

```bash
pnpm --filter @travel/workspace-lint run workspace-lint
```

Checks:
- Catalogued dependencies use `"catalog:"` prefix (not literal versions)
- Internal packages use `"workspace:*"` protocol
- `engines` fields are consistent with the root

Exit code 1 with a per-field violation report blocks CI.

## Common Commands

```bash
# Install all dependencies
pnpm install

# Build affected packages
pnpm turbo run build

# Typecheck all
pnpm turbo run typecheck

# Test all
pnpm turbo run test

# Lint all
pnpm turbo run lint

# Clean all build outputs
pnpm turbo run clean

# Dev (watch mode)
pnpm turbo run dev
```

## Troubleshooting

**Frozen lockfile error in CI**: run `pnpm install` locally and commit `pnpm-lock.yaml`.

**Cyclic dependency error**: `turbo` will detect cycles at graph construction time with an actionable message. Never add a `workspace:` reference that would create a cycle.

**Cache poison concern**: CI enforces `TURBO_REMOTE_CACHE_SIGNATURE_KEY` so only signed artefacts are accepted. Developer machines without the key fall back to local caching.
