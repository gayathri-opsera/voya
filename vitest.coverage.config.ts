/**
 * WO-094: Unit test harness configuration — per-path coverage gates.
 *
 * Coverage requirements (enforced in CI):
 * - Domain services: 90% line coverage
 * - Repository interfaces: 80% line coverage
 * - HTTP routes: 75% line coverage
 * - Shared packages: 85% line coverage
 *
 * This config is used by CI to enforce coverage gates.
 */

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      thresholds: {
        // Domain services
        "services/*/src/domain/**/*.ts": {
          lines: 90,
          functions: 90,
          branches: 85,
        },
        // Shared packages
        "packages/*/src/**/*.ts": {
          lines: 85,
          functions: 85,
        },
        // HTTP routes
        "services/*/src/routes/**/*.ts": {
          lines: 75,
          functions: 75,
        },
        // Repositories
        "services/*/src/repositories/**/*.ts": {
          lines: 80,
          functions: 80,
        },
      },
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/vitest.config.*",
        "**/*.config.ts",
        "**/tests/**",
        "**/test/**",
        "apps/**",
        "infra/**",
        "tools/**",
        "docs/**",
      ],
    },
  },
});
