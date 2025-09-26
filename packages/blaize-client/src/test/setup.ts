/**
 * Test setup for browser environment
 * Location: packages/blaize-client/test/setup.ts
 *
 * Ensures browser APIs are available with happy-dom
 */

beforeAll(() => {
  // Verify we're in a browser-like environment
  if (typeof window === 'undefined') {
    throw new Error('Tests must run in happy-dom environment');
  }

  // happy-dom provides most browser APIs but we can add polyfills if needed

  // Ensure fetch is available (Node 22+ provides it)
  if (!window.fetch && typeof globalThis.fetch !== 'undefined') {
    window.fetch = globalThis.fetch;
  }

  // Mock EventSource for SSE tests (happy-dom doesn't provide it)
  if (!window.EventSource) {
    (window as any).EventSource = class MockEventSource {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 2;

      readyState = 0;
      url: string;
      withCredentials: boolean;

      constructor(url: string, options?: EventSourceInit) {
        this.url = url;
        this.withCredentials = options?.withCredentials || false;
      }

      addEventListener() {}
      removeEventListener() {}
      close() {
        this.readyState = 2;
      }

      onopen: any = null;
      onmessage: any = null;
      onerror: any = null;
    };
  }
});

afterEach(() => {
  // Clear any stored data between tests
  if (window.localStorage) {
    window.localStorage.clear();
  }

  if (window.sessionStorage) {
    window.sessionStorage.clear();
  }

  // Clear any mock timers
  vi.clearAllTimers();

  // Clear all mocks
  vi.clearAllMocks();
});

// Type augmentations for test environment
declare global {
  interface Window {
    // Add any test-specific globals here
    __TEST_MODE__?: boolean;
  }
}

// Mark as test mode
if (typeof window !== 'undefined') {
  window.__TEST_MODE__ = true;
}

export {};
