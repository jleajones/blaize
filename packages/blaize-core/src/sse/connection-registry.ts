/**
 * Internal SSE Connection Registry
 *
 * This module is INTERNAL ONLY and not exposed in the public API.
 * It manages active SSE connections, enforces limits, and handles cleanup.
 * The registry is created lazily on first SSE route initialization.
 *
 */

import type { ConnectionEntry, ConnectionRegistry, RegistryConfig } from '@blaize-types/sse';

/**
 *
 * Default configuration values
 *
 */
const DEFAULT_CONFIG: Required<RegistryConfig> = {
  maxConnections: 10000,
  maxConnectionsPerClient: 100,
  inactiveTimeout: 30 * 60 * 1000, // 30 minutes
  cleanupInterval: 60 * 1000, // 1 minute
};

/**
 * Creates a connection registry using functional patterns with closure-based state
 * @internal
 */
function createConnectionRegistry(config?: RegistryConfig): ConnectionRegistry {
  // Merge with defaults
  const settings = { ...DEFAULT_CONFIG, ...config };

  // Private state using closure
  const connections = new Map<string, ConnectionEntry>();
  const clientConnectionCounts = new Map<string, number>();
  let cleanupTimer: NodeJS.Timeout | null = null;

  // Create the registry object first so we can reference its methods
  const registry: ConnectionRegistry = {} as ConnectionRegistry;

  /**
   * Start periodic cleanup if not already running
   */
  const startCleanupTimer = (cleanupFn: () => void): void => {
    if (!cleanupTimer && settings.cleanupInterval > 0) {
      cleanupTimer = setInterval(() => {
        cleanupFn();
      }, settings.cleanupInterval);

      // Ensure cleanup timer doesn't prevent process exit
      if (cleanupTimer.unref) {
        cleanupTimer.unref();
      }
    }
  };

  /**
   * Stop the cleanup timer
   */
  const stopCleanupTimer = (): void => {
    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  };

  /**
   * Update client connection count
   */
  const updateClientCount = (clientIp: string | undefined, delta: number): void => {
    if (!clientIp) return;

    const current = clientConnectionCounts.get(clientIp) || 0;
    const newCount = current + delta;

    if (newCount <= 0) {
      clientConnectionCounts.delete(clientIp);
    } else {
      clientConnectionCounts.set(clientIp, newCount);
    }
  };

  /**
   * Add a connection to the registry
   * @throws {Error} If connection ID already exists or limits exceeded
   */
  const add: ConnectionRegistry['add'] = (id, stream, metadata) => {
    // Check if ID already exists
    if (connections.has(id)) {
      throw new Error(`Connection with ID ${id} already exists`);
    }

    // Check total connection limit
    if (connections.size >= settings.maxConnections) {
      throw new Error(`Maximum connection limit reached (${settings.maxConnections})`);
    }

    // Check per-client limit
    if (metadata?.clientIp) {
      const clientCount = clientConnectionCounts.get(metadata.clientIp) || 0;
      if (clientCount >= settings.maxConnectionsPerClient) {
        throw new Error(
          `Maximum connections per client reached (${settings.maxConnectionsPerClient})`
        );
      }
    }

    // Add the connection
    const now = Date.now();
    connections.set(id, {
      stream,
      connectedAt: now,
      lastActivity: now,
      clientIp: metadata?.clientIp,
      userAgent: metadata?.userAgent,
    });

    // Update client count
    updateClientCount(metadata?.clientIp, 1);

    // Start cleanup timer on first connection
    if (connections.size === 1) {
      startCleanupTimer(registry.cleanup);
    }

    // Register cleanup callback on stream close
    stream.onClose(() => {
      remove(id);
    });
  };

  /**
   * Remove a connection from the registry
   */
  const remove: ConnectionRegistry['remove'] = id => {
    const entry = connections.get(id);
    if (!entry) return;

    // Remove from registry
    connections.delete(id);

    // Update client count
    updateClientCount(entry.clientIp, -1);

    // Stop cleanup timer if no connections
    if (connections.size === 0) {
      stopCleanupTimer();
    }
  };

  /**
   * Get current connection count
   */
  const count: ConnectionRegistry['count'] = () => {
    return connections.size;
  };

  /**
   * Clean up inactive or closed connections
   */
  const cleanup: ConnectionRegistry['cleanup'] = () => {
    const now = Date.now();
    const idsToRemove: string[] = [];

    connections.forEach((entry, id) => {
      // Check if connection is inactive
      const isInactive = now - entry.lastActivity > settings.inactiveTimeout;

      // Check if stream is closed (assuming SSEStream has an isWritable property)
      // Since we don't have the actual implementation yet, we'll check if the stream
      // has been explicitly closed by checking a hypothetical state
      const isClosed =
        !entry.stream ||
        (entry.stream as any).state === 'closed' ||
        !(entry.stream as any).isWritable;

      if (isInactive || isClosed) {
        idsToRemove.push(id);

        // Close the stream if it's still open
        if (entry.stream && typeof entry.stream.close === 'function') {
          try {
            entry.stream.close();
          } catch {
            // Ignore errors during cleanup
          }
        }
      }
    });

    // Remove marked connections
    idsToRemove.forEach(id => remove(id));
  };

  /**
   * Get a connection by ID
   */
  const get: ConnectionRegistry['get'] = id => {
    const entry = connections.get(id);
    return entry?.stream;
  };

  /**
   * Check if a connection exists
   */
  const has: ConnectionRegistry['has'] = id => {
    return connections.has(id);
  };

  /**
   * Get all connection IDs
   */
  const getIds: ConnectionRegistry['getIds'] = () => {
    return Array.from(connections.keys());
  };

  /**
   * Shutdown the registry and close all connections
   */
  const shutdown: ConnectionRegistry['shutdown'] = () => {
    // Stop cleanup timer
    stopCleanupTimer();

    // Close all connections
    connections.forEach(entry => {
      if (entry.stream && typeof entry.stream.close === 'function') {
        try {
          entry.stream.close();
        } catch {
          // Ignore errors during shutdown
        }
      }
    });

    // Clear all state
    connections.clear();
    clientConnectionCounts.clear();
  };

  // Assign methods to the registry object
  registry.add = add;
  registry.remove = remove;
  registry.count = count;
  registry.cleanup = cleanup;
  registry.get = get;
  registry.has = has;
  registry.getIds = getIds;
  registry.shutdown = shutdown;

  // Return the registry interface
  return registry;
}

/**
 *
 * Singleton instance holder using closure
 *
 */
let registryInstance: ConnectionRegistry | null = null;

/**
 * Get or create the singleton registry instance (lazy initialization)
 * This is the only function that should be used by other SSE modules
 *
 * @param config - Optional configuration (only used on first initialization)
 * @returns The singleton connection registry
 */
export function getConnectionRegistry(config?: RegistryConfig): ConnectionRegistry {
  if (!registryInstance) {
    registryInstance = createConnectionRegistry(config);
  }
  return registryInstance;
}

/**
 *
 * Reset the singleton instance (for testing purposes only)
 *
 */
export function resetRegistry(): void {
  if (registryInstance) {
    registryInstance.shutdown();
    registryInstance = null;
  }
}
