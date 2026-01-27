/**
 * Route template files for minimal template
 *
 * Includes:
 * - src/routes/index.ts - Root endpoint
 * - src/routes/health.ts - Health check endpoint
 * - src/routes/users/index.ts - List users
 * - src/routes/users/[userId]/index.ts - Get user by ID
 * - src/routes/upload.ts - File upload with validation
 * - src/routes/events/stream.ts - Server-Sent Events (SSE)
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
  {
    path: 'src/routes/upload.ts',
    content: `/**
 * File Upload Endpoint
 * 
 * POST /upload - Upload files with validation
 * 
 * Demonstrates:
 * - Type-safe file uploads with file() schema
 * - File size validation
 * - MIME type allowlist (security best practice)
 * - Filename sanitization (prevents path traversal)
 * - EventBus integration
 * - Production-ready security patterns
 * 
 * Security Checklist for Production:
 * - [ ] Add virus scanning (e.g., ClamAV)
 * - [ ] Implement rate limiting per user
 * - [ ] Store files in S3/cloud storage (not local filesystem)
 * - [ ] Add authentication/authorization
 * - [ ] Generate thumbnails for images
 * - [ ] Verify file content matches MIME type
 */

import { route } from '../app-router';
import { z } from 'zod';
import { file } from 'blaizejs';

/**
 * Security Configuration
 * 
 * Review and adjust these limits based on your use case
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
] as const;

/**
 * Sanitize filename to prevent path traversal attacks
 * 
 * Removes: Path separators, null bytes, control characters
 * Limits: 255 characters (filesystem limit)
 * 
 * @param filename - Original filename from upload
 * @returns Sanitized filename safe for filesystem
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')  // Replace unsafe chars with underscore
    .replace(/\\.{2,}/g, '.')          // Prevent directory traversal (..)
    .slice(0, 255);                   // Filesystem filename length limit
}

/**
 * File Upload Schema
 * 
 * Provides type-safe access to uploaded files.
 * At least one file (document OR attachments) must be uploaded.
 */
const uploadFilesSchema = z.object({
  document: file().optional(),
  attachments: z.array(file()).optional(),
}).refine(
  data => data.document || (data.attachments && data.attachments.length > 0),
  { message: 'At least one file must be uploaded' }
);

export const postUpload = route.post({
  schema: {
    files: uploadFilesSchema,
    response: z.object({
      message: z.string(),
      files: z.array(z.object({
        filename: z.string(),
        size: z.number(),
        mimetype: z.string(),
      })),
    }),
  },
  handler: async ({ ctx, logger, eventBus }) => {
    const { document, attachments } = ctx.request.files;
    
    // Collect all files into single array
    const uploadedFiles = [
      ...(document ? [document] : []),
      ...(attachments || []),
    ];
    
    logger.info('Files uploaded', { count: uploadedFiles.length });
    
    // Validate and process each file
    const processedFiles = uploadedFiles.map(file => {
      // Size validation
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(\`File \${file.filename} exceeds size limit\`);
      }
      
      // MIME type validation (allowlist, not blocklist!)
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
        throw new Error(\`File \${file.filename} has disallowed type: \${file.mimetype}\`);
      }
      
      const sanitizedFilename = sanitizeFilename(file.filename);
      
      // Publish event for audit trail / processing pipeline
      eventBus.publish('file:uploaded', {
        filename: sanitizedFilename,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: Date.now(),
      });
      
      // TODO: Production - Save to cloud storage
      // const url = await uploadToS3(file.data, sanitizedFilename);
      
      // TODO: Production - Scan for viruses
      // await scanForViruses(file.data);
      
      // TODO: Production - Generate thumbnails for images
      // if (file.mimetype.startsWith('image/')) {
      //   await generateThumbnail(file.data, sanitizedFilename);
      // }
      
      return {
        filename: sanitizedFilename,
        size: file.size,
        mimetype: file.mimetype,
      };
    });
    
    return {
      message: \`Successfully uploaded \${uploadedFiles.length} file(s)\`,
      files: processedFiles,
    };
  },
});
`,
  },
  {
    path: 'src/routes/events/stream.ts',
    content: `/**
 * Server-Sent Events (SSE) Stream Endpoint
 * 
 * GET /events/stream - Real-time event streaming
 * 
 * Demonstrates:
 * - Server-Sent Events (SSE) with route.sse()
 * - EventBus subscription pattern
 * - Long-lived connections
 * - Heartbeat mechanism
 * - Proper cleanup on disconnect
 * - Error handling for streams
 * 
 * Client Usage:
 * \`\`\`javascript
 * const es = new EventSource('https://localhost:7485/events/stream');
 * es.addEventListener('user:viewed', e => console.log(JSON.parse(e.data)));
 * es.addEventListener('file:uploaded', e => console.log(JSON.parse(e.data)));
 * es.addEventListener('demo:event', e => console.log(JSON.parse(e.data)));
 * \`\`\`
 */

import { route } from '../../app-router';
import { z } from 'zod';

export const getEventsStream = route.sse({
  schema: {
    events: {
      /**
       * Published when a user is viewed
       */
      'user:viewed': z.object({
        userId: z.string(),
        timestamp: z.number(),
      }),
      
      /**
       * Published when a file is uploaded
       */
      'file:uploaded': z.object({
        filename: z.string(),
        size: z.number(),
        mimetype: z.string(),
        uploadedAt: z.number(),
      }),
      
      /**
       * Demo events for testing and heartbeats
       */
      'demo:event': z.object({
        message: z.string(),
        data: z.record(z.unknown()).optional(),
      }),
    },
  },
  handler: async ({ stream, logger, eventBus }) => {
    logger.info('SSE client connected');
    
    // Track cleanup functions for proper disconnection
    const cleanupFns: Array<() => void> = [];
    
    // Send initial connection message
    await stream.send('demo:event', {
      message: 'Connected to event stream',
      data: { connectedAt: Date.now() },
    });
    
    // Subscribe to user:viewed events
    const unsubUserViewed = eventBus.subscribe('user:viewed', async (event) => {
      try {
        await stream.send('user:viewed', event.data);
      } catch (error) {
        logger.error('Failed to send user:viewed event', { error });
      }
    });
    cleanupFns.push(unsubUserViewed);
    
    // Subscribe to file:uploaded events
    const unsubFileUploaded = eventBus.subscribe('file:uploaded', async (event) => {
      try {
        await stream.send('file:uploaded', event.data);
      } catch (error) {
        logger.error('Failed to send file:uploaded event', { error });
      }
    });
    cleanupFns.push(unsubFileUploaded);
    
    // Heartbeat to keep connection alive (every 30 seconds)
    const heartbeat = setInterval(() => {
      stream.send('demo:event', {
        message: 'heartbeat',
        data: { timestamp: Date.now() },
      }).catch(err => logger.error('Heartbeat failed', { error: err }));
    }, 30000);
    
    // Cleanup on client disconnect
    stream.onClose(() => {
      logger.info('SSE client disconnected');
      clearInterval(heartbeat);
      cleanupFns.forEach(fn => fn());
    });
    
    // Cleanup on stream error
    stream.onError((error) => {
      logger.error('SSE stream error', { error });
      clearInterval(heartbeat);
      cleanupFns.forEach(fn => fn());
    });
  },
});
`,
  },
];
