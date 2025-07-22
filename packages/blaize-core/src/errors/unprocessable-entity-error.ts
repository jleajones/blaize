import { getCurrentCorrelationId } from './correlation';
import { BlaizeError, ErrorType } from '../../../blaize-types/src/errors';

export class UnprocessableEntityError extends BlaizeError {
  constructor(title: string, details?: unknown, correlationId?: string) {
    super(
      ErrorType.UNPROCESSABLE_ENTITY,
      title,
      422,
      correlationId ?? getCurrentCorrelationId(),
      details
    );
  }
}
