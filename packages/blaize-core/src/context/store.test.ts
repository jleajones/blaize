
import { createMockContext } from '@blaizejs/testing-utils';

import {
  contextStorage,
  getContext,
  runWithContext,
  contextMiddleware,
  hasContext,
  bindContext,
} from './store';

import type { Context } from '@blaize-types/context';

// Mock AsyncLocalStorage for better test control
vi.mock('node:async_hooks', () => {
  const store = {
    currentStore: null,
  };

  return {
    AsyncLocalStorage: vi.fn().mockImplementation(() => {
      return {
        getStore: vi.fn(() => store.currentStore),
        run: vi.fn((context, callback) => {
          const previousStore = store.currentStore;
          store.currentStore = context;
          try {
            return callback();
          } finally {
            store.currentStore = previousStore;
          }
        }),
      };
    }),
  };
});

describe('Context Store', () => {
  let mockContext: Context;

  beforeEach(() => {
    // Create a mock context for testing
    mockContext = createMockContext();

    // Reset any previously set context
    vi.mocked(contextStorage.getStore).mockReturnValue(undefined);
  });

  describe('getContext', () => {
    test('returns undefined when no context is set', () => {
      const context = getContext();
      expect(context).toBeUndefined();
    });

    test('returns the current context when set', () => {
      vi.mocked(contextStorage.getStore).mockReturnValue(mockContext);
      const context = getContext();
      expect(context).toBe(mockContext);
    });
  });

  describe('runWithContext', () => {
    test('runs the callback with the provided context', () => {
      const callback = vi.fn().mockReturnValue('result');

      const result = runWithContext(mockContext, callback);

      expect(contextStorage.run).toHaveBeenCalledWith(mockContext, expect.any(Function));
      expect(callback).toHaveBeenCalled();
      expect(result).toBe('result');
    });

    test('handles async callbacks correctly', async () => {
      const callback = vi.fn().mockResolvedValue('async result');

      const result = await runWithContext(mockContext, callback);

      expect(contextStorage.run).toHaveBeenCalledWith(mockContext, expect.any(Function));
      expect(callback).toHaveBeenCalled();
      expect(result).toBe('async result');
    });
  });

  describe('contextMiddleware', () => {
    test('runs next function with the provided context', async () => {
      const next = vi.fn().mockResolvedValue(undefined);

      await contextMiddleware(mockContext, next);

      expect(contextStorage.run).toHaveBeenCalledWith(mockContext, expect.any(Function));
      expect(next).toHaveBeenCalled();
    });
  });

  describe('hasContext', () => {
    test('returns false when no context is set', () => {
      vi.mocked(contextStorage.getStore).mockReturnValue(undefined);
      expect(hasContext()).toBe(false);
    });

    test('returns true when a context is set', () => {
      vi.mocked(contextStorage.getStore).mockReturnValue(mockContext);
      expect(hasContext()).toBe(true);
    });
  });

  describe('bindContext', () => {
    test('returns the original function when no context is set', () => {
      vi.mocked(contextStorage.getStore).mockReturnValue(undefined);

      const originalFn = vi.fn();
      const boundFn = bindContext(originalFn);

      expect(boundFn).toBe(originalFn);
    });

    test('returns a new function bound to the current context', () => {
      vi.mocked(contextStorage.getStore).mockReturnValue(mockContext);

      const originalFn = vi.fn().mockReturnValue('result');
      const boundFn = bindContext(originalFn);

      expect(boundFn).not.toBe(originalFn);

      // Reset the mock to verify it's called during bound function execution
      vi.mocked(contextStorage.run).mockClear();

      const result = boundFn('arg1', 'arg2');

      expect(contextStorage.run).toHaveBeenCalledWith(mockContext, expect.any(Function));
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('result');
    });

    test('preserves this binding in the bound function', () => {
      vi.mocked(contextStorage.getStore).mockReturnValue(mockContext);

      const thisObj = { value: 'test' };
      const originalFn = vi.fn(function (this: typeof thisObj) {
        return this.value;
      });

      const boundFn = bindContext(originalFn);
      const result = boundFn.call(thisObj);

      expect(originalFn).toHaveBeenCalled();
      expect(result).toBe('test');
    });

    test('works with async functions', async () => {
      vi.mocked(contextStorage.getStore).mockReturnValue(mockContext);

      const originalFn = vi.fn().mockResolvedValue('async result');
      const boundFn = bindContext(originalFn);

      const result = await boundFn('arg1', 'arg2');

      expect(contextStorage.run).toHaveBeenCalledWith(mockContext, expect.any(Function));
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('async result');
    });
  });
});
