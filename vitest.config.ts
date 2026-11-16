import { defineConfig } from 'vitest/config';

// Speed reports print numbers and take a while; run them with `npm run bench`.
const always = ['tests/bench/**', 'node_modules/**', 'dist/**'];
// The 90-day check times every solve against a 2-second limit. It runs on its own, after every
// other test has finished, so the other test files (the generator's are CPU-heavy) never share
// the machine with it and its clock measures the solver, not the suite.
const timed = 'tests/content.test.ts';

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'rules',
          include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
          exclude: [...always, timed],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'timed',
          include: [timed],
          exclude: always,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
