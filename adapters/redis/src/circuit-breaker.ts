/**
 * Circuit Breaker Implementation
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * in distributed systems. Automatically detects failures and temporarily
 * blocks requests to failing services.
 *
 * @module @blaizejs/adapter-redis/circuit-breaker
 * @since 0.1.0
 */

import { createLogger } from 'blaizejs';

import { CircuitBreakerOpenError } from './errors';

import type {
  CircuitState,
  CircuitBreaker,
  CircuitBreakerConfig,
  CircuitBreakerStats,
} from './types';
import type { BlaizeLogger } from 'blaizejs';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<
  Omit<CircuitBreakerConfig, 'onOpen' | 'onClose' | 'onHalfOpen' | 'logger'>
> = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  successThreshold: 1,
};

/**
 * CircuitBreakerImpl - Private implementation of CircuitBreaker
 *
 * Implements a state machine with three states:
 * - CLOSED: Normal operation, tracking failures
 * - OPEN: Rejecting all requests, waiting for reset timeout
 * - HALF_OPEN: Testing with single request
 */
class CircuitBreakerImpl implements CircuitBreaker {
  private currentState: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private resetTimer?: NodeJS.Timeout;
  private testInProgress = false;

  private readonly config: Required<
    Omit<CircuitBreakerConfig, 'onOpen' | 'onClose' | 'onHalfOpen' | 'logger'>
  >;
  private readonly onOpen?: () => void;
  private readonly onClose?: () => void;
  private readonly onHalfOpen?: () => void;
  private readonly logger: BlaizeLogger;

  constructor(config?: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? DEFAULT_CONFIG.failureThreshold,
      resetTimeout: config?.resetTimeout ?? DEFAULT_CONFIG.resetTimeout,
      successThreshold: config?.successThreshold ?? DEFAULT_CONFIG.successThreshold,
    };

    this.onOpen = config?.onOpen;
    this.onClose = config?.onClose;
    this.onHalfOpen = config?.onHalfOpen;

