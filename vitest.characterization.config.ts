import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["tests/characterization/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@travel/contracts/provenance": resolve(__dirname, "packages/contracts/src/provenance/index.ts"),
    },
  },
});
