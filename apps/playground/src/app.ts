import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Blaize from 'blaizejs';

import bc from '@blaizejs/client';

import { routes } from './app-type.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
try {
  // Create the server instance
  const app = Blaize.createServer({
    port: 7485,
    routesDir: path.resolve(__dirname, '../src/routes'),
    http2: {
      enabled: true,
    },
  });

  // Start the server
  app.listen();

  // Handle process termination signals
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, async () => {
      console.log(`🔥 Received ${signal}, shutting down server...`);
      try {
        await app.close();
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

const c = bc.create('http://localhost:7485', routes);
const data = await c.$get.getHello();
console.log(data.message);
