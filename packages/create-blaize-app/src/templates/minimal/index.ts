import { getDependencies, getDevDependencies } from '../../utils/versions';

/**
 * Template file type
 */
export interface TemplateFile {
  path: string;
  content: string;
}

/**
 * Template type
 */
export interface Template {
  name: string;
  files: TemplateFile[];
  getDependencies: (options?: { latest?: boolean }) => Promise<Record<string, string>>;
  getDevDependencies: (options?: { latest?: boolean }) => Promise<Record<string, string>>;
  scripts: Record<string, string>;
}

/**
 * Minimal template - A basic BlaizeJS API with testing
 */
export const minimalTemplate: Template = {
  name: 'minimal',
  files: [
    {
      path: 'src/app.ts',
      content: `import { createServer } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ESM path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = createServer({
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  host: 'localhost',
  routesDir: path.resolve(__dirname, './routes')
});

await server.listen();
console.log('🔥 BlaizeJS running on http://localhost:3000');
`,
    },
    {
      path: 'src/routes/index.ts',
      content: `import { createGetRoute } from 'blaizejs';
import { z } from 'zod';

export const GET = createGetRoute({
  response: z.object({
    message: z.string(),
    timestamp: z.string(),
    version: z.string()
  }),
  handler: async () => ({
    message: 'Welcome to BlaizeJS!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
});
`,
    },
    {
      path: 'src/routes/health.ts',
      content: `import { createGetRoute, NotFoundError } from 'blaizejs';
import { z } from 'zod';

const HealthStatus = z.enum(['healthy', 'degraded', 'unhealthy']);

export const GET = createGetRoute({
  response: z.object({
    status: HealthStatus,
    uptime: z.number(),
    timestamp: z.string(),
    checks: z.object({
      database: z.boolean().optional(),
      redis: z.boolean().optional()
    }).optional()
  }),
  handler: async () => {
    // Example of error handling
    if (process.env.FORCE_UNHEALTHY) {
      throw new NotFoundError('Health check failed');
    }
    
    return {
      status: 'healthy' as const,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database: true,
        redis: true
      }
    };
  }
});
`,
    },
    {
      path: 'src/__tests__/routes/index.test.ts',
      content: `import { describe, it, expect } from 'vitest';
import { createTestClient } from '@blaizejs/testing-utils';
import { GET } from '../../routes/index';

describe('GET /', () => {
  const client = createTestClient();
  
  it('should return welcome message', async () => {
    const response = await client.testRoute(GET, {});
    
    expect(response).toHaveProperty('message');
    expect(response.message).toBe('Welcome to BlaizeJS!');
    expect(response).toHaveProperty('timestamp');
    expect(response).toHaveProperty('version');
  });
  
  it('should return valid timestamp', async () => {
    const response = await client.testRoute(GET, {});
    
    const timestamp = new Date(response.timestamp);
    expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });
  
  it('should return version string', async () => {
    const response = await client.testRoute(GET, {});
    
    expect(response.version).toMatch(/^\\d+\\.\\d+\\.\\d+$/);
  });
});
`,
    },
    {
      path: 'src/__tests__/routes/health.test.ts',
      content: `import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestClient } from '@blaizejs/testing-utils';
import { GET } from '../../routes/health';

describe('GET /health', () => {
  const client = createTestClient();
  const originalEnv = process.env.FORCE_UNHEALTHY;
  
  beforeEach(() => {
    delete process.env.FORCE_UNHEALTHY;
  });
  
  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.FORCE_UNHEALTHY = originalEnv;
    } else {
      delete process.env.FORCE_UNHEALTHY;
    }
  });
  
  it('should return healthy status', async () => {
    const response = await client.testRoute(GET, {});
    
    expect(response.status).toBe('healthy');
    expect(response.uptime).toBeGreaterThan(0);
    expect(response.checks).toEqual({
      database: true,
      redis: true
    });
  });
  
  it('should handle unhealthy state', async () => {
    process.env.FORCE_UNHEALTHY = 'true';
    
    await expect(
      client.testRoute(GET, {})
    ).rejects.toThrow('Health check failed');
  });
  
  it('should include valid timestamp', async () => {
    const response = await client.testRoute(GET, {});
    
    const timestamp = new Date(response.timestamp);
    expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
`,
    },
    {
      path: 'src/__tests__/setup.ts',
      content: `/**
 * Test setup file
 * Add any global test configuration here
 */

// Example: Mock environment variables
process.env.NODE_ENV = 'test';
`,
    },
  ],
  getDependencies,
  getDevDependencies,
  scripts: {
    dev: 'tsx --watch src/app.ts',
    build: 'tsc',
    start: 'node dist/app.js',
    test: 'vitest',
    'test:watch': 'vitest --watch',
    'test:coverage': 'vitest --coverage',
    'type-check': 'tsc --noEmit',
    clean: 'rimraf dist',
  },
};
