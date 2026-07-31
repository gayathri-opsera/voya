import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["tests/resilience/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@travel/contracts/audit": resolve(__dirname, "packages/contracts/src/audit/index.ts"),
      "@travel/contracts/provenance": resolve(__dirname, "packages/contracts/src/provenance/index.ts"),
    },
  },
});
