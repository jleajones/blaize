/**
 * Test Helper Utilities
 *
 * Common test patterns and helper functions for BlaizeJS route testing.
 * Reduces boilerplate and provides consistent testing patterns.
 *
 * @packageDocumentation
 */

import { createMockEventBus } from '../mocks/event-bus';
import { createMockLogger } from '../mocks/logger';

import type { MockEventBusHelpers } from '../mocks/event-bus';
import type { MockLogger } from '../mocks/logger';
import type { TypedEventBus, EventSchemas } from '@blaize-types/events';

/**
 * Route test context with logger, eventBus, and cleanup
 *
 * Provides all the common dependencies needed for route handler testing
 * in a single convenient object.
 *
 * @template TSchemas - Optional event schemas for typed EventBus
 */
export interface RouteTestContext<TSchemas extends EventSchemas = EventSchemas> {
  /**
   * Mock logger with assertion helpers
   *
   * @example
   * ```typescript
   * logger.info('User created', { userId: '123' });
   * logger.assertInfoCalled('User created', { userId: '123' });
   * ```
   */
  logger: MockLogger;

  /**
   * Mock EventBus with assertion helpers
   *
   * @example
   * ```typescript
   * await eventBus.publish('user:created', { userId: '123' });
   * eventBus.assertPublished('user:created', { userId: '123' });
   * ```
   */
  eventBus: TypedEventBus<TSchemas> & MockEventBusHelpers;

  /**
   * Cleanup function to reset all mocks
   *
   * Clears:
   * - Logger state and assertions
   * - EventBus state and assertions
   * - All Vitest mock call history
   *
   * @example
   * ```typescript
   * afterEach(() => {
   *   cleanup();
   * });
   * ```
   */
  cleanup: () => void;
}

/**
 * Create a complete test context for route handler testing
 *
 * Provides pre-configured logger and eventBus with assertion helpers,
 * plus a cleanup function to reset state between tests.
 *
 * This is the primary testing utility - use it in every route test to
 * reduce boilerplate from ~10 lines to ~1 line.
 *
 * @template TSchemas - Optional event schemas for typed EventBus
 * @returns Test context with logger, eventBus, and cleanup
 *
 * @example Basic usage
 * ```typescript
 * import { createRouteTestContext } from '@blaizejs/testing-utils';
 *
 * describe('GET /users/:userId', () => {
 *   it('should fetch user and publish event', async () => {
 *     const { logger, eventBus, cleanup } = createRouteTestContext();
 *
 *     const result = await getUserById.handler({
 *       params: { userId: 'test-123' },
 *       logger,
 *       eventBus,
 *     });
 *
 *     expect(result.id).toBe('test-123');
 *     logger.assertInfoCalled('Fetching user', { userId: 'test-123' });
 *     eventBus.assertPublished('user:viewed', { userId: 'test-123' });
 *
 *     cleanup();
 *   });
 * });
 * ```
 *
 * @example With cleanup in afterEach
 * ```typescript
 * describe('User routes', () => {
 *   const { logger, eventBus, cleanup } = createRouteTestContext();
 *
 *   afterEach(() => {
 *     cleanup(); // Reset state between tests
 *   });
 *
 *   it('test 1', async () => {
 *     // Use logger and eventBus
 *   });
 *
 *   it('test 2', async () => {
 *     // Fresh state from cleanup
 *   });
 * });
 * ```
 *
 * @example With typed event schemas
 * ```typescript
 * import { z } from 'zod';
 *
 * type MyEvents = {
 *   'user:created': z.ZodObject<{ userId: z.ZodString }>;
 *   'order:placed': z.ZodObject<{ orderId: z.ZodString }>;
 * };
 *
 * const { logger, eventBus, cleanup } = createRouteTestContext<MyEvents>();
 *
 * // eventBus now has type hints for event names and data
 * await eventBus.publish('user:created', { userId: '123' });
 * ```
 */
export function createRouteTestContext<
  TSchemas extends EventSchemas = EventSchemas,
>(): RouteTestContext<TSchemas> {
  const logger = createMockLogger();
  const eventBus = createMockEventBus<TSchemas>();

  return {
    logger,
    eventBus,
    cleanup: () => {
      logger.clear();
      eventBus.clear();
      vi.clearAllMocks();
    },
  };
}
