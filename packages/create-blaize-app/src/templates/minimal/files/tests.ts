/**
 * Test template files for minimal template
 *
 * Includes:
 * - vitest.config.ts - Vitest configuration
 * - src/__tests__/setup.ts - Test setup
 * - src/__tests__/routes/index.test.ts - Root route tests
 * - src/__tests__/routes/health.test.ts - Health route tests
 * - src/__tests__/routes/users.test.ts - User routes tests
 * - src/__tests__/routes/upload.test.ts - Upload route tests
 * - src/__tests__/routes/events-stream.test.ts - SSE route tests
 */

import { TemplateFile } from '@/types';

export const testFiles: TemplateFile[] = [
  {
    path: 'vitest.config.ts',
    content: `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
`,
  },
  {
    path: 'src/__tests__/setup.ts',
    content: `/**
 * Test setup file
 * 
 * Runs before all tests to configure the test environment
 */

import { beforeAll, afterEach } from 'vitest';

beforeAll(() => {
  // Set NODE_ENV for tests
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});
`,
  },
  {
    path: 'src/__tests__/routes/index.test.ts',
    content: `/**
 * Tests for Root Route
 * 
 * Tests the GET / endpoint
 */

import { describe, it, expect } from 'vitest';
import { createTestContext, createRouteTestContext } from '@blaizejs/testing-utils';
import { getRoot } from '../../routes/index';

describe('GET /', () => {
  it('should return welcome message', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/',
    });
    
    const result = await getRoot.handler({ ctx, logger, eventBus });
    
    expect(result.message).toBe('Welcome to BlaizeJS!');
    expect(result.version).toBe('1.0.0');
    expect(result.timestamp).toBeDefined();
    expect(result.endpoints).toHaveLength(6);
    
    logger.assertInfoCalled('Root endpoint accessed');
    
    cleanup();
  });
  
  it('should include all endpoints in response', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/',
    });
    
    const result = await getRoot.handler({ ctx, logger, eventBus });
    
    expect(result.endpoints).toContain('GET /');
    expect(result.endpoints).toContain('GET /health');
    expect(result.endpoints).toContain('GET /users');
    expect(result.endpoints).toContain('GET /users/:userId');
    expect(result.endpoints).toContain('POST /upload');
    expect(result.endpoints).toContain('GET /events/stream');
    
    cleanup();
  });
  
  it('should return valid ISO timestamp', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/',
    });
    
    const result = await getRoot.handler({ ctx, logger, eventBus });
    
    // Should be valid ISO date string
    const date = new Date(result.timestamp);
    expect(date.toString()).not.toBe('Invalid Date');
    
    cleanup();
  });
});
`,
  },
  {
    path: 'src/__tests__/routes/health.test.ts',
    content: `/**
 * Tests for Health Check Route
 * 
 * Tests the GET /health endpoint
 */

import { describe, it, expect } from 'vitest';
import { createTestContext, createRouteTestContext } from '@blaizejs/testing-utils';
import { getHealth } from '../../routes/health';

describe('GET /health', () => {
  it('should return ok status', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/health',
    });
    
    const result = await getHealth.handler({ ctx, logger, eventBus });
    
    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    
    logger.assertDebugCalled('Health check requested');
    
    cleanup();
  });
  
  it('should return increasing uptime', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/health',
    });
    
    const result1 = await getHealth.handler({ ctx, logger, eventBus });
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const result2 = await getHealth.handler({ ctx, logger, eventBus });
    
    expect(result2.uptime).toBeGreaterThan(result1.uptime);
    
    cleanup();
  });
  
  it('should return current timestamp', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/health',
    });
    
    const before = Date.now();
    const result = await getHealth.handler({ ctx, logger, eventBus });
    const after = Date.now();
    
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
    
    cleanup();
  });
});
`,
  },
  {
    path: 'src/__tests__/routes/users.test.ts',
    content: `/**
 * Tests for User Routes
 * 
 * Tests GET /users and GET /users/:userId endpoints
 */

import { describe, it, expect } from 'vitest';
import { createTestContext, createRouteTestContext } from '@blaizejs/testing-utils';
import { getUsers } from '../../routes/users/index';
import { getUserById } from '../../routes/users/[userId]/index';

describe('GET /users', () => {
  it('should return paginated users', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/users',
      query: { limit: '10' },
    });
    
    const result = await getUsers.handler({ ctx, logger, eventBus });
    
    expect(result.users).toHaveLength(3);
    expect(result.total).toBe(3);
    
    logger.assertInfoCalled('Fetching users', { limit: 10 });
    
    cleanup();
  });
  
  it('should respect limit parameter', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/users',
      query: { limit: '2' },
    });
    
    const result = await getUsers.handler({ ctx, logger, eventBus });
    
    expect(result.users).toHaveLength(2);
    expect(result.total).toBe(3);
    
    cleanup();
  });
  
  it('should use default limit of 10', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/users',
      query: {},
    });
    
    const result = await getUsers.handler({ ctx, logger, eventBus });
    
    expect(result.users).toHaveLength(3); // Less than 10, so returns all
    
    cleanup();
  });
  
  it('should return users with correct structure', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/users',
      query: { limit: '1' },
    });
    
    const result = await getUsers.handler({ ctx, logger, eventBus });
    
    const user = result.users[0];
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('role');
    expect(['admin', 'user', 'guest']).toContain(user!.role);
    
    cleanup();
  });
});

describe('GET /users/:userId', () => {
  it('should return user by id', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/users/test-123',
      params: { userId: 'test-123' },
    });
    
    const result = await getUserById.handler({ params: ctx.params, logger, eventBus });
    
    expect(result.id).toBe('test-123');
    expect(result.name).toBe('Demo User');
    expect(result.email).toBe('demo@example.com');
    expect(result.role).toBe('user');
    
    cleanup();
  });
  
  it('should log user fetch', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/users/user-456',
      params: { userId: 'user-456' },
    });
    
    await getUserById.handler({ params: ctx.params, logger, eventBus });
    
    logger.assertInfoCalled('Fetching user', { userId: 'user-456' });
    
    cleanup();
  });
  
  it('should publish user:viewed event', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/users/user-789',
      params: { userId: 'user-789' },
    });
    
    await getUserById.handler({ params: ctx.params, logger, eventBus });
    
    eventBus.assertPublished('user:viewed', { userId: 'user-789' });
    
    cleanup();
  });
  
  it('should include timestamp in event', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'GET',
      path: '/users/user-xyz',
      params: { userId: 'user-xyz' },
    });
    
    const before = Date.now();
    await getUserById.handler({ params: ctx.params, logger, eventBus });
    const after = Date.now();
    
    const publishedEvents = eventBus.getPublishedEvents('user:viewed');
    expect(publishedEvents).toHaveLength(1);
    
    const event = publishedEvents[0];
    expect(event!.data.timestamp).toBeGreaterThanOrEqual(before);
    expect(event!.data.timestamp).toBeLessThanOrEqual(after);
    
    cleanup();
  });
});
`,
  },
  {
    path: 'src/__tests__/routes/upload.test.ts',
    content: `/**
 * Tests for Upload Route
 * 
 * Tests the POST /upload endpoint
 */

import { describe, it, expect } from 'vitest';
import { createTestContext, createRouteTestContext } from '@blaizejs/testing-utils';
import { postUpload } from '../../routes/upload';

describe('POST /upload', () => {
  it('should handle single file upload', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'POST',
      path: '/upload',
      files: {
        document: {
          filename: 'test.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          data: Buffer.from('fake image data'),
        },
      },
    });
    
    const result = await postUpload.handler({ ctx, logger, eventBus });
    
    expect(result.message).toBe('Successfully uploaded 1 file(s)');
    expect(result.files).toHaveLength(1);
    expect(result.files[0]!.filename).toBe('test.jpg');
    expect(result.files[0]!.size).toBe(1024);
    expect(result.files[0]!.mimetype).toBe('image/jpeg');
    
    logger.assertInfoCalled('Files uploaded', { count: 1 });
    
    cleanup();
  });
  
  it('should handle multiple file uploads', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'POST',
      path: '/upload',
      files: {
        attachments: [
          {
            filename: 'file1.pdf',
            mimetype: 'application/pdf',
            size: 2048,
            data: Buffer.from('pdf data'),
          },
          {
            filename: 'file2.pdf',
            mimetype: 'application/pdf',
            size: 3072,
            data: Buffer.from('more pdf data'),
          },
        ],
      },
    });
    
    const result = await postUpload.handler({ ctx, logger, eventBus });
    
    expect(result.message).toBe('Successfully uploaded 2 file(s)');
    expect(result.files).toHaveLength(2);
    
    cleanup();
  });
  
  it('should reject oversized files', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'POST',
      path: '/upload',
      files: {
        document: {
          filename: 'huge.jpg',
          mimetype: 'image/jpeg',
          size: 15 * 1024 * 1024, // 15MB (over 10MB limit)
          data: Buffer.alloc(100),
        },
      },
    });
    
    await expect(
      postUpload.handler({ ctx, logger, eventBus })
    ).rejects.toThrow('exceeds size limit');
    
    cleanup();
  });
  
  it('should reject disallowed MIME types', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'POST',
      path: '/upload',
      files: {
        document: {
          filename: 'script.exe',
          mimetype: 'application/x-msdownload',
          size: 1024,
          data: Buffer.from('executable'),
        },
      },
    });
    
    await expect(
      postUpload.handler({ ctx, logger, eventBus })
    ).rejects.toThrow('has disallowed type');
    
    cleanup();
  });
  
  it('should sanitize filenames', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'POST',
      path: '/upload',
      files: {
        document: {
          filename: '../../../etc/passwd',
          mimetype: 'text/plain',
          size: 512,
          data: Buffer.from('test'),
        },
      },
    });
    
    const result = await postUpload.handler({ ctx, logger, eventBus });
    
    // Should sanitize to remove path traversal
    expect(result.files[0]!.filename).not.toContain('..');
    expect(result.files[0]!.filename).not.toContain('/');
    
    cleanup();
  });
  
  it('should publish file:uploaded event', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const ctx = createTestContext({
      method: 'POST',
      path: '/upload',
      files: {
        document: {
          filename: 'report.pdf',
          mimetype: 'application/pdf',
          size: 4096,
          data: Buffer.from('pdf content'),
        },
      },
    });
    
    await postUpload.handler({ ctx, logger, eventBus });
    
    eventBus.assertPublished('file:uploaded', {
      filename: 'report.pdf',
      mimetype: 'application/pdf',
    });
    
    cleanup();
  });
  
  it('should accept allowed image types', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    
    const mimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    for (const mimetype of mimeTypes) {
      const ctx = createTestContext({
        method: 'POST',
        path: '/upload',
        files: {
          document: {
            filename: \`test.\${mimetype.split('/')[1]}\`,
            mimetype,
            size: 1024,
            data: Buffer.from('image'),
          },
        },
      });
      
      const result = await postUpload.handler({ ctx, logger, eventBus });
      expect(result.files).toHaveLength(1);
    }
    
    cleanup();
  });
});
`,
  },
  {
    path: 'src/__tests__/routes/events-stream.test.ts',
    content: `/**
 * Tests for Events Stream Route
 * 
 * Tests the GET /events/stream SSE endpoint
 */

import { describe, it, expect, vi } from 'vitest';
import { createRouteTestContext, createSSEMockContext } from '@blaizejs/testing-utils';
import { getEventsStream } from '../../routes/events/stream';

describe('GET /events/stream', () => {
  it('should send initial connection message', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    const stream = createSSEMockContext();
    
    // Start the handler (doesn't await - it's long-lived)
    const handlerPromise = getEventsStream.handler({ stream, logger, eventBus });
    
    // Wait for initial message
    await vi.waitFor(() => {
      expect(stream.sends).toHaveLength(1);
    });
    
    const firstSend = stream.sends[0];
    expect(firstSend!.type).toBe('demo:event');
    expect(firstSend!.data.message).toBe('Connected to event stream');
    expect(firstSend!.data.data).toHaveProperty('connectedAt');
    
    logger.assertInfoCalled('SSE client connected');
    
    // Cleanup
    stream.triggerClose();
    await handlerPromise;
    cleanup();
  });
  
  it('should forward user:viewed events', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    const stream = createSSEMockContext();
    
    const handlerPromise = getEventsStream.handler({ stream, logger, eventBus });
    
    // Wait for connection
    await vi.waitFor(() => {
      expect(stream.sends).toHaveLength(1);
    });
    
    // Publish event
    await eventBus.publish('user:viewed', {
      userId: 'test-user',
      timestamp: Date.now(),
    });
    
    // Wait for event to be forwarded
    await vi.waitFor(() => {
      expect(stream.sends).toHaveLength(2);
    });
    
    const userViewedSend = stream.sends[1];
    expect(userViewedSend!.type).toBe('user:viewed');
    expect(userViewedSend!.data.userId).toBe('test-user');
    
    // Cleanup
    stream.triggerClose();
    await handlerPromise;
    cleanup();
  });
  
  it('should forward file:uploaded events', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    const stream = createSSEMockContext();
    
    const handlerPromise = getEventsStream.handler({ stream, logger, eventBus });
    
    // Wait for connection
    await vi.waitFor(() => {
      expect(stream.sends).toHaveLength(1);
    });
    
    // Publish event
    await eventBus.publish('file:uploaded', {
      filename: 'test.jpg',
      size: 1024,
      mimetype: 'image/jpeg',
      uploadedAt: Date.now(),
    });
    
    // Wait for event to be forwarded
    await vi.waitFor(() => {
      expect(stream.sends).toHaveLength(2);
    });
    
    const fileUploadedSend = stream.sends[1];
    expect(fileUploadedSend!.type).toBe('file:uploaded');
    expect(fileUploadedSend!.data.filename).toBe('test.jpg');
    expect(fileUploadedSend!.data.mimetype).toBe('image/jpeg');
    
    // Cleanup
    stream.triggerClose();
    await handlerPromise;
    cleanup();
  });
  
  it('should send heartbeat every 30 seconds', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    const stream = createSSEMockContext();
    
    vi.useFakeTimers();
    
    const handlerPromise = getEventsStream.handler({ stream, logger, eventBus });
    
    // Wait for connection
    await vi.waitFor(() => {
      expect(stream.sends).toHaveLength(1);
    });
    
    // Fast-forward 30 seconds
    await vi.advanceTimersByTimeAsync(30000);
    
    // Should have heartbeat
    expect(stream.sends.length).toBeGreaterThan(1);
    const heartbeat = stream.sends[stream.sends.length - 1];
    expect(heartbeat!.type).toBe('demo:event');
    expect(heartbeat!.data.message).toBe('heartbeat');
    
    vi.useRealTimers();
    
    // Cleanup
    stream.triggerClose();
    await handlerPromise;
    cleanup();
  });
  
  it('should cleanup on close', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    const stream = createSSEMockContext();
    
    const handlerPromise = getEventsStream.handler({ stream, logger, eventBus });
    
    // Wait for connection
    await vi.waitFor(() => {
      expect(stream.sends).toHaveLength(1);
    });
    
    // Trigger close
    stream.triggerClose();
    await handlerPromise;
    
    logger.assertInfoCalled('SSE client disconnected');
    
    cleanup();
  });
  
  it('should cleanup on error', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    const stream = createSSEMockContext();
    
    const handlerPromise = getEventsStream.handler({ stream, logger, eventBus });
    
    // Wait for connection
    await vi.waitFor(() => {
      expect(stream.sends).toHaveLength(1);
    });
    
    // Trigger error
    const testError = new Error('Stream error');
    stream.triggerError(testError);
    await handlerPromise;
    
    logger.assertErrorCalled('SSE stream error');
    
    cleanup();
  });
  
  it('should handle send errors gracefully', async () => {
    const { logger, eventBus, cleanup } = createRouteTestContext();
    const stream = createSSEMockContext();
    
    // Make send fail
    stream.send = vi.fn().mockRejectedValue(new Error('Send failed'));
    
    const handlerPromise = getEventsStream.handler({ stream, logger, eventBus });
    
    // Publish event (should handle error)
    await eventBus.publish('user:viewed', {
      userId: 'test',
      timestamp: Date.now(),
    });
    
    // Wait a bit for error handling
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should have logged error
    const errorLogs = logger.getLogsByLevel('error');
    expect(errorLogs.length).toBeGreaterThan(0);
    
    // Cleanup
    stream.triggerClose();
    await handlerPromise;
    cleanup();
  });
});
`,
  },
];
