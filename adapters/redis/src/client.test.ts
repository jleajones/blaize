/**
 * Unit tests for RedisClient implementation
 *
 * @module @blaizejs/adapter-redis/client
 */

import Redis from 'ioredis';

import { createRedisClient } from './client';
import { RedisConnectionError } from './errors';

import type { RedisClient, RedisClientConfig } from './types';

// Mock ioredis
vi.mock('ioredis');

describe('RedisClient', () => {
  let client: RedisClient;
  let mockConnection: any;
  let mockPublisher: any;
  let mockSubscriber: any;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock Redis instances
    mockConnection = {
      connect: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue('PONG'),
      status: 'ready',
      on: vi.fn(),
    };

    mockPublisher = {
      connect: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
      status: 'ready',
      on: vi.fn(),
    };

    mockSubscriber = {
      connect: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
      status: 'ready',
      on: vi.fn(),
    };

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };
    mockLogger.child.mockReturnValue(mockLogger);

    // Setup Redis constructor mock to return our mocks in sequence
    let callCount = 0;
    (Redis as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockConnection;
      if (callCount === 2) return mockPublisher;
      return mockSubscriber;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration validation', () => {
    it('should accept valid configuration', () => {
      const config: RedisClientConfig = {
        host: 'localhost',
        port: 6379,
      };

      expect(() => createRedisClient(config)).not.toThrow();
    });

    it('should throw on missing host', () => {
      const config: any = {
        port: 6379,
      };

      expect(() => createRedisClient(config)).toThrow('host');
    });

    it('should throw on empty host', () => {
      const config: RedisClientConfig = {
        host: '',
      };

      expect(() => createRedisClient(config)).toThrow('host');
    });

    it('should throw on invalid port (too small)', () => {
      const config: any = {
        host: 'localhost',
        port: 0,
      };

      expect(() => createRedisClient(config)).toThrow('port');
    });

    it('should throw on invalid port (too large)', () => {
      const config: any = {
        host: 'localhost',
        port: 65536,
      };

      expect(() => createRedisClient(config)).toThrow('port');
    });

    it('should throw on negative db', () => {
      const config: any = {
        host: 'localhost',
        db: -1,
      };

      expect(() => createRedisClient(config)).toThrow('db');
    });

    it('should apply default values', () => {
      const config: RedisClientConfig = {
        host: 'localhost',
      };

      client = createRedisClient(config);
      const savedConfig = client.getConfig();

      expect(savedConfig.port).toBe(6379);
      expect(savedConfig.db).toBe(0);
      expect(savedConfig.connectTimeout).toBe(10000);
      expect(savedConfig.commandTimeout).toBe(5000);
      expect(savedConfig.maxRetriesPerRequest).toBe(3);
      expect(savedConfig.tls).toBe(false);
    });

    it('should preserve custom values', () => {
      const config: RedisClientConfig = {
        host: 'redis.example.com',
        port: 6380,
        db: 2,
        password: 'secret',
        keyPrefix: 'myapp:',
        connectTimeout: 5000,
        commandTimeout: 2000,
        maxRetriesPerRequest: 5,
        tls: true,
      };

      client = createRedisClient(config);
      const savedConfig = client.getConfig();

      expect(savedConfig.host).toBe('redis.example.com');
      expect(savedConfig.port).toBe(6380);
      expect(savedConfig.db).toBe(2);
      expect(savedConfig.password).toBe('secret');
      expect(savedConfig.keyPrefix).toBe('myapp:');
      expect(savedConfig.connectTimeout).toBe(5000);
      expect(savedConfig.commandTimeout).toBe(2000);
      expect(savedConfig.maxRetriesPerRequest).toBe(5);
      expect(savedConfig.tls).toBe(true);
    });
  });

  describe('Connection management', () => {
    beforeEach(() => {
      client = createRedisClient({
        host: 'localhost',
        logger: mockLogger,
      });
    });

    it('should create three Redis connections on connect', async () => {
      await client.connect();

      expect(Redis).toHaveBeenCalledTimes(3);
      expect(mockConnection.connect).toHaveBeenCalled();
      expect(mockPublisher.connect).toHaveBeenCalled();
      expect(mockSubscriber.connect).toHaveBeenCalled();
    });

    it('should setup event listeners for all connections', async () => {
      await client.connect();

      // Each connection should have event listeners
      expect(mockConnection.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('end', expect.any(Function));

      expect(mockPublisher.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSubscriber.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should return correct connections after connect', async () => {
      await client.connect();

      expect(client.getConnection()).toBe(mockConnection);
      expect(client.getPublisher()).toBe(mockPublisher);
      expect(client.getSubscriber()).toBe(mockSubscriber);
    });

    it('should throw if getting connections before connect', () => {
      expect(() => client.getConnection()).toThrow('not established');
      expect(() => client.getPublisher()).toThrow('not established');
      expect(() => client.getSubscriber()).toThrow('not established');
    });

    it('should disconnect all connections gracefully', async () => {
      await client.connect();
      await client.disconnect();

      expect(mockConnection.quit).toHaveBeenCalled();
      expect(mockPublisher.quit).toHaveBeenCalled();
      expect(mockSubscriber.quit).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected (no-op)', async () => {
      await client.disconnect();

      expect(mockConnection.quit).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Not connected, skipping disconnect()');
    });

    it('should handle connect when already connected (no-op)', async () => {
      await client.connect();

      // Clear call counts
      mockConnection.connect.mockClear();
      mockPublisher.connect.mockClear();
      mockSubscriber.connect.mockClear();

      // Try to connect again
      await client.connect();

      expect(mockConnection.connect).not.toHaveBeenCalled();
      expect(mockPublisher.connect).not.toHaveBeenCalled();
      expect(mockSubscriber.connect).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Already connected, skipping connect()');
    });

    it('should log connection events', async () => {
      await client.connect();

      expect(mockLogger.info).toHaveBeenCalledWith('Connecting to Redis', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully connected to Redis',
        expect.any(Object)
      );
    });
  });

  describe('Connection errors', () => {
    beforeEach(() => {
      client = createRedisClient({
        host: 'localhost',
        logger: mockLogger,
      });
    });

    it('should throw RedisConnectionError on connection failure', async () => {
      const error = new Error('ECONNREFUSED');
      mockConnection.connect.mockRejectedValue(error);

      await expect(client.connect()).rejects.toThrow(RedisConnectionError);
    });

    it('should detect CONNECTION_REFUSED reason', async () => {
      mockConnection.connect.mockRejectedValue(new Error('ECONNREFUSED'));

      try {
        await client.connect();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RedisConnectionError);
        const connError = error as RedisConnectionError;
        expect(connError.details?.reason).toBe('CONNECTION_REFUSED');
      }
    });

    it('should detect TIMEOUT reason', async () => {
      mockConnection.connect.mockRejectedValue(new Error('Connection timeout'));

      try {
        await client.connect();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RedisConnectionError);
        const connError = error as RedisConnectionError;
        expect(connError.details?.reason).toBe('TIMEOUT');
      }
    });

    it('should detect AUTH_FAILED reason', async () => {
      mockConnection.connect.mockRejectedValue(new Error('NOAUTH Authentication required'));

      try {
        await client.connect();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RedisConnectionError);
        const connError = error as RedisConnectionError;
        expect(connError.details?.reason).toBe('AUTH_FAILED');
      }
    });

    it('should use UNKNOWN reason for unrecognized errors', async () => {
      mockConnection.connect.mockRejectedValue(new Error('Something went wrong'));

      try {
        await client.connect();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RedisConnectionError);
        const connError = error as RedisConnectionError;
        expect(connError.details?.reason).toBe('UNKNOWN');
      }
    });

    it('should cleanup partial connections on failure', async () => {
      // Publisher fails
      mockPublisher.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(client.connect()).rejects.toThrow();

      // Should have attempted to quit all connections
      expect(mockConnection.quit).toHaveBeenCalled();
      expect(mockPublisher.quit).toHaveBeenCalled();
      expect(mockSubscriber.quit).toHaveBeenCalled();
    });

    it('should handle quit errors during cleanup gracefully', async () => {
      mockPublisher.connect.mockRejectedValue(new Error('Connection failed'));
      mockConnection.quit.mockRejectedValue(new Error('Quit failed'));

      await expect(client.connect()).rejects.toThrow(RedisConnectionError);

      // Should log the quit error but not throw
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error disconnecting main connection',
        expect.any(Object)
      );
    });
  });

  describe('Health check', () => {
    beforeEach(() => {
      client = createRedisClient({
        host: 'localhost',
        logger: mockLogger,
      });
    });

    it('should return unhealthy when not connected', async () => {
      const health = await client.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Not connected');
      expect(health.latency).toBeUndefined();
    });

    it('should return healthy with latency when connected', async () => {
      await client.connect();

      const health = await client.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(mockConnection.ping).toHaveBeenCalled();
    });

    it('should return unhealthy on ping failure', async () => {
      await client.connect();

      mockConnection.ping.mockRejectedValue(new Error('Ping failed'));

      const health = await client.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Ping failed');
    });

    it('should measure latency accurately', async () => {
      await client.connect();

      // Mock ping to take some time
      mockConnection.ping.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('PONG'), 10))
      );

      const health = await client.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isConnected', () => {
    beforeEach(() => {
      client = createRedisClient({
        host: 'localhost',
      });
    });

    it('should return false when not connected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true when all connections are ready', async () => {
      await client.connect();

      expect(client.isConnected()).toBe(true);
    });

    it('should return false if main connection not ready', async () => {
      await client.connect();

      mockConnection.status = 'connecting';

      expect(client.isConnected()).toBe(false);
    });

    it('should return false if publisher connection not ready', async () => {
      await client.connect();

      mockPublisher.status = 'connecting';

      expect(client.isConnected()).toBe(false);
    });

    it('should return false if subscriber connection not ready', async () => {
      await client.connect();

      mockSubscriber.status = 'connecting';

      expect(client.isConnected()).toBe(false);
    });

    it('should return false after disconnect', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);

      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Event listener logging', () => {
    beforeEach(() => {
      client = createRedisClient({
        host: 'localhost',
        logger: mockLogger,
      });
    });

    it('should log on error event', async () => {
      await client.connect();

      // Find the error handler
      const errorHandler = mockConnection.on.mock.calls.find(
        (call: any) => call[0] === 'error'
      )?.[1];

      expect(errorHandler).toBeDefined();

      // Trigger error
      errorHandler(new Error('Test error'));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Redis main connection error',
        expect.objectContaining({
          error: 'Test error',
        })
      );
    });

    it('should log on close event', async () => {
      await client.connect();

      const closeHandler = mockConnection.on.mock.calls.find(
        (call: any) => call[0] === 'close'
      )?.[1];

      closeHandler();

      expect(mockLogger.warn).toHaveBeenCalledWith('Redis main connection closed');
    });

    it('should log on reconnecting event', async () => {
      await client.connect();

      const reconnectingHandler = mockConnection.on.mock.calls.find(
        (call: any) => call[0] === 'reconnecting'
      )?.[1];

      reconnectingHandler(1000);

      expect(mockLogger.info).toHaveBeenCalledWith('Redis main connection: reconnecting', {
        delay: 1000,
      });
    });
  });

  describe('Custom retry strategy', () => {
    it('should use custom retry strategy when provided', () => {
      const customRetry = vi.fn((times: number) => (times > 5 ? null : 500));

      client = createRedisClient({
        host: 'localhost',
        retryStrategy: customRetry,
      });

      const config = client.getConfig();
      expect(config.retryStrategy).toBe(customRetry);
    });

    it('should use default retry strategy when not provided', () => {
      client = createRedisClient({
        host: 'localhost',
      });

      const config = client.getConfig();
      expect(config.retryStrategy).toBeDefined();

      // Test default retry strategy behavior
      expect(config.retryStrategy!(1)).toBe(200); // 100 * 2^1
      expect(config.retryStrategy!(5)).toBe(3000); // Capped at 3000
      expect(config.retryStrategy!(11)).toBeNull(); // Gives up after 10
    });
  });

  describe('TLS configuration', () => {
    it('should enable TLS when configured', async () => {
      client = createRedisClient({
        host: 'redis.example.com',
        tls: true,
      });

      await client.connect();

      // Check that Redis was called with TLS options
      const redisCall = (Redis as any).mock.calls[0][0];
      expect(redisCall.tls).toBeDefined();
    });

    it('should not enable TLS by default', async () => {
      client = createRedisClient({
        host: 'localhost',
      });

      await client.connect();

      const redisCall = (Redis as any).mock.calls[0][0];
      expect(redisCall.tls).toBeUndefined();
    });
  });
});
