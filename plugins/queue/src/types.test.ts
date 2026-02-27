/**
 * Type Tests for Core Job Types and Storage Adapter Interface
 *
 * These tests verify that types compile correctly and provide
 * the expected type safety.
 */
import { createMockLogger } from '@blaizejs/testing-utils';

import type {
  Job,
  JobStatus,
  JobPriority,
  JobError,
  JobOptions,
  JobContext,
  JobHandler,
  JobFilters,
  JobSubscription,
  QueueStats,
  QueueConfig,
  QueuePluginConfig,
  QueueStorageAdapter,
  JobTypesSchema,
  QueueInstanceEvents,
} from './types';

describe('Core Types', () => {
  describe('JobStatus', () => {
    it('should accept valid status values', () => {
      const statuses: JobStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled'];
      expect(statuses).toHaveLength(5);
    });

    it('should have correct type', () => {
      expectTypeOf<JobStatus>().toEqualTypeOf<
        'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
      >();
    });
  });

  describe('JobPriority', () => {
    it('should accept valid priority values (1-10)', () => {
      const priorities: JobPriority[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(priorities).toHaveLength(10);
    });

    it('should have correct type', () => {
      expectTypeOf<JobPriority>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10>();
    });
  });

  describe('JobError', () => {
    it('should require message and allow optional fields', () => {
      const minimalError: JobError = { message: 'Something went wrong' };
      expect(minimalError.message).toBe('Something went wrong');

      const fullError: JobError = {
        message: 'Connection failed',
        code: 'ECONNREFUSED',
        stack: 'Error: Connection failed\n    at ...',
      };
      expect(fullError.code).toBe('ECONNREFUSED');
    });
  });

  describe('JobOptions', () => {
    it('should allow all optional fields', () => {
      const emptyOptions: JobOptions = {};
      expect(emptyOptions).toEqual({});

      const fullOptions: JobOptions = {
        priority: 8,
        maxRetries: 5,
        timeout: 60000,
        metadata: { userId: '123', source: 'api' },
      };
      expect(fullOptions.priority).toBe(8);
    });

    it('should enforce priority type', () => {
      const options: JobOptions = { priority: 5 };
      expectTypeOf(options.priority).toEqualTypeOf<JobPriority | undefined>();
    });
  });

  describe('Job', () => {
    it('should have all required readonly fields', () => {
      const job: Job<{ email: string }, { sent: boolean }> = {
        id: 'job_123',
        type: 'email:send',
        queueName: 'emails',
        data: { email: 'test@example.com' },
        status: 'queued',
        priority: 5,
        progress: 0,
        queuedAt: Date.now(),
        retries: 0,
        maxRetries: 3,
        timeout: 30000,
        metadata: {},
      };

      expect(job.id).toBe('job_123');
      expect(job.status).toBe('queued');
      expect(job.data.email).toBe('test@example.com');
    });

    it('should allow optional fields', () => {
      const completedJob: Job<unknown, { result: string }> = {
        id: 'job_456',
        type: 'process',
        queueName: 'default',
        data: {},
        status: 'completed',
        priority: 5,
        progress: 100,
        progressMessage: 'Done',
        queuedAt: 1000,
        startedAt: 2000,
        completedAt: 3000,
        result: { result: 'success' },
        retries: 0,
        maxRetries: 3,
        timeout: 30000,
        metadata: { key: 'value' },
      };

      expect(completedJob.completedAt).toBe(3000);
      expect(completedJob.result?.result).toBe('success');
    });

    it('should support generic data and result types', () => {
      interface EmailData {
        to: string;
        subject: string;
      }
      interface EmailResult {
        messageId: string;
      }

      const emailJob: Job<EmailData, EmailResult> = {
        id: 'job_789',
        type: 'email:send',
        queueName: 'emails',
        data: { to: 'user@example.com', subject: 'Hello' },
        status: 'completed',
        priority: 5,
        progress: 100,
        queuedAt: 1000,
        completedAt: 2000,
        result: { messageId: 'msg_abc' },
        retries: 0,
        maxRetries: 3,
        timeout: 30000,
        metadata: {},
      };

      // Type assertions
      expectTypeOf(emailJob.data).toEqualTypeOf<EmailData>();
      expectTypeOf(emailJob.result).toEqualTypeOf<EmailResult | undefined>();
    });
  });

  describe('JobContext', () => {
    it('should have all required fields', () => {
      // This is a type test - we verify the shape
      type _ContextShape = {
        jobId: string;
        data: unknown;
        logger: { info: (msg: string) => void }; // BlaizeLogger shape
        signal: AbortSignal;
        progress: (percent: number, message?: string) => Promise<void>;
      };

      // JobContext should be assignable to this shape
      expectTypeOf<JobContext>().toMatchTypeOf<{
        readonly jobId: string;
        readonly data: unknown;
        readonly signal: AbortSignal;
        progress: (percent: number, message?: string) => Promise<void>;
      }>();
    });

    it('should support generic data type', () => {
      interface TaskData {
        taskId: number;
        name: string;
      }

      type TaskContext = JobContext<TaskData>;

      // Verify data type is correct
      expectTypeOf<TaskContext['data']>().toEqualTypeOf<TaskData>();
    });
  });

  describe('JobHandler', () => {
    it('should be a function that takes context and returns promise', () => {
      const handler: JobHandler<{ x: number }, { y: number }> = async ctx => {
        return { y: ctx.data.x * 2 };
      };

      expectTypeOf(handler).toBeFunction();
      expectTypeOf(handler).parameter(0).toMatchTypeOf<JobContext<{ x: number }>>();
    });
  });

  describe('JobFilters', () => {
    it('should allow all optional filter fields', () => {
      const emptyFilters: JobFilters = {};
      expect(emptyFilters).toEqual({});

      const fullFilters: JobFilters = {
        status: 'failed',
        jobType: 'email:send',
        limit: 10,
        offset: 0,
        sortBy: 'queuedAt',
        sortOrder: 'desc',
      };
      expect(fullFilters.status).toBe('failed');
    });

    it('should allow status to be single or array', () => {
      const singleStatus: JobFilters = { status: 'queued' };
      const multiStatus: JobFilters = { status: ['queued', 'running'] };

      expect(singleStatus.status).toBe('queued');
      expect(multiStatus.status).toEqual(['queued', 'running']);
    });
  });

  describe('QueueStats', () => {
    it('should have all required numeric fields', () => {
      const stats: QueueStats = {
        total: 100,
        queued: 50,
        running: 10,
        completed: 30,
        failed: 5,
        cancelled: 5,
      };

      expect(stats.total).toBe(100);
      expect(stats.queued + stats.running + stats.completed + stats.failed + stats.cancelled).toBe(
        100
      );
    });
  });

  describe('JobSubscription', () => {
    it('should allow all optional callbacks', () => {
      const emptySubscription: JobSubscription = {};
      expect(emptySubscription).toEqual({});

      const fullSubscription: JobSubscription = {
        onProgress: (percent, message) => {
          console.log(`${percent}% - ${message}`);
        },
        onCompleted: result => {
          console.log('Completed:', result);
        },
        onFailed: error => {
          console.error('Failed:', error);
        },
        onCancelled: reason => {
          console.log('Cancelled:', reason);
        },
      };

      expect(typeof fullSubscription.onProgress).toBe('function');
    });
  });
});

describe('Configuration Types', () => {
  describe('QueueConfig', () => {
    it('should require name and allow optional fields', () => {
      const minimalConfig: QueueConfig = {
        name: 'default',
        jobs: {},
      };
      expect(minimalConfig.name).toBe('default');

      const fullConfig: QueueConfig = {
        name: 'emails',
        concurrency: 10,
        defaultTimeout: 60000,
        defaultMaxRetries: 5,
        jobs: {},
      };
      expect(fullConfig.concurrency).toBe(10);
    });
  });

  describe('QueuePluginConfig', () => {
    it('should require queues and allow optional fields', () => {
      const minimalConfig: QueuePluginConfig = {
        queues: {
          default: { jobs: {} },
        },
      };
      expect(minimalConfig.queues).toBeDefined();

      const fullConfig: QueuePluginConfig = {
        queues: {
          default: { concurrency: 5, jobs: {} },
          emails: { concurrency: 10, jobs: {} },
        },
        // storage: mockStorageAdapter, // Would be set in real usage
        defaultConcurrency: 5,
        defaultTimeout: 30000,
        defaultMaxRetries: 3,
      };
      expect(fullConfig.defaultConcurrency).toBe(5);
    });
  });

  describe('QueueInstanceConfig', () => {
    it('should require all fields', () => {
      const _mockLogger = createMockLogger();

      // Mock storage adapter
      const _mockStorage: QueueStorageAdapter = {
        enqueue: async () => {},
        dequeue: async () => null,
        peek: async () => null,
        getJob: async () => null,
        listJobs: async () => [],
        updateJob: async () => {},
        removeJob: async () => false,
        getQueueStats: async () => ({
          total: 0,
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        }),
      };

      // Mock job types with schema
      const _mockJobTypes = {
        'test:job': {
          schema: {
            safeParse: (data: unknown) => ({ success: true as const, data }),
            parse: (data: unknown) => data,
            _type: {} as { value: string },
            _output: {} as { value: string },
            _input: {} as { value: string },
            _def: { typeName: 'mock' },
          },
          priority: 5 as const,
        },
      } as unknown as JobTypesSchema;

      const config: QueueConfig = {
        name: 'default',
        concurrency: 5,
        defaultTimeout: 30000,
        defaultMaxRetries: 3,
        jobs: {},
      };

      expect(config.name).toBe('default');
      expect(config.concurrency).toBe(5);
    });
  });
});

describe('QueueStorageAdapter Interface', () => {
  it('should define all required methods', () => {
    // Create a mock implementation to verify interface shape
    const mockAdapter: QueueStorageAdapter = {
      // Queue operations
      enqueue: async () => {},
      dequeue: async () => null,
      peek: async () => null,

      // Job retrieval
      getJob: async () => null,
      listJobs: async () => [],

      // Job updates
      updateJob: async () => {},
      removeJob: async () => false,

      // Statistics
      getQueueStats: async () => ({
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      }),

      // Optional lifecycle
      connect: async () => {},
      disconnect: async () => {},
      healthCheck: async () => true,
    };

    // All methods should exist
    expect(typeof mockAdapter.enqueue).toBe('function');
    expect(typeof mockAdapter.dequeue).toBe('function');
    expect(typeof mockAdapter.peek).toBe('function');
    expect(typeof mockAdapter.getJob).toBe('function');
    expect(typeof mockAdapter.listJobs).toBe('function');
    expect(typeof mockAdapter.updateJob).toBe('function');
    expect(typeof mockAdapter.removeJob).toBe('function');
    expect(typeof mockAdapter.getQueueStats).toBe('function');
    expect(typeof mockAdapter.connect).toBe('function');
    expect(typeof mockAdapter.disconnect).toBe('function');
    expect(typeof mockAdapter.healthCheck).toBe('function');
  });

  it('should allow optional lifecycle methods to be undefined', () => {
    // Minimal adapter without lifecycle methods
    const minimalAdapter: QueueStorageAdapter = {
      enqueue: async () => {},
      dequeue: async () => null,
      peek: async () => null,
      getJob: async () => null,
      listJobs: async () => [],
      updateJob: async () => {},
      removeJob: async () => false,
      getQueueStats: async () => ({
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      }),
      // No connect, disconnect, or healthCheck
    };

    expect(minimalAdapter.connect).toBeUndefined();
    expect(minimalAdapter.disconnect).toBeUndefined();
    expect(minimalAdapter.healthCheck).toBeUndefined();
  });

  it('should have correct method signatures', () => {
    // Type-level checks
    type EnqueueFn = QueueStorageAdapter['enqueue'];
    type DequeueFn = QueueStorageAdapter['dequeue'];
    type GetJobFn = QueueStorageAdapter['getJob'];
    type ListJobsFn = QueueStorageAdapter['listJobs'];
    type UpdateJobFn = QueueStorageAdapter['updateJob'];
    type RemoveJobFn = QueueStorageAdapter['removeJob'];
    type GetStatsFn = QueueStorageAdapter['getQueueStats'];

    // Verify return types
    expectTypeOf<EnqueueFn>().returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf<DequeueFn>().returns.toEqualTypeOf<Promise<Job | null>>();
    expectTypeOf<GetJobFn>().returns.toEqualTypeOf<Promise<Job | null>>();
    expectTypeOf<ListJobsFn>().returns.toEqualTypeOf<Promise<Job[]>>();
    expectTypeOf<UpdateJobFn>().returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf<RemoveJobFn>().returns.toEqualTypeOf<Promise<boolean>>();
    expectTypeOf<GetStatsFn>().returns.toEqualTypeOf<Promise<QueueStats>>();
  });
});

describe('QueueEvents Interface', () => {
  it('should define all event types', () => {
    // Verify event callback signatures exist
    type QueuedEvent = QueueInstanceEvents['job:queued'];
    type StartedEvent = QueueInstanceEvents['job:started'];
    type ProgressEvent = QueueInstanceEvents['job:progress'];
    type CompletedEvent = QueueInstanceEvents['job:completed'];
    type FailedEvent = QueueInstanceEvents['job:failed'];
    type CancelledEvent = QueueInstanceEvents['job:cancelled'];
    type RetryEvent = QueueInstanceEvents['job:retry'];

    // All should be function types
    expectTypeOf<QueuedEvent>().toBeFunction();
    expectTypeOf<StartedEvent>().toBeFunction();
    expectTypeOf<ProgressEvent>().toBeFunction();
    expectTypeOf<CompletedEvent>().toBeFunction();
    expectTypeOf<FailedEvent>().toBeFunction();
    expectTypeOf<CancelledEvent>().toBeFunction();
    expectTypeOf<RetryEvent>().toBeFunction();
  });
});
