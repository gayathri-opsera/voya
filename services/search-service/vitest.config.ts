import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@travel/contracts/search": resolve(__dirname, "../../packages/contracts/src/search/index.ts"),
      "@travel/supplier-port": resolve(__dirname, "../../packages/supplier-port/src/index.ts"),
    },
  },
});
