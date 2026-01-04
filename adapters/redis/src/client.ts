/* eslint-disable promise/always-return */
/**
 * Redis Client Implementation
 *
 * Manages three separate Redis connections for different purposes:
 * - Main connection: For data operations (GET, SET, DEL, etc.)
 * - Publisher connection: For pub/sub publishing
 * - Subscriber connection: For pub/sub subscribing
 *
 * @module @blaizejs/adapter-redis/client
 * @since 0.1.0
 */

import { createLogger } from 'blaizejs';
import Redis, { type RedisOptions } from 'ioredis';
import { z } from 'zod';

import { RedisConnectionError } from './errors';

import type { RedisClientConfig, RedisClient } from './types';
import type { BlaizeLogger } from 'blaizejs';

/**
 * Zod schema for RedisConfig validation
 */
const RedisConfigSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().min(1).max(65535).optional().default(6379),
  password: z.string().optional(),
  db: z.number().int().min(0).optional().default(0),
  keyPrefix: z.string().optional(),
  connectTimeout: z.number().int().min(0).optional().default(10000),
  commandTimeout: z.number().int().min(0).optional().default(5000),
  maxRetriesPerRequest: z.number().int().min(0).optional().default(3),
  tls: z.boolean().optional().default(false),
  retryStrategy: z
    .custom<
      (times: number) => number | null
    >(val => typeof val === 'function', 'retryStrategy must be a function')
    .optional(),
  logger: z.any().optional(), // BlaizeLogger - can't validate with Zod
});

/**
 * Default retry strategy for Redis connections
 *
 * Implements exponential backoff with a maximum delay of 3 seconds.
 * Gives up after 10 retries.
 */
function defaultRetryStrategy(times: number): number | null {
  if (times > 10) {
    return null; // Give up after 10 retries
  }
  // Exponential backoff: min(100 * 2^times, 3000)
  return Math.min(100 * Math.pow(2, times), 3000);
}

/**
 * RedisClientImpl - Private implementation of RedisClient
 */
class RedisClientImpl implements RedisClient {
  private readonly config: Required<
    Omit<RedisClientConfig, 'password' | 'keyPrefix' | 'retryStrategy' | 'logger'>
  > & {
    password?: string;
    keyPrefix?: string;
    retryStrategy: (times: number) => number | null;
  };
  private readonly logger: BlaizeLogger;

  private mainConnection?: Redis;
  private publisherConnection?: Redis;
  private subscriberConnection?: Redis;

  private isConnectionEstablished = false;

