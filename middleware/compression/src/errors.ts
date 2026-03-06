import { BlaizeError, ErrorType } from '@blaize-types/errors';
import { getCorrelationId } from '../../../packages/blaize-core/src/tracing/correlation';

interface CompressionConfigurationErrorDetails {
  field: string;
}

export class CompressionConfigurationError extends BlaizeError<CompressionConfigurationErrorDetails> {
  constructor(message: string, field: string, correlationId?: string) {
    super(
      ErrorType.COMPRESSION_CONFIGURATION_ERROR,
      message,
      500,
      correlationId ?? getCorrelationId(),
      { field }
    );
    this.name = 'CompressionConfigurationError';
  }
}

