/**
 * Integration tests for client-side error classes
 */

import { NetworkError } from './errors/network-error';
import { ParseError } from './errors/parse-error';
import { TimeoutError } from './errors/timeout-error';
import { ErrorType } from '../../blaize-types/src/errors';

import type {
  NetworkErrorContext,
  TimeoutErrorContext,
  ParseErrorContext,
} from '../../blaize-types/src/errors';

describe('Client Error Classes Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error type consistency', () => {
    test('all client errors have status 0', () => {
      const networkContext: NetworkErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_network_test',
        originalError: new Error('Network failure'),
      };

      const timeoutContext: TimeoutErrorContext = {
        url: 'https://api.example.com/slow',
        method: 'GET',
        correlationId: 'client_timeout_test',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const parseContext: ParseErrorContext = {
        url: 'https://api.example.com/malformed',
        method: 'GET',
        correlationId: 'client_parse_test',
        statusCode: 200,
        expectedFormat: 'json',
        originalError: new Error('Parse failure'),
      };

      const networkError = new NetworkError('Network failed', networkContext);
      const timeoutError = new TimeoutError('Request timeout', timeoutContext);
      const parseError = new ParseError('Parse failed', parseContext);

      expect(networkError.status).toBe(0);
      expect(timeoutError.status).toBe(0);
      expect(parseError.status).toBe(0);
    });

    test('all client errors have correct types', () => {
      const networkContext: NetworkErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_types_test',
        originalError: new Error('Test'),
      };

      const timeoutContext: TimeoutErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_types_test',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const parseContext: ParseErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_types_test',
        statusCode: 200,
        expectedFormat: 'json',
        originalError: new Error('Test'),
      };

      const networkError = new NetworkError('Network failed', networkContext);
      const timeoutError = new TimeoutError('Request timeout', timeoutContext);
      const parseError = new ParseError('Parse failed', parseContext);

      expect(networkError.type).toBe(ErrorType.NETWORK_ERROR);
      expect(timeoutError.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(parseError.type).toBe(ErrorType.PARSE_ERROR);
    });

    test('all client errors extend BlaizeError', () => {
      const networkContext: NetworkErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_inheritance_test',
        originalError: new Error('Test'),
      };

      const timeoutContext: TimeoutErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_inheritance_test',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const parseContext: ParseErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_inheritance_test',
        statusCode: 200,
        expectedFormat: 'json',
        originalError: new Error('Test'),
      };

      const networkError = new NetworkError('Network failed', networkContext);
      const timeoutError = new TimeoutError('Request timeout', timeoutContext);
      const parseError = new ParseError('Parse failed', parseContext);

      // All should have BlaizeError properties
      [networkError, timeoutError, parseError].forEach(error => {
        expect(error.type).toBeDefined();
        expect(error.title).toBeDefined();
        expect(error.status).toBeDefined();
        expect(error.correlationId).toBeDefined();
        expect(error.timestamp).toBeDefined();
        expect(error.details).toBeDefined();
      });
    });
  });

  describe('Error scenarios simulation', () => {
    test('simulates complete fetch request failure scenario', async () => {
      const correlationId = 'client_fetch_scenario';
      const url = 'https://api.example.com/users';
      const method = 'GET';

      // Step 1: Network connection fails
      const networkContext: NetworkErrorContext = {
        url,
        method,
        correlationId,
        originalError: new TypeError('Failed to fetch'),
        networkDetails: {
          isTimeout: false,
          isDnsFailure: false,
          isConnectionRefused: true,
        },
      };

      const networkError = new NetworkError('Connection refused', networkContext);

      expect(networkError.type).toBe(ErrorType.NETWORK_ERROR);
      expect(networkError.details?.url).toBe(url);
      expect(networkError.details?.method).toBe(method);
      expect(networkError.details?.networkDetails?.isConnectionRefused).toBe(true);
      expect(networkError.correlationId).toBe(correlationId);
    });

    test('simulates timeout scenario progression', async () => {
      const correlationId = 'client_timeout_scenario';
      const url = 'https://slow-api.example.com/heavy-computation';
      const method = 'POST';
      const timeoutMs = 30000;

      // Step 1: Request starts
      // Step 2: Connection established (no error)
      // Step 3: Request sent (no error)
      // Step 4: Waiting for response... timeout occurs
      const timeoutContext: TimeoutErrorContext = {
        url,
        method,
        correlationId,
        timeoutMs,
        elapsedMs: timeoutMs + 500, // Exceeded by 500ms
        timeoutType: 'response',
      };

      const timeoutError = new TimeoutError('Response timeout', timeoutContext);

      expect(timeoutError.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(timeoutError.details?.url).toBe(url);
      expect(timeoutError.details?.method).toBe(method);
      expect(timeoutError.details?.timeoutType).toBe('response');
      expect(timeoutError.details?.elapsedMs).toBeGreaterThan(timeoutMs);
      expect(timeoutError.correlationId).toBe(correlationId);
    });

    test('simulates successful request with parse failure scenario', async () => {
      const correlationId = 'client_parse_scenario';
      const url = 'https://api.example.com/data';
      const method = 'GET';

      // Step 1: Network request succeeds
      // Step 2: Server responds with 200 OK
      // Step 3: Response body is malformed JSON
      const parseContext: ParseErrorContext = {
        url,
        method,
        correlationId,
        statusCode: 200,
        contentType: 'application/json; charset=utf-8',
        expectedFormat: 'json',
        responseSample: '{"users": [{"id": 1, "name": "John"},{"id": 2, "name":]',
        originalError: new SyntaxError('Unexpected token ] in JSON at position 45'),
      };

      const parseError = new ParseError('Malformed JSON response', parseContext);

      expect(parseError.type).toBe(ErrorType.PARSE_ERROR);
      expect(parseError.details?.url).toBe(url);
      expect(parseError.details?.method).toBe(method);
      expect(parseError.details?.statusCode).toBe(200);
      expect(parseError.details?.contentType).toContain('application/json');
      expect(parseError.details?.responseSample).toContain('{"users":');
      expect(parseError.details?.originalError.message).toContain('Unexpected token');
      expect(parseError.correlationId).toBe(correlationId);
    });
  });

  describe('Error serialization consistency', () => {
    test('all errors serialize to consistent format', () => {
      const correlationId = 'client_serialization_test';

      const networkContext: NetworkErrorContext = {
        url: 'https://api.example.com/network',
        method: 'GET',
        correlationId,
        originalError: new Error('Network error'),
      };

      const timeoutContext: TimeoutErrorContext = {
        url: 'https://api.example.com/timeout',
        method: 'GET',
        correlationId,
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const parseContext: ParseErrorContext = {
        url: 'https://api.example.com/parse',
        method: 'GET',
        correlationId,
        statusCode: 200,
        expectedFormat: 'json',
        originalError: new Error('Parse error'),
      };

      const networkError = new NetworkError('Network failed', networkContext);
      const timeoutError = new TimeoutError('Request timeout', timeoutContext);
      const parseError = new ParseError('Parse failed', parseContext);

      const networkSerialized = networkError.toJSON();
      const timeoutSerialized = timeoutError.toJSON();
      const parseSerialized = parseError.toJSON();

      // All should have the same structure
      [networkSerialized, timeoutSerialized, parseSerialized].forEach(serialized => {
        expect(serialized).toHaveProperty('type');
        expect(serialized).toHaveProperty('title');
        expect(serialized).toHaveProperty('status', 0);
        expect(serialized).toHaveProperty('correlationId', correlationId);
        expect(serialized).toHaveProperty('timestamp');
        expect(serialized).toHaveProperty('details');
        expect(typeof serialized.timestamp).toBe('string');
      });

      // Each should have correct type
      expect(networkSerialized.type).toBe(ErrorType.NETWORK_ERROR);
      expect(timeoutSerialized.type).toBe(ErrorType.TIMEOUT_ERROR);
      expect(parseSerialized.type).toBe(ErrorType.PARSE_ERROR);
    });
  });

  describe('Error instanceof checks', () => {
    test('errors can be identified by instanceof', () => {
      const networkContext: NetworkErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_instanceof_test',
        originalError: new Error('Test'),
      };

      const timeoutContext: TimeoutErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_instanceof_test',
        timeoutMs: 5000,
        elapsedMs: 5100,
        timeoutType: 'request',
      };

      const parseContext: ParseErrorContext = {
        url: 'https://api.example.com/test',
        method: 'GET',
        correlationId: 'client_instanceof_test',
        statusCode: 200,
        expectedFormat: 'json',
        originalError: new Error('Test'),
      };

      const networkError = new NetworkError('Network failed', networkContext);
      const timeoutError = new TimeoutError('Request timeout', timeoutContext);
      const parseError = new ParseError('Parse failed', parseContext);

      // Positive instanceof checks
      expect(networkError).toBeInstanceOf(NetworkError);
      expect(timeoutError).toBeInstanceOf(TimeoutError);
      expect(parseError).toBeInstanceOf(ParseError);

      // All are instances of Error
      expect(networkError).toBeInstanceOf(Error);
      expect(timeoutError).toBeInstanceOf(Error);
      expect(parseError).toBeInstanceOf(Error);

      // Negative instanceof checks
      expect(networkError).not.toBeInstanceOf(TimeoutError);
      expect(networkError).not.toBeInstanceOf(ParseError);
      expect(timeoutError).not.toBeInstanceOf(NetworkError);
      expect(timeoutError).not.toBeInstanceOf(ParseError);
      expect(parseError).not.toBeInstanceOf(NetworkError);
      expect(parseError).not.toBeInstanceOf(TimeoutError);
    });
  });

  describe('Real-world API failure scenarios', () => {
    test('GitHub API rate limit scenario (HTML response instead of JSON)', () => {
      const parseContext: ParseErrorContext = {
        url: 'https://api.github.com/user/repos',
        method: 'GET',
        correlationId: 'github_rate_limit_scenario',
        statusCode: 403,
        contentType: 'text/html',
        expectedFormat: 'json',
        responseSample: '<!DOCTYPE html><html><head><title>Rate limit exceeded</title>',
        originalError: new SyntaxError('Unexpected token < in JSON at position 0'),
      };

      const parseError = new ParseError('GitHub returned HTML error page', parseContext);

      expect(parseError.details?.statusCode).toBe(403);
      expect(parseError.details?.contentType).toBe('text/html');
      expect(parseError.details?.responseSample).toContain('<!DOCTYPE html>');
    });

    test('Microservice timeout in distributed system', () => {
      const timeoutContext: TimeoutErrorContext = {
        url: 'https://internal-service.company.com/v1/user-preferences',
        method: 'GET',
        correlationId: 'microservice_timeout_scenario',
        timeoutMs: 2000, // Aggressive timeout for microservices
        elapsedMs: 2050,
        timeoutType: 'request',
      };

      const timeoutError = new TimeoutError('Microservice timeout', timeoutContext);

      expect(timeoutError.details?.timeoutMs).toBe(2000);
      expect(timeoutError.details?.timeoutType).toBe('request');
      expect(timeoutError.details?.url).toContain('internal-service');
    });

    test('CDN failure affecting API requests', () => {
      const networkContext: NetworkErrorContext = {
        url: 'https://cdn-api.example.com/v2/assets',
        method: 'GET',
        correlationId: 'cdn_failure_scenario',
        originalError: new Error('ENOTFOUND'),
        networkDetails: {
          isTimeout: false,
          isDnsFailure: true,
          isConnectionRefused: false,
        },
      };

      const networkError = new NetworkError('CDN DNS resolution failed', networkContext);

      expect(networkError.details?.url).toContain('cdn-api');
      expect(networkError.details?.networkDetails?.isDnsFailure).toBe(true);
      expect(networkError.details?.originalError.message).toBe('ENOTFOUND');
    });
  });
});
