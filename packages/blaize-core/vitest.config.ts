/// <reference types="vitest" />
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

import sharedConfig from '@blaizejs/vitest-config';

// Explicitly reference and customize the shared config
export default defineConfig({
  // Inherit all settings from shared config
  ...sharedConfig,
  plugins: [tsconfigPaths()],
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
        '**/node_modules/**',
        '**/test/**',
        '**/*.d.ts',
        '/**/*/index.ts',
        '**/*.config.*',
        '**/examples/**',
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
