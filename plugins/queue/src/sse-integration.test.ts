/**
 * SSE Integration Tests
 *
 * Tests that verify SSE events are correctly emitted for job lifecycle events.
 * Tests the full flow from job creation through completion/failure with event verification.
 *
 * Note: These tests verify the EVENT SYSTEM, not the HTTP SSE layer.
 * The SSE handler (T16) is a thin layer that pipes these events to HTTP streams.
 *
 * @module @blaizejs/queue/tests/sse-integration
 */
import { createMockLogger, createWorkingMockEventBus } from '@blaizejs/testing-utils';
import { z } from 'zod';

import { defineJob } from './define-job';
import { QueueService } from './queue-service';
import {
  jobProgressEventSchema,
  jobCompletedEventSchema,
  jobFailedEventSchema,
  jobCancelledEventSchema,
} from './schema';
import { InMemoryStorage } from './storage/memory';

import type { QueueStorageAdapter, JobError, HandlerRegistration, JobDefinition } from './types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a simple defineJob() definition for tests that don't care about schemas
 */
function createTestJob(handler: (...args: any[]) => Promise<any>): JobDefinition<any, any> {
  return defineJob({
    input: z.any(),
    output: z.any(),
    handler,
  });
}

/**
 * Build a handler registry from an array of { queueName, jobType, definition } entries
 */
function buildHandlerRegistry(
  entries: Array<{ queueName: string; jobType: string; definition: JobDefinition<any, any> }>
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

/**
 * Create a QueueService with test configuration
 */
function createTestQueueService(options?: {
  queues?: Record<string, { concurrency?: number; jobs?: Record<string, JobDefinition<any, any>> }>;
  storage?: QueueStorageAdapter;
  handlerRegistry?: Map<string, HandlerRegistration>;
}) {
  const storage = options?.storage ?? new InMemoryStorage();
  const logger = createMockLogger();
  const eventBus = createWorkingMockEventBus();

  // Add jobs: {} to each queue config if not provided
  const queues: Record<string, { concurrency?: number; jobs: Record<string, JobDefinition<any, any>> }> = {};
  const rawQueues = options?.queues ?? { default: { concurrency: 5 } };
  for (const [name, config] of Object.entries(rawQueues)) {
    queues[name] = { ...config, jobs: config.jobs ?? {} };
  }

  return new QueueService({
    queues,
    storage,
    logger,
    eventBus,
    handlerRegistry: options?.handlerRegistry ?? new Map(),
  });
}

/**
 * Create a deferred promise for async test coordination
 */
function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ============================================================================
// Tests: Progress Events
// ============================================================================

describe('SSE Integration: Progress Events', () => {
  let queueService: QueueService;

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should emit progress events during job execution', async () => {
    const progressEvents: Array<{ percent: number; message?: string }> = [];
    const completed = createDeferred();

    const progressTestJob = createTestJob(async (ctx: any) => {
      ctx.progress(25, 'Starting...');
      await new Promise(r => setTimeout(r, 10));
      ctx.progress(50, 'Halfway...');
      await new Promise(r => setTimeout(r, 10));
      ctx.progress(75, 'Almost done...');
      await new Promise(r => setTimeout(r, 10));
      ctx.progress(100, 'Complete!');
      return { success: true };
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'progress:test': progressTestJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'progress:test', definition: progressTestJob },
      ]),
    });
    await queueService.startAll();

    // Add job and subscribe before it processes
    const jobId = await queueService.add('default', 'progress:test', {});

    queueService.subscribe(jobId, {
      onProgress: (percent, message) => {
        progressEvents.push({ percent, message });
      },
      onCompleted: () => {
        completed.resolve();
      },
    });

    // Wait for job to complete
    await completed.promise;

    // Verify progress events
    expect(progressEvents.length).toBeGreaterThanOrEqual(4);
    expect(progressEvents).toContainEqual({ percent: 25, message: 'Starting...' });
    expect(progressEvents).toContainEqual({ percent: 50, message: 'Halfway...' });
    expect(progressEvents).toContainEqual({ percent: 75, message: 'Almost done...' });
    expect(progressEvents).toContainEqual({ percent: 100, message: 'Complete!' });
  });

  it('should emit progress events with valid schema payloads', async () => {
    const progressPayloads: unknown[] = [];
    const completed = createDeferred();

    const schemaProgressJob = createTestJob(async (ctx: any) => {
      ctx.progress(50, 'Test message');
      return {};
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'schema:progress': schemaProgressJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'schema:progress', definition: schemaProgressJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'schema:progress', {});

    queueService.subscribe(jobId, {
      onProgress: (percent, message) => {
        // Build the full event payload as it would be sent via SSE
        progressPayloads.push({
          jobId,
          percent,
          message,
          timestamp: Date.now(),
        });
      },
      onCompleted: () => completed.resolve(),
    });

    await completed.promise;

    // Validate against schema
    for (const payload of progressPayloads) {
      const result = jobProgressEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
    }
  });

  it('should emit progress events without message', async () => {
    const progressEvents: Array<{ percent: number; message?: string }> = [];
    const completed = createDeferred();

    const noMsgJob = createTestJob(async (ctx: any) => {
      ctx.progress(50); // No message
      return {};
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'progress:no-msg': noMsgJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'progress:no-msg', definition: noMsgJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'progress:no-msg', {});

    queueService.subscribe(jobId, {
      onProgress: (percent, message) => {
        progressEvents.push({ percent, message });
      },
      onCompleted: () => completed.resolve(),
    });

    await completed.promise;

    expect(progressEvents).toContainEqual({ percent: 50, message: undefined });
  });
});

