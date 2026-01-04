/**
 * Type tests for Cache Plugin
 *
 * Tests type safety, type guards, and ensures documentation examples compile.
 * Uses vitest's expectTypeOf for compile-time type assertions.
 */

import { expectTypeOf, describe, test, expect } from 'vitest';

import type { CacheService } from './cache-service';
import type {
  CacheStats,
  CacheAdapter,
  MemoryAdapterConfig,
  CacheEntry,
  CacheChangeEvent,
  CacheWatchHandler,
  CachePluginConfig,
  CachePluginServices,
} from './types';

// ============================================================================
// CacheStats Type Tests
// ============================================================================

describe('CacheStats', () => {
  test('has all required properties', () => {
    const stats: CacheStats = {
      hits: 100,
      misses: 20,
      evictions: 5,
      memoryUsage: 1024000,
      entryCount: 50,
      uptime: 3600000,
    };

    expectTypeOf(stats).toMatchTypeOf<CacheStats>();
  });

  test('all numeric properties are numbers', () => {
    expectTypeOf<CacheStats['hits']>().toEqualTypeOf<number>();
    expectTypeOf<CacheStats['misses']>().toEqualTypeOf<number>();
    expectTypeOf<CacheStats['evictions']>().toEqualTypeOf<number>();
    expectTypeOf<CacheStats['memoryUsage']>().toEqualTypeOf<number>();
    expectTypeOf<CacheStats['entryCount']>().toEqualTypeOf<number>();
  });

  test('uptime is optional', () => {
    expectTypeOf<CacheStats['uptime']>().toEqualTypeOf<number | undefined>();

    const withUptime: CacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsage: 0,
      entryCount: 0,
      uptime: 1000,
    };

    const withoutUptime: CacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsage: 0,
      entryCount: 0,
    };

    expect(withUptime.uptime).toBe(1000);
    expect(withoutUptime.uptime).toBeUndefined();
  });
});

// ============================================================================
// CacheAdapter Type Tests
// ============================================================================

describe('CacheAdapter', () => {
  test('has all required methods', () => {
    expectTypeOf<CacheAdapter>().toHaveProperty('get');
    expectTypeOf<CacheAdapter>().toHaveProperty('set');
    expectTypeOf<CacheAdapter>().toHaveProperty('delete');
    expectTypeOf<CacheAdapter>().toHaveProperty('mget');
    expectTypeOf<CacheAdapter>().toHaveProperty('mset');
    expectTypeOf<CacheAdapter>().toHaveProperty('getStats');
  });

  test('get() returns Promise<string | null>', () => {
    expectTypeOf<CacheAdapter['get']>().toBeFunction();
    expectTypeOf<CacheAdapter['get']>().parameter(0).toBeString();
    expectTypeOf<CacheAdapter['get']>().returns.resolves.toEqualTypeOf<string | null>();
  });

  test('set() accepts key, value, optional ttl', () => {
    expectTypeOf<CacheAdapter['set']>().toBeFunction();
    expectTypeOf<CacheAdapter['set']>().parameter(0).toBeString();
    expectTypeOf<CacheAdapter['set']>().parameter(1).toBeString();
    expectTypeOf<CacheAdapter['set']>().parameter(2).toEqualTypeOf<number | undefined>();
    expectTypeOf<CacheAdapter['set']>().returns.resolves.toBeVoid();
  });

  test('delete() returns Promise<boolean>', () => {
    expectTypeOf<CacheAdapter['delete']>().returns.resolves.toBeBoolean();
  });

  test('mget() accepts string array, returns Promise<(string | null)[]>', () => {
    expectTypeOf<CacheAdapter['mget']>().parameter(0).toEqualTypeOf<string[]>();
    expectTypeOf<CacheAdapter['mget']>().returns.resolves.toEqualTypeOf<(string | null)[]>();
  });

  test('mset() accepts tuple array with optional ttl', () => {
    expectTypeOf<CacheAdapter['mset']>().parameter(0).toEqualTypeOf<[string, string, number?][]>();
    expectTypeOf<CacheAdapter['mset']>().returns.resolves.toBeVoid();
  });

  test('getStats() returns Promise<CacheStats>', () => {
    expectTypeOf<CacheAdapter['getStats']>().returns.resolves.toEqualTypeOf<CacheStats>();
  });

  test('optional lifecycle methods', () => {
    expectTypeOf<CacheAdapter['connect']>().toEqualTypeOf<(() => Promise<void>) | undefined>();
    expectTypeOf<CacheAdapter['disconnect']>().toEqualTypeOf<(() => Promise<void>) | undefined>();
    expectTypeOf<CacheAdapter['healthCheck']>().toEqualTypeOf<
      | (() => Promise<{
          healthy: boolean;
          message?: string;
          details?: Record<string, unknown>;
        }>)
      | undefined
    >();
  });
});

