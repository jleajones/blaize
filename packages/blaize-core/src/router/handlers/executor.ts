import { compose } from '../../middleware/compose';
import { createRequestValidator, createResponseValidator } from '../validation';

import type { Context } from '@blaize-types/context';
import type { BlaizeLogger } from '@blaize-types/logger';
import type { RouteMethodOptions } from '@blaize-types/router';

/**
 * Execute a route handler with its middleware
 */
export async function executeHandler(
  ctx: Context,
  routeOptions: RouteMethodOptions,
  params: Record<string, string>,
  baseLogger: BlaizeLogger
): Promise<void> {
  // Set up middleware chain
  const middleware = [...(routeOptions.middleware || [])];

  // Add validation middleware if schemas are defined
  if (routeOptions.schema) {
    if (routeOptions.schema.params || routeOptions.schema.query || routeOptions.schema.body) {
      middleware.unshift(createRequestValidator(routeOptions.schema));
    }

    if (routeOptions.schema.response) {
      middleware.push(createResponseValidator(routeOptions.schema.response));
    }
  }

  // Compose middleware with the final handler
  const handler = compose([...middleware]);

  // Execute the middleware chain
  await handler(
    ctx,
    async () => {
      const routeLogger = baseLogger.child({
        route: ctx.request.path,
        method: ctx.request.method,
      });
      // Execute the handler with the new argument style
      const result = await routeOptions.handler(ctx, params, routeLogger);

      // Handle the result if it wasn't already handled by the handler
      if (!ctx.response.sent && result !== undefined) {
        ctx.response.json(result);
      }
    },
    baseLogger
  );
}
