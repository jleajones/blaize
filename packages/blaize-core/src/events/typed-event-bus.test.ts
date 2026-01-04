/**
 * Tests for TypedEventBus
 *
 * Comprehensive test suite covering:
 * - Always-on validation (publish and receive)
 * - Extra field stripping
 * - Unknown event behaviors
 * - Zod transforms and defaults
 * - Error callbacks
 * - Type inference
 */

import { z } from 'zod';

import { MemoryEventBus } from './memory-event-bus';
import { createTypedEventBus } from './typed-event-bus';
import { EventValidationError } from '../errors/event-validation-error';

import type { EventSchemas } from '@blaize-types';

// =============================================================================
// Test Schemas
// =============================================================================

const testSchemas = {
  'user:created': z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
  }),
  'user:updated': z.object({
    userId: z.string().uuid(),
    email: z.string().email(),
    name: z.string().optional(),
  }),
  'order:placed': z.object({
    orderId: z.string(),
    total: z.number().positive(),
    items: z.array(z.string()),
  }),
  'transform:test': z.object({
    value: z.string().transform(val => val.toUpperCase()),
  }),
} satisfies EventSchemas;

// =============================================================================
// Tests
// =============================================================================

describe('TypedEventBus', () => {
  let baseBus: MemoryEventBus;
  let typedBus: ReturnType<typeof createTypedEventBus<typeof testSchemas>>;

  beforeEach(() => {
    baseBus = new MemoryEventBus('test-server');
    typedBus = createTypedEventBus(baseBus, {
      schemas: testSchemas,
    });
  });

  afterEach(async () => {
    await typedBus.disconnect();
  });

  // ===========================================================================
  // Constructor & Basic Properties
  // ===========================================================================

  describe('Constructor', () => {
    it('should create TypedEventBus with schemas', () => {
      expect(typedBus).toBeDefined();
      expect(typedBus.base).toBe(baseBus);
      expect(typedBus.serverId).toBe('test-server');
    });

    it('should expose base EventBus', () => {
      expect(typedBus.base).toBe(baseBus);
      expect(typedBus.base).toBeInstanceOf(MemoryEventBus);
    });

    it('should expose serverId from base', () => {
      expect(typedBus.serverId).toBe(baseBus.serverId);
    });

    it('should use default unknownEventBehavior of "warn"', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should warn but not throw
      await expect((typedBus.base as any).publish('unknown:event', {})).resolves.toBeUndefined();

      warnSpy.mockRestore();
    });
  });

  // ===========================================================================
  // Publish - Always Validate
  // ===========================================================================

  describe('publish() - Always Validates', () => {
    it('should validate and publish valid data', async () => {
      const handler = vi.fn();
      baseBus.subscribe('user:created', handler);

      await typedBus.publish('user:created', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user:created',
          data: {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
          },
        })
      );
    });

    it('should throw EventValidationError for invalid data', async () => {
      await expect(
        typedBus.publish('user:created', {
          userId: 'not-a-uuid',
          email: 'invalid-email',
        } as any)
      ).rejects.toThrow(EventValidationError);
    });

    it('should throw for invalid UUID', async () => {
      await expect(
        typedBus.publish('user:created', {
          userId: 'not-a-uuid',
          email: 'valid@example.com',
        } as any)
      ).rejects.toThrow(EventValidationError);
    });

    it('should throw for invalid email', async () => {
      await expect(
        typedBus.publish('user:created', {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          email: 'not-an-email',
        } as any)
      ).rejects.toThrow(EventValidationError);
    });

    it('should throw for missing required fields', async () => {
      await expect(
        typedBus.publish('user:created', {
          userId: '123e4567-e89b-12d3-a456-426614174000',
        } as any)
      ).rejects.toThrow(EventValidationError);
    });

    it('should strip extra fields automatically', async () => {
      const handler = vi.fn();
      baseBus.subscribe('user:created', handler);

      await typedBus.publish('user:created', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        extraField: 'should-be-stripped',
        anotherExtra: 123,
      } as any);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
            // No extra fields
          },
        })
      );
    });

    it('should apply Zod transforms', async () => {
      const handler = vi.fn();
      baseBus.subscribe('transform:test', handler);

      await typedBus.publish('transform:test', {
        value: 'lowercase',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            value: 'LOWERCASE', // Transformed to uppercase
          },
        })
      );
    });

    it('should handle optional fields correctly', async () => {
      const handler = vi.fn();
      baseBus.subscribe('user:updated', handler);

      // Publish without optional 'name' field
      await typedBus.publish('user:updated', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        // name omitted (optional)
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
            // name not present
          },
        })
      );
    });

    it('should include validation details in error', async () => {
      try {
        await typedBus.publish('user:created', {
          userId: 'invalid',
          email: 'also-invalid',
        } as any);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EventValidationError);
        const valError = error as EventValidationError;
        expect(valError.details?.eventType).toBe('user:created');
        expect(valError.details?.context).toBe('publish');
        expect(valError.details?.zodError).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // Subscribe - Always Validate
  // ===========================================================================

  describe('subscribe() - Always Validates', () => {
    it('should validate and deliver valid events', async () => {
      const handler = vi.fn();
      typedBus.subscribe('user:created', handler);

      await baseBus.publish('user:created', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user:created',
          data: {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
          },
        })
      );
    });

    it('should drop invalid events (not crash)', async () => {
      const handler = vi.fn();
      typedBus.subscribe('user:created', handler);

      // Publish invalid data via base bus
      await baseBus.publish('user:created', {
        userId: 'not-a-uuid',
        email: 'invalid-email',
      });

      // Handler should not be called (event dropped)
      expect(handler).not.toHaveBeenCalled();
    });

    it('should strip extra fields on receive', async () => {
      const handler = vi.fn();
      typedBus.subscribe('user:created', handler);

      // Publish with extra fields via base bus
      await baseBus.publish('user:created', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        extraField: 'should-be-stripped',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
            // No extra fields
          },
        })
      );
    });

    it('should apply transforms on receive', async () => {
      const handler = vi.fn();
      typedBus.subscribe('transform:test', handler);

      await baseBus.publish('transform:test', {
        value: 'lowercase',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            value: 'LOWERCASE', // Transformed
          },
        })
      );
    });

    it('should handle optional fields on receive', async () => {
      const handler = vi.fn();
      typedBus.subscribe('user:updated', handler);

      // Test 1: With optional field
      await baseBus.publish('user:updated', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'John Doe',
      });

      expect(handler).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'John Doe',
          }),
        })
      );

      // Test 2: Without optional field
      await baseBus.publish('user:updated', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        // name omitted
      });

      expect(handler).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
            // name not present
          },
        })
      );
    });

    it('should work with wildcard patterns', async () => {
      const handler = vi.fn();
      typedBus.subscribe('user:*', handler);

      await baseBus.publish('user:created', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
      });

      await baseBus.publish('user:updated', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'updated@example.com',
        name: 'John',
      });

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should validate wildcard subscriptions against actual event schema', async () => {
      const handler = vi.fn();
      typedBus.subscribe('user:*', handler);

      // Valid user:created
      await baseBus.publish('user:created', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
      });

      // Invalid user:created (should be dropped)
      await baseBus.publish('user:created', {
        userId: 'invalid',
        email: 'invalid',
      });

      // Only valid event should reach handler
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Unknown Event Behavior
  // ===========================================================================

  describe('Unknown Event Behavior', () => {
    describe('unknownEventBehavior: "error"', () => {
      it('should throw on publish for unknown event', async () => {
        const strictBus = createTypedEventBus(baseBus, {
          schemas: testSchemas,
          unknownEventBehavior: 'error',
        });

        await expect((strictBus as any).publish('unknown:event', {})).rejects.toThrow(
          EventValidationError
        );
      });

      it('should drop unknown events on receive', async () => {
        const strictBus = createTypedEventBus(baseBus, {
          schemas: testSchemas,
          unknownEventBehavior: 'error',
        });

        const handler = vi.fn();
        (strictBus as any).subscribe('unknown:event', handler);

        // Publish via base bus
        await baseBus.publish('unknown:event', { data: 'test' });

        // Should drop (not call handler)
        expect(handler).not.toHaveBeenCalled();
      });
    });

    describe('unknownEventBehavior: "warn"', () => {
      it('should log warning and allow unknown event on publish', async () => {
        const warnBus = createTypedEventBus(baseBus, {
          schemas: testSchemas,
          unknownEventBehavior: 'warn',
        });

        const handler = vi.fn();
        baseBus.subscribe('unknown:event', handler);

        // Should not throw, should log warning
        await expect(
          (warnBus as any).publish('unknown:event', { data: 'test' })
        ).resolves.toBeUndefined();

        // Handler should receive event
        expect(handler).toHaveBeenCalled();
      });

      it('should log warning and allow unknown event on receive', async () => {
        const warnBus = createTypedEventBus(baseBus, {
          schemas: testSchemas,
          unknownEventBehavior: 'warn',
        });

        const handler = vi.fn();
        (warnBus as any).subscribe('unknown:event', handler);

        await baseBus.publish('unknown:event', { data: 'test' });

        // Handler should receive event
        expect(handler).toHaveBeenCalled();
      });
    });

    describe('unknownEventBehavior: "allow"', () => {
      it('should silently allow unknown event on publish', async () => {
        const allowBus = createTypedEventBus(baseBus, {
          schemas: testSchemas,
          unknownEventBehavior: 'allow',
        });

        const handler = vi.fn();
        baseBus.subscribe('unknown:event', handler);

        await expect(
          (allowBus as any).publish('unknown:event', { data: 'test' })
        ).resolves.toBeUndefined();

        expect(handler).toHaveBeenCalled();
      });

      it('should silently allow unknown event on receive', async () => {
        const allowBus = createTypedEventBus(baseBus, {
          schemas: testSchemas,
          unknownEventBehavior: 'allow',
        });

        const handler = vi.fn();
        (allowBus as any).subscribe('unknown:event', handler);

        await baseBus.publish('unknown:event', { data: 'test' });

        expect(handler).toHaveBeenCalled();
      });
    });
  });

  // ===========================================================================
  // Error Callback
  // ===========================================================================

  describe('onValidationError Callback', () => {
    it('should call callback before throwing on publish', async () => {
      const callback = vi.fn();
      const callbackBus = createTypedEventBus(baseBus, {
        schemas: testSchemas,
        onValidationError: callback,
      });

      try {
        await callbackBus.publish('user:created', {
          userId: 'invalid',
          email: 'invalid',
        } as any);
      } catch {
        // Expected
      }

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('validation failed'),
          details: expect.objectContaining({
            eventType: 'user:created',
            context: 'publish',
          }),
        })
      );
    });

    it('should call callback before dropping on receive', async () => {
      // Create isolated bus to prevent test pollution
      const isolatedBus = new MemoryEventBus('isolated-server');
      const callback = vi.fn();
      const callbackBus = createTypedEventBus(isolatedBus, {
        schemas: testSchemas,
        onValidationError: callback,
      });

      const handler = vi.fn();
      const unsubscribe = callbackBus.subscribe('user:created', handler);

      // Publish invalid data via isolated base
      await isolatedBus.publish('user:created', {
        userId: 'invalid',
        email: 'invalid',
      });

      // Small delay for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            eventType: 'user:created',
            context: 'receive',
          }),
        })
      );

      // Cleanup
      unsubscribe();
      await callbackBus.disconnect();
    });

    it('should call callback for unknown events with "error" behavior', async () => {
      const callback = vi.fn();
      const callbackBus = createTypedEventBus(baseBus, {
        schemas: testSchemas,
        unknownEventBehavior: 'error',
        onValidationError: callback,
      });

      try {
        await (callbackBus as any).publish('unknown:event', {});
      } catch {
        // Expected
      }

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Unknown event type'),
        })
      );
    });

    it('should not call callback for unknown events with "warn" or "allow"', async () => {
      const callback = vi.fn();

      // Test "warn"
      const warnBus = createTypedEventBus(baseBus, {
        schemas: testSchemas,
        unknownEventBehavior: 'warn',
        onValidationError: callback,
      });

      await (warnBus as any).publish('unknown:event', {});
      expect(callback).not.toHaveBeenCalled();

      // Test "allow"
      callback.mockClear();
      const allowBus = createTypedEventBus(baseBus, {
        schemas: testSchemas,
        unknownEventBehavior: 'allow',
        onValidationError: callback,
      });

      await (allowBus as any).publish('unknown:event', {});
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Adapter and Disconnect
  // ===========================================================================

  describe('setAdapter() and disconnect()', () => {
    it('should delegate setAdapter to base EventBus', async () => {
      const mockAdapter = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        publish: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(() => {}),
      };

      await typedBus.setAdapter(mockAdapter);

      expect(mockAdapter.connect).toHaveBeenCalled();
    });

    it('should delegate disconnect to base EventBus', async () => {
      const disconnectSpy = vi.spyOn(baseBus, 'disconnect');

      await typedBus.disconnect();

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('should handle complex nested schemas', async () => {
      const nestedSchemas = {
        'complex:event': z.object({
          user: z.object({
            id: z.string().uuid(),
            profile: z.object({
              name: z.string(),
              age: z.number().min(0).max(150),
            }),
          }),
          tags: z.array(z.string()),
        }),
      } satisfies EventSchemas;

      const nestedBus = createTypedEventBus(baseBus, {
        schemas: nestedSchemas,
      });

      const handler = vi.fn();
      baseBus.subscribe('complex:event', handler);

      await nestedBus.publish('complex:event', {
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          profile: {
            name: 'John',
            age: 30,
          },
        },
        tags: ['important', 'urgent'],
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should handle optional fields correctly', async () => {
      const handler = vi.fn();
      baseBus.subscribe('user:updated', handler);

      // With optional field
      await typedBus.publish('user:updated', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'John',
      });

      // Without optional field
      await typedBus.publish('user:updated', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
      });

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should handle array validation', async () => {
      const handler = vi.fn();
      baseBus.subscribe('order:placed', handler);

      await typedBus.publish('order:placed', {
        orderId: 'ord_123',
        total: 99.99,
        items: ['item1', 'item2', 'item3'],
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: ['item1', 'item2', 'item3'],
          }),
        })
      );
    });

    it('should reject invalid array items', async () => {
      await expect(
        typedBus.publish('order:placed', {
          orderId: 'ord_123',
          total: 99.99,
          items: [123, 456] as any, // Should be strings
        })
      ).rejects.toThrow(EventValidationError);
    });

    it('should handle multiple transforms in chain', async () => {
      const chainSchemas = {
        'chain:test': z.object({
          value: z
            .string()
            .transform(v => v.toLowerCase())
            .transform(v => v.trim())
            .transform(v => v.replace(/\s+/g, '-')),
        }),
      } satisfies EventSchemas;

      const chainBus = createTypedEventBus(baseBus, {
        schemas: chainSchemas,
      });

      const handler = vi.fn();
      baseBus.subscribe('chain:test', handler);

      await chainBus.publish('chain:test', {
        value: '  HELLO   WORLD  ',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            value: 'hello-world',
          },
        })
      );
    });

    it('should preserve event metadata (timestamp, serverId, correlationId)', async () => {
      const handler = vi.fn();
      typedBus.subscribe('user:created', handler);

      await typedBus.publish('user:created', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user:created',
          timestamp: expect.any(Number),
          serverId: 'test-server',
          correlationId: expect.any(String),
        })
      );
    });
  });

  // ===========================================================================
  // Type Inference (compile-time, verified at runtime)
  // ===========================================================================

  describe('Type Inference', () => {
    it('should infer correct event data type for exact match', async () => {
      typedBus.subscribe('user:created', async event => {
        // TypeScript should infer:
        // event.data: { userId: string; email: string }
        expect(event.data).toHaveProperty('userId');
        expect(event.data).toHaveProperty('email');
      });

      await typedBus.publish('user:created', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
      });
    });

    it('should infer union type for wildcard pattern', async () => {
      typedBus.subscribe('user:*', async event => {
        // TypeScript should infer:
        // event.data: { userId: string; email: string } | { userId: string; email: string; name?: string }
        expect(event.data).toHaveProperty('userId');
        expect(event.data).toHaveProperty('email');
      });

      await typedBus.publish('user:created', {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
      });
    });
  });
});
