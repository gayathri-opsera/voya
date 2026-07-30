# @travel/contracts

Shared Zod schemas and TypeScript types for the Voya travel platform.

This is the **highest fan-in package** in the repository — every service and the web
app depend on it. Follow the versioning policy before making any schema change.

## Quick Start

```sh
pnpm add @travel/contracts
```

```ts
import { FlightSearchRequestSchema } from "@travel/contracts/search";
import { ErrorEnvelopeSchema } from "@travel/contracts/errors";
```

## Subpath Exports

| Import path | Contains |
|---|---|
| `@travel/contracts` | All schemas (barrel) |
| `@travel/contracts/search` | Flight, hotel, car search + UnifiedOffer |
| `@travel/contracts/booking` | Booking requests, responses, itinerary |
| `@travel/contracts/payment` | Payment intents, records, refunds |
| `@travel/contracts/auth` | Register, login, tokens, ActorContext |
| `@travel/contracts/user` | User profile and travel preferences |
| `@travel/contracts/events` | Domain events (booking, notification, payment) |
| `@travel/contracts/errors` | Error codes, envelope, serialiser |

## Schema Registry & Baselines

Every exported schema is registered in `src/registry.ts` with a stable identifier.
A committed JSON Schema baseline lives under `contract-baselines/<schema-id>.json`.

The CI gate fails when:
1. A regenerated baseline differs from the committed file (schema drift).
2. A breaking change is not paired with a major-version bump.

See [`docs/contracts-versioning.md`](../../docs/contracts-versioning.md) for the full policy.

## Updating Schemas

```sh
# 1. Edit src/<domain>/index.ts
# 2. Regenerate baselines
GENERATE_BASELINES=1 pnpm test

# 3. Review the diff
git diff contract-baselines/

# 4. If breaking, bump package.json version to next major
# 5. Commit schema + updated baselines together
```

## Running Tests

```sh
pnpm test           # all 144+ tests
pnpm test:watch     # watch mode
```

## Test Runner

> **Assumption (pending tech-lead ratification):** Vitest 2.x
>
> Ratification owner: Tech Lead / Maintainer of `@travel/contracts`.
> The assertion layer is isolated so a switch to Jest 29 does not require rewriting tests.

## Versioning

Follows Semantic Versioning. See [`docs/contracts-versioning.md`](../../docs/contracts-versioning.md).

| Change type | Required bump |
|---|---|
| New optional field, new response enum member | MINOR |
| Removed field, newly required field, type change, request enum narrowed | **MAJOR** |
