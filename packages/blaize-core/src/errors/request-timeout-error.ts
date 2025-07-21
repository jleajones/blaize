import { getCurrentCorrelationId } from './correlation';
import { BlaizeError, ErrorType } from '../../../blaize-types/src/errors';

export class RequestTimeoutError extends BlaizeError {
  constructor(title: string, details?: unknown, correlationId?: string) {
    super(
      ErrorType.UPLOAD_TIMEOUT,
      title,
      408,
      correlationId ?? getCurrentCorrelationId(),
      details
    );
  }
}
