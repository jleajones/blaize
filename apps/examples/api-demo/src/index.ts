import path from 'node:path';

import { Blaize } from 'blaizejs';
import { server } from './server';

Blaize.logger.info('✅ EventBus Redis adapter configured');

try {
  // Start the server
  await server.listen();

  Blaize.logger.info('🚀 API Demo server ready!');
  Blaize.logger.info('');
  Blaize.logger.info('📖 Try these demos:');
  Blaize.logger.info('   Root: GET  http://localhost:7485');
  Blaize.logger.info('   Health: GET  http://localhost:7485/health');
  Blaize.logger.info('   Users: GET  http://localhost:7485/users');
  Blaize.logger.info('   Create User: POST  http://localhost:7485/users');
  Blaize.logger.info('   Get User by ID: GET  http://localhost:7485/users/:id');
  Blaize.logger.info('   SSE Time: GET  http://localhost:7485/sse/time');
  Blaize.logger.info('');

  // Handle process termination signals
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, async () => {
      Blaize.logger.info(`🔥 Received ${signal}, shutting down server...`);
      try {
        await server.close();
        Blaize.logger.info('🚪 Server shutdown completed, exiting.');
        process.exit(0);
      } catch (error) {
        Blaize.logger.error('❌ Error during shutdown:', { error });
        process.exit(1);
      }
    });
  });
} catch (err) {
  Blaize.logger.error('❌ Error:', { error: err });
}
