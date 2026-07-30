import { defineConfig } from "vitest/config";
import { resolve } from "path";

const contracts = (sub: string) =>
  resolve(__dirname, "../../packages/contracts/src", sub);

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: [
      { find: "@travel/contracts/provenance", replacement: contracts("provenance/index.ts") },
      { find: "@travel/contracts/audit",      replacement: contracts("audit/index.ts") },
      { find: "@travel/contracts/booking",    replacement: contracts("booking/index.ts") },
      { find: "@travel/contracts/errors",     replacement: contracts("errors/index.ts") },
      { find: "@travel/contracts",            replacement: contracts("index.ts") },
    ],
  },
});
