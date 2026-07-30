import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    server: {
      deps: {
        // jsonwebtoken is CJS; inline it so Vite can transform it
        inline: ["jsonwebtoken"],
      },
    },
  },
});
