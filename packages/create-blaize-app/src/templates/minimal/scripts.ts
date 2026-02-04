/**
 * npm scripts for minimal template
 */

export const scripts = {
  dev: 'NODE_ENV=development tsx watch src/app.ts',
  build: 'tsc',
  start: 'node dist/app.js',
  test: 'vitest run',
  'test:watch': 'vitest',
  'test:coverage': 'vitest run --coverage',
  'type-check': 'tsc --noEmit',
  clean: 'rimraf dist',
};
