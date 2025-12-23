/**
 * Cache Plugin Route Schemas Tests
 *
 * Tests Zod schema validation for cache routes including:
 * - Query parameter schemas
 * - Response schemas
 * - SSE event schemas
 * - Type inference
 *
 * @module @blaizejs/plugin-cache/schemas.test
 */

import {
  cacheEventsQuerySchema,
  cacheDashboardQuerySchema,
  cacheStatsResponseSchema,
  cacheSetEventSchema,
  cacheDeleteEventSchema,
  cacheEvictionEventSchema,
  cacheEventsSchema,
} from './schema';

import type {
  CacheEventsQuery,
  CacheDashboardQuery,
  CacheStatsResponse,
  CacheSetEvent,
  CacheDeleteEvent,
  CacheEvictionEvent,
} from './schema';

// ============================================================================
// Query Parameter Schemas
// ============================================================================

describe('cacheEventsQuerySchema', () => {
  describe('valid inputs', () => {
    test('should accept empty object (no pattern)', () => {
      const result = cacheEventsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pattern).toBeUndefined();
      }
    });

    test('should accept glob pattern', () => {
      const result = cacheEventsQuerySchema.safeParse({ pattern: 'user:*' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pattern).toBe('user:*');
      }
    });

    test('should accept regex pattern', () => {
      const result = cacheEventsQuerySchema.safeParse({ pattern: 'session:.*' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pattern).toBe('session:.*');
      }
    });

    test('should accept wildcard pattern', () => {
      const result = cacheEventsQuerySchema.safeParse({ pattern: '.*' });
      expect(result.success).toBe(true);
    });

    test('should accept complex patterns', () => {
      const patterns = ['manifest:*', 'config:feature-*', '^user:\\d+$', 'session:[a-f0-9]{32}'];

      patterns.forEach(pattern => {
        const result = cacheEventsQuerySchema.safeParse({ pattern });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('invalid inputs', () => {
    test('should reject non-string pattern', () => {
      const result = cacheEventsQuerySchema.safeParse({ pattern: 123 });
      expect(result.success).toBe(false);
    });

    test('should reject null pattern', () => {
      const result = cacheEventsQuerySchema.safeParse({ pattern: null });
      expect(result.success).toBe(false);
    });

    test('should reject array pattern', () => {
      const result = cacheEventsQuerySchema.safeParse({ pattern: ['user:*'] });
      expect(result.success).toBe(false);
    });
  });

  describe('type inference', () => {
    test('should infer correct type', () => {
      const data: CacheEventsQuery = { pattern: 'user:*' };
      const result = cacheEventsQuerySchema.safeParse(data);
      expect(result.success).toBe(true);

      // Type test - pattern should be optional
      const emptyData: CacheEventsQuery = {};
      expect(cacheEventsQuerySchema.safeParse(emptyData).success).toBe(true);
    });
  });
});

describe('cacheDashboardQuerySchema', () => {
  describe('valid inputs', () => {
    test('should accept empty object (no refresh)', () => {
      const result = cacheDashboardQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.refresh).toBeUndefined();
      }
    });

    test('should accept numeric string', () => {
      const result = cacheDashboardQuerySchema.safeParse({ refresh: '30' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.refresh).toBe('30');
      }
    });

    test('should accept various interval strings', () => {
      const intervals = ['5', '10', '30', '60', '120'];

      intervals.forEach(refresh => {
        const result = cacheDashboardQuerySchema.safeParse({ refresh });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('invalid inputs', () => {
    test('should reject numeric value', () => {
      const result = cacheDashboardQuerySchema.safeParse({ refresh: 30 });
      expect(result.success).toBe(false);
    });

    test('should reject null', () => {
      const result = cacheDashboardQuerySchema.safeParse({ refresh: null });
      expect(result.success).toBe(false);
    });

    test('should reject boolean', () => {
      const result = cacheDashboardQuerySchema.safeParse({ refresh: true });
      expect(result.success).toBe(false);
    });
  });

  describe('type inference', () => {
    test('should infer correct type', () => {
      const data: CacheDashboardQuery = { refresh: '30' };
      const result = cacheDashboardQuerySchema.safeParse(data);
      expect(result.success).toBe(true);

      // Type test - refresh should be optional
      const emptyData: CacheDashboardQuery = {};
      expect(cacheDashboardQuerySchema.safeParse(emptyData).success).toBe(true);
    });
  });
});

// ============================================================================
// Response Schemas
// ============================================================================

describe('cacheStatsResponseSchema', () => {
  const validStats = {
    stats: {
      hits: 100,
      misses: 20,
      evictions: 5,
      memoryUsage: 1048576,
      entryCount: 50,
      uptime: 3600000,
    },
    hitRate: 0.833,
    timestamp: Date.now(),
  };

  describe('valid inputs', () => {
    test('should accept complete stats response', () => {
      const result = cacheStatsResponseSchema.safeParse(validStats);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stats.hits).toBe(100);
        expect(result.data.stats.misses).toBe(20);
        expect(result.data.hitRate).toBe(0.833);
      }
    });

    test('should accept stats without optional uptime', () => {
      const statsWithoutUptime = {
        stats: {
          hits: 100,
          misses: 20,
          evictions: 5,
          memoryUsage: 1048576,
          entryCount: 50,
        },
        hitRate: 0.833,
        timestamp: Date.now(),
      };

      const result = cacheStatsResponseSchema.safeParse(statsWithoutUptime);
      expect(result.success).toBe(true);
    });

    test('should accept zero values', () => {
      const zeroStats = {
        stats: {
          hits: 0,
          misses: 0,
          evictions: 0,
          memoryUsage: 0,
          entryCount: 0,
          uptime: 0,
        },
        hitRate: 0,
        timestamp: 1,
      };

      const result = cacheStatsResponseSchema.safeParse(zeroStats);
      expect(result.success).toBe(true);
    });

    test('should accept maximum hit rate', () => {
      const maxHitRate = {
        ...validStats,
        hitRate: 1.0,
      };

      const result = cacheStatsResponseSchema.safeParse(maxHitRate);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    test('should reject missing stats', () => {
      const result = cacheStatsResponseSchema.safeParse({
        hitRate: 0.5,
        timestamp: Date.now(),
      });
      expect(result.success).toBe(false);
    });

    test('should reject missing hitRate', () => {
      const result = cacheStatsResponseSchema.safeParse({
        stats: validStats.stats,
        timestamp: Date.now(),
      });
      expect(result.success).toBe(false);
    });

    test('should reject missing timestamp', () => {
      const result = cacheStatsResponseSchema.safeParse({
        stats: validStats.stats,
        hitRate: 0.5,
      });
      expect(result.success).toBe(false);
    });

    test('should reject negative values', () => {
      const negativeStats = {
        stats: {
          hits: -1,
          misses: 20,
          evictions: 5,
          memoryUsage: 1048576,
          entryCount: 50,
        },
        hitRate: 0.5,
        timestamp: Date.now(),
      };

      const result = cacheStatsResponseSchema.safeParse(negativeStats);
      expect(result.success).toBe(false);
    });

    test('should reject hit rate > 1', () => {
      const invalidHitRate = {
        ...validStats,
        hitRate: 1.5,
      };

      const result = cacheStatsResponseSchema.safeParse(invalidHitRate);
      expect(result.success).toBe(false);
    });

    test('should reject negative hit rate', () => {
      const invalidHitRate = {
        ...validStats,
        hitRate: -0.1,
      };

      const result = cacheStatsResponseSchema.safeParse(invalidHitRate);
      expect(result.success).toBe(false);
    });

    test('should reject zero or negative timestamp', () => {
      const invalidTimestamp = {
        ...validStats,
        timestamp: 0,
      };

      const result = cacheStatsResponseSchema.safeParse(invalidTimestamp);
      expect(result.success).toBe(false);
    });

    test('should reject non-integer values', () => {
      const floatStats = {
        stats: {
          hits: 100.5,
          misses: 20,
          evictions: 5,
          memoryUsage: 1048576,
          entryCount: 50,
        },
        hitRate: 0.5,
        timestamp: Date.now(),
      };

      const result = cacheStatsResponseSchema.safeParse(floatStats);
      expect(result.success).toBe(false);
    });

    test('should reject string values', () => {
      const stringStats = {
        stats: {
          hits: '100',
          misses: 20,
          evictions: 5,
          memoryUsage: 1048576,
          entryCount: 50,
        },
        hitRate: 0.5,
        timestamp: Date.now(),
      };

      const result = cacheStatsResponseSchema.safeParse(stringStats);
      expect(result.success).toBe(false);
    });
  });

  describe('type inference', () => {
    test('should infer correct type', () => {
      const data: CacheStatsResponse = validStats;
      const result = cacheStatsResponseSchema.safeParse(data);
      expect(result.success).toBe(true);

      // Type test - uptime should be optional
      const dataWithoutUptime: CacheStatsResponse = {
        stats: {
          hits: 100,
          misses: 20,
          evictions: 5,
          memoryUsage: 1048576,
          entryCount: 50,
        },
        hitRate: 0.833,
        timestamp: Date.now(),
      };
      expect(cacheStatsResponseSchema.safeParse(dataWithoutUptime).success).toBe(true);
    });
  });
});

// ============================================================================
// SSE Event Schemas
// ============================================================================

describe('cacheSetEventSchema', () => {
  const validEvent = {
    type: 'set' as const,
    key: 'user:123',
    value: 'John Doe',
    timestamp: new Date().toISOString(),
    serverId: 'server-1',
    sequence: 42,
  };

  describe('valid inputs', () => {
    test('should accept complete set event', () => {
      const result = cacheSetEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('set');
        expect(result.data.key).toBe('user:123');
        expect(result.data.value).toBe('John Doe');
      }
    });

    test('should accept event without optional fields', () => {
      const minimalEvent = {
        type: 'set' as const,
        key: 'user:123',
        timestamp: new Date().toISOString(),
      };

      const result = cacheSetEventSchema.safeParse(minimalEvent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBeUndefined();
        expect(result.data.serverId).toBeUndefined();
        expect(result.data.sequence).toBeUndefined();
      }
    });

    test('should accept various key formats', () => {
      const keys = [
        'simple',
        'user:123',
        'session:abc-def-ghi',
        'config:feature-flags',
        'manifest:federata-v1',
      ];

      keys.forEach(key => {
        const event = { ...validEvent, key };
        const result = cacheSetEventSchema.safeParse(event);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('invalid inputs', () => {
    test('should reject missing type', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { type, ...eventWithoutType } = validEvent;
      const result = cacheSetEventSchema.safeParse(eventWithoutType);
      expect(result.success).toBe(false);
    });

    test('should reject wrong type', () => {
      const wrongType = { ...validEvent, type: 'delete' };
      const result = cacheSetEventSchema.safeParse(wrongType);
      expect(result.success).toBe(false);
    });

    test('should reject missing key', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { key, ...eventWithoutKey } = validEvent;
      const result = cacheSetEventSchema.safeParse(eventWithoutKey);
      expect(result.success).toBe(false);
    });

    test('should reject empty key', () => {
      const emptyKey = { ...validEvent, key: '' };
      const result = cacheSetEventSchema.safeParse(emptyKey);
      expect(result.success).toBe(false);
    });

    test('should reject missing timestamp', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { timestamp, ...eventWithoutTimestamp } = validEvent;
      const result = cacheSetEventSchema.safeParse(eventWithoutTimestamp);
      expect(result.success).toBe(false);
    });

    test('should reject non-integer sequence', () => {
      const floatSequence = { ...validEvent, sequence: 42.5 };
      const result = cacheSetEventSchema.safeParse(floatSequence);
      expect(result.success).toBe(false);
    });
  });

  describe('type inference', () => {
    test('should infer correct type', () => {
      const data: CacheSetEvent = validEvent;
      const result = cacheSetEventSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});

describe('cacheDeleteEventSchema', () => {
  const validEvent = {
    type: 'delete' as const,
    key: 'user:123',
    timestamp: new Date().toISOString(),
    serverId: 'server-1',
    sequence: 43,
  };

  describe('valid inputs', () => {
    test('should accept complete delete event', () => {
      const result = cacheDeleteEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('delete');
        expect(result.data.key).toBe('user:123');
      }
    });

    test('should accept event without optional fields', () => {
      const minimalEvent = {
        type: 'delete' as const,
        key: 'user:123',
        timestamp: new Date().toISOString(),
      };

      const result = cacheDeleteEventSchema.safeParse(minimalEvent);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    test('should reject wrong type', () => {
      const wrongType = { ...validEvent, type: 'set' };
      const result = cacheDeleteEventSchema.safeParse(wrongType);
      expect(result.success).toBe(false);
    });

    test('should reject missing key', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { key, ...eventWithoutKey } = validEvent;
      const result = cacheDeleteEventSchema.safeParse(eventWithoutKey);
      expect(result.success).toBe(false);
    });
  });

  describe('type inference', () => {
    test('should infer correct type', () => {
      const data: CacheDeleteEvent = validEvent;
      const result = cacheDeleteEventSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});

describe('cacheEvictionEventSchema', () => {
  const validEvent = {
    type: 'eviction' as const,
    key: 'session:abc',
    reason: 'ttl' as const,
    timestamp: new Date().toISOString(),
    serverId: 'server-1',
    sequence: 44,
  };

  describe('valid inputs', () => {
    test('should accept complete eviction event', () => {
      const result = cacheEvictionEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('eviction');
        expect(result.data.reason).toBe('ttl');
      }
    });

    test('should accept lru reason', () => {
      const lruEvent = { ...validEvent, reason: 'lru' as const };
      const result = cacheEvictionEventSchema.safeParse(lruEvent);
      expect(result.success).toBe(true);
    });

    test('should accept event without optional reason', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { reason, ...eventWithoutReason } = validEvent;
      const result = cacheEvictionEventSchema.safeParse(eventWithoutReason);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    test('should reject wrong type', () => {
      const wrongType = { ...validEvent, type: 'delete' };
      const result = cacheEvictionEventSchema.safeParse(wrongType);
      expect(result.success).toBe(false);
    });

    test('should reject invalid reason', () => {
      const invalidReason = { ...validEvent, reason: 'expired' };
      const result = cacheEvictionEventSchema.safeParse(invalidReason);
      expect(result.success).toBe(false);
    });

    test('should reject missing key', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { key, ...eventWithoutKey } = validEvent;
      const result = cacheEvictionEventSchema.safeParse(eventWithoutKey);
      expect(result.success).toBe(false);
    });
  });

  describe('type inference', () => {
    test('should infer correct type', () => {
      const data: CacheEvictionEvent = validEvent;
      const result = cacheEvictionEventSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// SSE Events Schema (Discriminated Union)
// ============================================================================

describe('cacheEventsSchema', () => {
  test('should contain all event types', () => {
    expect(cacheEventsSchema).toHaveProperty('cache.set');
    expect(cacheEventsSchema).toHaveProperty('cache.delete');
    expect(cacheEventsSchema).toHaveProperty('cache.eviction');
  });

  test('should validate set event', () => {
    const setEvent = {
      type: 'set' as const,
      key: 'user:123',
      timestamp: new Date().toISOString(),
    };

    const result = cacheEventsSchema['cache.set'].safeParse(setEvent);
    expect(result.success).toBe(true);
  });

  test('should validate delete event', () => {
    const deleteEvent = {
      type: 'delete' as const,
      key: 'user:123',
      timestamp: new Date().toISOString(),
    };

    const result = cacheEventsSchema['cache.delete'].safeParse(deleteEvent);
    expect(result.success).toBe(true);
  });

  test('should validate eviction event', () => {
    const evictionEvent = {
      type: 'eviction' as const,
      key: 'session:abc',
      reason: 'ttl' as const,
      timestamp: new Date().toISOString(),
    };

    const result = cacheEventsSchema['cache.eviction'].safeParse(evictionEvent);
    expect(result.success).toBe(true);
  });

  test('should enforce type discrimination', () => {
    // Set event with wrong type should fail set schema
    const wrongTypeEvent = {
      type: 'delete' as const,
      key: 'user:123',
      timestamp: new Date().toISOString(),
    };

    const setResult = cacheEventsSchema['cache.set'].safeParse(wrongTypeEvent);
    expect(setResult.success).toBe(false);

    // But should pass delete schema
    const deleteResult = cacheEventsSchema['cache.delete'].safeParse(wrongTypeEvent);
    expect(deleteResult.success).toBe(true);
  });
});
