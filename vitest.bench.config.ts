import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/bench/**/*.test.ts'],
    environment: 'node',
    disableConsoleIntercept: true,
  },
});
