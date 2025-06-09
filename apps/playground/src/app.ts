import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Blaize from 'blaizejs';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
try {
  console.log('🚀 Starting Blaize server...');
  console.log(path.resolve(__dirname, './routes'));
  // Create the server instance
  const app = Blaize.createServer({
    port: 7485,
    routesDir: path.resolve(__dirname, './routes'),
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
