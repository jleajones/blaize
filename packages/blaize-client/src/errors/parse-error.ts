/**
 * ParseError class for client-side response parsing failures
 *
 * This error is thrown when the client receives a response but cannot parse it
 * in the expected format (JSON, text, binary). It provides detailed context
 * about what was expected vs what was received.
 */

import { BlaizeError, ErrorType } from '../../../blaize-types/src/errors';

import type { ParseErrorContext } from '../../../blaize-types/src/errors';

/**
 * Error thrown when response parsing fails
 *
 * Automatically sets HTTP status to 0 (client-side error) and provides
 * comprehensive context about the parsing failure for debugging.
 *
 * @example JSON parsing failure:
 * ```typescript
 * const context: ParseErrorContext = {
 *   url: 'https://api.example.com/data',
 *   method: 'GET',
 *   correlationId: 'client_123',
 *   statusCode: 200,
 *   contentType: 'application/json',
 *   expectedFormat: 'json',
 *   responseSample: '{"incomplete": true',
 *   originalError: new SyntaxError('Unexpected end of JSON input')
 * };
 *
 * throw new ParseError('Failed to parse JSON response', context);
 * ```
 *
 * @example Wrong content type:
 * ```typescript
 * const context: ParseErrorContext = {
 *   url: 'https://api.example.com/error',
 *   method: 'GET',
 *   correlationId: 'client_456',
 *   statusCode: 500,
 *   contentType: 'text/html',
 *   expectedFormat: 'json',
 *   responseSample: '<!DOCTYPE html><html>...',
 *   originalError: new Error('Expected JSON but received HTML')
 * };
 *
 * throw new ParseError('HTML error page instead of JSON', context);
 * ```
 *
 * @example Binary data issue:
 * ```typescript
 * const context: ParseErrorContext = {
 *   url: 'https://api.example.com/download',
 *   method: 'GET',
 *   correlationId: 'client_789',
 *   statusCode: 200,
 *   contentType: 'application/octet-stream',
 *   expectedFormat: 'json',
 *   responseSample: '�PNG\r\n\x1a\n...',
 *   originalError: new Error('Cannot parse binary as JSON')
 * };
 *
 * throw new ParseError('Binary file received instead of JSON', context);
 * ```
 */
export class ParseError extends BlaizeError<ParseErrorContext> {
  /**
   * Creates a new ParseError instance
   *
   * @param title - Human-readable error message
   * @param context - Parse failure context with response details
   * @param correlationId - Optional correlation ID (uses context.correlationId if not provided)
   */
  constructor(
    title: string,
    context: ParseErrorContext,
    correlationId: string | undefined = undefined
  ) {
    super(
      ErrorType.PARSE_ERROR,
      title,
      0, // Client-side errors have no HTTP status
      correlationId ?? context.correlationId,
      context
    );
  }
}
