import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Speed reports print numbers and take a while; run them with `npm run bench`.
    exclude: ['tests/bench/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
  },
});
