/**
 * Unit tests for CircuitBreaker implementation
 *
 * @module @blaizejs/adapter-redis/circuit-breaker
 */

import { createCircuitBreaker } from './circuit-breaker';
import { CircuitBreakerOpenError } from './errors';

import type { CircuitBreaker } from './types';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initial state', () => {
    it('should start in CLOSED state', () => {
      breaker = createCircuitBreaker();

      expect(breaker.state).toBe('CLOSED');
    });

    it('should have zero failures and successes initially', () => {
      breaker = createCircuitBreaker();
      const stats = breaker.getStats();

      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.lastFailure).toBeUndefined();
      expect(stats.lastSuccess).toBeUndefined();
    });
  });

  describe('CLOSED state behavior', () => {
    beforeEach(() => {
      breaker = createCircuitBreaker({ failureThreshold: 3 });
    });

    it('should allow successful calls through', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(breaker.state).toBe('CLOSED');
    });

    it('should reset failure count on success', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      const successFn = vi.fn().mockResolvedValue('success');

      // 2 failures
      await expect(breaker.execute(failFn)).rejects.toThrow('fail');
      await expect(breaker.execute(failFn)).rejects.toThrow('fail');

      expect(breaker.getStats().failures).toBe(2);

      // 1 success should reset count
      await breaker.execute(successFn);

      expect(breaker.getStats().failures).toBe(0);
      expect(breaker.state).toBe('CLOSED');
    });

    it('should track consecutive failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(breaker.getStats().failures).toBe(1);

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(breaker.getStats().failures).toBe(2);
    });

    it('should open after reaching failure threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Fail 3 times (threshold)
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      await expect(breaker.execute(fn)).rejects.toThrow('fail');

      expect(breaker.state).toBe('OPEN');
      expect(breaker.getStats().failures).toBe(3);
    });

    it('should update lastSuccess timestamp', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const beforeTime = new Date();

      await breaker.execute(fn);

      const stats = breaker.getStats();
      expect(stats.lastSuccess).toBeInstanceOf(Date);
      expect(stats.lastSuccess!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });

    it('should update lastFailure timestamp', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const beforeTime = new Date();

      await expect(breaker.execute(fn)).rejects.toThrow('fail');

      const stats = breaker.getStats();
      expect(stats.lastFailure).toBeInstanceOf(Date);
      expect(stats.lastFailure!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });
  });

  describe('OPEN state behavior', () => {
    beforeEach(() => {
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 5000,
      });
    });

    it('should reject all calls immediately with CircuitBreakerOpenError', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      await expect(breaker.execute(fn)).rejects.toThrow('fail');

      expect(breaker.state).toBe('OPEN');

      // Next call should be rejected without executing
      const successFn = vi.fn().mockResolvedValue('success');
      await expect(breaker.execute(successFn)).rejects.toThrow(CircuitBreakerOpenError);

      expect(successFn).not.toHaveBeenCalled();
    });

    it('should include state details in CircuitBreakerOpenError', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      try {
        await breaker.execute(fn);
        expect.fail('Should have thrown CircuitBreakerOpenError');
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerOpenError);
        const cbError = error as CircuitBreakerOpenError;
        expect(cbError.details?.state).toBe('OPEN');
        expect(cbError.details?.failures).toBe(2);
        expect(cbError.details?.resetTimeout).toBe(5000);
      }
    });

    it('should transition to HALF_OPEN after resetTimeout', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(breaker.state).toBe('OPEN');

      // Advance time by resetTimeout
      vi.advanceTimersByTime(5000);

      expect(breaker.state).toBe('HALF_OPEN');
    });

    it('should handle resetTimeout of 0 (immediate reset)', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 0,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit - should immediately go to HALF_OPEN
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(breaker.state).toBe('HALF_OPEN');
    });
  });

  describe('HALF_OPEN state behavior', () => {
    beforeEach(() => {
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 5000,
        successThreshold: 1,
      });
    });

    async function openAndWaitForHalfOpen() {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      vi.advanceTimersByTime(5000);
      expect(breaker.state).toBe('HALF_OPEN');
    }

    it('should allow single test call through', async () => {
      await openAndWaitForHalfOpen();

      const fn = vi.fn().mockResolvedValue('success');
      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should close on successful test call', async () => {
      await openAndWaitForHalfOpen();

      const fn = vi.fn().mockResolvedValue('success');
      await breaker.execute(fn);

      expect(breaker.state).toBe('CLOSED');
      expect(breaker.getStats().failures).toBe(0);
      expect(breaker.getStats().successes).toBe(0);
    });

    it('should reopen on failed test call', async () => {
      await openAndWaitForHalfOpen();

      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow('fail');

      expect(breaker.state).toBe('OPEN');
      expect(breaker.getStats().successes).toBe(0);
    });

    it('should reject concurrent calls while test is in progress', async () => {
      await openAndWaitForHalfOpen();

      const slowFn = vi.fn().mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve('success'), 100);
          })
      );

      // Start test call (don't await)
      const testCall = breaker.execute(slowFn);

      // Try another call while test is in progress
      const concurrentFn = vi.fn().mockResolvedValue('concurrent');
      await expect(breaker.execute(concurrentFn)).rejects.toThrow(CircuitBreakerOpenError);

      expect(concurrentFn).not.toHaveBeenCalled();

      // Complete the test call
      vi.advanceTimersByTime(100);
      await testCall;
    });

    it('should require successThreshold successes to close', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
        successThreshold: 3,
      });

      await openAndWaitForHalfOpen();

      const fn = vi.fn().mockResolvedValue('success');

      // First success
      await breaker.execute(fn);
      expect(breaker.state).toBe('HALF_OPEN');
      expect(breaker.getStats().successes).toBe(1);

      // Second success
      await breaker.execute(fn);
      expect(breaker.state).toBe('HALF_OPEN');
      expect(breaker.getStats().successes).toBe(2);

      // Third success should close
      await breaker.execute(fn);
      expect(breaker.state).toBe('CLOSED');
      expect(breaker.getStats().successes).toBe(0);
    });
  });

  describe('Manual control', () => {
    beforeEach(() => {
      breaker = createCircuitBreaker();
    });

    it('should manually open the circuit', () => {
      expect(breaker.state).toBe('CLOSED');

      breaker.open();

      expect(breaker.state).toBe('OPEN');
    });

    it('should manually close the circuit', async () => {
      // Open the circuit by failures
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(breaker.state).toBe('OPEN');

      breaker.close();

      expect(breaker.state).toBe('CLOSED');
      expect(breaker.getStats().failures).toBe(0);
      expect(breaker.getStats().successes).toBe(0);
    });

    it('should clear reset timer when manually closed', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(breaker.state).toBe('OPEN');

      // Manually close before timeout
      breaker.close();

      // Advance time past reset timeout
      vi.advanceTimersByTime(40000);

      // Should still be CLOSED (timer was cleared)
      expect(breaker.state).toBe('CLOSED');
    });

    it('should not change state if already in target state', () => {
      expect(breaker.state).toBe('CLOSED');

      breaker.close();
      expect(breaker.state).toBe('CLOSED');

      breaker.open();
      expect(breaker.state).toBe('OPEN');

      breaker.open();
      expect(breaker.state).toBe('OPEN');
    });
  });

  describe('State transition callbacks', () => {
    it('should invoke onOpen callback when opening', async () => {
      const onOpen = vi.fn();
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        onOpen,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('should invoke onClose callback when closing', async () => {
      const onClose = vi.fn();
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
        onClose,
      });

      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      // Transition to HALF_OPEN
      vi.advanceTimersByTime(1000);

      // Close with successful test
      const successFn = vi.fn().mockResolvedValue('success');
      await breaker.execute(successFn);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should invoke onHalfOpen callback when transitioning to HALF_OPEN', async () => {
      const onHalfOpen = vi.fn();
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
        onHalfOpen,
      });

      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      // Transition to HALF_OPEN
      vi.advanceTimersByTime(1000);

      expect(onHalfOpen).toHaveBeenCalledTimes(1);
    });

    it('should not affect state if callback throws', async () => {
      const onOpen = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      breaker = createCircuitBreaker({
        failureThreshold: 2,
        onOpen,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      // State should still be OPEN despite callback error
      expect(breaker.state).toBe('OPEN');
    });

    it('should invoke all relevant callbacks in state transitions', async () => {
      const onOpen = vi.fn();
      const onClose = vi.fn();
      const onHalfOpen = vi.fn();

      breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
        onOpen,
        onClose,
        onHalfOpen,
      });

      // Open
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(onOpen).toHaveBeenCalledTimes(1);

      // Half-open
      vi.advanceTimersByTime(1000);

      expect(onHalfOpen).toHaveBeenCalledTimes(1);

      // Close
      const successFn = vi.fn().mockResolvedValue('success');
      await breaker.execute(successFn);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      breaker = createCircuitBreaker({ failureThreshold: 3 });
    });

    it('should return accurate statistics', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      const stats = breaker.getStats();

      expect(stats.state).toBe('CLOSED');
      expect(stats.failures).toBe(2);
      expect(stats.successes).toBe(0);
      expect(stats.lastFailure).toBeInstanceOf(Date);
      expect(stats.lastSuccess).toBeUndefined();
    });

    it('should track both failures and successes', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      const successFn = vi.fn().mockResolvedValue('success');

      await expect(breaker.execute(failFn)).rejects.toThrow();
      await breaker.execute(successFn);

      const stats = breaker.getStats();

      expect(stats.failures).toBe(0); // Reset on success
      expect(stats.lastFailure).toBeInstanceOf(Date);
      expect(stats.lastSuccess).toBeInstanceOf(Date);
    });

    it('should update successes in HALF_OPEN state', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
        successThreshold: 2,
      });

      // Open circuit
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();

      // Move to HALF_OPEN
      vi.advanceTimersByTime(1000);

      // First success in HALF_OPEN
      const successFn = vi.fn().mockResolvedValue('success');
      await breaker.execute(successFn);

      const stats = breaker.getStats();
      expect(stats.state).toBe('HALF_OPEN');
      expect(stats.successes).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle function that throws synchronously', async () => {
      breaker = createCircuitBreaker({ failureThreshold: 2 });

      const fn = vi.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });

      await expect(breaker.execute(fn)).rejects.toThrow('Sync error');

      expect(breaker.getStats().failures).toBe(1);
    });

    it('should handle zero success threshold', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
        successThreshold: 0,
      });

      // Open circuit
      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();

      // Move to HALF_OPEN
      vi.advanceTimersByTime(1000);

      expect(breaker.state).toBe('HALF_OPEN');

      // With successThreshold of 0, should stay HALF_OPEN even after success
      // (This is an edge case - normally successThreshold should be >= 1)
      const successFn = vi.fn().mockResolvedValue('success');
      await breaker.execute(successFn);

      // The circuit closes because successCount (1) >= successThreshold (0)
      // This is technically correct behavior even though successThreshold=0 is unusual
      expect(breaker.state).toBe('CLOSED');
    });

    it('should handle multiple rapid failures', async () => {
      breaker = createCircuitBreaker({ failureThreshold: 10 });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // 20 rapid failures
      for (let i = 0; i < 20; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }

      expect(breaker.state).toBe('OPEN');
      // Only first 10 failures increment the counter, after that circuit is OPEN
      // and subsequent calls are rejected without calling fn or incrementing counter
      expect(breaker.getStats().failures).toBe(10);
    });
  });

  describe('Logging', () => {
    let mockLogger: {
      info: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      debug: ReturnType<typeof vi.fn>;
      child: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      // Create mock logger
      mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: vi.fn(),
      };

      // child() returns itself for chaining
      mockLogger.child.mockReturnValue(mockLogger);
    });

    it('should log state transitions', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
        logger: mockLogger as any,
      });

      mockLogger.info.mockClear(); // Clear initialization log

      // Transition to OPEN
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker state transition',
        expect.objectContaining({
          from: 'CLOSED',
          to: 'OPEN',
          failures: 2,
        })
      );

      mockLogger.info.mockClear();

      // Transition to HALF_OPEN
      vi.advanceTimersByTime(1000);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Circuit breaker state transition',
        expect.objectContaining({
          from: 'OPEN',
          to: 'HALF_OPEN',
        })
      );
    });

    it('should log failures in CLOSED state', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 3,
        logger: mockLogger as any,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith('Execution failed in CLOSED state', {
        failures: 1,
        threshold: 3,
      });
    });

    it('should log circuit opening', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        logger: mockLogger as any,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('Failure threshold reached, opening circuit', {
        failures: 2,
        threshold: 2,
      });
    });

    it('should log rejected calls when circuit is OPEN', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        logger: mockLogger as any,
      });

      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      mockLogger.warn.mockClear();

      // Try to call while OPEN
      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerOpenError);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Circuit breaker rejecting call - circuit is OPEN',
        expect.objectContaining({
          failures: 2,
        })
      );
    });

    it('should log test call in HALF_OPEN', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000,
        logger: mockLogger as any,
      });

      // Open circuit
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      // Move to HALF_OPEN
      vi.advanceTimersByTime(1000);

      mockLogger.info.mockClear();

      // Test call
      const successFn = vi.fn().mockResolvedValue('success');
      await breaker.execute(successFn);

      expect(mockLogger.info).toHaveBeenCalledWith('Circuit breaker allowing test call through', {
        state: 'HALF_OPEN',
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Test call succeeded in HALF_OPEN', {
        successCount: 1,
        successThreshold: 1,
      });
    });

    it('should log callback errors', async () => {
      const onOpen = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      breaker = createCircuitBreaker({
        failureThreshold: 2,
        logger: mockLogger as any,
        onOpen,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Circuit breaker state transition callback error',
        expect.objectContaining({
          state: 'OPEN',
          error: 'Callback error',
          stack: expect.any(String),
        })
      );
    });

    it('should log manual operations', () => {
      breaker = createCircuitBreaker({
        logger: mockLogger as any,
      });

      mockLogger.info.mockClear();

      breaker.open();

      expect(mockLogger.info).toHaveBeenCalledWith('Manually opening circuit breaker');

      mockLogger.info.mockClear();

      breaker.close();

      expect(mockLogger.info).toHaveBeenCalledWith('Manually closing circuit breaker');
    });

    it('should log timer operations', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 5000,
        logger: mockLogger as any,
      });

      // Open circuit
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith('Starting reset timer', {
        timeout: 5000,
      });

      mockLogger.info.mockClear();

      // Timer elapses
      vi.advanceTimersByTime(5000);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Reset timeout elapsed, transitioning to HALF_OPEN'
      );
    });

    it('should log immediate reset for timeout of 0', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 0,
        logger: mockLogger as any,
      });

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      mockLogger.info.mockClear();

      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Reset timeout is 0, transitioning to HALF_OPEN immediately'
      );
    });

    it('should log failure count reset', async () => {
      breaker = createCircuitBreaker({
        failureThreshold: 5,
        logger: mockLogger as any,
      });

      const failFn = vi.fn().mockRejectedValue(new Error('fail'));
      const successFn = vi.fn().mockResolvedValue('success');

      // Some failures
      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();

      mockLogger.debug.mockClear();

      // Success should reset
      await breaker.execute(successFn);

      expect(mockLogger.debug).toHaveBeenCalledWith('Resetting failure count after success', {
        previousFailures: 2,
      });
    });
  });
});
