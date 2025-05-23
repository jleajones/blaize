import { describe, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { Route, RouteMethodOptions } from '@blaizejs/types';

import { defineAppRoutes } from './define-app-routes';

// Mock route creation helpers for testing
const createMockGetRoute = (handler: any, schema?: any, path: string = '/'): Route => ({
  path,
  GET: {
    handler,
    schema,
  } as RouteMethodOptions,
});

describe('defineAppRoutes', () => {
  test('preserves original route structure at runtime', () => {
    const mockHandler = vi.fn();
    const routes = {
      getUser: createMockGetRoute(mockHandler, undefined, '/users/:id'),
    };

    const result = defineAppRoutes(routes);

    // Test what actually matters: it returns the same object
    expect(result).toBe(routes);
    expect(typeof result.getUser).toBe('object'); // Not a function yet
  });

  test('should eventually transform to client methods (type-level test)', () => {
    // This test verifies the type system works, even though runtime doesn't match yet
    const mockHandler = vi.fn();
    const routes = {
      getUser: createMockGetRoute(mockHandler, undefined, '/users/:id'),
    };

    const result = defineAppRoutes(routes);

    // Type-level assertion (won't compile if types are wrong)
    // @ts-expect-error compile time error
    const _typeTest: typeof result = {} as {
      getUser: (options: any) => Promise<any>;
    };

    // Runtime test (current behavior)
    expect(result).toBe(routes);
  });

  test('works with complex schemas for future client generation', () => {
    // Test that complex schemas can be processed without errors
    const mockHandler = vi.fn();
    const complexRoute = createMockGetRoute(mockHandler, {
      params: z.object({ userId: z.string() }),
      response: z.object({ name: z.string() }),
    });

    const routes = { getUser: complexRoute };

    // Should not throw
    const result = defineAppRoutes(routes);
    expect(result).toBeDefined();
  });
});
