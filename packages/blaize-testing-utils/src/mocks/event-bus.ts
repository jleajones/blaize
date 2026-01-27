/**
 * Mock EventBus for Testing
 *
 * Provides mock implementations of EventBus for testing with assertion helpers
 * that reduce test boilerplate by ~70%.
 *
 * @packageDocumentation
 */

import type { EventBus, Unsubscribe, EventSchemas, TypedEventBus } from '@blaize-types/events';

/**
 * Published event entry for internal tracking
 */
type PublishedEvent = {
  type: string;
  data: unknown;
  timestamp: number;
};

/**
 * Assertion helpers for MockEventBus
 *
 * These methods make testing event publishing much cleaner and more readable.
 */
export interface MockEventBusHelpers {
  /**
   * Assert that an event with the given type was published
   *
   * Optionally validates event data using partial matching (toMatchObject).
   * This means you only need to specify the fields you care about.
   *
   * @param eventType - The expected event type
   * @param data - Optional data to validate (partial match)
   * @throws {Error} If the event was not published, with helpful error message
   *
   * @example
   * ```typescript
   * await eventBus.publish('user:created', { userId: '123', email: 'test@example.com' });
   *
   * // Pass - exact match
   * eventBus.assertPublished('user:created', { userId: '123', email: 'test@example.com' });
   *
   * // Pass - partial match (only check userId)
   * eventBus.assertPublished('user:created', { userId: '123' });
   *
   * // Throw - event not found
   * eventBus.assertPublished('user:deleted'); // Error with actual events listed
   *
   * // Throw - data doesn't match
   * eventBus.assertPublished('user:created', { userId: '456' }); // Error
   * ```
   */
  assertPublished(eventType: string, data?: unknown): void;

  /**
   * Assert that an event with the given type was NOT published
   *
   * @param eventType - The event type that should not have been published
   * @throws {Error} If the event was published
   *
   * @example
   * ```typescript
   * await eventBus.publish('user:created', { userId: '123' });
   *
   * // Pass - event was not published
   * eventBus.assertNotPublished('user:deleted');
   *
   * // Throw - event was published
   * eventBus.assertNotPublished('user:created'); // Error
   * ```
   */
  assertNotPublished(eventType: string): void;

  /**
   * Get all published events, optionally filtered by type
   *
   * Returns a copy of the events array to prevent external mutation.
   *
   * @param eventType - Optional event type to filter by
   * @returns Array of published events
   *
   * @example
   * ```typescript
   * await eventBus.publish('user:created', { userId: '123' });
   * await eventBus.publish('user:updated', { userId: '123' });
   * await eventBus.publish('user:created', { userId: '456' });
   *
   * // Get all events
   * const allEvents = eventBus.getPublishedEvents();
   * console.log(allEvents.length); // 3
   *
   * // Get only user:created events
   * const createdEvents = eventBus.getPublishedEvents('user:created');
   * console.log(createdEvents.length); // 2
   * ```
   */
  getPublishedEvents(eventType?: string): Array<{ type: string; data: unknown; timestamp: number }>;

  /**
   * Clear all tracked events and reset mock state
   *
   * Clears:
   * - All published events
   * - Vitest mock call history
   *
   * @example
   * ```typescript
   * await eventBus.publish('user:created', { userId: '123' });
   * eventBus.clear();
   *
   * eventBus.getPublishedEvents(); // []
   * expect(eventBus.publish).not.toHaveBeenCalled(); // ✅ Pass
   * ```
   */
  clear(): void;
}

/**
 * Create a mock EventBus for testing with assertion helpers
 *
 * NEW in 0.6.0: Assertion helpers reduce test boilerplate by ~70%:
 * - eventBus.assertPublished('event:type', { data })
 * - eventBus.assertNotPublished('event:type')
 * - eventBus.getPublishedEvents('event:type')
 * - eventBus.clear()
 *
 * @param overrides - Optional overrides for specific EventBus methods
 * @returns Mock EventBus with assertion helpers
 *
 * @example Basic usage
 * ```typescript
 * import { createMockEventBus } from '@blaizejs/testing-utils';
 *
 * const eventBus = createMockEventBus();
 * await eventBus.publish('user:created', { userId: '123' });
 *
 * // Old way - verbose
 * expect(eventBus.publish).toHaveBeenCalledWith('user:created', { userId: '123' });
 *
 * // New way - concise
 * eventBus.assertPublished('user:created', { userId: '123' });
 * ```
 *
 * @example With TypeScript event schemas
 * ```typescript
 * type MyEvents = {
 *   'user:created': { userId: string; email: string };
 *   'user:deleted': { userId: string };
 * };
 *
 * const eventBus = createMockEventBus<MyEvents>();
 * await eventBus.publish('user:created', { userId: '123', email: 'test@example.com' });
 *
 * eventBus.assertPublished('user:created', { userId: '123' });
 * ```
 */
