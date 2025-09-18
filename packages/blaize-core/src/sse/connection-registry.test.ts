/**
 * @vitest-environment node
 */
import { getConnectionRegistry, resetRegistry } from './connection-registry';

import type { SSEStream } from '@blaize-types/sse';

// Mock SSEStream implementation for testing
function createMockStream(isWritable = true): SSEStream {
  const closeCallbacks: Array<() => void> = [];

  const stream: SSEStream & { isWritable: boolean; state: string } = {
    send: vi.fn(),
    sendError: vi.fn(),
    close: vi.fn(() => {
      stream.isWritable = false;
      stream.state = 'closed';
      closeCallbacks.forEach(cb => cb());
    }),
    onClose: vi.fn((cb: () => void) => {
      closeCallbacks.push(cb);
    }),
    isWritable,
    state: isWritable ? 'connected' : 'closed',
  };

  return stream;
}

describe('SSE Connection Registry', () => {
  beforeEach(() => {
    // Reset the singleton before each test
    resetRegistry();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Clean up after each test
    resetRegistry();
    vi.useRealTimers();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const registry1 = getConnectionRegistry();
      const registry2 = getConnectionRegistry();

      expect(registry1).toBe(registry2);
    });

    it('should create a new instance after reset', () => {
      const registry1 = getConnectionRegistry();
      const id = 'test-connection';
      const stream = createMockStream();

      registry1.add(id, stream);
      expect(registry1.count()).toBe(1);

      resetRegistry();

      const registry2 = getConnectionRegistry();
      expect(registry2.count()).toBe(0);
    });

    it('should ignore config on subsequent calls', () => {
      getConnectionRegistry({ maxConnections: 5 });
      const registry2 = getConnectionRegistry({ maxConnections: 10 });

      // Should use the first config (maxConnections: 5)
      const stream = createMockStream();
      for (let i = 0; i < 5; i++) {
        registry2.add(`conn-${i}`, stream);
      }

      expect(() => registry2.add('conn-5', stream)).toThrow('Maximum connection limit reached (5)');
    });
  });

  describe('Connection Management', () => {
    it('should add a connection successfully', () => {
      const registry = getConnectionRegistry();
      const stream = createMockStream();

      // Should not throw
      expect(() => registry.add('conn-1', stream)).not.toThrow();

      expect(registry.count()).toBe(1);
      expect(registry.has('conn-1')).toBe(true);
      expect(registry.get('conn-1')).toBe(stream);
    });

    it('should reject duplicate connection IDs', () => {
      const registry = getConnectionRegistry();
      const stream1 = createMockStream();
      const stream2 = createMockStream();

      registry.add('conn-1', stream1);

      expect(() => registry.add('conn-1', stream2)).toThrow(
        'Connection with ID conn-1 already exists'
      );
      expect(registry.count()).toBe(1);
      expect(registry.get('conn-1')).toBe(stream1);
    });

    it('should remove a connection', () => {
      const registry = getConnectionRegistry();
      const stream = createMockStream();

      registry.add('conn-1', stream);
      expect(registry.count()).toBe(1);

      registry.remove('conn-1');
      expect(registry.count()).toBe(0);
      expect(registry.has('conn-1')).toBe(false);
      expect(registry.get('conn-1')).toBeUndefined();
    });

    it('should handle removing non-existent connection gracefully', () => {
      const registry = getConnectionRegistry();

      expect(() => registry.remove('non-existent')).not.toThrow();
      expect(registry.count()).toBe(0);
    });

    it('should auto-remove connection when stream closes', () => {
      const registry = getConnectionRegistry();
      const stream = createMockStream();

      registry.add('conn-1', stream);
      expect(registry.count()).toBe(1);

      // Simulate stream close
      stream.close();

      expect(registry.count()).toBe(0);
      expect(registry.has('conn-1')).toBe(false);
    });

    it('should return all connection IDs', () => {
      const registry = getConnectionRegistry();

      for (let i = 1; i <= 3; i++) {
        registry.add(`conn-${i}`, createMockStream());
      }

      const ids = registry.getIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('conn-1');
      expect(ids).toContain('conn-2');
      expect(ids).toContain('conn-3');
    });
  });

  describe('Connection Limits', () => {
    it('should enforce maximum total connections', () => {
      const registry = getConnectionRegistry({ maxConnections: 3 });

      for (let i = 1; i <= 3; i++) {
        expect(() => registry.add(`conn-${i}`, createMockStream())).not.toThrow();
      }

      expect(() => registry.add('conn-4', createMockStream())).toThrow(
        'Maximum connection limit reached (3)'
      );
      expect(registry.count()).toBe(3);
    });

    it('should enforce per-client connection limit', () => {
      const registry = getConnectionRegistry({ maxConnectionsPerClient: 2 });
      const clientIp = '192.168.1.1';

      // Add 2 connections from same client
      for (let i = 1; i <= 2; i++) {
        expect(() => registry.add(`conn-${i}`, createMockStream(), { clientIp })).not.toThrow();
      }

      // Third connection from same client should fail
      expect(() => registry.add('conn-3', createMockStream(), { clientIp })).toThrow(
        'Maximum connections per client reached (2)'
      );

      // Connection from different client should succeed
      expect(() =>
        registry.add('conn-4', createMockStream(), { clientIp: '192.168.1.2' })
      ).not.toThrow();
    });

    it('should update client counts correctly on removal', () => {
      const registry = getConnectionRegistry({ maxConnectionsPerClient: 2 });
      const clientIp = '192.168.1.1';

      registry.add('conn-1', createMockStream(), { clientIp });
      registry.add('conn-2', createMockStream(), { clientIp });

      // Remove one connection
      registry.remove('conn-1');

      // Should be able to add another connection from same client
      expect(() => registry.add('conn-3', createMockStream(), { clientIp })).not.toThrow();
    });
  });

  describe('Cleanup Mechanism', () => {
    it('should clean up closed connections', () => {
      const registry = getConnectionRegistry();
      const activeStream = createMockStream(true);
      const closedStream = createMockStream(false);

      registry.add('active', activeStream);
      registry.add('closed', closedStream);

      expect(registry.count()).toBe(2);

      registry.cleanup();

      expect(registry.count()).toBe(1);
      expect(registry.has('active')).toBe(true);
      expect(registry.has('closed')).toBe(false);
    });

    it('should clean up inactive connections', () => {
      const registry = getConnectionRegistry({ inactiveTimeout: 1000 });
      const stream = createMockStream();

      registry.add('conn-1', stream);

      // Fast forward time beyond inactive timeout
      vi.advanceTimersByTime(2000);

      registry.cleanup();

      expect(registry.count()).toBe(0);
      expect(stream.close).toHaveBeenCalled();
    });

    it('should start cleanup timer on first connection', () => {
      const registry = getConnectionRegistry({ cleanupInterval: 1000 });

      // Create spy before adding any connections
      const cleanupSpy = vi.spyOn(registry, 'cleanup');

      // Add first connection to start the timer
      const stream = createMockStream();
      registry.add('conn-1', stream);

      // Advance time and verify cleanup is called periodically
      vi.advanceTimersByTime(1000);
      expect(cleanupSpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      expect(cleanupSpy).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1000);
      expect(cleanupSpy).toHaveBeenCalledTimes(3);
    });

    it('should stop cleanup timer when no connections', () => {
      const registry = getConnectionRegistry({ cleanupInterval: 1000 });
      const stream = createMockStream();

      const cleanupSpy = vi.spyOn(registry, 'cleanup');

      registry.add('conn-1', stream);
      vi.advanceTimersByTime(2000);
      const callCount = cleanupSpy.mock.calls.length;

      registry.remove('conn-1');

      // No more cleanup calls after removal
      vi.advanceTimersByTime(2000);
      expect(cleanupSpy).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('Shutdown', () => {
    it('should close all connections on shutdown', () => {
      const registry = getConnectionRegistry();
      const streams = [createMockStream(), createMockStream(), createMockStream()];

      streams.forEach((stream, i) => {
        registry.add(`conn-${i}`, stream);
      });

      expect(registry.count()).toBe(3);

      registry.shutdown();

      expect(registry.count()).toBe(0);
      streams.forEach(stream => {
        expect(stream.close).toHaveBeenCalled();
      });
    });

    it('should stop cleanup timer on shutdown', () => {
      const registry = getConnectionRegistry({ cleanupInterval: 1000 });
      const stream = createMockStream();

      registry.add('conn-1', stream);

      const cleanupSpy = vi.spyOn(registry, 'cleanup');

      registry.shutdown();

      // No cleanup calls after shutdown
      vi.advanceTimersByTime(5000);
      expect(cleanupSpy).not.toHaveBeenCalled();
    });

    it('should handle errors during shutdown gracefully', () => {
      const registry = getConnectionRegistry();
      const stream = createMockStream();

      // Make close throw an error
      stream.close = vi.fn(() => {
        throw new Error('Close failed');
      });

      registry.add('conn-1', stream);

      expect(() => registry.shutdown()).not.toThrow();
      expect(registry.count()).toBe(0);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent adds safely', () => {
      const registry = getConnectionRegistry();

      // Simulate concurrent adds - all should succeed
      for (let i = 0; i < 10; i++) {
        expect(() => registry.add(`conn-${i}`, createMockStream())).not.toThrow();
      }

      expect(registry.count()).toBe(10);
    });

    it('should handle concurrent adds and removes', () => {
      const registry = getConnectionRegistry();

      // Add some connections
      for (let i = 0; i < 5; i++) {
        registry.add(`conn-${i}`, createMockStream());
      }

      // Concurrent operations
      registry.remove('conn-0');
      registry.add('conn-5', createMockStream());
      registry.remove('conn-1');
      registry.add('conn-6', createMockStream());

      expect(registry.count()).toBe(5);
      expect(registry.has('conn-0')).toBe(false);
      expect(registry.has('conn-1')).toBe(false);
      expect(registry.has('conn-5')).toBe(true);
      expect(registry.has('conn-6')).toBe(true);
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not leak memory with repeated add/remove cycles', () => {
      const registry = getConnectionRegistry();

      for (let cycle = 0; cycle < 100; cycle++) {
        const stream = createMockStream();
        registry.add(`conn-${cycle}`, stream);
        registry.remove(`conn-${cycle}`);
      }

      expect(registry.count()).toBe(0);
      expect(registry.getIds()).toHaveLength(0);
    });

    it('should clean up metadata on connection removal', () => {
      const registry = getConnectionRegistry();
      const metadata = {
        clientIp: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      };

      registry.add('conn-1', createMockStream(), metadata);
      registry.remove('conn-1');

      // Reset to get a new registry with fresh state
      resetRegistry();
      const registry2 = getConnectionRegistry({ maxConnectionsPerClient: 1 });

      // Should be able to add connection from same client in new registry
      expect(() => registry2.add('conn-2', createMockStream(), metadata)).not.toThrow();
    });
  });

  describe('Internal API Verification', () => {
    it('should not expose internal types or implementation details', () => {
      // This test verifies that only the minimal API is exposed
      const registry = getConnectionRegistry();

      // These should be the only available methods
      expect(typeof registry.add).toBe('function');
      expect(typeof registry.remove).toBe('function');
      expect(typeof registry.count).toBe('function');
      expect(typeof registry.cleanup).toBe('function');
      expect(typeof registry.get).toBe('function');
      expect(typeof registry.has).toBe('function');
      expect(typeof registry.getIds).toBe('function');
      expect(typeof registry.shutdown).toBe('function');

      // Internal state should not be accessible
      expect((registry as any).connections).toBeUndefined();
      expect((registry as any).clientConnectionCounts).toBeUndefined();
      expect((registry as any).cleanupTimer).toBeUndefined();
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error messages for different failure scenarios', () => {
      const registry = getConnectionRegistry({
        maxConnections: 2,
        maxConnectionsPerClient: 1,
      });

      const stream = createMockStream();

      // Add first connection
      registry.add('conn-1', stream);

      // Test duplicate ID error
      expect(() => registry.add('conn-1', stream)).toThrow(
        'Connection with ID conn-1 already exists'
      );

      // Add second connection to reach max
      registry.add('conn-2', stream);

      // Test max connections error
      expect(() => registry.add('conn-3', stream)).toThrow('Maximum connection limit reached (2)');

      // Reset for the next test with different config
      resetRegistry();

      // Test per-client limit error
      const registry2 = getConnectionRegistry({ maxConnectionsPerClient: 1 });
      const clientIp = '10.0.0.1';
      registry2.add('client-1', createMockStream(), { clientIp });

      expect(() => registry2.add('client-2', createMockStream(), { clientIp })).toThrow(
        'Maximum connections per client reached (1)'
      );
    });
  });
});
