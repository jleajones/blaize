import type { Context } from '@blaize-types/context';
import type { ProcessResponseOptions } from '@blaize-types/router';

/**
 * Process a handler response
 */
export function processResponse(
  ctx: Context,
  result: unknown,
  options: ProcessResponseOptions = {}
): void {
  // Response already sent
  if (ctx.response.sent) {
    return;
  }

  // No result, use default status
  if (result === undefined || result === null) {
    ctx.response.text('', options.defaultStatus || 204);
    return;
  }

  // Handle different result types
  if (typeof result === 'string') {
    ctx.response.text(result);
  } else if (typeof result === 'object') {
    ctx.response.json(result);
  } else {
    // Convert other types to string
    ctx.response.text(String(result));
  }
}