export function createMockEventBus<TSchemas extends EventSchemas = EventSchemas>(
  overrides: Partial<EventBus> = {}
): TypedEventBus<TSchemas> & MockEventBusHelpers {
  /**
   * Internal array tracking all published events
   */
  const publishedEvents: PublishedEvent[] = [];

  /**
   * Mock publish function that tracks all calls
   */
  const publish = vi.fn(async (type: string, data?: unknown) => {
    publishedEvents.push({
      type,
      data,
      timestamp: Date.now(),
    });
  });

  return {
    serverId: 'mock-eventbus-server',
    publish,
    subscribe: vi.fn().mockReturnValue(vi.fn()), // Returns mock unsubscribe function
    setAdapter: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),

    // Assertion helpers (NEW in 0.6.0)
    assertPublished(eventType: string, data?: unknown): void {
      const found = publishedEvents.find(e => e.type === eventType);

      if (!found) {
        const types = publishedEvents.map(e => e.type).join(', ');
        throw new Error(
          `Expected event "${eventType}" was not published.\n` +
            `Published events: [${types || 'none'}]`
        );
      }

      if (data) {
        expect(found.data).toMatchObject(data);
      }
    },

    assertNotPublished(eventType: string): void {
      const found = publishedEvents.find(e => e.type === eventType);

      if (found) {
        throw new Error(
          `Expected event "${eventType}" to NOT be published, but it was.\n` +
            `Event data: ${JSON.stringify(found.data)}`
        );
      }
    },

    getPublishedEvents(eventType?: string): Array<{ type: string; data: unknown; timestamp: number }> {
      if (eventType) {
        return publishedEvents
          .filter(e => e.type === eventType)
          .map(e => ({ type: e.type, data: e.data, timestamp: e.timestamp }));
      }
      // Return copy to prevent external mutation
      return publishedEvents.map(e => ({ type: e.type, data: e.data, timestamp: e.timestamp }));
    },

    clear(): void {
      publishedEvents.length = 0; // Clear array
      vi.clearAllMocks(); // Clear vitest mock state
    },

    ...overrides,
  } as TypedEventBus<TSchemas> & MockEventBusHelpers;
}

/**
 * Create a working mock EventBus with in-memory pub/sub for integration tests
 *
 * This implementation actually handles subscriptions and calls handlers when
 * events are published, making it useful for integration tests that need
 * real event flow.
 *
 * @param serverId - Optional server ID (defaults to 'mock-server')
 * @returns Working EventBus with real pub/sub behavior
 *
 * @example
 * ```typescript
 * const eventBus = createWorkingMockEventBus('test-server');
 *
 * const handler = vi.fn();
 * eventBus.subscribe('user:*', handler);
 *
 * await eventBus.publish('user:created', { userId: '123' });
 *
 * expect(handler).toHaveBeenCalledWith(
 *   expect.objectContaining({
 *     type: 'user:created',
 *     data: { userId: '123' },
 *   })
 * );
 * ```
 */
export function createWorkingMockEventBus(serverId: string = 'mock-server'): EventBus {
  const subscriptions = new Map<string, Set<(event: any) => void>>();

  return {
    serverId,

    publish: vi.fn().mockImplementation(async (type: string, data?: unknown) => {
      const event = {
        type,
        data,
        timestamp: Date.now(),
        serverId,
        correlationId: 'test-correlation-id',
      };

      // Call matching subscribers
      for (const [pattern, handlers] of subscriptions.entries()) {
        if (matchesPattern(type, pattern)) {
          handlers.forEach(handler => handler(event));
        }
      }
    }),

    subscribe: vi
      .fn()
      .mockImplementation((pattern: string, handler: (event: any) => void): Unsubscribe => {
        if (!subscriptions.has(pattern)) {
          subscriptions.set(pattern, new Set());
        }
        subscriptions.get(pattern)!.add(handler);

        // Return unsubscribe function
        return () => {
          subscriptions.get(pattern)?.delete(handler);
          if (subscriptions.get(pattern)?.size === 0) {
            subscriptions.delete(pattern);
          }
        };
      }),

    setAdapter: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Simple pattern matching for testing
 *
 * Supports:
 * - Exact match: 'user:created' matches 'user:created'
 * - Wildcard: 'user:*' matches 'user:created', 'user:updated', etc.
 * - Global wildcard: '*' matches any event
 *
 * @internal
 */
function matchesPattern(eventType: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === eventType) return true;

  // Simple wildcard support
  const regex = new RegExp('^' + pattern.replace(/\*/g, '[^:]*') + '$');
  return regex.test(eventType);
}