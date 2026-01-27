/**
 * Route template files for minimal template
 *
 * Includes:
 * - src/routes/index.ts - Root endpoint
 * - src/routes/health.ts - Health check endpoint
 * - src/routes/users/index.ts - List users
 * - src/routes/users/[userId]/index.ts - Get user by ID
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
  {
    path: 'src/routes/users/index.ts',
    content: `/**
 * Users List Endpoint
 * 
 * GET /users - List all users with pagination
 * 
 * Query Parameters:
 * - limit: Number of users to return (1-100, default: 10)
 * 
 * Demonstrates:
 * - Query parameter validation with coercion
 * - Array response schemas
 * - Shared schema reuse
 */

import { route } from '../../app-router';
import { z } from 'zod';

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'guest']),
});

export const getUsers = route.get({
  schema: {
    query: z.object({
      limit: z.coerce.number().min(1).max(100).default(10),
    }),
    response: z.object({
      users: z.array(userSchema),
      total: z.number(),
    }),
  },
  handler: async ({ ctx, logger }) => {
    const { limit } = ctx.request.query;
    logger.info('Fetching users', { limit });
    
    // Demo data - replace with database in production
    const demoUsers = [
      { id: 'user-1', name: 'Alice Admin', email: 'alice@example.com', role: 'admin' as const },
      { id: 'user-2', name: 'Bob User', email: 'bob@example.com', role: 'user' as const },
      { id: 'user-3', name: 'Charlie Guest', email: 'charlie@example.com', role: 'guest' as const },
    ];
    
    return {
      users: demoUsers.slice(0, limit),
      total: demoUsers.length,
    };
  },
});
`,
  },
  {
    path: 'src/routes/users/[userId]/index.ts',
    content: `/**
 * User Detail Endpoint
 * 
 * GET /users/:userId - Get user by ID
 * 
 * Demonstrates:
 * - Dynamic route parameters
 * - EventBus publishing
 * - Structured logging with context
 * - Parameter validation
 */

import { route } from '../../../app-router';
import { z } from 'zod';

export const getUserById = route.get({
  schema: {
    params: z.object({
      userId: z.string(),
    }),
    response: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      role: z.enum(['admin', 'user', 'guest']),
    }),
  },
  handler: async ({ params, logger, eventBus }) => {
    logger.info('Fetching user', { userId: params.userId });
    
    // Publish view event for analytics/tracking
    await eventBus.publish('user:viewed', {
      userId: params.userId,
      timestamp: Date.now(),
    });
    
    // Demo data - replace with database lookup in production
    // In production, throw NotFoundError if user doesn't exist
    return {
      id: params.userId,
      name: 'Demo User',
      email: 'demo@example.com',
      role: 'user' as const,
    };
  },
});
`,
  },
];
