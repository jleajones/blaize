/**
 * Type-level tests for router types
 *
 * These tests verify that the type system works correctly at compile time.
 * They use Vitest's expectTypeOf to ensure types are properly defined.
 */

import type { Context, QueryParams, RequestParams } from '@blaize-types/context';
import type { BlaizeLogger } from '@blaize-types/logger';
import type { RouteHandler, HttpMethod } from '@blaize-types/router';

describe('Router Types', () => {
  describe('RouteHandler', () => {
    it('should accept 3 parameters: ctx, params, logger', () => {
      const handler: RouteHandler = (ctx, params, logger) => {
        expectTypeOf(ctx).toEqualTypeOf<Context>();
        expectTypeOf(params).toEqualTypeOf<Record<string, string>>();
        expectTypeOf(logger).toEqualTypeOf<BlaizeLogger>();
        return {};
      };

      expectTypeOf(handler).toEqualTypeOf<RouteHandler>();
    });

    it('should return Promise<TResponse> or TResponse', () => {
      type UserResponse = { user: { id: string; name: string } };

      const asyncHandler: RouteHandler<any, any, any, UserResponse> = async (
        _ctx,
        _params,
        _logger
      ) => {
        return { user: { id: '1', name: 'Test' } };
      };

      const syncHandler: RouteHandler<any, any, any, UserResponse> = (_ctx, _params, _logger) => {
        return { user: { id: '1', name: 'Test' } };
      };

      expectTypeOf(asyncHandler).toEqualTypeOf<RouteHandler<any, any, any, UserResponse>>();
      expectTypeOf(syncHandler).toEqualTypeOf<RouteHandler<any, any, any, UserResponse>>();
    });

    it('should support typed parameters', () => {
      type UserParams = { userId: string };
      type UserQuery = { include?: string };
      type UserBody = { name: string; email: string };
      type UserResponse = { user: { id: string; name: string; email: string } };

      const handler: RouteHandler<UserParams, UserQuery, UserBody, UserResponse> = (
        ctx,
        params,
        _logger
      ) => {
        expectTypeOf(params).toEqualTypeOf<UserParams>();
        expectTypeOf(params.userId).toEqualTypeOf<string>();

        return {
          user: {
            id: params.userId,
            name: ctx.request.body.name,
            email: ctx.request.body.email,
          },
        };
      };

      expectTypeOf(handler).toEqualTypeOf<
        RouteHandler<UserParams, UserQuery, UserBody, UserResponse>
      >();
    });

    it('should support accumulated state and services', () => {
      type CustomState = { userId: string; sessionId: string };
      type CustomServices = { db: { query: () => void }; cache: { get: () => void } };

      const handler: RouteHandler<any, any, any, any, CustomState, CustomServices> = (
        ctx,
        _params,
        _logger
      ) => {
        expectTypeOf(ctx.state).toEqualTypeOf<CustomState>();
        expectTypeOf(ctx.services).toEqualTypeOf<CustomServices>();

        return { success: true };
      };

      expectTypeOf(handler).toEqualTypeOf<
        RouteHandler<any, any, any, any, CustomState, CustomServices>
      >();
    });

    it('should not accept incorrect parameter types', () => {
      // @ts-expect-error - Wrong parameter types
      const _incorrectTypes: RouteHandler = (_ctx: string, _params: number, _logger: boolean) => {
        return {};
      };
    });
  });

  describe('HttpMethod', () => {
    it('should accept all standard HTTP methods', () => {
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

      methods.forEach(method => {
        expectTypeOf(method).toEqualTypeOf<HttpMethod>();
      });
    });

    it('should be a string literal union', () => {
      expectTypeOf<HttpMethod>().toBeString();
    });

    it('should only allow specific method names', () => {
      expectTypeOf<HttpMethod>().toEqualTypeOf<
        'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
      >();
    });

    it('should not accept arbitrary strings', () => {
      // @ts-expect-error - Not a valid HTTP method
      const _invalid: HttpMethod = 'INVALID';
    });
  });

  describe('RequestParams', () => {
    it('should be a record of string to string', () => {
      const params: RequestParams = {
        userId: '123',
        postId: '456',
      };

      expectTypeOf(params).toEqualTypeOf<Record<string, string>>();
    });

    it('should not accept non-string values', () => {
      // @ts-expect-error - Values must be strings
      const _invalid: RouteParams = {
        userId: 123,
      };
    });
  });

  describe('QueryParams', () => {
    it('should support string values', () => {
      const query: QueryParams = {
        search: 'test',
        limit: '10',
      };

      expectTypeOf(query).toEqualTypeOf<Record<string, string | string[] | undefined>>();
    });

    it('should support string array values', () => {
      const query: QueryParams = {
        tags: ['javascript', 'typescript'],
        ids: ['1', '2', '3'],
      };

      expectTypeOf(query).toEqualTypeOf<Record<string, string | string[] | undefined>>();
    });

    it('should support undefined values', () => {
      const query: QueryParams = {
        optional: undefined,
        search: 'test',
      };

      expectTypeOf(query).toEqualTypeOf<Record<string, string | string[] | undefined>>();
    });

    it('should not accept non-string, non-array values', () => {
      const _invalid: QueryParams = {
        // @ts-expect-error - Values must be string, string[], or undefined
        count: 123,
      };
    });
  });

  describe('Type exports', () => {
    it('should export all types', () => {
      expectTypeOf<RouteHandler>().not.toBeAny();
      expectTypeOf<HttpMethod>().not.toBeAny();
      expectTypeOf<RequestParams>().not.toBeAny();
      expectTypeOf<QueryParams>().not.toBeAny();
    });
  });
});
