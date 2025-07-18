import { createContext } from '../context/create';
import { runWithContext } from '../context/store';
import { compose } from '../middleware/compose';

import type { RequestHandler, Server } from '../index';

export function createRequestHandler(serverInstance: Server): RequestHandler {
  return async (req, res) => {
    try {
      // Create context for this request
      const context = await createContext(req, res, {
        parseBody: true, // Enable automatic body parsing
      });

      // Compose all middleware into a single function
      const handler = compose(serverInstance.middleware);

      // Run the request with context in AsyncLocalStorage
      await runWithContext(context, async () => {
        try {
          // Execute the middleware chain
          await handler(context, async () => {
            if (!context.response.sent) {
              // Let the router handle the request
              await serverInstance.router.handleRequest(context);
              // If router didn't handle it either, send a 404
              if (!context.response.sent) {
                context.response.status(404).json({
                  error: 'Not Found',
                  message: `Route not found: ${context.request.method} ${context.request.path}`,
                });
              }
            }
          });
        } catch (error) {
          // Handle errors in middleware chain
          console.error('Error processing request:', error);

          // Only send error response if one hasn't been sent already
          if (!context.response.sent) {
            context.response.json(
              {
                error: 'Internal Server Error',
                message:
                  process.env.NODE_ENV === 'development'
                    ? error || 'Unknown error'
                    : 'An error occurred processing your request',
              },
              500
            );
          }
        }
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
