import type { EventBus, Unsubscribe } from '@blaize-types/events';

/**
 * Create a mock EventBus for testing
 */
export function createMockEventBus(overrides: Partial<EventBus> = {}): EventBus {
  return {
    serverId: 'mock-eventbus-server',
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(vi.fn()), // Returns mock unsubscribe function
    setAdapter: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as EventBus;
}

/**
 * Create a working mock EventBus with in-memory pub/sub for integration tests
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

    subscribe: vi.fn().mockImplementation((pattern: string, handler: (event: any) => void): Unsubscribe => {
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
 */
function matchesPattern(eventType: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === eventType) return true;
  
  // Simple wildcard support
  const regex = new RegExp('^' + pattern.replace(/\*/g, '[^:]*') + '$');
  return regex.test(eventType);
}