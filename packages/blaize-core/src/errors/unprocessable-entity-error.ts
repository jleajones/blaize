import { BlaizeError, ErrorType } from '../../../blaize-types/src/errors';
import { getCorrelationId } from '../tracing/correlation';

export class UnprocessableEntityError extends BlaizeError {
  constructor(title: string, details?: unknown, correlationId?: string) {
    super(
      ErrorType.UNPROCESSABLE_ENTITY,
      title,
      422,
      correlationId ?? getCorrelationId(),
      details
    );
  }
}
