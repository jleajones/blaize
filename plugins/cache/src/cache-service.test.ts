/**
 * Tests for CacheService
 *
 * Covers:
 * - Event emission on mutations
 * - Pattern matching (string and regex)
 * - Watch subscription and cleanup
 * - Error handling in listeners
 * - Multi-server coordination
 * - Adapter delegation
 */
import { createMockLogger } from '@blaizejs/testing-utils';

import { CacheService } from './cache-service';
import { MemoryAdapter } from './storage/memory';

import type { CacheAdapter, CacheChangeEvent } from './types';

describe('CacheService', () => {
  let service: CacheService;
  let adapter: CacheAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter({ maxEntries: 100 });
    service = new CacheService({ adapter, logger: createMockLogger() });
  });

  afterEach(async () => {
    await service.disconnect();
  });

  // ==========================================================================
  // Basic Operations (Adapter Delegation)
  // ==========================================================================

  describe('get()', () => {
    test('delegates to adapter', async () => {
      await adapter.set('key1', 'value1');
      const result = await service.get('key1');
      expect(result).toBe('value1');
    });

    test('returns null for missing key', async () => {
      const result = await service.get('missing');
      expect(result).toBeNull();
    });

    test('does not emit events (read-only)', async () => {
      const handler = vi.fn();
      service.on('cache:change', handler);

      await service.get('key1');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('mget()', () => {
    test('delegates to adapter', async () => {
      await adapter.set('key1', 'value1');
      await adapter.set('key2', 'value2');

      const results = await service.mget(['key1', 'key2', 'missing']);

      expect(results).toEqual(['value1', 'value2', null]);
    });

    test('does not emit events (read-only)', async () => {
      const handler = vi.fn();
      service.on('cache:change', handler);

      await service.mget(['key1', 'key2']);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Event Emission on Mutations
  // ==========================================================================

  describe('set() event emission', () => {
    test('emits cache:change event on set', async () => {
      const events: CacheChangeEvent[] = [];
      service.on('cache:change', event => events.push(event));

      await service.set('key1', 'value1', 60);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'set',
        key: 'key1',
        value: 'value1',
      });
      expect(events[0]!.timestamp).toBeGreaterThan(0);
    });

    test('includes serverId if provided', async () => {
      const serviceWithId = new CacheService({
        adapter,
        serverId: 'server-123',
        logger: createMockLogger(),
      });
      const events: CacheChangeEvent[] = [];
      serviceWithId.on('cache:change', event => events.push(event));

      await serviceWithId.set('key1', 'value1');

      expect(events[0]!.serverId).toBe('server-123');

      await serviceWithId.disconnect();
    });

    test('emits event after successful write', async () => {
      const events: CacheChangeEvent[] = [];
      service.on('cache:change', event => events.push(event));

      await service.set('key1', 'value1');

      // Value should be stored
      expect(await service.get('key1')).toBe('value1');
      // Event should be emitted
      expect(events).toHaveLength(1);
    });

    test('does not emit event if adapter throws', async () => {
      const mockAdapter = {
        ...adapter,
        set: vi.fn().mockRejectedValue(new Error('Adapter error')),
      } as unknown as CacheAdapter;

      const serviceWithMock = new CacheService({
        adapter: mockAdapter,
        logger: createMockLogger(),
      });
      const events: CacheChangeEvent[] = [];
      serviceWithMock.on('cache:change', event => events.push(event));

      await expect(serviceWithMock.set('key1', 'value1')).rejects.toThrow('Adapter error');

      expect(events).toHaveLength(0);

      await serviceWithMock.disconnect();
    });
  });

  describe('delete() event emission', () => {
    test('emits cache:change event when key exists', async () => {
      await service.set('key1', 'value1');

      const events: CacheChangeEvent[] = [];
      service.on('cache:change', event => events.push(event));

      const existed = await service.delete('key1');

      expect(existed).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: 'delete',
        key: 'key1',
      });
      expect(events[0]!.value).toBeUndefined();
    });

    test('does not emit event when key does not exist', async () => {
      const events: CacheChangeEvent[] = [];
      service.on('cache:change', event => events.push(event));

      const existed = await service.delete('missing');

      expect(existed).toBe(false);
      expect(events).toHaveLength(0);
    });

    test('includes serverId if provided', async () => {
      const serviceWithId = new CacheService({
        adapter,
        serverId: 'server-456',
        logger: createMockLogger(),
      });
      await serviceWithId.set('key1', 'value1');

      const events: CacheChangeEvent[] = [];
      serviceWithId.on('cache:change', event => events.push(event));

      await serviceWithId.delete('key1');

      expect(events[0]!.serverId).toBe('server-456');

      await serviceWithId.disconnect();
    });
  });

  describe('mset() event emission', () => {
    test('emits event for each entry', async () => {
      const events: CacheChangeEvent[] = [];
      service.on('cache:change', event => events.push(event));

      await service.mset([
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3', 60],
      ]);

      expect(events).toHaveLength(3);
      expect(events[0]!.key).toBe('key1');
      expect(events[1]!.key).toBe('key2');
      expect(events[2]!.key).toBe('key3');

      // All events should have same timestamp (batched)
      expect(events[0]!.timestamp).toBe(events[1]!.timestamp);
      expect(events[1]!.timestamp).toBe(events[2]!.timestamp);
    });

    test('stores values correctly', async () => {
      await service.mset([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);

      expect(await service.get('key1')).toBe('value1');
      expect(await service.get('key2')).toBe('value2');
    });
  });

  // ==========================================================================
  // Pattern Matching
  // ==========================================================================

  describe('watch() with string patterns', () => {
    test('matches exact string', async () => {
      const handler = vi.fn();
      service.watch('user:123', handler);

      await service.set('user:123', 'data');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'set',
          key: 'user:123',
        })
      );
    });

    test('does not match different keys', async () => {
      const handler = vi.fn();
      service.watch('user:123', handler);

      await service.set('user:456', 'data');
      await service.set('session:123', 'data');

      expect(handler).not.toHaveBeenCalled();
    });

    test('matches on delete events', async () => {
      const handler = vi.fn();
      service.watch('user:123', handler);

      await service.set('user:123', 'data');
      await service.delete('user:123');

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'set' }));
      expect(handler).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'delete' }));
    });
  });

  describe('watch() with regex patterns', () => {
    test('matches regex pattern', async () => {
      const handler = vi.fn();
      service.watch(/^user:/, handler);

      await service.set('user:123', 'data1');
      await service.set('user:456', 'data2');
      await service.set('session:789', 'data3');

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, expect.objectContaining({ key: 'user:123' }));
      expect(handler).toHaveBeenNthCalledWith(2, expect.objectContaining({ key: 'user:456' }));
    });

    test('supports complex regex patterns', async () => {
      const handler = vi.fn();
      service.watch(/^(user|session):\d+$/, handler);

      await service.set('user:123', 'data');
      await service.set('session:456', 'data');
      await service.set('admin:789', 'data');
      await service.set('user:abc', 'data');

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Watch Cleanup
  // ==========================================================================

  describe('watch() cleanup', () => {
    test('returns unsubscribe function', async () => {
      const handler = vi.fn();
      const unsubscribe = service.watch('key1', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    test('stops receiving events after unsubscribe', async () => {
      const handler = vi.fn();
      const unsubscribe = service.watch('key1', handler);

      await service.set('key1', 'value1');
      unsubscribe();
      await service.set('key1', 'value2');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    test('handles multiple unsubscribe calls gracefully', async () => {
      const handler = vi.fn();
      const unsubscribe = service.watch('key1', handler);

      expect(() => {
        unsubscribe();
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
    });

    test('multiple watchers work independently', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unsub1 = service.watch('key1', handler1);
      const unsub2 = service.watch('key1', handler2);

      await service.set('key1', 'value1');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      unsub1();

      await service.set('key1', 'value2');

      expect(handler1).toHaveBeenCalledTimes(1); // Still 1
      expect(handler2).toHaveBeenCalledTimes(2); // Incremented

      unsub2();
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling in listeners', () => {
    test('continues operation even if listener throws', async () => {
      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 error');
      });
      const handler2 = vi.fn();

      service.on('error', () => {}); // Suppress error output

      service.watch('key1', handler1);
      service.watch('key1', handler2);

      await service.set('key1', 'value1');

      // Both handlers should be called despite error in first
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();

      // Value should still be set
      expect(await service.get('key1')).toBe('value1');
    });
  });

  // ==========================================================================
  // Statistics and Health
  // ==========================================================================

  describe('getStats()', () => {
    test('delegates to adapter', async () => {
      await service.set('key1', 'value1');
      await service.get('key1');

      const stats = await service.getStats();

      expect(stats.entryCount).toBe(1);
      expect(stats.hits).toBeGreaterThan(0);
    });
  });

  describe('healthCheck()', () => {
    test('delegates to adapter if available', async () => {
      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.message).toBeDefined();
    });

    test('returns default healthy if adapter has no healthCheck', async () => {
      const mockAdapter = {
        ...adapter,
        healthCheck: undefined,
      } as unknown as CacheAdapter;

      const serviceWithMock = new CacheService({
        adapter: mockAdapter,
        logger: createMockLogger(),
      });
      const health = await serviceWithMock.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.message).toContain('does not implement healthCheck');

      await serviceWithMock.disconnect();
    });
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('connect()', () => {
    test('calls adapter connect if available', async () => {
      const mockAdapter = {
        ...adapter,
        connect: vi.fn().mockResolvedValue(undefined),
      } as unknown as CacheAdapter;

      const serviceWithMock = new CacheService({
        adapter: mockAdapter,
        logger: createMockLogger(),
      });

      await serviceWithMock.connect();

      expect(mockAdapter.connect).toHaveBeenCalled();

      await serviceWithMock.disconnect();
    });

    test('succeeds if adapter has no connect method', async () => {
      const mockAdapter = {
        ...adapter,
        connect: undefined,
      } as unknown as CacheAdapter;

      const serviceWithMock = new CacheService({
        adapter: mockAdapter,
        logger: createMockLogger(),
      });

      await expect(serviceWithMock.connect()).resolves.toBeUndefined();

      await serviceWithMock.disconnect();
    });
  });

  describe('disconnect()', () => {
    test('calls adapter disconnect if available', async () => {
      const mockAdapter = {
        ...adapter,
        disconnect: vi.fn().mockResolvedValue(undefined),
      } as unknown as CacheAdapter;

      const serviceWithMock = new CacheService({
        adapter: mockAdapter,
        logger: createMockLogger(),
      });

      await serviceWithMock.disconnect();

      expect(mockAdapter.disconnect).toHaveBeenCalled();
    });

    test('removes all event listeners', async () => {
      const handler = vi.fn();
      service.watch('key1', handler);

      await service.disconnect();

      // Try to emit event (should not reach handler)
      service.emit('cache:change', {
        type: 'set',
        key: 'key1',
        value: 'value1',
        timestamp: Date.now(),
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Integration Scenarios
  // ==========================================================================

  describe('integration scenarios', () => {
    test('multiple operations emit correct events', async () => {
      const events: CacheChangeEvent[] = [];
      service.on('cache:change', event => events.push(event));

      await service.set('key1', 'value1');
      await service.set('key2', 'value2');
      await service.delete('key1');
      await service.mset([['key3', 'value3']]);

      expect(events).toHaveLength(4);
      expect(events[0]!.type).toBe('set');
      expect(events[1]!.type).toBe('set');
      expect(events[2]!.type).toBe('delete');
      expect(events[3]!.type).toBe('set');
    });

    test('pattern watchers receive filtered events', async () => {
      const userHandler = vi.fn();
      const sessionHandler = vi.fn();

      service.watch(/^user:/, userHandler);
      service.watch(/^session:/, sessionHandler);

      await service.set('user:1', 'data');
      await service.set('session:1', 'data');
      await service.set('user:2', 'data');
      await service.set('admin:1', 'data');

      expect(userHandler).toHaveBeenCalledTimes(2);
      expect(sessionHandler).toHaveBeenCalledTimes(1);
    });
  });
});
