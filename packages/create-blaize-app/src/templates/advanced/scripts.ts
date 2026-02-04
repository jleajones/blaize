/**
 * NPM scripts for advanced template
 *
 * Includes Docker, Redis, and integration testing scripts
 */

export const scripts = {
  build: 'tsc',
  dev: 'NODE_ENV=development tsx watch src/index.ts',
  'dev:all': 'docker-compose up -d && pnpm run dev',
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
