import {
  generateCorrelationId,
  getCurrentCorrelationId,
  setCorrelationId,
  withCorrelationId,
  getOrGenerateCorrelationId,
  _setCorrelationConfig,
  getCorrelationHeaderName,
  _resetCorrelationConfig,
  _getCorrelationStorageInfo,
} from './correlation';

describe('Correlation ID System', () => {
  beforeEach(() => {
    // Reset configuration and correlation context before each test
    _resetCorrelationConfig();
    setCorrelationId('test-default');
  });

  afterEach(() => {
    // Clean up after each test
    _resetCorrelationConfig();
  });

  describe('Configuration Management', () => {
    test('uses default header name when not configured', () => {
      expect(getCorrelationHeaderName()).toBe('x-correlation-id');
    });

    test('allows custom header name configuration', () => {
      _setCorrelationConfig('x-request-id', undefined);
      expect(getCorrelationHeaderName()).toBe('x-request-id');
    });

    test('allows custom generator function', () => {
      const customGenerator = () => 'custom-id-123';
      _setCorrelationConfig(undefined, customGenerator);
      
      const correlationId = generateCorrelationId();
      expect(correlationId).toBe('custom-id-123');
    });

    test('allows both header name and generator configuration', () => {
      const customGenerator = () => 'custom-generated-456';
      _setCorrelationConfig('x-trace-id', customGenerator);
      
      expect(getCorrelationHeaderName()).toBe('x-trace-id');
      expect(generateCorrelationId()).toBe('custom-generated-456');
    });

    test('resets configuration to defaults', () => {
      _setCorrelationConfig('custom-header', () => 'custom-id');
      expect(getCorrelationHeaderName()).toBe('custom-header');
      
      _resetCorrelationConfig();
      expect(getCorrelationHeaderName()).toBe('x-correlation-id');
      expect(generateCorrelationId()).toMatch(/^req_[a-z0-9_]+$/);
    });

    test('provides debug information about configuration', () => {
      const info = _getCorrelationStorageInfo();
      expect(info.config.headerName).toBe('x-correlation-id');
      expect(info.config.generatorType).toBe('default');

      _setCorrelationConfig(undefined, () => 'custom');
      const customInfo = _getCorrelationStorageInfo();
      expect(customInfo.config.generatorType).toBe('custom');
    });
  });

  describe('generateCorrelationId', () => {
    test('creates unique correlation IDs with correct format', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      // Should be different
      expect(id1).not.toBe(id2);

      // Should start with 'req_' when using default generator
      expect(id1).toMatch(/^req_[a-z0-9_]+$/);
      expect(id2).toMatch(/^req_[a-z0-9_]+$/);
    });

    test('generates IDs with timestamp component', () => {
      const beforeTime = Date.now();
      const correlationId = generateCorrelationId();
      const afterTime = Date.now();

      // Extract timestamp from correlation ID (base36 encoded)
      const timestampPart = correlationId.split('_')[1];
      const decodedTimestamp = parseInt(timestampPart!, 36);

      expect(decodedTimestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(decodedTimestamp).toBeLessThanOrEqual(afterTime);
    });

    test('uses custom generator when configured', () => {
      let counter = 0;
      const customGenerator = () => `trace-${++counter}`;
      _setCorrelationConfig(undefined, customGenerator);

      expect(generateCorrelationId()).toBe('trace-1');
      expect(generateCorrelationId()).toBe('trace-2');
      expect(generateCorrelationId()).toBe('trace-3');
    });
  });

  describe('getCurrentCorrelationId', () => {
    test('returns stored correlation ID', () => {
      const testId = 'test-correlation-123';
      setCorrelationId(testId);

      expect(getCurrentCorrelationId()).toBe(testId);
    });

    test('returns "unknown" when no correlation ID is set', () => {
      // Clear any existing context
      setCorrelationId('');

      const result = getCurrentCorrelationId();
      expect(result).toBe('unknown');
    });
  });

  describe('setCorrelationId', () => {
    test('stores correlation ID in context', () => {
      const testId = 'test-set-correlation';
      setCorrelationId(testId);

      expect(getCurrentCorrelationId()).toBe(testId);
    });

    test('overwrites existing correlation ID', () => {
      setCorrelationId('first-id');
      expect(getCurrentCorrelationId()).toBe('first-id');

      setCorrelationId('second-id');
      expect(getCurrentCorrelationId()).toBe('second-id');
    });
  });

  describe('withCorrelationId', () => {
    test('preserves correlation ID context across async operations', async () => {
      const testId = 'async-test-correlation';

      // Start with different correlation ID
      setCorrelationId('original-id');
      expect(getCurrentCorrelationId()).toBe('original-id');

      const result = await withCorrelationId(testId, async () => {
        // Inside the async context, should have the new ID
        expect(getCurrentCorrelationId()).toBe(testId);

        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10));

        // Should still have the correct ID after async operation
        expect(getCurrentCorrelationId()).toBe(testId);

        return 'async-result';
      });

      // After the context, should return to original ID
      expect(getCurrentCorrelationId()).toBe('original-id');
      expect(result).toBe('async-result');
    });

    test('maintains correlation across nested async calls', async () => {
      const outerCorrelationId = 'outer-correlation';
      const innerCorrelationId = 'inner-correlation';

      await withCorrelationId(outerCorrelationId, async () => {
        expect(getCurrentCorrelationId()).toBe(outerCorrelationId);

        await withCorrelationId(innerCorrelationId, async () => {
          expect(getCurrentCorrelationId()).toBe(innerCorrelationId);

          // Call another async function
          await simulateAsyncWork();

          expect(getCurrentCorrelationId()).toBe(innerCorrelationId);
        });

        // Back to outer context
        expect(getCurrentCorrelationId()).toBe(outerCorrelationId);
      });
    });

    test('handles thrown errors while preserving correlation context', async () => {
      const testId = 'error-test-correlation';
      setCorrelationId('original-id');

      await expect(
        withCorrelationId(testId, async () => {
          expect(getCurrentCorrelationId()).toBe(testId);
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Should restore original context even after error
      expect(getCurrentCorrelationId()).toBe('original-id');
    });
  });

  describe('getOrGenerateCorrelationId', () => {
    describe('with default header configuration', () => {
      test('extracts correlation ID from x-correlation-id header', () => {
        const headerCorrelationId = 'header-correlation-123';
        const headers = {
          'x-correlation-id': headerCorrelationId,
          'content-type': 'application/json',
        };

        const result = getOrGenerateCorrelationId(headers);
        expect(result).toBe(headerCorrelationId);
      });

      test('generates new correlation ID when header is missing', () => {
        const headers = {
          'content-type': 'application/json',
        };

        const result = getOrGenerateCorrelationId(headers);
        expect(result).toMatch(/^req_[a-z0-9_]+$/);
      });

      test('generates new correlation ID when header is undefined', () => {
        const headers = {
          'x-correlation-id': undefined,
          'content-type': 'application/json',
        };

        const result = getOrGenerateCorrelationId(headers);
        expect(result).toMatch(/^req_[a-z0-9_]+$/);
      });

      test('handles empty string header value', () => {
        const headers = {
          'x-correlation-id': '',
          'content-type': 'application/json',
        };

        const result = getOrGenerateCorrelationId(headers);
        expect(result).toMatch(/^req_[a-z0-9_]+$/);
      });

      test('handles array header values', () => {
        const headers = {
          'x-correlation-id': ['first-id', 'second-id'],
          'content-type': 'application/json',
        };

        const result = getOrGenerateCorrelationId(headers);
        expect(result).toBe('first-id');
      });

      test('handles empty array header values', () => {
        const headers = {
          'x-correlation-id': [],
          'content-type': 'application/json',
        };

        const result = getOrGenerateCorrelationId(headers);
        expect(result).toMatch(/^req_[a-z0-9_]+$/);
      });
    });

    describe('with custom header configuration', () => {
      beforeEach(() => {
        _setCorrelationConfig('x-request-id', undefined);
      });

      test('extracts correlation ID from custom header', () => {
        const requestId = 'request-456';
        const headers = {
          'x-request-id': requestId,
          'x-correlation-id': 'should-ignore-this',
          'content-type': 'application/json',
        };

        const result = getOrGenerateCorrelationId(headers);
        expect(result).toBe(requestId);
      });

      test('ignores default header when custom header configured', () => {
        const headers = {
          'x-correlation-id': 'ignored-id',
          'content-type': 'application/json',
        };

        const result = getOrGenerateCorrelationId(headers);
        expect(result).toMatch(/^req_[a-z0-9_]+$/); // Should generate new
      });

      test('uses custom generator when header missing', () => {
        _setCorrelationConfig('x-trace-id', () => 'custom-trace-789');
        
        const headers = {
          'content-type': 'application/json',
        };

        const result = getOrGenerateCorrelationId(headers);
        expect(result).toBe('custom-trace-789');
      });
    });
  });

  describe('AsyncLocalStorage integration', () => {
    test('maintains correlation across middleware chain simulation', async () => {
      const correlationId = 'middleware-test-correlation';

      await withCorrelationId(correlationId, async () => {
        // Simulate middleware 1
        await simulateMiddleware1();

        // Simulate middleware 2
        await simulateMiddleware2();

        // Simulate route handler
        await simulateRouteHandler();
      });
    });

    test('correlation IDs are isolated between concurrent requests', async () => {
      const requests = [
        { id: 'req1-correlation', value: 'request-1' },
        { id: 'req2-correlation', value: 'request-2' },
        { id: 'req3-correlation', value: 'request-3' },
      ];

      // Run concurrent requests
      const results = await Promise.all(
        requests.map(async req => {
          return withCorrelationId(req.id, async () => {
            // Simulate async processing time
            await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

            // Verify we still have the right correlation ID
            expect(getCurrentCorrelationId()).toBe(req.id);

            return {
              correlationId: getCurrentCorrelationId(),
              value: req.value,
            };
          });
        })
      );

      // Verify each request maintained its own correlation ID
      expect(results).toEqual([
        { correlationId: 'req1-correlation', value: 'request-1' },
        { correlationId: 'req2-correlation', value: 'request-2' },
        { correlationId: 'req3-correlation', value: 'request-3' },
      ]);
    });
  });

  describe('Backward Compatibility', () => {
    test('maintains backward compatibility with existing code', () => {
      // Existing code that doesn't use configuration should work unchanged
      const headers = {
        'x-correlation-id': 'legacy-id-123',
      };

      const correlationId = getOrGenerateCorrelationId(headers);
      expect(correlationId).toBe('legacy-id-123');

      // Generated IDs should still follow the default format
      const generated = generateCorrelationId();
      expect(generated).toMatch(/^req_[a-z0-9_]+$/);
    });

    test('existing error handling code continues to work', async () => {
      // Simulate how errors currently use correlation
      const errorCorrelationId = 'error-correlation-456';
      
      await withCorrelationId(errorCorrelationId, async () => {
        const currentId = getCurrentCorrelationId();
        expect(currentId).toBe(errorCorrelationId);
        
        // This is how error classes use it
        const errorId = getCurrentCorrelationId();
        expect(errorId).toBe(errorCorrelationId);
      });
    });
  });
});

// Helper functions for testing

async function simulateAsyncWork(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 5));
}

async function simulateMiddleware1(): Promise<void> {
  // Middleware would typically have access to the correlation ID
  const correlationId = getCurrentCorrelationId();
  expect(correlationId).toBeTruthy();
  await simulateAsyncWork();
}

async function simulateMiddleware2(): Promise<void> {
  const correlationId = getCurrentCorrelationId();
  expect(correlationId).toBeTruthy();
  await simulateAsyncWork();
}

async function simulateRouteHandler(): Promise<void> {
  const correlationId = getCurrentCorrelationId();
  expect(correlationId).toBeTruthy();
  await simulateAsyncWork();
}