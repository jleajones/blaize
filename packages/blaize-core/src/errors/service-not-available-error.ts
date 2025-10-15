// ============================================
// packages/blaize-core/src/errors/service-unavailable-error.ts
// ============================================

import { BlaizeError, ErrorType } from '@blaize-types/errors';

import { getCorrelationId } from '../tracing/correlation';

import type { ServiceNotAvailableDetails } from '@blaize-types/errors';

/**
 * Error thrown when a service is temporarily unavailable
 *
 * Automatically sets HTTP status to 503 and optionally includes Retry-After.
 *
 * @example Basic usage:
 * ```typescript
 * throw new ServiceNotAvailableError('Database unavailable');
 * ```
 *
 * @example With retry guidance:
 * ```typescript
 * throw new ServiceNotAvailableError('Payment service down', {
 *   service: 'stripe',
 *   retryAfter: 30,
 *   reason: 'circuit_breaker'
 * });
 * ```
 */
export class ServiceNotAvailableError extends BlaizeError<ServiceNotAvailableDetails> {
  constructor(
    title: string,
    details: ServiceNotAvailableDetails | undefined = undefined,
    correlationId: string | undefined = undefined
  ) {
    super(ErrorType.SERVICE_UNAVAILABLE, title, 503, correlationId ?? getCorrelationId(), details);
  }
}
