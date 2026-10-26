import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `workspace` was replaced by `projects` in Vitest 3.2.
    projects: ['shared', 'server', 'client'],
    passWithNoTests: true,
  },
});
