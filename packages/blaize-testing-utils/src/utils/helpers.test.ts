/**
 * Unit tests for test-helpers utilities
 *
 * Tests the createRouteTestContext helper to ensure it properly
 * sets up test dependencies and cleanup works correctly.
 *
 * Coverage target: 90%+
 */

import { createRouteTestContext } from './helpers';

import type { RouteTestContext } from './helpers';

describe('createRouteTestContext', () => {
  let context: RouteTestContext;

  beforeEach(() => {
    context = createRouteTestContext();
  });

  afterEach(() => {
    if (context) {
      context.cleanup();
    }
  });

  describe('Return value structure', () => {
    it('should return object with logger, eventBus, and cleanup', () => {
      expect(context).toHaveProperty('logger');
      expect(context).toHaveProperty('eventBus');
      expect(context).toHaveProperty('cleanup');
    });

    it('should return MockLogger instance', () => {
      expect(context.logger).toBeDefined();
      expect(context.logger.info).toBeDefined();
      expect(context.logger.debug).toBeDefined();
      expect(context.logger.warn).toBeDefined();
      expect(context.logger.error).toBeDefined();
      expect(context.logger.assertInfoCalled).toBeDefined();
    });

    it('should return MockEventBus with helpers', () => {
      expect(context.eventBus).toBeDefined();
      expect(context.eventBus.publish).toBeDefined();
      expect(context.eventBus.subscribe).toBeDefined();
      expect(context.eventBus.assertPublished).toBeDefined();
      expect(context.eventBus.assertNotPublished).toBeDefined();
      expect(context.eventBus.getPublishedEvents).toBeDefined();
    });

    it('should return cleanup function', () => {
      expect(typeof context.cleanup).toBe('function');
    });
  });

  describe('Logger functionality', () => {
    it('should allow logging with assertion helpers', () => {
      context.logger.info('Test message', { userId: '123' });

      expect(() => context.logger.assertInfoCalled('Test message')).not.toThrow();
    });

    it('should track logs independently per context', () => {
      const context1 = createRouteTestContext();
      const context2 = createRouteTestContext();

      context1.logger.info('Context 1');
      context2.logger.info('Context 2');

      expect(() => context1.logger.assertInfoCalled('Context 1')).not.toThrow();
      expect(() => context1.logger.assertInfoCalled('Context 2')).toThrow();

      expect(() => context2.logger.assertInfoCalled('Context 2')).not.toThrow();
      expect(() => context2.logger.assertInfoCalled('Context 1')).toThrow();

      context1.cleanup();
      context2.cleanup();
    });

    it('should support all log levels', () => {
      context.logger.debug('Debug');
      context.logger.info('Info');
      context.logger.warn('Warn');
      context.logger.error('Error');

      expect(() => context.logger.assertDebugCalled('Debug')).not.toThrow();
      expect(() => context.logger.assertInfoCalled('Info')).not.toThrow();
      expect(() => context.logger.assertWarnCalled('Warn')).not.toThrow();
      expect(() => context.logger.assertErrorCalled('Error')).not.toThrow();
    });
  });

  describe('EventBus functionality', () => {
    it('should allow publishing with assertion helpers', async () => {
      await context.eventBus.publish('user:created', { userId: '123' });

      expect(() => context.eventBus.assertPublished('user:created')).not.toThrow();
    });

    it('should track events independently per context', async () => {
      const context1 = createRouteTestContext();
      const context2 = createRouteTestContext();

      await context1.eventBus.publish('event:1', {});
      await context2.eventBus.publish('event:2', {});

      expect(() => context1.eventBus.assertPublished('event:1')).not.toThrow();
      expect(() => context1.eventBus.assertPublished('event:2')).toThrow();

      expect(() => context2.eventBus.assertPublished('event:2')).not.toThrow();
      expect(() => context2.eventBus.assertPublished('event:1')).toThrow();

      context1.cleanup();
      context2.cleanup();
    });

    it('should support all EventBus helpers', async () => {
      await context.eventBus.publish('user:created', { userId: '123' });
      await context.eventBus.publish('user:updated', { userId: '456' });

      expect(() => context.eventBus.assertPublished('user:created')).not.toThrow();
      expect(() => context.eventBus.assertNotPublished('user:deleted')).not.toThrow();

      const events = context.eventBus.getPublishedEvents('user:created');
      expect(events).toHaveLength(1);
    });
  });

  describe('Cleanup functionality', () => {
    it('should clear logger state', () => {
      context.logger.info('Before cleanup');

      context.cleanup();

      const logs = context.logger.getLogsByLevel('info');
      expect(logs).toHaveLength(0);
    });

    it('should clear eventBus state', async () => {
      await context.eventBus.publish('test:event', {});

      context.cleanup();

      const events = context.eventBus.getPublishedEvents();
      expect(events).toHaveLength(0);
    });

    it('should clear vitest mock call history', async () => {
      context.logger.info('Test');
      await context.eventBus.publish('test:event', {});

      context.cleanup();

      expect(context.logger.info).not.toHaveBeenCalled();
      expect(context.eventBus.publish).not.toHaveBeenCalled();
    });

    it('should allow reuse after cleanup', async () => {
      // First use
      context.logger.info('First');
      await context.eventBus.publish('event:first', {});

      context.cleanup();

      // Second use (after cleanup)
      context.logger.info('Second');
      await context.eventBus.publish('event:second', {});

      const logs = context.logger.getLogsByLevel('info');
      const events = context.eventBus.getPublishedEvents();

      expect(logs).toHaveLength(1);
      expect(logs[0]!.message).toBe('Second');

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('event:second');
    });

    it('should be safe to call multiple times', () => {
      context.logger.info('Test');

      expect(() => {
        context.cleanup();
        context.cleanup();
        context.cleanup();
      }).not.toThrow();
    });
  });

  describe('Real-world usage patterns', () => {
    it('should work with route handler pattern', async () => {
      // Simulate route handler
      const getUserById = {
        handler: async ({ params, logger, eventBus }: any) => {
          logger.info('Fetching user', { userId: params.userId });
          await eventBus.publish('user:viewed', { userId: params.userId });
          return { id: params.userId, name: 'Test User' };
        },
      };

      const result = await getUserById.handler({
        params: { userId: 'test-123' },
        logger: context.logger,
        eventBus: context.eventBus,
      });

      expect(result.id).toBe('test-123');
      context.logger.assertInfoCalled('Fetching user', { userId: 'test-123' });
      context.eventBus.assertPublished('user:viewed', { userId: 'test-123' });
    });

    it('should work with multiple route calls in same test', async () => {
      const createUser = {
        handler: async ({ logger, eventBus }: any) => {
          logger.info('Creating user');
          await eventBus.publish('user:created', { userId: '123' });
          return { id: '123' };
        },
      };

      const updateUser = {
        handler: async ({ logger, eventBus }: any) => {
          logger.info('Updating user');
          await eventBus.publish('user:updated', { userId: '123' });
          return { id: '123', updated: true };
        },
      };

      await createUser.handler({ logger: context.logger, eventBus: context.eventBus });
      await updateUser.handler({ logger: context.logger, eventBus: context.eventBus });

      context.logger.assertInfoCalled('Creating user');
      context.logger.assertInfoCalled('Updating user');
      context.eventBus.assertPublished('user:created');
      context.eventBus.assertPublished('user:updated');
    });

    it('should work with error scenarios', async () => {
      const failingHandler = {
        handler: async ({ logger, eventBus }: any) => {
          logger.error('Operation failed', { error: 'Database error' });
          await eventBus.publish('error:occurred', { type: 'database' });
          throw new Error('Database error');
        },
      };

      await expect(
        failingHandler.handler({ logger: context.logger, eventBus: context.eventBus })
      ).rejects.toThrow('Database error');

      context.logger.assertErrorCalled('Operation failed', { error: 'Database error' });
      context.eventBus.assertPublished('error:occurred', { type: 'database' });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty logger usage', () => {
      const logs = context.logger.getLogsByLevel('info');
      expect(logs).toHaveLength(0);
    });

    it('should handle empty eventBus usage', () => {
      const events = context.eventBus.getPublishedEvents();
      expect(events).toHaveLength(0);
    });

    it('should handle cleanup before any usage', () => {
      const freshContext = createRouteTestContext();

      expect(() => freshContext.cleanup()).not.toThrow();

      freshContext.cleanup();
    });

    it('should create multiple independent contexts', () => {
      const contexts = Array.from({ length: 10 }, () => createRouteTestContext());

      contexts.forEach((ctx, i) => {
        ctx.logger.info(`Context ${i}`);
      });

      contexts.forEach((ctx, i) => {
        expect(() => ctx.logger.assertInfoCalled(`Context ${i}`)).not.toThrow();
      });

      contexts.forEach(ctx => ctx.cleanup());
    });
  });

  describe('Integration with other test patterns', () => {
    it('should work with beforeEach/afterEach pattern', () => {
      const testContext: ReturnType<typeof createRouteTestContext> = createRouteTestContext();

      // Test
      testContext.logger.info('Test');

      // Simulate afterEach
      testContext.cleanup();

      // Verify cleanup worked
      expect(testContext.logger.getLogsByLevel('info')).toHaveLength(0);
    });

    it('should work with describe block scoped context', async () => {
      const scopedContext = createRouteTestContext();

      // Test 1
      scopedContext.logger.info('Test 1');
      expect(() => scopedContext.logger.assertInfoCalled('Test 1')).not.toThrow();
      scopedContext.cleanup();

      // Test 2 (after cleanup)
      await scopedContext.eventBus.publish('test:2', {});
      expect(() => scopedContext.eventBus.assertPublished('test:2')).not.toThrow();
      scopedContext.cleanup();
    });
  });

  describe('TypeScript generic typing', () => {
    it('should work without type parameters', () => {
      const ctx = createRouteTestContext();

      expect(ctx.logger).toBeDefined();
      expect(ctx.eventBus).toBeDefined();
      expect(ctx.cleanup).toBeDefined();

      ctx.cleanup();
    });

    it('should work with EventSchemas type parameter', () => {
      // Note: Type parameter is for documentation/future type safety
      // The mock doesn't enforce it at runtime
      const ctx = createRouteTestContext();

      expect(ctx.logger).toBeDefined();
      expect(ctx.eventBus).toBeDefined();

      ctx.cleanup();
    });
  });
});
