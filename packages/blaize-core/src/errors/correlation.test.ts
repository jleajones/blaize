import {
  generateCorrelationId,
  getCurrentCorrelationId,
  setCorrelationId,
  withCorrelationId,
  getOrGenerateCorrelationId,
} from './correlation';

describe('Correlation ID System', () => {
  beforeEach(() => {
    // Reset correlation context before each test
    setCorrelationId('test-default');
  });

  describe('generateCorrelationId', () => {
    test('creates unique correlation IDs with correct format', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      // Should be different
      expect(id1).not.toBe(id2);

      // Should start with 'req_'
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

      // Note: We'll need to handle the case where storage is empty
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
