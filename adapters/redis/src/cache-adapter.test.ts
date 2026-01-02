/**
 * Unit tests for RedisCacheAdapter
 *
 * @module @blaizejs/adapter-redis/cache-adapter
 */

import { RedisCacheAdapter } from './cache-adapter';
import { RedisOperationError } from './errors';

import type { RedisClient } from './types';

describe('RedisCacheAdapter', () => {
  let adapter: RedisCacheAdapter;
  let mockClient: any;
  let mockConnection: any;
  let mockLogger: any;

  beforeEach(() => {
    // Create mock Redis connection
    mockConnection = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue('OK'),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      mget: vi.fn(),
      pipeline: vi.fn(),
      scan: vi.fn(),
      info: vi.fn(),
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
      adapter = new RedisCacheAdapter(mockClient as RedisClient);

      expect(adapter).toBeInstanceOf(RedisCacheAdapter);
    });

    it('should create adapter with custom key prefix', () => {
      adapter = new RedisCacheAdapter(mockClient as RedisClient, {
        keyPrefix: 'custom:',
        logger: mockLogger,
      });

      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'RedisCacheAdapter' });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'RedisCacheAdapter created',
        expect.objectContaining({
          keyPrefix: 'custom:',
        })
      );
    });
  });

  describe('connect()', () => {
    beforeEach(() => {
      adapter = new RedisCacheAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
    });

    it('should connect successfully', async () => {
      await adapter.connect();

      expect(mockClient.isConnected).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('RedisCacheAdapter connected');
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
      adapter = new RedisCacheAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should disconnect successfully', async () => {
      await adapter.disconnect();

      expect(mockLogger.info).toHaveBeenCalledWith('RedisCacheAdapter disconnected');
    });

    it('should be no-op if not connected', async () => {
      await adapter.disconnect();

      mockLogger.debug.mockClear();

      await adapter.disconnect();

      expect(mockLogger.debug).toHaveBeenCalledWith('Not connected, skipping disconnect()');
    });
  });

  describe('get()', () => {
    beforeEach(async () => {
      adapter = new RedisCacheAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should get value successfully (cache hit)', async () => {
      mockConnection.get.mockResolvedValue('value1');

      const result = await adapter.get('key1');

      expect(result).toBe('value1');
      expect(mockConnection.get).toHaveBeenCalledWith('cache:key1');
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache hit', { key: 'key1' });
    });

    it('should return null for missing key (cache miss)', async () => {
      mockConnection.get.mockResolvedValue(null);

      const result = await adapter.get('missing');

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache miss', { key: 'missing' });
    });

    it('should track hits and misses in stats', async () => {
      mockConnection.get.mockResolvedValueOnce('value1');
      mockConnection.get.mockResolvedValueOnce(null);
      mockConnection.scan.mockResolvedValue(['0', []]);
      mockConnection.info.mockResolvedValue('used_memory:1024');

      await adapter.get('key1'); // hit
      await adapter.get('missing'); // miss

      const stats = await adapter.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.get('key1')).rejects.toThrow('not connected');
    });

    it('should throw RedisOperationError on failure', async () => {
      mockConnection.get.mockRejectedValue(new Error('Redis error'));

      await expect(adapter.get('key1')).rejects.toThrow(RedisOperationError);
    });

    it('should apply key prefix', async () => {
      const customAdapter = new RedisCacheAdapter(mockClient as RedisClient, {
        keyPrefix: 'myapp:',
      });
      await customAdapter.connect();

      mockConnection.get.mockResolvedValue('value');

      await customAdapter.get('key1');

      expect(mockConnection.get).toHaveBeenCalledWith('myapp:key1');
    });
  });

  describe('set()', () => {
    beforeEach(async () => {
      adapter = new RedisCacheAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should set value without TTL', async () => {
      await adapter.set('key1', 'value1');

      expect(mockConnection.set).toHaveBeenCalledWith('cache:key1', 'value1');
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache set', { key: 'key1' });
    });

    it('should set value with TTL using SETEX', async () => {
      await adapter.set('key1', 'value1', 3600);

      expect(mockConnection.setex).toHaveBeenCalledWith('cache:key1', 3600, 'value1');
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache set with TTL', {
        key: 'key1',
        ttl: 3600,
      });
    });

    it('should use SET for TTL of 0', async () => {
      await adapter.set('key1', 'value1', 0);

      expect(mockConnection.set).toHaveBeenCalledWith('cache:key1', 'value1');
      expect(mockConnection.setex).not.toHaveBeenCalled();
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.set('key1', 'value1')).rejects.toThrow('not connected');
    });

    it('should throw RedisOperationError on failure', async () => {
      mockConnection.set.mockRejectedValue(new Error('Redis error'));

      await expect(adapter.set('key1', 'value1')).rejects.toThrow(RedisOperationError);
    });
  });

  describe('delete()', () => {
    beforeEach(async () => {
      adapter = new RedisCacheAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should delete existing key and return true', async () => {
      mockConnection.del.mockResolvedValue(1);

      const result = await adapter.delete('key1');

      expect(result).toBe(true);
      expect(mockConnection.del).toHaveBeenCalledWith('cache:key1');
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache delete', { key: 'key1' });
    });

    it('should return false for non-existent key', async () => {
      mockConnection.del.mockResolvedValue(0);

      const result = await adapter.delete('missing');

      expect(result).toBe(false);
    });

    it('should track evictions in stats', async () => {
      mockConnection.del.mockResolvedValue(1);
      mockConnection.scan.mockResolvedValue(['0', []]);
      mockConnection.info.mockResolvedValue('used_memory:1024');

      await adapter.delete('key1');

      const stats = await adapter.getStats();

      expect(stats.evictions).toBe(1);
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.delete('key1')).rejects.toThrow('not connected');
    });

    it('should throw RedisOperationError on failure', async () => {
      mockConnection.del.mockRejectedValue(new Error('Redis error'));

      await expect(adapter.delete('key1')).rejects.toThrow(RedisOperationError);
    });
  });

  describe('mget()', () => {
    beforeEach(async () => {
      adapter = new RedisCacheAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();
    });

    it('should get multiple values', async () => {
      mockConnection.mget.mockResolvedValue(['value1', 'value2', null]);

      const results = await adapter.mget(['key1', 'key2', 'key3']);

      expect(results).toEqual(['value1', 'value2', null]);
      expect(mockConnection.mget).toHaveBeenCalledWith('cache:key1', 'cache:key2', 'cache:key3');
    });

    it('should handle empty array', async () => {
      const results = await adapter.mget([]);

      expect(results).toEqual([]);
      expect(mockConnection.mget).not.toHaveBeenCalled();
    });

    it('should track hits and misses for mget', async () => {
      mockConnection.mget.mockResolvedValue(['value1', null, 'value3']);
      mockConnection.scan.mockResolvedValue(['0', []]);
      mockConnection.info.mockResolvedValue('used_memory:1024');

      await adapter.mget(['key1', 'key2', 'key3']);

      const stats = await adapter.getStats();

      expect(stats.hits).toBe(2); // key1, key3
      expect(stats.misses).toBe(1); // key2
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.mget(['key1'])).rejects.toThrow('not connected');
    });

    it('should throw RedisOperationError on failure', async () => {
      mockConnection.mget.mockRejectedValue(new Error('Redis error'));

      await expect(adapter.mget(['key1'])).rejects.toThrow(RedisOperationError);
    });
  });

  describe('mset()', () => {
    beforeEach(async () => {
      adapter = new RedisCacheAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
      await adapter.connect();

      // Setup pipeline mock
      const mockPipeline = {
        set: vi.fn().mockReturnThis(),
        setex: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockConnection.pipeline.mockReturnValue(mockPipeline);
    });

    it('should set multiple values without TTL', async () => {
      await adapter.mset([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);

      const pipeline = mockConnection.pipeline();

      expect(pipeline.set).toHaveBeenCalledWith('cache:key1', 'value1');
      expect(pipeline.set).toHaveBeenCalledWith('cache:key2', 'value2');
      expect(pipeline.exec).toHaveBeenCalled();
    });

    it('should set multiple values with mixed TTLs', async () => {
      await adapter.mset([
        ['key1', 'value1', 3600],
        ['key2', 'value2'], // no TTL
        ['key3', 'value3', 7200],
      ]);

      const pipeline = mockConnection.pipeline();

      expect(pipeline.setex).toHaveBeenCalledWith('cache:key1', 3600, 'value1');
      expect(pipeline.set).toHaveBeenCalledWith('cache:key2', 'value2');
      expect(pipeline.setex).toHaveBeenCalledWith('cache:key3', 7200, 'value3');
      expect(pipeline.exec).toHaveBeenCalled();
    });

    it('should handle empty array', async () => {
      await adapter.mset([]);

      expect(mockConnection.pipeline).not.toHaveBeenCalled();
    });

    it('should use SET for TTL of 0', async () => {
      await adapter.mset([['key1', 'value1', 0]]);

      const pipeline = mockConnection.pipeline();

      expect(pipeline.set).toHaveBeenCalledWith('cache:key1', 'value1');
      expect(pipeline.setex).not.toHaveBeenCalled();
    });

    it('should throw if not connected', async () => {
      await adapter.disconnect();

      await expect(adapter.mset([['key1', 'value1']])).rejects.toThrow('not connected');
    });

    it('should throw RedisOperationError on failure', async () => {
      const failingPipeline = {
        set: vi.fn().mockReturnThis(),
        setex: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Pipeline failed')),
      };
      mockConnection.pipeline.mockReturnValue(failingPipeline);

      await expect(adapter.mset([['key1', 'value1']])).rejects.toThrow(RedisOperationError);
    });
  });

  describe('getStats()', () => {
    beforeEach(async () => {
      adapter = new RedisCacheAdapter(mockClient as RedisClient, {
        logger: mockLogger,
      });
    });

    it('should return basic stats when not connected', async () => {
      const stats = await adapter.getStats();

      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        evictions: 0,
        memoryUsage: 0,
        entryCount: 0,
        uptime: 0,
      });
    });

    it('should return full stats when connected', async () => {
      await adapter.connect();

      mockConnection.scan.mockResolvedValueOnce(['100', ['key1', 'key2']]);
      mockConnection.scan.mockResolvedValueOnce(['0', ['key3']]);
      mockConnection.info.mockResolvedValue('used_memory:1048576\nother:value');

      const stats = await adapter.getStats();

      expect(stats.entryCount).toBe(3); // key1, key2, key3
      expect(stats.memoryUsage).toBe(1048576);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should handle SCAN pagination', async () => {
      await adapter.connect();

      mockConnection.scan
        .mockResolvedValueOnce(['200', ['k1', 'k2']])
        .mockResolvedValueOnce(['300', ['k3']])
        .mockResolvedValueOnce(['0', ['k4', 'k5']]);

      mockConnection.info.mockResolvedValue('used_memory:2048');

      const stats = await adapter.getStats();

      expect(stats.entryCount).toBe(5);
      expect(mockConnection.scan).toHaveBeenCalledTimes(3);
    });

    it('should return basic stats on error', async () => {
      await adapter.connect();

      mockConnection.scan.mockRejectedValue(new Error('SCAN failed'));

      const stats = await adapter.getStats();

      expect(stats.memoryUsage).toBe(0);
      expect(stats.entryCount).toBe(0);
    });
  });

  describe('healthCheck()', () => {
    beforeEach(async () => {
      adapter = new RedisCacheAdapter(mockClient as RedisClient);
      await adapter.connect();
    });

    it('should return unhealthy when not connected', async () => {
      await adapter.disconnect();

      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Adapter not connected');
    });

    it('should return healthy with details', async () => {
      mockConnection.scan.mockResolvedValue(['0', ['key1', 'key2']]);
      mockConnection.info.mockResolvedValue('used_memory:1024');

      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.message).toBe('Connected');
      expect(health.details).toEqual({
        latency: 5,
        hits: 0,
        misses: 0,
        entryCount: 2,
      });
    });

    it('should return unhealthy when client unhealthy', async () => {
      mockClient.healthCheck.mockResolvedValue({
        healthy: false,
        message: 'Redis down',
        latency: undefined,
      });

      const health = await adapter.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Redis down');
    });
  });

  describe('Edge cases', () => {
    beforeEach(async () => {
      adapter = new RedisCacheAdapter(mockClient as RedisClient);
      await adapter.connect();

      // Setup pipeline mock for mset test
      const mockPipeline = {
        set: vi.fn().mockReturnThis(),
        setex: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockConnection.pipeline.mockReturnValue(mockPipeline);
    });

    it('should handle very long key names', async () => {
      const longKey = 'a'.repeat(1000);
      mockConnection.get.mockResolvedValue('value');

      await adapter.get(longKey);

      expect(mockConnection.get).toHaveBeenCalledWith(`cache:${longKey}`);
    });

    it('should handle values with special characters', async () => {
      const specialValue = 'value\nwith\ttabs\rand\nnewlines';
      mockConnection.get.mockResolvedValue(specialValue);

      const result = await adapter.get('key1');

      expect(result).toBe(specialValue);
    });

    it('should handle Unicode values', async () => {
      const unicodeValue = '你好世界 🎉 مرحبا';
      mockConnection.get.mockResolvedValue(unicodeValue);

      const result = await adapter.get('key1');

      expect(result).toBe(unicodeValue);
    });

    it('should handle empty string values', async () => {
      mockConnection.get.mockResolvedValue('');

      const result = await adapter.get('key1');

      expect(result).toBe('');
    });

    it('should handle large mget requests', async () => {
      const keys = Array.from({ length: 1000 }, (_, i) => `key${i}`);
      mockConnection.mget.mockResolvedValue(new Array(1000).fill(null));

      const results = await adapter.mget(keys);

      expect(results.length).toBe(1000);
    });

    it('should handle large mset requests', async () => {
      const entries: [string, string, number?][] = Array.from({ length: 100 }, (_, i) => [
        `key${i}`,
        `value${i}`,
        i % 2 === 0 ? 3600 : undefined,
      ]);

      await adapter.mset(entries);

      const pipeline = mockConnection.pipeline();
      expect(pipeline.exec).toHaveBeenCalled();
    });
  });
});
