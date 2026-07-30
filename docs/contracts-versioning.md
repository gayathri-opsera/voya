# @travel/contracts — Schema Versioning Policy

## Summary

`@travel/contracts` is the highest fan-in package in the Voya repository. A single
incompatible edit can silently break all nine services and the web app simultaneously.
This document defines the rules that make breaking changes **impossible to merge unreviewed**.

---

## Semantic Versioning

`@travel/contracts` follows [Semantic Versioning 2.0.0](https://semver.org):

| Version bump | Trigger |
|---|---|
| **PATCH** (`1.0.x`) | Documentation, comment changes, test additions — no schema changes |
| **MINOR** (`1.x.0`) | Additive changes: new optional fields, new response enum members, new schemas |
| **MAJOR** (`x.0.0`) | Breaking changes: removed fields, newly required fields, narrowed enums, type changes |

The CI gate enforces this: if the compatibility classifier detects a breaking change
but the package version has **not** been bumped to a new major, the build **fails**.

---

## Expand-and-Contract Rule

A field or enum member **must remain available for one full major version** before removal.

### Example

```
v1.0.0  →  add new field `cabinClass` (additive, optional)
v1.1.0  →  deprecate old field `seatClass` (document in README, keep in schema)
v2.0.0  →  remove `seatClass` (breaking, requires major bump)
```

Never remove a field and bump the major version in the same commit without first
shipping a version where both old and new fields coexist.

---

## Change Classification Rules

### Additive (MINOR bump, safe within a major)

- New **optional** property added to any schema
- New **enum member** added to a **response** schema
- New schema added to the registry
- New definition added to `$defs`
- Field made optional (was required → now optional)

### Breaking (MAJOR bump required)

- Property **removed** from any schema
- Property **added to `required`** array (newly required field)
- Property **type changed**
- **Enum member removed** from any schema
- New enum member added to a **request** schema (clients must produce valid values)
- Schema **identifier changed** (treated as remove + add)

> **Note:** The request/response distinction follows the Postel principle.
> Adding a new enum value to a request schema means clients *must* produce that value
> to use the new path, which requires a coordinated rollout.

---

## JSON Schema Baselines

Every exported schema has a committed JSON Schema baseline under
`packages/contracts/contract-baselines/`. The baselines are:

- **Deterministic**: keys sorted alphabetically, same input always produces the same file.
- **Offline**: no network dependency; the harness runs entirely from committed fixtures.
- **Blocking**: the CI gate fails when regenerated output differs from the committed file.

### Updating a baseline (intentional schema change)

1. Edit the Zod schema in `src/`.
2. Regenerate baselines:
   ```sh
   GENERATE_BASELINES=1 pnpm --filter @travel/contracts test
   ```
3. Review the diff with `git diff packages/contracts/contract-baselines/`.
4. If the change is breaking, bump the `version` in `package.json` to the next major.
5. Commit both the schema change and the updated baseline together.
6. Update `docs/contracts-versioning.md` if the change adds a new rule or exception.

### Never do this

- Do not update a baseline file without a corresponding schema change.
- Do not remove a field without shipping a deprecation version first.
- Do not suppress the baseline drift failure with `--reporter`.

---

## Consumer-Driven Fixture Tests

Each of the nine services and the web app maintains a fixture directory under:
```
packages/contracts/test/consumer-fixtures/<service-name>/
```

These fixtures contain synthetic data (no real PII, BR-18 compliant) representative
of the payloads each consumer sends or receives. A consumer fixture test parses
each fixture against the specific contracts schema it depends on.

If a contracts schema is narrowed incompatibly, the test for the consumer that
actually depends on it will fail — providing precise, actionable failure attribution
rather than a generic "type mismatch" error.

### Adding a new consumer fixture

1. Create `test/consumer-fixtures/<consumer>/fixtures.ts`.
2. Add a `describe("consumer: <consumer>", ...)` block to `test/consumer-contracts.test.ts`.
3. Each fixture must include a comment noting its provenance and owning consumer.

---

## CI Gate

The Turborepo affected graph ensures that any edit to `@travel/contracts` triggers
a full rebuild and revalidation of all ten dependent targets (nine services + frontend).

The contract-check failures are **blocking** at the same severity as:
- Dependency vulnerability advisories (critical/high)
- Leaked secret detection
- Static analysis failures (SAST)
- Packaged artefacts in commits (NPM Build policy)

The check is **not cacheable** in a way that could hide a real drift: `turbo.json` marks
the baseline comparison as `cache: false`.

---

## Test Runner Selection

> **Assumption (pending tech-lead ratification):** All harness tests use **Vitest 2.x**.
>
> Rationale: Vitest is already the runner for all other packages in this monorepo,
> avoids a second runner config, and shares the same transform pipeline as the service tests.
>
> **Ratification owner:** Tech Lead / Maintainer of `@travel/contracts`.
>
> If Jest 29 is preferred, the switch is isolated to:
> - `vitest.config.ts` → `jest.config.ts`
> - Import `describe/it/expect` from `@jest/globals` instead of `vitest`
> - The assertion logic in `test/compatibility.test.ts` requires **no rewrite**.

---

## Phase 0 Baseline Metrics

| Metric | Value |
|---|---|
| Test files before WO-005 | 1 (`boundaries.test.ts`) |
| Tests before WO-005 | 3 |
| Schemas in registry | 53 |
| Consumer fixture suites | 9 services + 1 frontend = 10 |
| Duplicate type declarations removed | All (single source in `@travel/contracts`) |
| Route boundaries validated (Zod middleware) | 9 services (WO-003) |