    // Create child logger
    if (config?.logger) {
      this.logger = config.logger.child({ component: 'CircuitBreaker' });
    } else {
      this.logger = createLogger().child({ component: 'CircuitBreaker' });
    }
  }

  /**
   * Get current circuit breaker state
   */
  get state(): CircuitState {
    return this.currentState;
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * Behavior depends on current state:
   * - CLOSED: Execute and track result
   * - OPEN: Reject immediately
   * - HALF_OPEN: Execute only if no test in progress
   *
   * @param fn - Async function to execute
   * @returns Promise resolving to function result
   * @throws {CircuitBreakerOpenError} When circuit is OPEN or test already in progress
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.currentState === 'OPEN') {
      this.logger.warn('Circuit breaker rejecting call - circuit is OPEN', {
        failures: this.failureCount,
        lastFailure: this.lastFailureTime,
      });

      throw new CircuitBreakerOpenError('Circuit breaker is OPEN', {
        state: this.currentState,
        failures: this.failureCount,
        lastFailure: this.lastFailureTime,
        resetTimeout: this.config.resetTimeout,
      });
    }

    if (this.currentState === 'HALF_OPEN') {
      // Only allow one test call through
      if (this.testInProgress) {
        this.logger.warn('Circuit breaker rejecting concurrent call - test in progress');

        throw new CircuitBreakerOpenError('Circuit breaker test call already in progress', {
          state: this.currentState,
          failures: this.failureCount,
          lastFailure: this.lastFailureTime,
          resetTimeout: this.config.resetTimeout,
        });
      }

      this.logger.info('Circuit breaker allowing test call through', {
        state: 'HALF_OPEN',
      });

      this.testInProgress = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    } finally {
      if (this.currentState === 'HALF_OPEN') {
        this.testInProgress = false;
      }
    }
  }

  /**
   * Manually open the circuit
   *
   * Forces circuit to OPEN state and starts reset timer.
   */
  open(): void {
    if (this.currentState !== 'OPEN') {
      this.logger.info('Manually opening circuit breaker');
      this.transitionTo('OPEN');
      this.startResetTimer();
    }
  }

  /**
   * Manually close the circuit
   *
   * Forces circuit to CLOSED state and resets counters.
   */
  close(): void {
    if (this.currentState !== 'CLOSED') {
      this.logger.info('Manually closing circuit breaker');
      this.clearResetTimer();
      this.failureCount = 0;
      this.successCount = 0;
      this.transitionTo('CLOSED');
    }
  }

  /**
   * Get current circuit breaker statistics
   *
   * @returns Current stats including state, counters, and timestamps
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.currentState,
      failures: this.failureCount,
      successes: this.successCount,
      lastFailure: this.lastFailureTime,
      lastSuccess: this.lastSuccessTime,
    };
  }

  /**
   * Handle successful execution
   *
   * @private
   */
  private onSuccess(): void {
    this.lastSuccessTime = new Date();

    if (this.currentState === 'CLOSED') {
      // Reset failure count on success in CLOSED state
      if (this.failureCount > 0) {
        this.logger.debug('Resetting failure count after success', {
          previousFailures: this.failureCount,
        });
        this.failureCount = 0;
      }
    } else if (this.currentState === 'HALF_OPEN') {
      // Increment success count in HALF_OPEN
      this.successCount++;

      this.logger.info('Test call succeeded in HALF_OPEN', {
        successCount: this.successCount,
        successThreshold: this.config.successThreshold,
      });

      // Close circuit if success threshold reached
      if (this.successCount >= this.config.successThreshold) {
        this.logger.info('Success threshold reached, closing circuit', {
          successCount: this.successCount,
          successThreshold: this.config.successThreshold,
        });

        this.failureCount = 0;
        this.successCount = 0;
        this.transitionTo('CLOSED');
      }
    }
  }

  /**
   * Handle failed execution
   *
   * @private
   */
  private onFailure(): void {
    this.lastFailureTime = new Date();
    this.failureCount++;

    if (this.currentState === 'CLOSED') {
      this.logger.warn('Execution failed in CLOSED state', {
        failures: this.failureCount,
        threshold: this.config.failureThreshold,
      });

      // Open circuit if failure threshold reached
      if (this.failureCount >= this.config.failureThreshold) {
        this.logger.error('Failure threshold reached, opening circuit', {
          failures: this.failureCount,
          threshold: this.config.failureThreshold,
        });

        this.transitionTo('OPEN');
        this.startResetTimer();
      }
    } else if (this.currentState === 'HALF_OPEN') {
      this.logger.error('Test call failed in HALF_OPEN, reopening circuit', {
        failures: this.failureCount,
      });

      // Return to OPEN state on test failure
      this.successCount = 0;
      this.transitionTo('OPEN');
      this.startResetTimer();
    }
  }

  /**
   * Transition to a new state and invoke callback
   *
   * @param newState - State to transition to
   * @private
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.currentState;
    this.currentState = newState;

    this.logger.info('Circuit breaker state transition', {
      from: previousState,
      to: newState,
      failures: this.failureCount,
      successes: this.successCount,
    });

    // Invoke state transition callbacks (wrapped in try-catch to prevent affecting state)
    try {
      if (newState === 'OPEN' && this.onOpen) {
        this.onOpen();
      } else if (newState === 'CLOSED' && this.onClose) {
        this.onClose();
      } else if (newState === 'HALF_OPEN' && this.onHalfOpen) {
        this.onHalfOpen();
      }
    } catch (error) {
      // Callback errors should not affect circuit breaker state
      this.logger.error('Circuit breaker state transition callback error', {
        state: newState,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Start the reset timer for OPEN -> HALF_OPEN transition
   *
   * @private
   */
  private startResetTimer(): void {
    this.clearResetTimer();

    // Handle resetTimeout of 0 (immediate reset)
    if (this.config.resetTimeout === 0) {
      this.logger.info('Reset timeout is 0, transitioning to HALF_OPEN immediately');
      this.successCount = 0;
      this.transitionTo('HALF_OPEN');
      return;
    }

    this.logger.info('Starting reset timer', {
      timeout: this.config.resetTimeout,
    });

    this.resetTimer = setTimeout(() => {
      this.logger.info('Reset timeout elapsed, transitioning to HALF_OPEN');
      this.successCount = 0;
      this.transitionTo('HALF_OPEN');
    }, this.config.resetTimeout);
  }

  /**
   * Clear the reset timer if it exists
   *
   * @private
   */
  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
      this.logger.debug('Reset timer cleared');
    }
  }
}

/**
 * Create a new circuit breaker instance
 *
 * Factory function that creates a circuit breaker with the specified configuration.
 * The circuit breaker starts in CLOSED state.
 *
 * @param config - Optional configuration for the circuit breaker
 * @returns CircuitBreaker instance
 *
 * @example Basic usage
 * ```typescript
 * const breaker = createCircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeout: 30000,
 * });
 *
 * try {
 *   const result = await breaker.execute(async () => {
 *     return await redisClient.get('key');
 *   });
 * } catch (error) {
 *   if (error instanceof CircuitBreakerOpenError) {
 *     console.log('Circuit is open, using fallback');
 *   }
 * }
 * ```
 *
 * @example With callbacks and logger
 * ```typescript
 * const breaker = createCircuitBreaker({
 *   failureThreshold: 3,
 *   resetTimeout: 15000,
 *   logger: myLogger,
 *   onOpen: () => console.log('Circuit opened'),
 *   onClose: () => console.log('Circuit closed'),
 *   onHalfOpen: () => console.log('Circuit half-open, testing'),
 * });
 * ```
 */
export function createCircuitBreaker(config?: CircuitBreakerConfig): CircuitBreaker {
  return new CircuitBreakerImpl(config);
}
