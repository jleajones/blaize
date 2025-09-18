import { BlaizeError, ErrorType } from '@blaize-types/errors';
import { getCorrelationId } from 'src/tracing/correlation';

export class SSENotAcceptableError extends BlaizeError<{
  acceptHeader: string;
  requiredHeader: string;
  endpoint: string;
}> {
  constructor(message: string, details: any, correlationId?: string) {
    super(
      ErrorType.SSE_NOT_ACCEPTABLE,
      message,
      406, // Not Acceptable status
      correlationId || getCorrelationId(),
      details
    );
  }
}
