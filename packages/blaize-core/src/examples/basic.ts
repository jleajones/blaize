/**
 * Basic BlaizeJS Server Example
 *
 * This is a minimal example showing how to create and start a BlaizeJS server.
 * Currently, it will throw an error since the implementation is not complete.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Blaize, type InferContext } from '../index';
import { loggerMiddleware } from './sample-middleware';
import { createMetricsPlugin } from './sample-plugin';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const routesDir = path.resolve(__dirname, './router/');

/**
 * Logger middleware - adds request ID and logging service
 */
const logger = loggerMiddleware({
  prefix: '[API]',
  logRequests: true,
  logResponses: true,
});

/**
 * Metrics plugin - adds metrics tracking
 */
const metricsPlugin = createMetricsPlugin({
  enabled: true,
  logToConsole: process.env.NODE_ENV === 'development',
  reportInterval: 30000,
});

console.log(`BlaizeJS version: ${Blaize.VERSION}`);

const app = Blaize.createServer({
  port: 3000,
  host: 'localhost',
  cors: {
    origin: ['https://localhost:3000/*'],
  },
  routesDir,
  middleware: [logger],
  plugins: [metricsPlugin],
});

type AppContext = InferContext<typeof app>;
export const appRouter = Blaize.Router.createRouteFactory<
  AppContext['state'],
  AppContext['services']
>();

try {
  // Start the server
  await app.listen();
} catch (err) {
  console.error('Error:', err);
}