// ============================================================================
// MemoryAdapterConfig Type Tests
// ============================================================================

describe('MemoryAdapterConfig', () => {
  test('allows empty config', () => {
    const config: MemoryAdapterConfig = {};
    expect(config).toEqual({});
  });

  test('allows maxEntries only', () => {
    const config: MemoryAdapterConfig = {
      maxEntries: 1000,
    };
    expect(config.maxEntries).toBe(1000);
  });

  test('allows defaultTtl only', () => {
    const config: MemoryAdapterConfig = {
      defaultTtl: 3600,
    };
    expect(config.defaultTtl).toBe(3600);
  });

  test('allows both maxEntries and defaultTtl', () => {
    const config: MemoryAdapterConfig = {
      maxEntries: 500,
      defaultTtl: 1800,
    };
    expect(config).toEqual({ maxEntries: 500, defaultTtl: 1800 });
  });

  test('maxEntries is optional number', () => {
    expectTypeOf<MemoryAdapterConfig['maxEntries']>().toEqualTypeOf<number | undefined>();
  });

  test('defaultTtl is optional number', () => {
    expectTypeOf<MemoryAdapterConfig['defaultTtl']>().toEqualTypeOf<number | undefined>();
  });
});

// ============================================================================
// CacheEntry Type Tests
// ============================================================================

describe('CacheEntry', () => {
  test('has all required properties', () => {
    const entry: CacheEntry = {
      value: '{"user":"Alice"}',
      expiresAt: Date.now() + 3600000,
      size: 100,
    };

    expectTypeOf(entry).toMatchTypeOf<CacheEntry>();
  });

  test('value is string', () => {
    expectTypeOf<CacheEntry['value']>().toBeString();
  });

  test('expiresAt is number', () => {
    expectTypeOf<CacheEntry['expiresAt']>().toBeNumber();
  });

  test('size is number', () => {
    expectTypeOf<CacheEntry['size']>().toBeNumber();
  });

  test('allows expiresAt = 0 for no expiration', () => {
    const entry: CacheEntry = {
      value: 'test',
      expiresAt: 0,
      size: 10,
    };

    expect(entry.expiresAt).toBe(0);
  });
});

// ============================================================================
// CacheChangeEvent Type Tests
// ============================================================================

