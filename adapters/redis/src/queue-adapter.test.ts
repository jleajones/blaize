/**
 * Unit tests for RedisQueueAdapter
 *
 * @module @blaizejs/adapter-redis/queue-adapter
 */
import { RedisOperationError } from './errors';
import { RedisQueueAdapter } from './queue-adapter';

import type { QueueJob, RedisClient } from './types';

describe('RedisQueueAdapter', () => {
  let adapter: RedisQueueAdapter;
  let mockClient: any;
  let mockConnection: any;
  let mockLogger: any;

  // Helper to create test jobs
  function createTestJob(overrides: Partial<QueueJob> = {}): QueueJob {
    const id = overrides.id ?? `job_${Math.random().toString(36).slice(2, 10)}`;
    return {
      id,
      type: 'test:job',
      queueName: 'default',
      data: { test: true },
      status: 'queued',
      priority: 5,
      progress: 0,
      queuedAt: Date.now(),
      retries: 0,
      maxRetries: 3,
      timeout: 30000,
      metadata: {},
      ...overrides,
    };
  }

  beforeEach(() => {
    // Create mock Redis connection
    mockConnection = {
      hset: vi.fn().mockResolvedValue('OK'),
      hgetall: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
      zadd: vi.fn().mockResolvedValue(1),
      zrem: vi.fn().mockResolvedValue(1),
      zrange: vi.fn(),
      zcard: vi.fn(),
      pipeline: vi.fn(),
      eval: vi.fn(),
      script: vi.fn().mockResolvedValue('0123456789abcdef0123456789abcdef01234567'),
      evalsha: vi.fn(),
    };

    // Create mock client
    mockClient = {
      getConnection: vi.fn().mockReturnValue(mockConnection),
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      healthCheck: vi.fn().mockResolvedValue({ healthy: true, latency: 5 }),
    };

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };
    mockLogger.child.mockReturnValue(mockLogger);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create adapter with default options', () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient);

      expect(adapter).toBeInstanceOf(RedisQueueAdapter);
    });

    it('should create adapter with custom key prefix', () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient, {
        keyPrefix: 'myqueue:',
        logger: mockLogger,
      });

      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'RedisQueueAdapter' });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'RedisQueueAdapter created',
        expect.objectContaining({
          keyPrefix: 'myqueue:',
        })
      );
    });
  });

  describe('connect()', () => {
    beforeEach(() => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
    });

    it('should connect successfully and load Lua scripts', async () => {
      await adapter.connect();

      expect(mockClient.isConnected).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('RedisQueueAdapter connected');
      expect(mockLogger.debug).toHaveBeenCalledWith('Lua scripts loaded from files');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Lua scripts registered in Redis',
        expect.objectContaining({
          dequeueSha: expect.any(String),
          completeSha: expect.any(String),
          failSha: expect.any(String),
        })
      );
    });

    it('should connect client if not already connected', async () => {
      mockClient.isConnected.mockReturnValue(false);

      await adapter.connect();

      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('should be no-op if already connected', async () => {
      await adapter.connect();

      mockLogger.debug.mockClear();

      await adapter.connect();

      expect(mockLogger.debug).toHaveBeenCalledWith('Already connected, skipping connect()');
    });
  });

  describe('disconnect()', () => {
    beforeEach(async () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should disconnect successfully', async () => {
      await adapter.disconnect();

      expect(mockLogger.info).toHaveBeenCalledWith('RedisQueueAdapter disconnected');
    });

    it('should be no-op if not connected', async () => {
      await adapter.disconnect();

      mockLogger.debug.mockClear();

      await adapter.disconnect();

      expect(mockLogger.debug).toHaveBeenCalledWith('Not connected, skipping disconnect()');
    });
  });

  describe('enqueue()', () => {
    beforeEach(async () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();

      // Setup pipeline mock
      const mockPipeline = {
        hset: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockConnection.pipeline.mockReturnValue(mockPipeline);
    });

    it('should enqueue a job with correct score', async () => {
      const job = createTestJob({ id: 'job1', priority: 5, queuedAt: 1000000 });

      await adapter.enqueue('default', job);

      const pipeline = mockConnection.pipeline();

      // Verify job hash was stored
      expect(pipeline.hset).toHaveBeenCalledWith(
        'job:job1',
        expect.objectContaining({
          id: 'job1',
          priority: '5',
          status: 'queued',
        })
      );

      // Verify job was added to sorted set with correct score
      // Score = -priority + (timestamp / 1e13) = -5 + 0.0000001 = -4.9999999
      expect(pipeline.zadd).toHaveBeenCalledWith(
        'queue:default:queued',
        expect.any(Number),
        'job1'
      );

      expect(pipeline.exec).toHaveBeenCalled();
    });

    it('should handle high priority jobs (lower score)', async () => {
      const lowPriorityJob = createTestJob({ priority: 1 });
      const highPriorityJob = createTestJob({ priority: 10 });

      await adapter.enqueue('default', highPriorityJob);
      await adapter.enqueue('default', lowPriorityJob);

      const calls = mockConnection.pipeline().zadd.mock.calls;

      // High priority (10) should have lower score than low priority (1)
      const highPriorityScore = calls[0][1];
      const lowPriorityScore = calls[1][1];

      expect(highPriorityScore).toBeLessThan(lowPriorityScore);
    });

    it('should ensure FIFO for same priority', async () => {
      const job1 = createTestJob({ priority: 5, queuedAt: 1000 });
      const job2 = createTestJob({ priority: 5, queuedAt: 2000 });

      await adapter.enqueue('default', job1);
      await adapter.enqueue('default', job2);

      const calls = mockConnection.pipeline().zadd.mock.calls;

      // Earlier timestamp should have lower score (processed first)
      const score1 = calls[0][1];
      const score2 = calls[1][1];

      expect(score1).toBeLessThan(score2);
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      const job = createTestJob();

      await expect(adapter.enqueue('default', job)).rejects.toThrow('not connected');
    });

    it('should throw RedisOperationError on failure', async () => {
      const failingPipeline = {
        hset: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Redis error')),
      };
      mockConnection.pipeline.mockReturnValue(failingPipeline);

      const job = createTestJob();

      await expect(adapter.enqueue('default', job)).rejects.toThrow(RedisOperationError);
    });
  });

  describe('dequeue()', () => {
    beforeEach(async () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should dequeue highest priority job using Lua script', async () => {
      const _job = createTestJob({ id: 'job1' });

      mockConnection.evalsha.mockResolvedValue('job1');
      mockConnection.hgetall.mockResolvedValue({
        id: 'job1',
        type: 'test:job',
        queueName: 'default',
        data: JSON.stringify({ test: true }),
        status: 'running',
        priority: '5',
        progress: '0',
        queuedAt: Date.now().toString(),
        retries: '0',
        maxRetries: '3',
        timeout: '30000',
        startedAt: Date.now().toString(),
        metadata: '{}',
      });

      const result = await adapter.dequeue('default');

      expect(result).toBeDefined();
      expect(result?.id).toBe('job1');
      expect(result?.status).toBe('running');

      // Verify Lua script was called with correct arguments
      expect(mockConnection.evalsha).toHaveBeenCalledWith(
        expect.any(String), // Lua script content
        3, // Number of keys
        'queue:default:queued',
        'queue:default:running',
        'job:',
        expect.any(String) // timestamp
      );
    });

    it('should return null when queue is empty', async () => {
      mockConnection.evalsha.mockResolvedValue(null);

      const result = await adapter.dequeue('default');

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('Dequeue: queue empty', {
        queueName: 'default',
      });
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.dequeue('default')).rejects.toThrow('not connected');
    });

    it('should throw RedisOperationError on failure', async () => {
      mockConnection.evalsha.mockRejectedValue(new Error('Lua script error'));

      await expect(adapter.dequeue('default')).rejects.toThrow(RedisOperationError);
    });
  });

  describe('peek()', () => {
    beforeEach(async () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should return highest priority job without removing it', async () => {
      mockConnection.zrange.mockResolvedValue(['job1']);
      mockConnection.hgetall.mockResolvedValue({
        id: 'job1',
        type: 'test:job',
        queueName: 'default',
        data: JSON.stringify({ test: true }),
        status: 'queued',
        priority: '10',
        progress: '0',
        queuedAt: Date.now().toString(),
        retries: '0',
        maxRetries: '3',
        timeout: '30000',
        metadata: '{}',
      });

      const result = await adapter.peek('default');

      expect(result).toBeDefined();
      expect(result?.id).toBe('job1');
      expect(result?.priority).toBe(10);

      // Verify job was not removed
      expect(mockConnection.zrem).not.toHaveBeenCalled();
    });

    it('should return null when queue is empty', async () => {
      mockConnection.zrange.mockResolvedValue([]);

      const result = await adapter.peek('default');

      expect(result).toBeNull();
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.peek('default')).rejects.toThrow('not connected');
    });

    it('should throw RedisOperationError on failure', async () => {
      mockConnection.zrange.mockRejectedValue(new Error('Redis error'));

      await expect(adapter.peek('default')).rejects.toThrow(RedisOperationError);
    });
  });

  describe('getJob()', () => {
    beforeEach(async () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should get job by ID', async () => {
      mockConnection.hgetall.mockResolvedValue({
        id: 'job1',
        type: 'test:job',
        queueName: 'default',
        data: JSON.stringify({ value: 42 }),
        status: 'queued',
        priority: '7',
        progress: '50',
        queuedAt: '1000000',
        retries: '1',
        maxRetries: '3',
        timeout: '60000',
        result: JSON.stringify({ done: true }),
        error: JSON.stringify({ message: 'Some error' }),
        metadata: JSON.stringify({ custom: 'data' }),
      });

      const result = await adapter.getJob('job1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('job1');
      expect(result?.data).toEqual({ value: 42 });
      expect(result?.priority).toBe(7);
      expect(result?.progress).toBe(50);
      expect(result?.result).toEqual({ done: true });
      expect(result?.error).toEqual({ message: 'Some error' });
      expect(result?.metadata).toEqual({ custom: 'data' });
    });

    it('should return null for non-existent job', async () => {
      mockConnection.hgetall.mockResolvedValue({});

      const result = await adapter.getJob('missing');

      expect(result).toBeNull();
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.getJob('job1')).rejects.toThrow('not connected');
    });

    it('should throw RedisOperationError on failure', async () => {
      mockConnection.hgetall.mockRejectedValue(new Error('Redis error'));

      await expect(adapter.getJob('job1')).rejects.toThrow(RedisOperationError);
    });
  });

  describe('listJobs()', () => {
    beforeEach(async () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should list all jobs in queue', async () => {
      mockConnection.zrange
        .mockResolvedValueOnce(['job1', 'job2']) // queued
        .mockResolvedValueOnce([]) // running
        .mockResolvedValueOnce([]) // completed
        .mockResolvedValueOnce([]) // failed
        .mockResolvedValueOnce([]); // cancelled

      mockConnection.hgetall
        .mockResolvedValueOnce({
          id: 'job1',
          type: 'email',
          queueName: 'default',
          data: '{}',
          status: 'queued',
          priority: '5',
          progress: '0',
          queuedAt: '1000',
          retries: '0',
          maxRetries: '3',
          timeout: '30000',
          metadata: '{}',
        })
        .mockResolvedValueOnce({
          id: 'job2',
          type: 'email',
          queueName: 'default',
          data: '{}',
          status: 'queued',
          priority: '3',
          progress: '0',
          queuedAt: '2000',
          retries: '0',
          maxRetries: '3',
          timeout: '30000',
          metadata: '{}',
        });

      const result = await adapter.listJobs('default');

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('job1');
      expect(result[1]!.id).toBe('job2');
    });

    it('should filter by status', async () => {
      mockConnection.zrange.mockResolvedValue(['job1']);
      mockConnection.hgetall.mockResolvedValue({
        id: 'job1',
        type: 'test',
        queueName: 'default',
        data: '{}',
        status: 'running',
        priority: '5',
        progress: '0',
        queuedAt: '1000',
        retries: '0',
        maxRetries: '3',
        timeout: '30000',
        metadata: '{}',
      });

      const result = await adapter.listJobs('default', { status: 'running' });

      expect(result).toHaveLength(1);
      expect(result[0]!.status).toBe('running');
    });

    it('should filter by multiple statuses', async () => {
      mockConnection.zrange
        .mockResolvedValueOnce(['job1']) // queued
        .mockResolvedValueOnce(['job2']); // running

      mockConnection.hgetall
        .mockResolvedValueOnce({
          id: 'job1',
          type: 'test',
          queueName: 'default',
          data: '{}',
          status: 'queued',
          priority: '5',
          progress: '0',
          queuedAt: '1000',
          retries: '0',
          maxRetries: '3',
          timeout: '30000',
          metadata: '{}',
        })
        .mockResolvedValueOnce({
          id: 'job2',
          type: 'test',
          queueName: 'default',
          data: '{}',
          status: 'running',
          priority: '5',
          progress: '0',
          queuedAt: '2000',
          retries: '0',
          maxRetries: '3',
          timeout: '30000',
          metadata: '{}',
        });

      const result = await adapter.listJobs('default', {
        status: ['queued', 'running'],
      });

      expect(result).toHaveLength(2);
    });

    it('should filter by job type', async () => {
      // Mock zrange for all 5 statuses
      mockConnection.zrange
        .mockResolvedValueOnce(['job1', 'job2']) // queued
        .mockResolvedValueOnce([]) // running
        .mockResolvedValueOnce([]) // completed
        .mockResolvedValueOnce([]) // failed
        .mockResolvedValueOnce([]); // cancelled

      mockConnection.hgetall
        .mockResolvedValueOnce({
          id: 'job1',
          type: 'email',
          queueName: 'default',
          data: '{}',
          status: 'queued',
          priority: '5',
          progress: '0',
          queuedAt: '1000',
          startedAt: '',
          completedAt: '',
          retries: '0',
          maxRetries: '3',
          timeout: '30000',
          result: '',
          metadata: '{}',
        })
        .mockResolvedValueOnce({
          id: 'job2',
          type: 'sms',
          queueName: 'default',
          data: '{}',
          status: 'queued',
          priority: '5',
          progress: '0',
          queuedAt: '2000',
          startedAt: '',
          completedAt: '',
          retries: '0',
          maxRetries: '3',
          timeout: '30000',
          result: '',
          metadata: '{}',
        });

      const result = await adapter.listJobs('default', { jobType: 'email' });

      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe('email');
    });

    it('should apply limit and offset', async () => {
      // Mock zrange for all 5 statuses
      mockConnection.zrange
        .mockResolvedValueOnce(['job1', 'job2', 'job3']) // queued
        .mockResolvedValueOnce([]) // running
        .mockResolvedValueOnce([]) // completed
        .mockResolvedValueOnce([]) // failed
        .mockResolvedValueOnce([]); // cancelled

      mockConnection.hgetall
        .mockResolvedValueOnce({
          id: 'job1',
          type: 'test',
          queueName: 'default',
          data: '{}',
          status: 'queued',
          priority: '5',
          progress: '0',
          queuedAt: '1000',
          startedAt: '',
          completedAt: '',
          retries: '0',
          maxRetries: '3',
          timeout: '30000',
          result: '',
          metadata: '{}',
        })
        .mockResolvedValueOnce({
          id: 'job2',
          type: 'test',
          queueName: 'default',
          data: '{}',
          status: 'queued',
          priority: '5',
          progress: '0',
          queuedAt: '2000',
          startedAt: '',
          completedAt: '',
          retries: '0',
          maxRetries: '3',
          timeout: '30000',
          result: '',
          metadata: '{}',
        })
        .mockResolvedValueOnce({
          id: 'job3',
          type: 'test',
          queueName: 'default',
          data: '{}',
          status: 'queued',
          priority: '5',
          progress: '0',
          queuedAt: '3000',
          startedAt: '',
          completedAt: '',
          retries: '0',
          maxRetries: '3',
          timeout: '30000',
          result: '',
          metadata: '{}',
        });

      const result = await adapter.listJobs('default', { limit: 1, offset: 1 });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('job2');
    });

    it('should sort by priority', async () => {
      // Mock zrange for all 5 statuses
      mockConnection.zrange
        .mockResolvedValueOnce(['job1', 'job2']) // queued
        .mockResolvedValueOnce([]) // running
        .mockResolvedValueOnce([]) // completed
        .mockResolvedValueOnce([]) // failed
        .mockResolvedValueOnce([]); // cancelled

      mockConnection.hgetall
        .mockResolvedValueOnce({
          id: 'job1',
          type: 'test',
          queueName: 'default',
          data: '{}',
          status: 'queued',
          priority: '3',
          progress: '0',
          queuedAt: '1000',
          startedAt: '',
          completedAt: '',
          retries: '0',
          maxRetries: '3',
          timeout: '30000',
          result: '',
          metadata: '{}',
        })
        .mockResolvedValueOnce({
          id: 'job2',
          type: 'test',
          queueName: 'default',
          data: '{}',
          status: 'queued',
          priority: '10',
          progress: '0',
          queuedAt: '2000',
          startedAt: '',
          completedAt: '',
          retries: '0',
          maxRetries: '3',
          timeout: '30000',
          result: '',
          metadata: '{}',
        });

      const result = await adapter.listJobs('default', {
        sortBy: 'priority',
        sortOrder: 'desc',
      });

      expect(result[0]!.priority).toBe(10);
      expect(result[1]!.priority).toBe(3);
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.listJobs('default')).rejects.toThrow('not connected');
    });
  });

  describe('updateJob()', () => {
    beforeEach(async () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();

      // Setup pipeline mock
      const mockPipeline = {
        hset: vi.fn().mockReturnThis(),
        zrem: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockConnection.pipeline.mockReturnValue(mockPipeline);
    });

    it('should update job without status change', async () => {
      mockConnection.hgetall.mockResolvedValue({
        id: 'job1',
        type: 'test',
        queueName: 'default',
        data: '{}',
        status: 'queued',
        priority: '5',
        progress: '0',
        queuedAt: '1000',
        retries: '0',
        maxRetries: '3',
        timeout: '30000',
        metadata: '{}',
      });

      await adapter.updateJob('job1', { progress: 50 });

      const pipeline = mockConnection.pipeline();

      expect(pipeline.hset).toHaveBeenCalled();
      expect(pipeline.zrem).not.toHaveBeenCalled(); // No status change
      expect(pipeline.exec).toHaveBeenCalled();
    });

    it('should move job between status sets on status change', async () => {
      mockConnection.hgetall.mockResolvedValue({
        id: 'job1',
        type: 'test',
        queueName: 'default',
        data: '{}',
        status: 'running',
        priority: '5',
        progress: '0',
        queuedAt: '1000',
        retries: '0',
        maxRetries: '3',
        timeout: '30000',
        metadata: '{}',
      });

      await adapter.updateJob('job1', { status: 'completed' });

      const pipeline = mockConnection.pipeline();

      // Should remove from old status set
      expect(pipeline.zrem).toHaveBeenCalledWith('queue:default:running', 'job1');

      // Should add to new status set
      expect(pipeline.zadd).toHaveBeenCalledWith(
        'queue:default:completed',
        expect.any(Number),
        'job1'
      );
    });

    it('should throw if job not found', async () => {
      mockConnection.hgetall.mockResolvedValue({});

      await expect(adapter.updateJob('missing', { progress: 50 })).rejects.toThrow(
        'Job missing not found'
      );
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.updateJob('job1', { progress: 50 })).rejects.toThrow('not connected');
    });
  });

  describe('removeJob()', () => {
    beforeEach(async () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();

      // Setup pipeline mock
      const mockPipeline = {
        del: vi.fn().mockReturnThis(),
        zrem: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockConnection.pipeline.mockReturnValue(mockPipeline);
    });

    it('should remove job and return true', async () => {
      mockConnection.hgetall.mockResolvedValue({
        id: 'job1',
        type: 'test',
        queueName: 'default',
        data: '{}',
        status: 'queued',
        priority: '5',
        progress: '0',
        queuedAt: '1000',
        retries: '0',
        maxRetries: '3',
        timeout: '30000',
        metadata: '{}',
      });

      const result = await adapter.removeJob('job1');

      expect(result).toBe(true);

      const pipeline = mockConnection.pipeline();

      expect(pipeline.del).toHaveBeenCalledWith('job:job1');
      expect(pipeline.zrem).toHaveBeenCalledWith('queue:default:queued', 'job1');
      expect(pipeline.exec).toHaveBeenCalled();
    });

    it('should return false for non-existent job', async () => {
      mockConnection.hgetall.mockResolvedValue({});

      const result = await adapter.removeJob('missing');

      expect(result).toBe(false);
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.removeJob('job1')).rejects.toThrow('not connected');
    });
  });

  describe('getQueueStats()', () => {
    beforeEach(async () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
    });

    it('should return basic stats when not connected', async () => {
      const stats = await adapter.getQueueStats('default');

      expect(stats).toEqual({
        total: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      });
    });

    it('should return full stats when connected', async () => {
      await adapter.connect();

      // Setup pipeline mock
      const mockPipeline = {
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 5], // queued
          [null, 2], // running
          [null, 10], // completed
          [null, 1], // failed
          [null, 0], // cancelled
        ]),
      };
      mockConnection.pipeline.mockReturnValue(mockPipeline);

      const stats = await adapter.getQueueStats('default');

      expect(stats).toEqual({
        total: 18,
        queued: 5,
        running: 2,
        completed: 10,
        failed: 1,
        cancelled: 0,
      });
    });

    it('should return zero stats on error', async () => {
      await adapter.connect();

      const mockPipeline = {
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Pipeline failed')),
      };
      mockConnection.pipeline.mockReturnValue(mockPipeline);

      const stats = await adapter.getQueueStats('default');

      expect(stats.total).toBe(0);
    });
  });

  describe('healthCheck()', () => {
    beforeEach(async () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient);
      await adapter.connect();
    });

    it('should return false when not connected', async () => {
      await adapter.disconnect();

      const healthy = await adapter.healthCheck();

      expect(healthy).toBe(false);
    });

    it('should return true when client is healthy', async () => {
      const healthy = await adapter.healthCheck();

      expect(healthy).toBe(true);
    });

    it('should return false when client is unhealthy', async () => {
      mockClient.healthCheck.mockResolvedValue({ healthy: false });

      const healthy = await adapter.healthCheck();

      expect(healthy).toBe(false);
    });

    it('should return false on error', async () => {
      mockClient.healthCheck.mockRejectedValue(new Error('Health check failed'));

      const healthy = await adapter.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe('Edge cases', () => {
    beforeEach(async () => {
      adapter = new RedisQueueAdapter(mockClient as RedisClient);
      await adapter.connect();
    });

    it('should handle large job payloads', async () => {
      const largeData = { text: 'x'.repeat(10000) };
      const job = createTestJob({ data: largeData });

      const mockPipeline = {
        hset: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockConnection.pipeline.mockReturnValue(mockPipeline);

      await adapter.enqueue('default', job);

      const pipeline = mockConnection.pipeline();
      const hashData = pipeline.hset.mock.calls[0][1];

      expect(hashData.data).toContain('x'.repeat(10000));
    });

    it('should handle jobs with undefined optional fields', async () => {
      const _job: QueueJob = {
        id: 'job1',
        type: 'test',
        queueName: 'default',
        data: {},
        status: 'queued',
        priority: 5,
        progress: 0,
        queuedAt: Date.now(),
        retries: 0,
        maxRetries: 3,
        timeout: 30000,
        metadata: {},
        // No startedAt, completedAt, failedAt, result, error
      };

      mockConnection.hgetall.mockResolvedValue({
        id: 'job1',
        type: 'test',
        queueName: 'default',
        data: '{}',
        status: 'queued',
        priority: '5',
        progress: '0',
        queuedAt: Date.now().toString(),
        retries: '0',
        maxRetries: '3',
        timeout: '30000',
        startedAt: '',
        completedAt: '',
        result: '',
        metadata: '{}',
      });

      const retrieved = await adapter.getJob('job1');

      expect(retrieved?.startedAt).toBeUndefined();
      expect(retrieved?.completedAt).toBeUndefined();
      expect(retrieved?.result).toBeUndefined();
      expect(retrieved?.error).toBeUndefined();
    });
  });
});
