import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "search/index": "src/search/index.ts",
    "booking/index": "src/booking/index.ts",
    "payment/index": "src/payment/index.ts",
    "auth/index": "src/auth/index.ts",
    "user/index": "src/user/index.ts",
    "events/index": "src/events/index.ts",
    "errors/index": "src/errors/index.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    compilerOptions: {
      composite: false,
    },
  },
  splitting: false,
  sourcemap: true,
  clean: true,
});
