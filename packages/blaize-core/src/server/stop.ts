import type { StopOptions, UnknownServer } from '@blaize-types/server';

// Add a global flag to prevent multiple shutdowns
let isShuttingDown = false;

// Replace the stopServer function in stop.ts with this version:

export async function stopServer(
  serverInstance: UnknownServer,
  options: StopOptions = {}
): Promise<void> {
  const server = serverInstance.server;
  const events = serverInstance.events;

  if (isShuttingDown) {
    console.log('⚠️ Shutdown already in progress, ignoring duplicate shutdown request');
    return;
  }

  if (!server) {
    return;
  }

  isShuttingDown = true;
  const timeout = options.timeout || 5000; // Reduced to 5 seconds for faster restarts

  try {
    if (options.onStopping) {
      await options.onStopping();
    }

    events.emit('stopping');

    // Close router watchers with timeout
    if (serverInstance.router && typeof serverInstance.router.close === 'function') {
      console.log('🔌 Closing router watchers...');
      try {
        // Add timeout to router close
        await Promise.race([
          serverInstance.router.close(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Router close timeout')), 2000)
          ),
        ]);
        console.log('✅ Router watchers closed');
      } catch (error) {
        console.error('❌ Error closing router watchers:', error);
        // Continue with shutdown
      }
    }

    // Notify plugins with timeout
    try {
      await Promise.race([
        serverInstance.pluginManager.onServerStop(serverInstance, server),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Plugin stop timeout')), 2000)
        ),
      ]);
    } catch (error) {
      console.error('❌ Plugin stop timeout:', error);
      // Continue with shutdown
    }

    // 🆕 NEW: Disconnect EventBus
    if (serverInstance.eventBus) {
      console.log('🔌 Disconnecting EventBus...');
      try {
        await Promise.race([
          serverInstance.eventBus.disconnect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('EventBus disconnect timeout')), 2000)
          ),
        ]);
        console.log('✅ EventBus disconnected');
      } catch (error) {
        console.error('❌ Error disconnecting EventBus:', error);
        // Continue with shutdown - don't fail
      }
    }

    // Create server close promise with shorter timeout
    const closePromise = new Promise<void>((resolve, reject) => {
      server.close((err?: Error) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Server shutdown timeout'));
      }, timeout);
    });

    await Promise.race([closePromise, timeoutPromise]);

    // Terminate plugins with timeout
    try {
      await Promise.race([
        serverInstance.pluginManager.terminatePlugins(serverInstance),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Plugin terminate timeout')), 1000)
        ),
      ]);
    } catch (error) {
      console.error('❌ Plugin terminate timeout:', error);
      // Continue with shutdown
    }

    if (options.onStopped) {
      await options.onStopped();
    }

    events.emit('stopped');
    serverInstance.server = null as any;

    console.log('✅ Graceful shutdown completed');
    isShuttingDown = false;
  } catch (error) {
    isShuttingDown = false;
    console.error('⚠️ Shutdown error (forcing exit):', error);

    // Force close the server if graceful shutdown fails
    if (server && typeof server.close === 'function') {
      server.close();
    }

    // In development, force exit to allow tsx to restart
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Forcing exit for development restart...');
      process.exit(0);
    }

    events.emit('error', error);
    throw error;
  }
}

/**
 * Register signal handlers for graceful shutdown
 */
export function registerSignalHandlers(stopFn: () => Promise<void>): { unregister: () => void } {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (isDevelopment) {
    // Development: Force exit for fast restarts
    const sigintHandler = () => {
      console.log('📤 SIGINT received, forcing exit for development restart...');
      process.exit(0);
    };

    const sigtermHandler = () => {
      console.log('📤 SIGTERM received, forcing exit for development restart...');
      process.exit(0);
    };

    process.on('SIGINT', sigintHandler);
    process.on('SIGTERM', sigtermHandler);

    return {
      unregister: () => {
        process.removeListener('SIGINT', sigintHandler);
        process.removeListener('SIGTERM', sigtermHandler);
      },
    };
  } else {
    // Production: Graceful shutdown
    const sigintHandler = () => {
      console.log('📤 SIGINT received, starting graceful shutdown...');
      stopFn().catch(console.error);
    };

    const sigtermHandler = () => {
      console.log('📤 SIGTERM received, starting graceful shutdown...');
      stopFn().catch(console.error);
    };

    process.on('SIGINT', sigintHandler);
    process.on('SIGTERM', sigtermHandler);

    return {
      unregister: () => {
        process.removeListener('SIGINT', sigintHandler);
        process.removeListener('SIGTERM', sigtermHandler);
      },
    };
  }
}
