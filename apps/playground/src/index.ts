import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Blaize } from 'blaizejs';

import { createSecurityMiddleware } from '@blaizejs/middleware-security';
import { createMetricsPlugin } from '@blaizejs/plugin-metrics';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create the metrics plugin
const metricsPlugin = createMetricsPlugin({
  enabled: true,
  excludePaths: ['/health', '/favicon.ico'], // Don't track health checks
  histogramLimit: 1000,
  collectionInterval: 60000, // Report every 60 seconds
  logToConsole: true, // See metrics in console during development
  maxCardinality: 10,
  onCardinalityLimit: 'warn',
  labels: {
    service: 'playground-app',
    environment: process.env.NODE_ENV || 'development',
  },
});

const securityMiddleware = createSecurityMiddleware();

export const server = Blaize.createServer({
  port: 7485,
  routesDir: path.resolve(__dirname, './routes'),
  http2: {
    enabled: true,
  },
  middleware: [securityMiddleware],
  plugins: [metricsPlugin],
});

try {
  console.log(path.resolve(__dirname, './routes'));
  // Create the server instance

  // Start the server
  server.listen();

  // Handle process termination signals
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, async () => {
      console.log(`🔥 Received ${signal}, shutting down server...`);
      try {
        await server.close();
        console.log('🚪 Server shutdown completed, exiting.');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    });
  });
} catch (err) {
  console.error('❌ Error:', err);
}
