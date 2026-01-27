/**
 * Core template files for minimal template
 *
 * Includes:
 * - events.ts - Event schemas
 * - app-router.ts - Route factory
 * - app.ts - Server setup
 * - app-type.ts - Route registry
 */

import type { TemplateFile } from '../index';

export const coreFiles: TemplateFile[] = [
  {
    path: 'src/events.ts',
    content: `/**
 * Application Event Schemas
 *
 * Define all events published in this application using Zod schemas.
 * These schemas provide runtime validation and TypeScript type inference.
 */

import { z } from 'zod';

/**
 * Minimal Template Event Schemas
 */
export const minimalEvents = {
  /**
   * Published when a user is viewed (GET /users/:userId)
   */
  'user:viewed': z.object({
    userId: z.string(),
    timestamp: z.number(),
  }),

  /**
   * Published when a file is uploaded (POST /upload)
   */
  'file:uploaded': z.object({
    filename: z.string(),
    size: z.number(),
    mimetype: z.string(),
    uploadedAt: z.number(),
  }),

  /**
   * Demo event for SSE streaming (GET /events/stream)
   */
  'demo:event': z.object({
    message: z.string(),
    data: z.record(z.unknown()).optional(),
  }),
} as const;

export type MinimalEvents = typeof minimalEvents;
`,
  },
  {
    path: 'src/app-router.ts',
    content: `/**
 * Type-Safe Route Factory
 *
 * This file creates a route factory with proper type inference.
 * Import this in your route files instead of creating routes directly.
 *
 * Why separate from app.ts?
 * - Cleaner imports: \`from '../app-router'\`
 * - Type inference happens once, reused everywhere
 * - No server lifecycle dependency in route files
 * - Easier testing
 */

import { Blaize, type InferContext } from 'blaizejs';
import type { minimalEvents } from './events';

// Type-only server for type inference
const typeServer = Blaize.createServer({
  host: 'localhost',
  port: 7485,
  routesDir: './routes',
  eventSchemas: {} as typeof minimalEvents,
});

type AppContext = InferContext<typeof typeServer>;

export const route = Blaize.Router.createRouteFactory<
  AppContext['state'],
  AppContext['services']
>();
`,
  },
  {
    path: 'src/app.ts',
    content: `/**
 * Application Server Entry Point
 *
 * Creates and starts the BlaizeJS server with:
 * - File-based routing
 * - HTTP/2 enabled
 * - EventBus with type-safe schemas
 * - Graceful shutdown
 */

import { Blaize } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { minimalEvents } from './events';

// ESM path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const routesDir = path.resolve(__dirname, './routes');

const server = Blaize.createServer({
  host: 'localhost',
  port: process.env.PORT ? parseInt(process.env.PORT) : 7485,
  routesDir,
  http2: { enabled: true },
  eventSchemas: minimalEvents,
});

try {
  await server.listen();
  
  Blaize.logger.info('🚀 Server started successfully');
  Blaize.logger.info('');
  Blaize.logger.info('📍 Available Endpoints:');
  Blaize.logger.info(\`   GET  https://\${server.host}:\${server.port}/\`);
  Blaize.logger.info(\`   GET  https://\${server.host}:\${server.port}/health\`);
  Blaize.logger.info(\`   GET  https://\${server.host}:\${server.port}/users\`);
  Blaize.logger.info(\`   GET  https://\${server.host}:\${server.port}/users/:userId\`);
  Blaize.logger.info(\`   POST https://\${server.host}:\${server.port}/upload\`);
  Blaize.logger.info(\`   GET  https://\${server.host}:\${server.port}/events/stream\`);
  Blaize.logger.info('');
} catch (error) {
  Blaize.logger.error('❌ Failed to start server', { error });
  process.exit(1);
}

['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, async () => {
    Blaize.logger.info(\`🛑 Received \${signal}, shutting down...\`);
    await server.close();
    process.exit(0);
  });
});
`,
  },
  {
    path: 'src/app-type.ts',
    content: `/**
 * Route Registry for Type-Safe Client
 *
 * Exports all route handlers for use by the BlaizeJS
 * type-safe client generator.
 */

import { getRoot } from './routes/index';
import { getHealth } from './routes/health';
import { getUsers } from './routes/users/index';
import { getUserById } from './routes/users/[userId]/index';
import { postUpload } from './routes/upload';
import { getEventsStream } from './routes/events/stream';

export const routes = {
  getRoot,
  getHealth,
  getUsers,
  getUserById,
  postUpload,
  getEventsStream,
} as const;
`,
  },
];
