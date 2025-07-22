import { getCurrentCorrelationId } from './correlation';
import { BlaizeError, ErrorType } from '../../../blaize-types/src/errors';

export class UnsupportedMediaTypeError extends BlaizeError {
  constructor(title: string, details?: unknown, correlationId?: string) {
    super(
      ErrorType.UNSUPPORTED_MEDIA_TYPE,
      title,
      415,
      correlationId ?? getCurrentCorrelationId(),
      details
    );
  }
}
