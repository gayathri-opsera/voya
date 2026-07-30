import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@voya/domain-model': resolve(__dirname, 'src/index.ts'),
      '@voya/test-fixtures': resolve(__dirname, '../test-fixtures/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
  },
});
