import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@voya/design-tokens': resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
  },
});
