import { createContext } from '../context/create';
import { runWithContext } from '../context/store';
import { NotFoundError } from '../errors/not-found-error';
import { compose } from '../middleware/compose';
import { createErrorBoundary } from '../middleware/error-boundary';

import type { Server, RequestHandler } from '@blaize-types/server';

export function createRequestHandler(serverInstance: Server): RequestHandler {
  return async (req, res) => {
    try {
      // Create context for this request
      const context = await createContext(req, res, {
        parseBody: true, // Enable automatic body parsing
      });

      // Create error boundary middleware that catches all thrown error classes
      const errorBoundary = createErrorBoundary();

      // Compose all middleware with error boundary first (to catch all errors)
      const allMiddleware = [errorBoundary, ...serverInstance.middleware];

      // Compose all middleware into a single function
      const handler = compose(allMiddleware);

      // Run the request with context in AsyncLocalStorage
      await runWithContext(context, async () => {
        await handler(context, async () => {
          if (!context.response.sent) {
            // Let the router handle the request
            await serverInstance.router.handleRequest(context);
            // If router didn't handle it either, send a 404
            if (!context.response.sent) {
              throw new NotFoundError(
                `Route not found: ${context.request.method} ${context.request.path}`
              );
            }
          }
        });
      });
    } catch (error) {
      // Handle errors in context creation
      console.error('Error creating context:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Internal Server Error',
          message: 'Failed to process request',
        })
      );
    }
  };
}
