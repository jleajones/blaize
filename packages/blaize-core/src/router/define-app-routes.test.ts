// tests/define-app-routes.test.ts
import { z } from 'zod';

import { createGetRoute, createPostRoute, defineAppRoutes } from '.';

describe('defineAppRoutes - Client Generation Types', () => {
  // Test routes with schemas
  const getUserRoute = createGetRoute({
    schema: {
      params: z.object({
        id: z.string(),
      }),
      query: z.object({
        includeDetails: z.boolean().optional(),
      }),
      response: z.object({
        message: z.string(),
        id: z.string(),
      }),
    },
    handler: async (_ctx, params) => {
      return {
        message: `Hello ${params.id}`,
        id: params.id,
      };
    },
  });

  const createUserRoute = createPostRoute({
    schema: {
      params: z.object({
        orgId: z.string(),
      }),
      body: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
      response: z.object({
        success: z.boolean(),
        userId: z.string(),
      }),
    },
    handler: async (_ctx, _params) => {
      return {
        success: true,
        userId: 'new-user-id',
      };
    },
  });

  // Simple route without schema
  const simpleRoute = createGetRoute({
    handler: async (_ctx, _params) => {
      return { message: 'Hello World' };
    },
  });

  describe('Runtime Behavior', () => {
    it('should return the routes object unchanged', () => {
      const routes = {
        getUser: getUserRoute,
        createUser: createUserRoute,
        simple: simpleRoute,
      };

      const result = defineAppRoutes(routes);

      // Should return the same object reference (for now)
      expect(result).toBe(routes);
    });
  });

  describe('Client Function Generation Types', () => {
    it('should generate correct client function for GET route with schema', () => {
      const _appRoutes = defineAppRoutes({
        getUser: getUserRoute,
      });

      type AppRoutes = typeof _appRoutes;
      type GetUserClient = AppRoutes['getUser']['GET'];

      // Should be a function
      expectTypeOf<GetUserClient>().toBeFunction();

      // Should accept correct parameters
      expectTypeOf<GetUserClient>().parameter(0).toMatchTypeOf<{
        params: { id: string };
        query?: { includeDetails?: boolean };
      }>();

      // Should return correct response type
      expectTypeOf<GetUserClient>().returns.toEqualTypeOf<
        Promise<{
          message: string;
          id: string;
        }>
      >();
    });

    it('should generate correct client function for POST route with body', () => {
      const _appRoutes = defineAppRoutes({
        createUser: createUserRoute,
      });

      type AppRoutes = typeof _appRoutes;
      type CreateUserClient = AppRoutes['createUser']['POST'];

      // Should be a function
      expectTypeOf<CreateUserClient>().toBeFunction();

      // Should accept params and body
      expectTypeOf<CreateUserClient>().parameter(0).toMatchTypeOf<{
        params: { orgId: string };
        body: { name: string; email: string };
      }>();

      // Should return correct response type
      expectTypeOf<CreateUserClient>().returns.toEqualTypeOf<
        Promise<{
          success: boolean;
          userId: string;
        }>
      >();
    });

    it('should handle routes without schemas correctly', () => {
      const _appRoutes = defineAppRoutes({
        simple: simpleRoute,
      });

      type AppRoutes = typeof _appRoutes;
      type SimpleClient = AppRoutes['simple']['GET'];

      // Should be a function
      expectTypeOf<SimpleClient>().toBeFunction();

      // Should accept no parameters or optional empty args
      expectTypeOf<SimpleClient>()
        .parameter(0)
        .toEqualTypeOf<{ params: any; body: never; query: any }>();

      // Should return Promise<unknown>
      expectTypeOf<SimpleClient>().returns.toEqualTypeOf<Promise<any>>();
    });

    it('should generate complete client API for multiple routes', () => {
      const _appRoutes = defineAppRoutes({
        getUser: getUserRoute,
        createUser: createUserRoute,
        simple: simpleRoute,
      });

      type AppRoutes = typeof _appRoutes;

      // Should have all routes
      expectTypeOf<AppRoutes>().toHaveProperty('getUser');
      expectTypeOf<AppRoutes>().toHaveProperty('createUser');
      expectTypeOf<AppRoutes>().toHaveProperty('simple');

      // Each route should have the correct methods
      expectTypeOf<AppRoutes['getUser']>().toHaveProperty('GET');
      expectTypeOf<AppRoutes['createUser']>().toHaveProperty('POST');
      expectTypeOf<AppRoutes['simple']>().toHaveProperty('GET');

      // All methods should be functions
      expectTypeOf<AppRoutes['getUser']['GET']>().toBeFunction();
      expectTypeOf<AppRoutes['createUser']['POST']>().toBeFunction();
      expectTypeOf<AppRoutes['simple']['GET']>().toBeFunction();
    });

    it('should generate client API that matches expected interface', () => {
      const _appRoutes = defineAppRoutes({
        getUser: getUserRoute,
        createUser: createUserRoute,
      });

      type AppRoutes = typeof _appRoutes;

      // Test the complete expected client API structure
      expectTypeOf<AppRoutes>().toMatchTypeOf<{
        getUser: {
          GET: (args: {
            params: { id: string };
            query: { includeDetails?: boolean | undefined };
            body: never;
          }) => Promise<{ message: string; id: string }>;
        };
        createUser: {
          POST: (args: {
            params: { orgId: string };
            body: { name: string; email: string };
            query: never;
          }) => Promise<{ success: boolean; userId: string }>;
        };
      }>();
    });
  });

  describe('Edge Cases', () => {
    it('should handle GET routes with only params', () => {
      const paramsOnlyRoute = createGetRoute({
        schema: {
          params: z.object({ id: z.string() }),
          response: z.object({ data: z.string() }),
        },
        handler: async (ctx, params) => ({ data: params.id }),
      });

      const _appRoutes = defineAppRoutes({
        paramsOnly: paramsOnlyRoute,
      });

      type ParamsOnlyClient = typeof _appRoutes.paramsOnly.GET;

      expectTypeOf<ParamsOnlyClient>().parameter(0).toMatchTypeOf<{
        params: { id: string };
      }>();

      expectTypeOf<ParamsOnlyClient>().returns.toEqualTypeOf<
        Promise<{
          data: string;
        }>
      >();
    });

    it('should handle POST routes with only body', () => {
      const bodyOnlyRoute = createPostRoute({
        schema: {
          body: z.object({ message: z.string() }),
          response: z.object({ success: z.boolean() }),
        },
        handler: async (_ctx, _params) => ({ success: true }),
      });

      const _appRoutes = defineAppRoutes({
        bodyOnly: bodyOnlyRoute,
      });

      type BodyOnlyClient = typeof _appRoutes.bodyOnly.POST;

      expectTypeOf<BodyOnlyClient>().parameter(0).toMatchTypeOf<{
        body: { message: string };
      }>();

      expectTypeOf<BodyOnlyClient>().returns.toEqualTypeOf<
        Promise<{
          success: boolean;
        }>
      >();
    });
  });
});
