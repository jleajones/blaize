/**
 * Tests for CacheService (EventBus Integration)
 *
 * Covers:
 * - EventBus event publishing on mutations
 * - Adapter delegation
 * - Error handling
 * - Lifecycle methods
 */
import { createMockLogger, createMockEventBus } from '@blaizejs/testing-utils';

import { CacheService } from './cache-service';
import { MemoryAdapter } from './storage/memory';

import type { CacheAdapter } from './types';
import type { EventBus } from 'blaizejs';

describe('CacheService', () => {
  let service: CacheService;
  let adapter: CacheAdapter;
  let mockEventBus: EventBus;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    adapter = new MemoryAdapter({ maxEntries: 100 });
    mockEventBus = createMockEventBus();
    mockLogger = createMockLogger();
  });

  afterEach(async () => {
    if (service) {
      await service.disconnect();
    }
  });

  // ==========================================================================
  // Basic Operations (Adapter Delegation)
  // ==========================================================================

  describe('Adapter Delegation', () => {
    beforeEach(() => {
      service = new CacheService({ adapter, logger: mockLogger });
    });

    test('get() delegates to adapter', async () => {
      await adapter.set('key1', 'value1');
      const result = await service.get('key1');
      expect(result).toBe('value1');
    });

    test('get() returns null for missing key', async () => {
      const result = await service.get('missing');
      expect(result).toBeNull();
    });

    test('set() delegates to adapter', async () => {
      await service.set('key1', 'value1');
      expect(await adapter.get('key1')).toBe('value1');
    });

    test('set() with TTL delegates to adapter', async () => {
      await service.set('key1', 'value1', 3600);
      expect(await adapter.get('key1')).toBe('value1');
    });

    test('delete() delegates to adapter', async () => {
      await adapter.set('key1', 'value1');
      const deleted = await service.delete('key1');
      expect(deleted).toBe(true);
      expect(await adapter.get('key1')).toBeNull();
    });

    test('delete() returns false for non-existent key', async () => {
      const deleted = await service.delete('missing');
      expect(deleted).toBe(false);
    });

    test('mget() delegates to adapter', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');

      const results = await service.mget(['key1', 'key2', 'missing']);
      expect(results).toEqual(['value1', 'value2', null]);
    });

    test('mset() delegates to adapter', async () => {
      await service.mset([
        ['key1', 'value1'],
        ['key2', 'value2', 60],
      ]);

      expect(await adapter.get('key1')).toBe('value1');
      expect(await adapter.get('key2')).toBe('value2');
    });

    test('keys() delegates to adapter', async () => {
      await adapter.set('user:1', 'data1');
      await adapter.set('user:2', 'data2');
      await adapter.set('session:1', 'data3');

      const keys = await service.keys('user:*');
      expect(keys).toContain('user:1');
      expect(keys).toContain('user:2');
      expect(keys).not.toContain('session:1');
    });

    test('clear() delegates to adapter', async () => {
      await adapter.set('user:1', 'data1');
      await adapter.set('user:2', 'data2');

      const count = await service.clear('user:*');
      expect(count).toBe(2);
      expect(await adapter.get('user:1')).toBeNull();
    });

    test('getStats() delegates to adapter', async () => {
      const stats = await service.getStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('entryCount');
    });
  });

  // ==========================================================================
  // EventBus Integration
  // ==========================================================================

  describe('EventBus Integration', () => {
    beforeEach(() => {
      service = new CacheService({
        adapter,
        eventBus: mockEventBus,
        serverId: 'test-server',
        logger: mockLogger,
      });
    });

    describe('get() events', () => {
      test('publishes cache:hit when key exists', async () => {
        await adapter.set('key1', 'value1');
        await service.get('key1');

        expect(mockEventBus.publish).toHaveBeenCalledWith('cache:hit', {
          key: 'key1',
        });
      });

      test('publishes cache:miss when key does not exist', async () => {
        await service.get('missing');

        expect(mockEventBus.publish).toHaveBeenCalledWith('cache:miss', {
          key: 'missing',
        });
      });
    });

    describe('set() events', () => {
      test('publishes cache:set event', async () => {
        await service.set('key1', 'value1');

        expect(mockEventBus.publish).toHaveBeenCalledWith('cache:set', {
          key: 'key1',
          ttl: undefined,
          timestamp: expect.any(Number),
          size: 6, // 'value1'.length
        });
      });

      test('publishes cache:set with TTL', async () => {
        await service.set('key1', 'value1', 3600);

        expect(mockEventBus.publish).toHaveBeenCalledWith('cache:set', {
          key: 'key1',
          ttl: 3600,
          timestamp: expect.any(Number),
          size: 6,
        });
      });

      test('still sets value if EventBus publish fails', async () => {
        mockEventBus.publish = vi.fn().mockRejectedValue(new Error('EventBus error'));

        await service.set('key1', 'value1');

        // Value should still be set despite EventBus error
        expect(await adapter.get('key1')).toBe('value1');
      });
    });

    describe('delete() events', () => {
      test('publishes cache:delete when key exists', async () => {
        await adapter.set('key1', 'value1');
        await service.delete('key1');

        expect(mockEventBus.publish).toHaveBeenCalledWith('cache:delete', {
          key: 'key1',
          timestamp: expect.any(Number),
        });
      });

      test('does not publish when key does not exist', async () => {
        await service.delete('missing');

        expect(mockEventBus.publish).not.toHaveBeenCalled();
      });
    });

    describe('mset() events', () => {
      test('publishes cache:set for each entry', async () => {
        await service.mset([
          ['key1', 'value1'],
          ['key2', 'value2', 60],
        ]);

        expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
        expect(mockEventBus.publish).toHaveBeenNthCalledWith(1, 'cache:set', {
          key: 'key1',
          ttl: undefined,
          timestamp: expect.any(Number),
          size: 6,
        });
        expect(mockEventBus.publish).toHaveBeenNthCalledWith(2, 'cache:set', {
          key: 'key2',
          ttl: 60,
          timestamp: expect.any(Number),
          size: 6,
        });
      });
    });

    describe('clear() events', () => {
      test('publishes cache:delete for each deleted key', async () => {
        await adapter.set('user:1', 'data1');
        await adapter.set('user:2', 'data2');

        await service.clear('user:*');

        expect(mockEventBus.publish).toHaveBeenCalledTimes(2);
        expect(mockEventBus.publish).toHaveBeenCalledWith('cache:delete', {
          key: 'user:1',
          timestamp: expect.any(Number),
        });
        expect(mockEventBus.publish).toHaveBeenCalledWith('cache:delete', {
          key: 'user:2',
          timestamp: expect.any(Number),
        });
      });

      test('does not publish if no keys deleted', async () => {
        await service.clear('nonexistent:*');

        expect(mockEventBus.publish).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Without EventBus
  // ==========================================================================

  describe('Without EventBus', () => {
    beforeEach(() => {
      service = new CacheService({
        adapter,
        logger: mockLogger,
        // No eventBus provided
      });
    });

    test('set() works without EventBus', async () => {
      await expect(service.set('key1', 'value1')).resolves.toBeUndefined();
      expect(await adapter.get('key1')).toBe('value1');
    });

    test('delete() works without EventBus', async () => {
      await adapter.set('key1', 'value1');
      await expect(service.delete('key1')).resolves.toBe(true);
    });

    test('mset() works without EventBus', async () => {
      await expect(service.mset([['key1', 'value1']])).resolves.toBeUndefined();
    });

    test('clear() works without EventBus', async () => {
      await adapter.set('key1', 'value1');
      await expect(service.clear('*')).resolves.toBe(1);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    test('adapter errors are propagated', async () => {
      const errorAdapter = {
        ...adapter,
        set: vi.fn().mockRejectedValue(new Error('Adapter error')),
      } as unknown as CacheAdapter;

      service = new CacheService({
        adapter: errorAdapter,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      await expect(service.set('key1', 'value1')).rejects.toThrow('Adapter error');

      // EventBus publish should not be called if adapter fails
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    test('EventBus publish errors do not fail operation', async () => {
      mockEventBus.publish = vi.fn().mockRejectedValue(new Error('EventBus error'));

      service = new CacheService({
        adapter,
        eventBus: mockEventBus,
        serverId: 'test-server',
        logger: mockLogger,
      });

      // Operation should succeed despite EventBus error
      await expect(service.set('key1', 'value1')).resolves.toBeUndefined();
      expect(await adapter.get('key1')).toBe('value1');
    });
  });

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  describe('Lifecycle', () => {
    test('connect() calls adapter.connect if available', async () => {
      const mockAdapter = {
        ...adapter,
        connect: vi.fn().mockResolvedValue(undefined),
      } as unknown as CacheAdapter;

      service = new CacheService({
        adapter: mockAdapter,
        logger: mockLogger,
      });

      await service.connect();
      expect(mockAdapter.connect).toHaveBeenCalled();
    });

    test('connect() succeeds if adapter has no connect method', async () => {
      service = new CacheService({ adapter, logger: mockLogger });
      await expect(service.connect()).resolves.toBeUndefined();
    });

    test('disconnect() calls adapter.disconnect if available', async () => {
      const mockAdapter = {
        ...adapter,
        disconnect: vi.fn().mockResolvedValue(undefined),
      } as unknown as CacheAdapter;

      service = new CacheService({
        adapter: mockAdapter,
        logger: mockLogger,
      });

      await service.disconnect();
      expect(mockAdapter.disconnect).toHaveBeenCalled();
    });

    test('disconnect() logs but does not throw on adapter error', async () => {
      const mockAdapter = {
        ...adapter,
        disconnect: vi.fn().mockRejectedValue(new Error('Disconnect error')),
      } as unknown as CacheAdapter;

      service = new CacheService({
        adapter: mockAdapter,
        logger: mockLogger,
      });

      await expect(service.disconnect()).resolves.toBeUndefined();
    });

    test('healthCheck() delegates to adapter if available', async () => {
      service = new CacheService({ adapter, logger: mockLogger });
      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
    });

    test('healthCheck() returns default if adapter has no healthCheck', async () => {
      const mockAdapter = {
        ...adapter,
        healthCheck: undefined,
      } as unknown as CacheAdapter;

      service = new CacheService({
        adapter: mockAdapter,
        logger: mockLogger,
      });

      const health = await service.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.message).toContain('does not implement healthCheck');
    });
  });

  // ==========================================================================
  // Additional Methods
  // ==========================================================================

  describe('getWithTTL()', () => {
    beforeEach(() => {
      // ✅ Create service before each test
      service = new CacheService({ adapter, logger: mockLogger });
    });
    test('returns value and TTL when key exists', async () => {
      await service.set('key1', 'value1', 3600);

      const { value } = await service.getWithTTL('key1');
      expect(value).toBe('value1');
      // TTL depends on adapter implementation
    });

    test('returns null for missing key', async () => {
      service = new CacheService({ adapter, logger: mockLogger });
      const { value, ttl } = await service.getWithTTL('missing');
      expect(value).toBeNull();
      expect(ttl).toBeNull();
    });
  });
});
