/**
 * NPM scripts for advanced template
 *
 * Includes Docker, Redis, and integration testing scripts
 */

export const scripts = {
  // Development
  dev: 'tsx watch src/index.ts',

  // Build
  build: 'tsc',
  start: 'node dist/index.js',

  // Testing
  test: 'vitest run',
  'test:watch': 'vitest',
  'test:coverage': 'vitest run --coverage',
  'test:integration': 'vitest run --config vitest.integration.config.ts',

  // Type checking
  'type-check': 'tsc --noEmit',

  // Docker
  'docker:up': 'docker-compose up -d',
  'docker:down': 'docker-compose down',
  'docker:logs': 'docker-compose logs -f',
  'docker:redis': 'docker-compose up -d redis',
  'docker:rebuild': 'docker-compose up -d --build',

  // Utilities
  clean: 'rimraf dist',
};
