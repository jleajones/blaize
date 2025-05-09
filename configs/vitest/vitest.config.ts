/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use global test APIs without imports (describe, it, expect)
    globals: true,

    // Use jsdom for DOM APIs if needed
    environment: 'node',

    // Include files matching these patterns
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    // Exclude these patterns
    exclude: ['**/node_modules/**', '**/dist/**'],

    // Configure coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/test/**', '**/*.d.ts'],
    },

    // Keep tests isolated
    isolate: true,

    // Wait for keypress before exiting (in watch mode)
    // watchExclude: ['**/node_modules/**', '**/dist/**'],
  },
});
