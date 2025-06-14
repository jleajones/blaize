import type { Server, StopOptions } from '../index';

export async function stopServer(serverInstance: Server, options: StopOptions = {}): Promise<void> {
  // Get the HTTP server from the server instance
  const server = serverInstance.server;
  const events = serverInstance.events;

  // If no server is running, do nothing
  if (!server) {
    return;
  }

  const timeout = options.timeout || 30000; // 30 seconds default

  try {
    // Execute pre-stop hook if provided
    if (options.onStopping) {
      await options.onStopping();
    }

    // Emit stopping event
    events.emit('stopping');

    // Notify plugins that server is stopping
    await serverInstance.pluginManager.onServerStop(serverInstance, server);

    // Set a timeout to ensure we don't wait forever
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Server shutdown timed out waiting for requests to complete'));
      }, timeout);
    });

    // Create server close promise
    const closePromise = new Promise<void>((resolve, reject) => {
      server.close((err?: Error) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    // Wait for server to close with timeout
    await Promise.race([closePromise, timeoutPromise]);

    // Use plugin lifecycle manager to terminate plugins
    await serverInstance.pluginManager.terminatePlugins(serverInstance);

    // Execute post-stop hook if provided
    if (options.onStopped) {
      await options.onStopped();
    }

    // Emit stopped event
    events.emit('stopped');

    // Clear server reference
    serverInstance.server = null as any;
  } catch (error) {
    // Emit error event and rethrow
    events.emit('error', error);
    throw error;
  }
}

/**
 * Register signal handlers for graceful shutdown
 */
export function registerSignalHandlers(stopFn: () => Promise<void>): { unregister: () => void } {
  // Create bound handler functions
  const sigintHandler = () => stopFn().catch(console.error);
  const sigtermHandler = () => stopFn().catch(console.error);

  // Register handlers
  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigtermHandler);

  // Return function to unregister handlers
  return {
    unregister: () => {
      process.removeListener('SIGINT', sigintHandler);
      process.removeListener('SIGTERM', sigtermHandler);
    },
  };
}
