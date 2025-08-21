/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

import sharedConfig from '@blaizejs/vitest-config';

// Explicitly reference and customize the shared config
export default defineConfig({
  // Inherit all settings from shared config
  ...sharedConfig,

  // Override or add additional settings
  test: {
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.test.json',
      include: ['**/*.{test,spec}.{ts,tsx}'],
    },
    // Existing shared settings are preserved

    // Package-specific settings
    env: {
      NODE_ENV: 'test',
    },
    globals: true,

    // Longer timeout for complex tests
    testTimeout: 10000,

    // override the include pattern
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Custom coverage thresholds
    coverage: {
      reportsDirectory: './coverage',
      exclude: [
        '**/dist/**',
        '**/node_modules/**',
        '**/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/examples/**',
        '**/index.ts',
        // Templates
        '**/templates/generators/generate-git-ignore.ts',
        '**/templates/generators/generate-readme.ts',
        '**/templates/generators/generate-ts-config.ts',
        '**/templates/generators/generate-vitest-config.ts',
      ],
      // Use the thresholds property for coverage targets
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
