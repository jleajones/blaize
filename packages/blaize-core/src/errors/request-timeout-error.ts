import { BlaizeError, ErrorType } from '../../../blaize-types/src/errors';
import { getCorrelationId } from '../tracing/correlation';

export class RequestTimeoutError extends BlaizeError {
  constructor(title: string, details?: unknown, correlationId?: string) {
    super(
      ErrorType.UPLOAD_TIMEOUT,
      title,
      408,
      correlationId ?? getCorrelationId(),
      details
    );
  }
}
