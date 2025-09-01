import { BlaizeError, ErrorType } from '../../../blaize-types/src/errors';
import { getCurrentCorrelationId } from '../tracing/correlation';

import type { PayloadTooLargeErrorDetails } from '@blaize-types/errors';

export class PayloadTooLargeError extends BlaizeError<PayloadTooLargeErrorDetails> {
  constructor(
    title: string,
    details?: PayloadTooLargeErrorDetails | undefined,
    correlationId?: string
  ) {
    super(
      ErrorType.PAYLOAD_TOO_LARGE,
      title,
      413,
      correlationId ?? getCurrentCorrelationId(),
      details
    );
  }
}
