import { describe, it, expect, vi, afterEach } from 'vitest';
import zlib from 'node:zlib';
import { PassThrough, Transform } from 'node:stream';

import { configureFlushMode, wrapWriteWithFlush } from './flush';

/**
 * Helper to create a PassThrough with a mock flush method (like zlib transforms have).
 */
function createMockTransform() {
  const transform = new PassThrough() as PassThrough & { flush: any };
  transform.flush = vi.fn((_flushConst: number, cb?: () => void) => { cb?.(); });
  return transform;
}

describe('wrapWriteWithFlush', () => {
  it('should call flush with the given constant after write', () => {
    return new Promise<void>((resolve) => {
      const transform = createMockTransform();

      wrapWriteWithFlush(transform, zlib.constants.Z_SYNC_FLUSH);

      transform.write('hello', () => {
        expect(transform.flush).toHaveBeenCalledWith(
          zlib.constants.Z_SYNC_FLUSH,
          expect.any(Function),
        );
        resolve();
      });
    });
  });

  it('should pass encoding through to original write', () => {
    return new Promise<void>((resolve) => {
      const transform = createMockTransform();

      wrapWriteWithFlush(transform, zlib.constants.Z_SYNC_FLUSH);

      transform.write('hello', 'utf8', () => {
        expect(transform.flush).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it('should throw a descriptive error when transform has no flush method', () => {
    const transform = new Transform({
      transform(chunk, _encoding, callback) {
        callback(null, chunk);
      },
    });

    expect(() => wrapWriteWithFlush(transform, zlib.constants.Z_SYNC_FLUSH)).toThrow(
      'Transform stream does not have a flush method. Only zlib transform streams are supported.',
    );
  });

  it('should propagate flush errors to the write callback (function overload)', () => {
    return new Promise<void>((resolve) => {
      const flushError = new Error('flush failed');
      const transform = createMockTransform();
      transform.flush = vi.fn((_flushConst: number, cb?: (err: Error | null) => void) => {
        cb?.(flushError);
      });

      wrapWriteWithFlush(transform, zlib.constants.Z_SYNC_FLUSH);

      transform.write('hello', (err: Error | null | undefined) => {
        expect(err).toBe(flushError);
        resolve();
      });
    });
  });

  it('should propagate flush errors to the write callback (encoding overload)', () => {
    return new Promise<void>((resolve) => {
      const flushError = new Error('flush failed');
      const transform = createMockTransform();
      transform.flush = vi.fn((_flushConst: number, cb?: (err: Error | null) => void) => {
        cb?.(flushError);
      });

      wrapWriteWithFlush(transform, zlib.constants.Z_SYNC_FLUSH);

      transform.write('hello', 'utf8', (err: Error | null | undefined) => {
        expect(err).toBe(flushError);
        resolve();
      });
    });
  });
});

describe('configureFlushMode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('none / false', () => {
    it('should return transform unmodified when flush is false', () => {
      const transform = new PassThrough();
      const originalWrite = transform.write;
      const result = configureFlushMode(transform, false);
      expect(result).toBe(transform);
      expect(result.write).toBe(originalWrite);
    });

    it('should return transform unmodified when flush is "none"', () => {
      const transform = new PassThrough();
      const originalWrite = transform.write;
      const result = configureFlushMode(transform, 'none');
      expect(result).toBe(transform);
      expect(result.write).toBe(originalWrite);
    });
  });

  describe('sync / true', () => {
    it('should wrap write with Z_SYNC_FLUSH when flush is true', () => {
      return new Promise<void>((resolve) => {
        const transform = createMockTransform();

        configureFlushMode(transform, true);

        transform.write('data', () => {
          expect(transform.flush).toHaveBeenCalledWith(
            zlib.constants.Z_SYNC_FLUSH,
            expect.any(Function),
          );
          resolve();
        });
      });
    });

    it('should wrap write with Z_SYNC_FLUSH when flush is "sync"', () => {
      return new Promise<void>((resolve) => {
        const transform = createMockTransform();

        configureFlushMode(transform, 'sync');

        transform.write('data', () => {
          expect(transform.flush).toHaveBeenCalledWith(
            zlib.constants.Z_SYNC_FLUSH,
            expect.any(Function),
          );
          resolve();
        });
      });
    });
  });

  describe('partial', () => {
    it('should wrap write with Z_PARTIAL_FLUSH when available', () => {
      return new Promise<void>((resolve) => {
        const transform = createMockTransform();

        // Z_PARTIAL_FLUSH should exist on modern Node.js
        configureFlushMode(transform, 'partial');

        transform.write('data', () => {
          expect(transform.flush).toHaveBeenCalledWith(
            zlib.constants.Z_PARTIAL_FLUSH,
            expect.any(Function),
          );
          resolve();
        });
      });
    });

    it('should fall back silently (no-op) when Z_PARTIAL_FLUSH is unavailable', async () => {
      // Dynamically re-import flush module with mocked zlib constants
      // to simulate Z_PARTIAL_FLUSH being undefined (older Node.js)
      vi.resetModules();

      vi.doMock('node:zlib', async (importOriginal) => {
        const actual = (await importOriginal()) as any;
        const zlibDefault = actual.default ?? actual;
        return {
          ...actual,
          default: {
            ...zlibDefault,
            constants: {
              ...zlibDefault.constants,
              Z_PARTIAL_FLUSH: undefined,
            },
          },
          constants: {
            ...zlibDefault.constants,
            Z_PARTIAL_FLUSH: undefined,
          },
        };
      });

      const { configureFlushMode: mockedConfigureFlushMode } = await import('./flush');

      const transform = createMockTransform();
      const result = mockedConfigureFlushMode(transform, 'partial');
      expect(result).toBe(transform);
      // flush should NOT be called since partial flush is unavailable (no-op)
      transform.write('test-data', () => {});
      expect(transform.flush).not.toHaveBeenCalled();

      vi.doUnmock('node:zlib');
    });
  });

  it('should return transform unmodified for unknown flush values', () => {
    const transform = new PassThrough();
    const originalWrite = transform.write;
    const result = configureFlushMode(transform, 'unknown');
    expect(result).toBe(transform);
    expect(result.write).toBe(originalWrite);
  });
});