  constructor(config: RedisClientConfig) {
    // Validate config with Zod
    const validationResult = RedisConfigSchema.safeParse(config);
    if (!validationResult.success) {
      throw new Error(
        `Invalid Redis configuration: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }

    // Store validated config with defaults
    const validated = validationResult.data;
    this.config = {
      host: validated.host,
      port: validated.port,
      db: validated.db,
      connectTimeout: validated.connectTimeout,
      commandTimeout: validated.commandTimeout,
      maxRetriesPerRequest: validated.maxRetriesPerRequest,
      tls: validated.tls,
      password: validated.password,
      keyPrefix: validated.keyPrefix,
      retryStrategy: config.retryStrategy ?? defaultRetryStrategy,
    };

    // Setup logger
    if (config.logger) {
      this.logger = config.logger.child({ component: 'RedisClient' });
    } else {
      this.logger = createLogger().child({ component: 'RedisClient' });
    }

    this.logger.info('Redis client created', {
      host: this.config.host,
      port: this.config.port,
      db: this.config.db,
    });
  }

  /**
   * Get the main Redis connection for data operations
   *
   * @throws {Error} If connection not established
   */
  getConnection(): Redis {
    if (!this.mainConnection) {
      throw new Error('Redis connection not established. Call connect() first.');
    }
    return this.mainConnection;
  }

  /**
   * Get the publisher connection for pub/sub publishing
   *
   * @throws {Error} If connection not established
   */
  getPublisher(): Redis {
    if (!this.publisherConnection) {
      throw new Error('Redis publisher connection not established. Call connect() first.');
    }
    return this.publisherConnection;
  }

  /**
   * Get the subscriber connection for pub/sub subscribing
   *
   * @throws {Error} If connection not established
   */
  getSubscriber(): Redis {
    if (!this.subscriberConnection) {
      throw new Error('Redis subscriber connection not established. Call connect() first.');
    }
    return this.subscriberConnection;
  }

  /**
   * Connect all three Redis connections
   *
   * If already connected, this is a no-op.
   */
  async connect(): Promise<void> {
    if (this.isConnectionEstablished) {
      this.logger.debug('Already connected, skipping connect()');
      return;
    }

    this.logger.info('Connecting to Redis', {
      host: this.config.host,
      port: this.config.port,
    });

    try {
      // Create ioredis options
      const options: RedisOptions = {
        host: this.config.host,
        port: this.config.port,
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        retryStrategy: this.config.retryStrategy,
        lazyConnect: true, // Don't auto-connect, we'll call connect()
        enableReadyCheck: true,
        enableOfflineQueue: true,
      };

      if (this.config.tls) {
        options.tls = {};
      }

      // Create three connections
      this.mainConnection = new Redis(options);
      this.publisherConnection = new Redis(options);
      this.subscriberConnection = new Redis(options);

      // Setup event listeners for all connections
      this.setupConnectionListeners(this.mainConnection, 'main');
      this.setupConnectionListeners(this.publisherConnection, 'publisher');
      this.setupConnectionListeners(this.subscriberConnection, 'subscriber');

      // Connect all three
      await Promise.all([
        this.mainConnection.connect(),
        this.publisherConnection.connect(),
        this.subscriberConnection.connect(),
      ]);

      this.isConnectionEstablished = true;

      this.logger.info('Successfully connected to Redis', {
        host: this.config.host,
        port: this.config.port,
      });
    } catch (error) {
      this.logger.error('Failed to connect to Redis', {
        host: this.config.host,
        port: this.config.port,
        error: error instanceof Error ? error.message : String(error),
      });

      // Clean up any partial connections
      await this.cleanupConnections();

      // Determine failure reason
      let reason: 'CONNECTION_REFUSED' | 'TIMEOUT' | 'AUTH_FAILED' | 'UNKNOWN' = 'UNKNOWN';
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('econnrefused') || msg.includes('connection refused')) {
          reason = 'CONNECTION_REFUSED';
        } else if (msg.includes('timeout') || msg.includes('timed out')) {
          reason = 'TIMEOUT';
        } else if (msg.includes('auth') || msg.includes('noauth') || msg.includes('wrongpass')) {
          reason = 'AUTH_FAILED';
        }
      }

      throw new RedisConnectionError('Failed to connect to Redis', {
        host: this.config.host,
        port: this.config.port,
        reason,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Disconnect all three Redis connections gracefully
   *
   * If not connected, this is a no-op.
   */
  async disconnect(): Promise<void> {
    if (!this.isConnectionEstablished) {
      this.logger.debug('Not connected, skipping disconnect()');
      return;
    }

    this.logger.info('Disconnecting from Redis');

    await this.cleanupConnections();
    this.isConnectionEstablished = false;

    this.logger.info('Disconnected from Redis');
  }

  /**
   * Perform health check by pinging Redis
   *
   * @returns Health status with latency measurement
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string; latency?: number }> {
    if (!this.isConnectionEstablished || !this.mainConnection) {
      return {
        healthy: false,
        message: 'Not connected',
      };
    }

    try {
      const start = Date.now();
      await this.mainConnection.ping();
      const latency = Date.now() - start;

      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  /**
   * Check if all connections are currently connected
   */
  isConnected(): boolean {
    return (
      this.isConnectionEstablished &&
      this.mainConnection?.status === 'ready' &&
      this.publisherConnection?.status === 'ready' &&
      this.subscriberConnection?.status === 'ready'
    );
  }

  /**
   * Get the current configuration
   */
  getConfig(): RedisClientConfig {
    return {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      keyPrefix: this.config.keyPrefix,
      connectTimeout: this.config.connectTimeout,
      commandTimeout: this.config.commandTimeout,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      tls: this.config.tls,
      retryStrategy: this.config.retryStrategy,
    };
  }

  /**
   * Setup event listeners for a Redis connection
   *
   * @private
   */
  private setupConnectionListeners(connection: Redis, name: string): void {
    connection.on('connect', () => {
      this.logger.debug(`Redis ${name} connection: connecting`);
    });

    connection.on('ready', () => {
      this.logger.debug(`Redis ${name} connection: ready`);
    });

    connection.on('error', (error: Error) => {
      this.logger.error(`Redis ${name} connection error`, {
        error: error.message,
        stack: error.stack,
      });
    });

    connection.on('close', () => {
      this.logger.warn(`Redis ${name} connection closed`);
    });

    connection.on('reconnecting', (delay: number) => {
      this.logger.info(`Redis ${name} connection: reconnecting`, { delay });
    });

    connection.on('end', () => {
      this.logger.warn(`Redis ${name} connection ended`);
    });
  }

  /**
   * Cleanup all connections
   *
   * @private
   */
  private async cleanupConnections(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    if (this.mainConnection) {
      disconnectPromises.push(
        this.mainConnection
          .quit()
          // eslint-disable-next-line promise/always-return
          .then(() => {})
          .catch(err => {
            this.logger.warn('Error disconnecting main connection', {
              error: err instanceof Error ? err.message : String(err),
            });
          })
      );
      this.mainConnection = undefined;
    }

    if (this.publisherConnection) {
      disconnectPromises.push(
        // eslint-disable-next-line promise/always-return
        this.publisherConnection
          .quit()
          .then(() => {})
          .catch(err => {
            this.logger.warn('Error disconnecting publisher connection', {
              error: err instanceof Error ? err.message : String(err),
            });
          })
      );
      this.publisherConnection = undefined;
    }

    if (this.subscriberConnection) {
      disconnectPromises.push(
        this.subscriberConnection
          .quit()
          .then(() => {})
          .catch(err => {
            this.logger.warn('Error disconnecting subscriber connection', {
              error: err instanceof Error ? err.message : String(err),
            });
          })
      );
      this.subscriberConnection = undefined;
    }

    await Promise.allSettled(disconnectPromises);
  }
}

/**
 * Create a new Redis client instance
 *
 * Factory function that creates a Redis client with three separate connections
 * for data operations, publishing, and subscribing.
 *
 * @param config - Redis configuration
 * @returns RedisClient instance
 *
 * @throws {Error} If configuration is invalid
 *
 * @example Basic usage
 * ```typescript
 * const client = createRedisClient({
 *   host: 'localhost',
 *   port: 6379,
 * });
 *
 * await client.connect();
 *
 * const connection = client.getConnection();
 * await connection.set('key', 'value');
 *
 * await client.disconnect();
 * ```
 *
 * @example With authentication
 * ```typescript
 * const client = createRedisClient({
 *   host: 'redis.example.com',
 *   port: 6380,
 *   password: 'secret',
 *   tls: true,
 * });
 * ```
 *
 * @example With custom logger
 * ```typescript
 * const client = createRedisClient({
 *   host: 'localhost',
 *   logger: myLogger,
 * });
 * ```
 */
export function createRedisClient(config: RedisClientConfig): RedisClient {
  return new RedisClientImpl(config);
}
