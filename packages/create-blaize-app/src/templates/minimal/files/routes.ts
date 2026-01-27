/**
 * Route template files for minimal template
 *
 * Includes:
 * - src/routes/index.ts - Root endpoint
 * - src/routes/health.ts - Health check endpoint
 */

import type { TemplateFile } from '../index';

export const routeFiles: TemplateFile[] = [
  {
    path: 'src/routes/index.ts',
    content: `/**
 * Root Endpoint
 * 
 * GET / - Welcome message with API information
 */

import { route } from '../app-router';
import { z } from 'zod';

export const getRoot = route.get({
  schema: {
    response: z.object({
      message: z.string(),
      timestamp: z.string(),
      version: z.string(),
      endpoints: z.array(z.string()),
    }),
  },
  handler: async ({ logger }) => {
    logger.info('Root endpoint accessed');
    
    return {
      message: 'Welcome to BlaizeJS!',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      endpoints: [
        'GET /',
        'GET /health',
        'GET /users',
        'GET /users/:userId',
        'POST /upload',
        'GET /events/stream',
      ],
    };
  },
});
`,
  },
  {
    path: 'src/routes/health.ts',
    content: `/**
 * Health Check Endpoint
 * 
 * GET /health - Server health status
 * 
 * Returns uptime and timestamp for monitoring.
 */

import { route } from '../app-router';
import { z } from 'zod';

const startTime = Date.now();

export const getHealth = route.get({
  schema: {
    response: z.object({
      status: z.literal('ok'),
      timestamp: z.number(),
      uptime: z.number(),
    }),
  },
  handler: async ({ logger }) => {
    logger.debug('Health check requested');
    
    return {
      status: 'ok' as const,
      timestamp: Date.now(),
      uptime: Date.now() - startTime,
    };
  },
});
`,
  },
];
