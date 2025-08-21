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
  ],
  getDependencies,
  getDevDependencies,
  scripts: {
    dev: 'tsx --watch src/app.ts',
    build: 'tsc',
    start: 'node dist/app.js',
    'type-check': 'tsc --noEmit',
    clean: 'rimraf dist',
  },
};