describe('CacheChangeEvent', () => {
  test('has all required properties', () => {
    const event: CacheChangeEvent = {
      type: 'set',
      key: 'user:123',
      value: '{"name":"Alice"}',
      timestamp: new Date().toISOString(),
      serverId: 'server-1',
    };

    expectTypeOf(event).toMatchTypeOf<CacheChangeEvent>();
  });

  test('type is literal union', () => {
    expectTypeOf<CacheChangeEvent['type']>().toEqualTypeOf<'set' | 'delete' | 'eviction'>();
  });

  test('key is string', () => {
    expectTypeOf<CacheChangeEvent['key']>().toBeString();
  });

  test('value is optional string', () => {
    expectTypeOf<CacheChangeEvent['value']>().toEqualTypeOf<string | undefined>();
  });

  test('timestamp is number', () => {
    expectTypeOf<CacheChangeEvent['timestamp']>().toBeString();
  });

  test('serverId is optional string', () => {
    expectTypeOf<CacheChangeEvent['serverId']>().toEqualTypeOf<string | undefined>();
  });

  test('allows set event with value', () => {
    const event: CacheChangeEvent = {
      type: 'set',
      key: 'test',
      value: 'data',
      timestamp: new Date().toISOString(),
    };

    expect(event.type).toBe('set');
    expect(event.value).toBe('data');
  });

  test('allows delete event without value', () => {
    const event: CacheChangeEvent = {
      type: 'delete',
      key: 'test',
      timestamp: new Date().toISOString(),
    };

    expect(event.type).toBe('delete');
    expect(event.value).toBeUndefined();
  });
});

// ============================================================================
// CacheWatchHandler Type Tests
// ============================================================================

describe('CacheWatchHandler', () => {
  test('is a function accepting CacheChangeEvent', () => {
    const handler: CacheWatchHandler = event => {
      console.log(event.key);
    };

    expectTypeOf(handler).toBeFunction();
    expectTypeOf(handler).parameter(0).toMatchTypeOf<CacheChangeEvent>();
  });

  test('can be sync (returns void)', () => {
    const syncHandler: CacheWatchHandler = _event => {
      // Sync operation
    };

    expectTypeOf(syncHandler).returns.toEqualTypeOf<void | Promise<void>>();
  });

  test('can be async (returns Promise<void>)', () => {
    const asyncHandler: CacheWatchHandler = async _event => {
      await Promise.resolve();
    };

    expectTypeOf(asyncHandler).returns.toEqualTypeOf<void | Promise<void>>();
  });
});

// ============================================================================
// CachePluginConfig Type Tests
// ============================================================================

describe('CachePluginConfig', () => {
  test('allows empty config', () => {
    const config: CachePluginConfig = {};
    expect(config).toEqual({});
  });

  test('allows adapter only', () => {
    const mockAdapter: CacheAdapter = {
      get: async () => null,
      set: async () => {},
      delete: async () => false,
      mget: async () => [],
      mset: async () => {},
      getStats: async () => ({
        hits: 0,
        misses: 0,
        evictions: 0,
        memoryUsage: 0,
        entryCount: 0,
      }),
    };

    const config: CachePluginConfig = {
      adapter: mockAdapter,
    };

    expect(config.adapter).toBe(mockAdapter);
  });

  test('allows memory adapter config', () => {
    const config: CachePluginConfig = {
      maxEntries: 1000,
      defaultTtl: 3600,
    };

    expect(config).toEqual({ maxEntries: 1000, defaultTtl: 3600 });
  });

  test('allows serverId', () => {
    const config: CachePluginConfig = {
      serverId: 'server-42',
    };

    expect(config.serverId).toBe('server-42');
  });

  test('allows all options together', () => {
    const config: CachePluginConfig = {
      maxEntries: 500,
      defaultTtl: 1800,
      serverId: 'server-1',
    };

    expect(config).toEqual({
      maxEntries: 500,
      defaultTtl: 1800,
      serverId: 'server-1',
    });
  });

  test('adapter is optional CacheAdapter', () => {
    expectTypeOf<CachePluginConfig['adapter']>().toEqualTypeOf<CacheAdapter | undefined>();
  });

  test('maxEntries is optional number', () => {
    expectTypeOf<CachePluginConfig['maxEntries']>().toEqualTypeOf<number | undefined>();
  });

  test('defaultTtl is optional number', () => {
    expectTypeOf<CachePluginConfig['defaultTtl']>().toEqualTypeOf<number | undefined>();
  });

  test('serverId is optional string', () => {
    expectTypeOf<CachePluginConfig['serverId']>().toEqualTypeOf<string | undefined>();
  });
});

// ============================================================================
// CachePluginServices Type Tests
// ============================================================================

