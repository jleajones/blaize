/**
 * Integration Tests for Queue Plugin with defineJob() API
 *
 * Tests end-to-end flow: defineJob → config → initialize → add → process → verify
 * Tests input validation rejection at enqueue time
 * Tests output validation failure during processing
 */
import { z } from 'zod';

import { createMockLogger, createWorkingMockEventBus } from '@blaizejs/testing-utils';

import { defineJob } from '../define-job';
import { JobValidationError } from '../errors';
import { QueueService } from '../queue-service';
import { InMemoryStorage } from '../storage/memory';

import type { HandlerRegistration } from '../types';

// ============================================================================
// Helpers
// ============================================================================

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildHandlerRegistry(
  entries: Array<{
    queueName: string;
    jobType: string;
    definition: { handler: any; input: z.ZodType; output: z.ZodType };
  }>
): Map<string, HandlerRegistration> {
  const registry = new Map<string, HandlerRegistration>();
  for (const { queueName, jobType, definition } of entries) {
    registry.set(`${queueName}:${jobType}`, {
      handler: definition.handler,
      inputSchema: definition.input,
      outputSchema: definition.output,
    });
  }
  return registry;
}

// ============================================================================
// Job Definitions
// ============================================================================

const emailSendJob = defineJob({
  input: z.object({
    to: z.string().email(),
    subject: z.string().min(1),
  }),
  output: z.object({
    messageId: z.string(),
    sentAt: z.number(),
  }),
  handler: async () => ({
    messageId: `msg-${Date.now()}`,
    sentAt: Date.now(),
  }),
});

const badOutputJob = defineJob({
  input: z.object({ value: z.number() }),
  output: z.object({
    result: z.string(),
    timestamp: z.number(),
  }),
  handler: async () =>
    // Intentionally return wrong shape — missing 'timestamp', 'result' is number
    ({ result: 42, extra: 'ignored' }) as any,
});

// ============================================================================
// Test Suite
// ============================================================================

describe('Queue Plugin Integration (defineJob API)', () => {
  let service: QueueService;
  let storage: InMemoryStorage;

  afterEach(async () => {
    if (service) {
      await service.stopAll({ graceful: false });
    }
  });

  // --------------------------------------------------------------------------
  // 1. E2E flow: defineJob → config → add → process → verify typed result
  // --------------------------------------------------------------------------
  describe('E2E flow', () => {
    it('should define job, enqueue, process, and return typed result', async () => {
      storage = new InMemoryStorage();
      const logger = createMockLogger();
      const eventBus = createWorkingMockEventBus();

      const handlerRegistry = buildHandlerRegistry([
        { queueName: 'emails', jobType: 'email:send', definition: emailSendJob },
      ]);

      service = new QueueService({
        queues: {
          emails: {
            concurrency: 1,
            defaultMaxRetries: 0,
            jobs: { 'email:send': emailSendJob },
          },
        },
        storage,
        logger,
        eventBus,
        handlerRegistry,
      });

      // Start processing
      await service.startAll();
      await wait(50);

      // Enqueue a valid job
      const jobId = await service.add('emails', 'email:send', {
        to: 'user@example.com',
        subject: 'Hello World',
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      // Wait for processing
      const startTime = Date.now();
      let job = await service.getJob(jobId);
      while (job?.status !== 'completed' && Date.now() - startTime < 5000) {
        await wait(50);
        job = await service.getJob(jobId);
      }

      // Verify completion and result shape
      expect(job).toBeDefined();
      expect(job!.status).toBe('completed');
      expect(job!.result).toBeDefined();
      expect(typeof (job!.result as any).messageId).toBe('string');
      expect(typeof (job!.result as any).sentAt).toBe('number');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Validation rejection: strict schema → add() invalid data → JobValidationError
  // --------------------------------------------------------------------------
  describe('Input validation rejection', () => {
    it('should throw JobValidationError with stage "enqueue" for invalid input', async () => {
      storage = new InMemoryStorage();
      const logger = createMockLogger();
      const eventBus = createWorkingMockEventBus();

      const handlerRegistry = buildHandlerRegistry([
        { queueName: 'emails', jobType: 'email:send', definition: emailSendJob },
      ]);

      service = new QueueService({
        queues: {
          emails: {
            concurrency: 1,
            defaultMaxRetries: 0,
            jobs: { 'email:send': emailSendJob },
          },
        },
        storage,
        logger,
        eventBus,
        handlerRegistry,
      });

      // Attempt to add with invalid email (not a valid email address)
      try {
        await service.add('emails', 'email:send', {
          to: 'not-an-email',
          subject: 'Test',
        });
        expect.fail('Should have thrown JobValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(JobValidationError);
        const validationErr = err as JobValidationError;
        expect(validationErr.details!.stage).toBe('enqueue');
        expect(validationErr.details!.jobType).toBe('email:send');
        expect(validationErr.details!.validationErrors.length).toBeGreaterThan(0);
      }

      // Attempt to add with missing required field
      try {
        await service.add('emails', 'email:send', { to: 'valid@example.com' } as any);
        expect.fail('Should have thrown JobValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(JobValidationError);
        const validationErr = err as JobValidationError;
        expect(validationErr.details!.stage).toBe('enqueue');
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Output validation: handler returns wrong shape → job fails
  // --------------------------------------------------------------------------
  describe('Output validation failure', () => {
    it('should fail job when handler returns data that does not match output schema', async () => {
      storage = new InMemoryStorage();
      const logger = createMockLogger();
      const eventBus = createWorkingMockEventBus();

      const handlerRegistry = buildHandlerRegistry([
        { queueName: 'tasks', jobType: 'bad:output', definition: badOutputJob },
      ]);

      service = new QueueService({
        queues: {
          tasks: {
            concurrency: 1,
            defaultMaxRetries: 0,
            jobs: { 'bad:output': badOutputJob },
          },
        },
        storage,
        logger,
        eventBus,
        handlerRegistry,
      });

      await service.startAll();
      await wait(50);

      // Enqueue with valid input
      const jobId = await service.add('tasks', 'bad:output', { value: 123 });
      expect(jobId).toBeDefined();

      // Wait for processing
      const startTime = Date.now();
      let job = await service.getJob(jobId);
      while (job?.status !== 'failed' && Date.now() - startTime < 5000) {
        await wait(50);
        job = await service.getJob(jobId);
      }

      // Verify job failed with validation error
      expect(job).toBeDefined();
      expect(job!.status).toBe('failed');
      expect(job!.error).toBeDefined();
      expect(job!.error!.code).toBe('VALIDATION_ERROR');
      expect(job!.error!.message).toContain('bad:output');
    });
  });
});