// ============================================================================
// Tests: Completion Events
// ============================================================================

describe('SSE Integration: Completion Events', () => {
  let queueService: QueueService;

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should emit completed event with result', async () => {
    const completed = createDeferred<unknown>();

    const expectedResult = {
      processed: true,
      count: 42,
      nested: { value: 'test' },
    };

    const completeResultJob = createTestJob(async () => expectedResult);

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'complete:result': completeResultJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'complete:result', definition: completeResultJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'complete:result', {});

    queueService.subscribe(jobId, {
      onCompleted: result => {
        completed.resolve(result);
      },
    });

    const result = await completed.promise;
    expect(result).toEqual(expectedResult);
  });

  it('should emit completed event with valid schema payload', async () => {
    const completed = createDeferred<unknown>();

    const schemaCompleteJob = createTestJob(async () => ({ success: true }));

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'schema:complete': schemaCompleteJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'schema:complete', definition: schemaCompleteJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'schema:complete', {});

    queueService.subscribe(jobId, {
      onCompleted: result => {
        // Build full event payload
        const payload = {
          jobId,
          result,
          completedAt: Date.now(),
        };
        completed.resolve(payload);
      },
    });

    const payload = await completed.promise;
    const validation = jobCompletedEventSchema.safeParse(payload);
    expect(validation.success).toBe(true);
  });

  it('should emit completed event with null result', async () => {
    const completed = createDeferred<unknown>();

    const completeNullJob = createTestJob(async () => null);

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'complete:null': completeNullJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'complete:null', definition: completeNullJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'complete:null', {});

    queueService.subscribe(jobId, {
      onCompleted: result => {
        completed.resolve(result);
      },
    });

    const result = await completed.promise;
    expect(result).toBeNull();
  });

  it('should emit completed event with undefined result', async () => {
    const completed = createDeferred<unknown>();

    const completeUndefinedJob = createTestJob(async () => {
      // No explicit return
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'complete:undefined': completeUndefinedJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'complete:undefined', definition: completeUndefinedJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'complete:undefined', {});

    queueService.subscribe(jobId, {
      onCompleted: result => {
        completed.resolve(result);
      },
    });

    const result = await completed.promise;
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Tests: Failure Events
// ============================================================================

describe('SSE Integration: Failure Events', () => {
  let queueService: QueueService;

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should emit failed event with error details', async () => {
    const failed = createDeferred<JobError>();

    const failErrorJob = createTestJob(async () => {
      throw new Error('Something went wrong');
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'fail:error': failErrorJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'fail:error', definition: failErrorJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add(
      'default',
      'fail:error',
      {},
      {
        maxRetries: 0, // No retries - fail immediately
      }
    );

    queueService.subscribe(jobId, {
      onFailed: error => {
        failed.resolve(error);
      },
    });

    const error = await failed.promise;
    expect(error.message).toBe('Something went wrong');
  });

  it('should emit failed event with valid schema payload', async () => {
    const failed = createDeferred<unknown>();

    const schemaFailJob = createTestJob(async () => {
      const error = new Error('Test failure');
      (error as any).code = 'TEST_ERROR';
      throw error;
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'schema:fail': schemaFailJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'schema:fail', definition: schemaFailJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add(
      'default',
      'schema:fail',
      {},
      {
        maxRetries: 0,
      }
    );

    queueService.subscribe(jobId, {
      onFailed: error => {
        // Build full event payload
        const payload = {
          jobId,
          error: {
            message: error.message,
            code: (error as any).code,
          },
          failedAt: Date.now(),
        };
        failed.resolve(payload);
      },
    });

    const payload = await failed.promise;
    const validation = jobFailedEventSchema.safeParse(payload);
    expect(validation.success).toBe(true);
  });

  it('should emit failed event after retries exhausted', async () => {
    let attempts = 0;
    const failed = createDeferred<JobError>();

    const failRetryJob = createTestJob(async () => {
      attempts++;
      throw new Error(`Attempt ${attempts} failed`);
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'fail:retry': failRetryJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'fail:retry', definition: failRetryJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add(
      'default',
      'fail:retry',
      {},
      {
        maxRetries: 2, // Will try 3 times total (1 initial + 2 retries)
      }
    );

    queueService.subscribe(jobId, {
      onFailed: error => {
        failed.resolve(error);
      },
    });

    const error = await failed.promise;
    expect(attempts).toBe(3); // Initial + 2 retries
    expect(error.message).toContain('failed');
  });

  it('should emit failed event with error code when available', async () => {
    const failed = createDeferred<JobError>();

    const failCodeJob = createTestJob(async () => {
      const error = new Error('Connection timeout') as Error & { code: string };
      error.code = 'JOB_TIMEOUT';
      throw error;
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'fail:code': failCodeJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'fail:code', definition: failCodeJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add(
      'default',
      'fail:code',
      {},
      {
        maxRetries: 0,
      }
    );

    queueService.subscribe(jobId, {
      onFailed: error => {
        failed.resolve(error);
      },
    });

    const error = await failed.promise;
    expect((error as any).code).toBe('JOB_TIMEOUT');
  });
});

// ============================================================================
// Tests: Cancellation Events
// ============================================================================

describe('SSE Integration: Cancellation Events', () => {
  let queueService: QueueService;

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should emit cancelled event when job is cancelled', async () => {
    const cancelled = createDeferred<string | undefined>();
    const jobStarted = createDeferred();

    const cancelTestJob = createTestJob(async (ctx: any) => {
      jobStarted.resolve();
      // Long running job that checks for cancellation
      for (let i = 0; i < 100; i++) {
        if (ctx.signal.aborted) {
          throw new Error('Job cancelled');
        }
        await new Promise(r => setTimeout(r, 50));
      }
      return {};
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'cancel:test': cancelTestJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'cancel:test', definition: cancelTestJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'cancel:test', {});

    queueService.subscribe(jobId, {
      onCancelled: reason => {
        cancelled.resolve(reason);
      },
    });

    // Wait for job to start, then cancel
    await jobStarted.promise;
    await queueService.cancelJob(jobId, 'default', 'User requested');

    const reason = await cancelled.promise;
    expect(reason).toBe('User requested');
  });

  it('should emit cancelled event with valid schema payload', async () => {
    const cancelled = createDeferred<unknown>();
    const jobStarted = createDeferred();

    const schemaCancelJob = createTestJob(async (_ctx: any) => {
      jobStarted.resolve();
      await new Promise(r => setTimeout(r, 5000));
      return {};
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'schema:cancel': schemaCancelJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'schema:cancel', definition: schemaCancelJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'schema:cancel', {});

    queueService.subscribe(jobId, {
      onCancelled: reason => {
        // Build full event payload
        const payload = {
          jobId,
          reason,
          cancelledAt: Date.now(),
        };
        cancelled.resolve(payload);
      },
    });

    await jobStarted.promise;
    await queueService.cancelJob(jobId, 'default', 'Test cancellation');

    const payload = await cancelled.promise;
    const validation = jobCancelledEventSchema.safeParse(payload);
    expect(validation.success).toBe(true);
  });

  it('should emit cancelled event without reason', async () => {
    const cancelled = createDeferred<string | undefined>();
    const jobStarted = createDeferred();

    const cancelNoReasonJob = createTestJob(async (_ctx: any) => {
      jobStarted.resolve();
      await new Promise(r => setTimeout(r, 5000));
      return {};
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'cancel:no-reason': cancelNoReasonJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'cancel:no-reason', definition: cancelNoReasonJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'cancel:no-reason', {});

    queueService.subscribe(jobId, {
      onCancelled: reason => {
        cancelled.resolve(reason);
      },
    });

    await jobStarted.promise;
    await queueService.cancelJob(jobId, 'default'); // No reason provided

    const reason = await cancelled.promise;
    expect(reason).toBeUndefined();
  });
});

// ============================================================================
// Tests: Subscription Cleanup
// ============================================================================

describe('SSE Integration: Subscription Cleanup', () => {
  let queueService: QueueService;

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should stop receiving events after unsubscribe', async () => {
    const progressEvents: number[] = [];
    const jobStarted = createDeferred();
    const jobCompleted = createDeferred();

    const cleanupUnsubJob = createTestJob(async (ctx: any) => {
      jobStarted.resolve();
      for (let i = 1; i <= 5; i++) {
        ctx.progress(i * 20);
        await new Promise(r => setTimeout(r, 20));
      }
      jobCompleted.resolve();
      return {};
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'cleanup:unsub': cleanupUnsubJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'cleanup:unsub', definition: cleanupUnsubJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'cleanup:unsub', {});

    const unsubscribe = queueService.subscribe(jobId, {
      onProgress: percent => {
        progressEvents.push(percent);
        // Unsubscribe after receiving first progress event
        if (progressEvents.length === 1) {
          unsubscribe();
        }
      },
    });

    await jobCompleted.promise;

    // Should have only received events before unsubscribe
    expect(progressEvents.length).toBeLessThan(5);
  });

  it('should allow re-subscription after unsubscribe', async () => {
    const events1: string[] = [];
    const events2: string[] = [];
    const completed = createDeferred();

    const cleanupResubJob = createTestJob(async (ctx: any) => {
      ctx.progress(50, 'halfway');
      return { done: true };
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'cleanup:resub': cleanupResubJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'cleanup:resub', definition: cleanupResubJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'cleanup:resub', {});

    // First subscription
    const unsub1 = queueService.subscribe(jobId, {
      onProgress: () => events1.push('progress'),
      onCompleted: () => events1.push('completed'),
    });

    // Immediately unsubscribe and re-subscribe
    unsub1();

    queueService.subscribe(jobId, {
      onProgress: () => events2.push('progress'),
      onCompleted: () => {
        events2.push('completed');
        completed.resolve();
      },
    });

    await completed.promise;

    // First subscription should have no events (unsubscribed immediately)
    expect(events1.length).toBe(0);
    // Second subscription should have events
    expect(events2).toContain('completed');
  });

  it('should handle multiple unsubscribe calls gracefully', async () => {
    const completed = createDeferred();

    const cleanupMultiUnsubJob = createTestJob(async () => ({}));

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'cleanup:multi-unsub': cleanupMultiUnsubJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'cleanup:multi-unsub', definition: cleanupMultiUnsubJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'cleanup:multi-unsub', {});

    const unsubscribe = queueService.subscribe(jobId, {
      onCompleted: () => completed.resolve(),
    });

    await completed.promise;

    // Multiple unsubscribe calls should not throw
    expect(() => {
      unsubscribe();
      unsubscribe();
      unsubscribe();
    }).not.toThrow();
  });
});

// ============================================================================
// Tests: Multiple Subscribers
// ============================================================================

describe('SSE Integration: Multiple Subscribers', () => {
  let queueService: QueueService;

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should notify all subscribers of progress events', async () => {
    const subscriber1Progress: number[] = [];
    const subscriber2Progress: number[] = [];
    const subscriber3Progress: number[] = [];
    const allCompleted = createDeferred();
    let completedCount = 0;

    const multiProgressJob = createTestJob(async (ctx: any) => {
      ctx.progress(25);
      ctx.progress(50);
      ctx.progress(75);
      ctx.progress(100);
      return {};
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'multi:progress': multiProgressJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'multi:progress', definition: multiProgressJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'multi:progress', {});

    const onComplete = () => {
      completedCount++;
      if (completedCount === 3) {
        allCompleted.resolve();
      }
    };

    // Subscribe three times
    queueService.subscribe(jobId, {
      onProgress: p => subscriber1Progress.push(p),
      onCompleted: onComplete,
    });

    queueService.subscribe(jobId, {
      onProgress: p => subscriber2Progress.push(p),
      onCompleted: onComplete,
    });

    queueService.subscribe(jobId, {
      onProgress: p => subscriber3Progress.push(p),
      onCompleted: onComplete,
    });

    await allCompleted.promise;

    // All subscribers should receive same events
    expect(subscriber1Progress).toEqual([25, 50, 75, 100]);
    expect(subscriber2Progress).toEqual([25, 50, 75, 100]);
    expect(subscriber3Progress).toEqual([25, 50, 75, 100]);
  });

  it('should notify all subscribers of completion', async () => {
    const results: unknown[] = [];
    const allCompleted = createDeferred();
    let completedCount = 0;

    const expectedResult = { value: 'shared result' };

    const multiCompleteJob = createTestJob(async () => expectedResult);

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'multi:complete': multiCompleteJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'multi:complete', definition: multiCompleteJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'multi:complete', {});

    const onComplete = (result: unknown) => {
      results.push(result);
      completedCount++;
      if (completedCount === 3) {
        allCompleted.resolve();
      }
    };

    // Subscribe three times
    queueService.subscribe(jobId, { onCompleted: onComplete });
    queueService.subscribe(jobId, { onCompleted: onComplete });
    queueService.subscribe(jobId, { onCompleted: onComplete });

    await allCompleted.promise;

    // All subscribers should receive same result
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(expectedResult);
    expect(results[1]).toEqual(expectedResult);
    expect(results[2]).toEqual(expectedResult);
  });

  it('should notify all subscribers of failure', async () => {
    const errors: JobError[] = [];
    const allFailed = createDeferred();
    let failedCount = 0;

    const multiFailJob = createTestJob(async () => {
      throw new Error('Shared failure');
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'multi:fail': multiFailJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'multi:fail', definition: multiFailJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add(
      'default',
      'multi:fail',
      {},
      {
        maxRetries: 0,
      }
    );

    const onFailed = (error: JobError) => {
      errors.push(error);
      failedCount++;
      if (failedCount === 3) {
        allFailed.resolve();
      }
    };

    // Subscribe three times
    queueService.subscribe(jobId, { onFailed });
    queueService.subscribe(jobId, { onFailed });
    queueService.subscribe(jobId, { onFailed });

    await allFailed.promise;

    // All subscribers should receive same error
    expect(errors).toHaveLength(3);
    expect(errors[0]!.message).toBe('Shared failure');
    expect(errors[1]!.message).toBe('Shared failure');
    expect(errors[2]!.message).toBe('Shared failure');
  });

  it('should allow independent unsubscription', async () => {
    const subscriber1Events: string[] = [];
    const subscriber2Events: string[] = [];
    const completed = createDeferred();

    const multiUnsubJob = createTestJob(async (ctx: any) => {
      ctx.progress(50);
      await new Promise(r => setTimeout(r, 50));
      return {};
    });

    queueService = createTestQueueService({
      queues: { default: { concurrency: 5, jobs: { 'multi:unsub': multiUnsubJob } } },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'default', jobType: 'multi:unsub', definition: multiUnsubJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('default', 'multi:unsub', {});

    // First subscriber - will unsubscribe after progress
    const unsub1 = queueService.subscribe(jobId, {
      onProgress: () => {
        subscriber1Events.push('progress');
        unsub1(); // Unsubscribe immediately
      },
      onCompleted: () => subscriber1Events.push('completed'),
    });

    // Second subscriber - stays subscribed
    queueService.subscribe(jobId, {
      onProgress: () => subscriber2Events.push('progress'),
      onCompleted: () => {
        subscriber2Events.push('completed');
        completed.resolve();
      },
    });

    await completed.promise;

    // First subscriber should only have progress (unsubscribed before completed)
    expect(subscriber1Events).toEqual(['progress']);
    // Second subscriber should have both
    expect(subscriber2Events).toEqual(['progress', 'completed']);
  });
});

// ============================================================================
// Tests: Cross-Queue Events
// ============================================================================

describe('SSE Integration: Cross-Queue Events', () => {
  let queueService: QueueService;

  afterEach(async () => {
    await queueService.stopAll({ graceful: false, timeout: 1000 });
  });

  it('should receive events for job without knowing queue name', async () => {
    const completed = createDeferred<unknown>();

    const crossTestJob = createTestJob(async () => ({ sent: true }));

    queueService = createTestQueueService({
      queues: {
        emails: { concurrency: 2, jobs: { 'cross:test': crossTestJob } },
        reports: { concurrency: 2, jobs: {} },
      },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'emails', jobType: 'cross:test', definition: crossTestJob },
      ]),
    });
    await queueService.startAll();

    const jobId = await queueService.add('emails', 'cross:test', {});

    // Subscribe without specifying queue name
    queueService.subscribe(jobId, {
      onCompleted: result => {
        completed.resolve(result);
      },
    });

    const result = await completed.promise;
    expect(result).toEqual({ sent: true });
  });

  it('should isolate events between different jobs', async () => {
    const job1Events: string[] = [];
    const job2Events: string[] = [];
    const allCompleted = createDeferred();
    let completedCount = 0;

    const isolateEmailJob = createTestJob(async (ctx: any) => {
      ctx.progress(50, 'email progress');
      return { type: 'email' };
    });

    const isolateReportJob = createTestJob(async (ctx: any) => {
      ctx.progress(50, 'report progress');
      return { type: 'report' };
    });

    queueService = createTestQueueService({
      queues: {
        emails: { concurrency: 2, jobs: { 'isolate:email': isolateEmailJob } },
        reports: { concurrency: 2, jobs: { 'isolate:report': isolateReportJob } },
      },
      handlerRegistry: buildHandlerRegistry([
        { queueName: 'emails', jobType: 'isolate:email', definition: isolateEmailJob },
        { queueName: 'reports', jobType: 'isolate:report', definition: isolateReportJob },
      ]),
    });
    await queueService.startAll();

    const jobId1 = await queueService.add('emails', 'isolate:email', {});
    const jobId2 = await queueService.add('reports', 'isolate:report', {});

    const checkComplete = () => {
      completedCount++;
      if (completedCount === 2) {
        allCompleted.resolve();
      }
    };

    queueService.subscribe(jobId1, {
      onProgress: (_, msg) => job1Events.push(`progress:${msg}`),
      onCompleted: (r: any) => {
        job1Events.push(`completed:${r.type}`);
        checkComplete();
      },
    });

    queueService.subscribe(jobId2, {
      onProgress: (_, msg) => job2Events.push(`progress:${msg}`),
      onCompleted: (r: any) => {
        job2Events.push(`completed:${r.type}`);
        checkComplete();
      },
    });

    await allCompleted.promise;

    // Each subscriber should only receive events for their job
    expect(job1Events).toContain('progress:email progress');
    expect(job1Events).toContain('completed:email');
    expect(job1Events).not.toContain('progress:report progress');

    expect(job2Events).toContain('progress:report progress');
    expect(job2Events).toContain('completed:report');
    expect(job2Events).not.toContain('progress:email progress');
  });
});