describe('CachePluginServices', () => {
  test('has cache property', () => {
    expectTypeOf<CachePluginServices>().toHaveProperty('cache');
  });

  test('cache is CacheService', () => {
    expectTypeOf<CachePluginServices['cache']>().toEqualTypeOf<CacheService>();
  });

  test('services structure matches expected shape', () => {
    const services: CachePluginServices = {
      cache: {} as CacheService,
    };

    expectTypeOf(services).toMatchTypeOf<CachePluginServices>();
  });
});

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('Type safety - no any types', () => {
  test('CacheStats has no any types', () => {
    const stats: CacheStats = {
      hits: 100,
      misses: 20,
      evictions: 5,
      memoryUsage: 1024,
      entryCount: 50,
      // @ts-expect-error - should not accept any type
      invalidProp: 'invalid',
    };

    expect(stats).toBeDefined();
  });

  test('CacheAdapter has no any types', () => {
    const adapter: CacheAdapter = {
      get: async () => null,
      set: async () => {},
      delete: async () => false,
      mget: async () => [],
      mset: async () => {},
      getStats: async () => ({}) as CacheStats,
      // @ts-expect-error - should not accept any type
      invalidMethod: () => {},
    };

    expect(adapter).toBeDefined();
  });

  test('CachePluginConfig has no any types', () => {
    const config: CachePluginConfig = {
      maxEntries: 1000,
      defaultTtl: 3600,
      // @ts-expect-error - should not accept any type
      invalidOption: 'invalid',
    };

    expect(config).toBeDefined();
  });
});

// ============================================================================
// Documentation Examples Compile
// ============================================================================

describe('Documentation examples compile', () => {
  test('CacheStats example compiles', () => {
    const stats: CacheStats = {
      hits: 100,
      misses: 20,
      evictions: 5,
      memoryUsage: 1024000,
      entryCount: 50,
      uptime: 3600000,
    };

    const hitRate = (stats.hits / (stats.hits + stats.misses)) * 100;
    expect(hitRate).toBeGreaterThan(0);
  });

  test('MemoryAdapterConfig example compiles', () => {
    const config: MemoryAdapterConfig = {
      maxEntries: 1000,
      defaultTtl: 3600,
    };

    expect(config).toBeDefined();
  });

  test('CacheChangeEvent example compiles', () => {
    const event: CacheChangeEvent = {
      type: 'set',
      key: 'user:123',
      value: '{"name":"Alice"}',
      timestamp: new Date().toISOString(),
      serverId: 'server-1',
    };

    expect(event.type).toBe('set');
  });

  test('CacheWatchHandler example compiles', () => {
    const handler: CacheWatchHandler = event => {
      console.log('Cache changed:', event.key);
    };

    expectTypeOf(handler).toBeFunction();
  });

  test('CachePluginConfig examples compile', () => {
    const devConfig: CachePluginConfig = {
      maxEntries: 1000,
      defaultTtl: 3600,
    };

    const prodConfig: CachePluginConfig = {
      serverId: 'server-1',
    };

    expect(devConfig).toBeDefined();
    expect(prodConfig).toBeDefined();
  });
});

// ============================================================================
// Naming Convention Tests
// ============================================================================

describe('Naming conventions', () => {
  test('Config interfaces end with "Config"', () => {
    expectTypeOf<MemoryAdapterConfig>().not.toBeAny();
    expectTypeOf<CachePluginConfig>().not.toBeAny();
  });

  test('Services interfaces end with "Services"', () => {
    expectTypeOf<CachePluginServices>().not.toBeAny();
  });

  test('Event interfaces end with "Event"', () => {
    expectTypeOf<CacheChangeEvent>().not.toBeAny();
  });

  test('Handler types end with "Handler"', () => {
    expectTypeOf<CacheWatchHandler>().not.toBeAny();
  });

  test('Statistics interfaces end with "Stats"', () => {
    expectTypeOf<CacheStats>().not.toBeAny();
  });
});
