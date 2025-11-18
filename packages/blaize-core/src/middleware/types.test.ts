/**
 * Type-level tests for middleware types
 *
 * These tests verify that the type system works correctly at compile time.
 * They use Vitest's expectTypeOf to ensure types are properly defined.
 */

import type { Context } from '@blaize-types/context';
import type { BlaizeLogger } from '@blaize-types/logger';
import type {
  MiddlewareFunction,
  NextFunction,
  Middleware,
  MiddlewareOptions,
} from '@blaize-types/middleware';

describe('Middleware Types', () => {
  describe('MiddlewareFunction', () => {
    it('should accept 3 parameters: ctx, next, logger', () => {
      const middleware: MiddlewareFunction = (ctx, next, logger) => {
        expectTypeOf(ctx).toEqualTypeOf<Context>();
        expectTypeOf(next).toEqualTypeOf<NextFunction>();
        expectTypeOf(logger).toEqualTypeOf<BlaizeLogger>();
      };

      expectTypeOf(middleware).toEqualTypeOf<MiddlewareFunction>();
    });

    it('should return Promise<void> or void', () => {
      const asyncMiddleware: MiddlewareFunction = async (ctx, next, _logger) => {
        await next();
      };

      const syncMiddleware: MiddlewareFunction = (_ctx, _next, _logger) => {
        // sync
      };

      expectTypeOf(asyncMiddleware).toEqualTypeOf<MiddlewareFunction>();
      expectTypeOf(syncMiddleware).toEqualTypeOf<MiddlewareFunction>();
    });

    it('should not accept incorrect parameter types', () => {
      // @ts-expect-error - Wrong parameter types
      const _incorrectTypes: MiddlewareFunction = (
        _ctx: string,
        _next: string,
        _logger: string
      ) => {
        // All wrong types
      };
    });
  });

  describe('NextFunction', () => {
    it('should be a function returning Promise<void> or void', () => {
      const next: NextFunction = async () => {};
      expectTypeOf(next).returns.toEqualTypeOf<Promise<void> | void>();
    });

    it('should not accept parameters', () => {
      // @ts-expect-error - Should not accept parameters
      const _nextWithParams: NextFunction = (_param: string) => {};
    });
  });

  describe('Middleware interface', () => {
    it('should have required properties', () => {
      const middleware: Middleware = {
        name: 'test',
        execute: (_ctx, _next, _logger) => {},
        debug: false,
      };

      expectTypeOf(middleware.name).toEqualTypeOf<string>();
      expectTypeOf(middleware.execute).toEqualTypeOf<MiddlewareFunction>();
      expectTypeOf(middleware.debug).toEqualTypeOf<boolean | undefined>();
    });

    it('should have optional skip function', () => {
      const middleware: Middleware = {
        name: 'test',
        execute: (_ctx, _next, _logger) => {},
        debug: false,
        skip: ctx => ctx.request.method === 'GET',
      };

      expectTypeOf(middleware.skip).toEqualTypeOf<((ctx: Context) => boolean) | undefined>();
    });

    it('should support generic state and services', () => {
      type CustomState = { userId: string };
      type CustomServices = { db: { query: () => void } };

      const middleware: Middleware<CustomState, CustomServices> = {
        name: 'test',
        execute: (_ctx, _next, _logger) => {},
        debug: false,
      };

      expectTypeOf(middleware._state).toEqualTypeOf<CustomState | undefined>();
      expectTypeOf(middleware._services).toEqualTypeOf<CustomServices | undefined>();
    });
  });

  describe('MiddlewareOptions interface', () => {
    it('should require handler function', () => {
      const options: MiddlewareOptions = {
        handler: (_ctx, _next, _logger) => {},
      };
      expectTypeOf(options.handler).toEqualTypeOf<MiddlewareFunction>();
    });
    it('should have optional properties', () => {
      const options: MiddlewareOptions = {
        name: 'test',
        handler: (_ctx, _next, _logger) => {},
        skip: _ctx => false,
        debug: true,
      };

      expectTypeOf(options).toHaveProperty('handler');
      expectTypeOf(options).toHaveProperty('name');
      expectTypeOf(options).toHaveProperty('skip');
      expectTypeOf(options).toHaveProperty('debug');
    });

    it('should allow optional properties to be omitted', () => {
      const minimalOptions: MiddlewareOptions = {
        handler: (_ctx, _next, _logger) => {},
      };
      expectTypeOf(minimalOptions).toBeObject();
      expectTypeOf(minimalOptions.handler).toEqualTypeOf<MiddlewareFunction>();
    });
  });
});
