/**
 * NPM scripts for advanced template
 *
 * Includes Docker, Redis, and integration testing scripts
 */

export const scripts = {
  dev: 'tsx watch src/index.ts',
  build: 'tsc',
  start: 'node dist/index.js',
  test: 'vitest run',
  'test:watch': 'vitest',
  'test:coverage': 'vitest run --coverage',
  'type-check': 'tsc --noEmit',
  clean: 'rimraf dist',
  'docker:up': 'docker compose up -d',
  'docker:down': 'docker compose down',
  'docker:logs': 'docker compose logs -f',
  'docker:clean': 'docker compose down -v',
  'dev:services': 'docker compose up -d && tsx watch src/index.ts',
};
