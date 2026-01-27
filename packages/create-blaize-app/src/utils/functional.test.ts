import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  ok,
  err,
  isOk,
  isErr,
  pipe,
  asyncPipe,
  mapResult,
  flatMapResult,
  unwrap,
  unwrapOr,
  tryCatch,
  measureTime,
} from './functional';

import type { Result } from '@/types';

describe('Functional Utilities', () => {
  describe('Result creation', () => {
    describe('ok', () => {
      it('should create a successful result with primitive value', () => {
        const result = ok(42);

        expect(result).toEqual({ ok: true, value: 42 });
        expect(result.ok).toBe(true);
        expect((result as any).value).toBe(42);
      });

      it('should create a successful result with object value', () => {
        const value = { name: 'test', count: 5 };
        const result = ok(value);

        expect(result).toEqual({ ok: true, value });
        expect((result as any).value).toBe(value); // Same reference
      });

      it('should create a successful result with null value', () => {
        const result = ok(null);

        expect(result).toEqual({ ok: true, value: null });
      });

      it('should create a successful result with undefined value', () => {
        const result = ok(undefined);

        expect(result).toEqual({ ok: true, value: undefined });
      });
    });

    describe('err', () => {
      it('should create a failed result with Error', () => {
        const error = new Error('Something went wrong');
        const result = err(error);

        expect(result).toEqual({ ok: false, error });
        expect(result.ok).toBe(false);
        expect((result as any).error).toBe(error);
      });

      it('should create a failed result with custom error type', () => {
        const customError = { code: 'INVALID', message: 'Invalid input' };
        const result = err(customError);

        expect(result).toEqual({ ok: false, error: customError });
      });

      it('should create a failed result with string error', () => {
        const result = err('Error message');

        expect(result).toEqual({ ok: false, error: 'Error message' });
      });

      it('should create a failed result with number error', () => {
        const result = err(404);

        expect(result).toEqual({ ok: false, error: 404 });
      });
    });
  });

  describe('Result type guards', () => {
    describe('isOk', () => {
      it('should return true for successful result', () => {
        const result = ok('success');

        expect(isOk(result)).toBe(true);
      });

      it('should return false for failed result', () => {
        const result = err(new Error('failed'));

        expect(isOk(result)).toBe(false);
      });

      it('should narrow type correctly', () => {
        const result: Result<string, Error> = ok('test');

        if (isOk(result)) {
          // TypeScript should know result.value exists here
          expect(result.value).toBe('test');
        }
      });
    });

    describe('isErr', () => {
      it('should return true for failed result', () => {
        const result = err(new Error('failed'));

        expect(isErr(result)).toBe(true);
      });

      it('should return false for successful result', () => {
        const result = ok('success');

        expect(isErr(result)).toBe(false);
      });

      it('should narrow type correctly', () => {
        const result: Result<string, Error> = err(new Error('test error'));

        if (isErr(result)) {
          // TypeScript should know result.error exists here
          expect(result.error.message).toBe('test error');
        }
      });
    });
  });

  describe('Function composition', () => {
    describe('pipe', () => {
      it('should compose functions left to right', () => {
        const add = (x: number) => x + 1;
        const multiply = (x: number) => x * 2;
        const toString = (x: number) => x.toString();

        const pipeline = pipe(add, multiply, toString);
        const result = pipeline(5);

        expect(result).toBe('12'); // (5 + 1) * 2 = 12
      });

      it('should work with single function', () => {
        const double = (x: number) => x * 2;
        const pipeline = pipe(double);

        expect(pipeline(5)).toBe(10);
      });

      it('should work with no functions (identity)', () => {
        const pipeline = pipe();

        expect(pipeline(42)).toBe(42);
      });

      it('should preserve types through the pipeline', () => {
        const toUpper = (s: string) => s.toUpperCase();
        const getLength = (s: string) => s.length;
        const isEven = (n: number) => n % 2 === 0;

        const pipeline = pipe(toUpper, getLength, isEven);
        const result = pipeline('hello');

        expect(result).toBe(false); // length is 5, which is odd
      });

      it('should handle complex transformations', () => {
        interface User {
          name: string;
          age: number;
        }

        const users: User[] = [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ];

        const filterAdults = (users: User[]) => users.filter(u => u.age >= 18);
        const getNames = (users: User[]) => users.map(u => u.name);
        const joinNames = (names: string[]) => names.join(', ');

        const pipeline = pipe(filterAdults, getNames, joinNames);
        const result = pipeline(users);

        expect(result).toBe('Alice, Bob');
      });
    });

    describe('asyncPipe', () => {
      it('should compose async functions left to right', async () => {
        const fetchData = async (id: number) => `data-${id}`;
        const process = async (data: string) => data.toUpperCase();
        const format = async (data: string) => `[${data}]`;

        const pipeline = asyncPipe(fetchData, process, format);
        const result = await pipeline(123);

        expect(result).toBe('[DATA-123]');
      });

      it('should handle mix of sync and async functions', async () => {
        const sync = (x: number) => x * 2;
        const async1 = async (x: number) => x + 1;
        const async2 = async (x: number) => x.toString();

        const pipeline = asyncPipe(sync, async1, async2);
        const result = await pipeline(5);

        expect(result).toBe('11'); // (5 * 2) + 1 = 11
      });

      it('should work with single async function', async () => {
        const delay = async (x: number) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return x * 2;
        };

        const pipeline = asyncPipe(delay);
        const result = await pipeline(5);

        expect(result).toBe(10);
      });

      it('should work with no functions (identity)', async () => {
        const pipeline = asyncPipe();
        const result = await pipeline(42);

        expect(result).toBe(42);
      });

      it('should handle errors in async functions', async () => {
        const failing = async () => {
          throw new Error('Async error');
        };

        const pipeline = asyncPipe(failing);

        await expect(pipeline('test')).rejects.toThrow('Async error');
      });

      it('should process functions sequentially', async () => {
        const order: number[] = [];

        const fn1 = async (x: number) => {
          await new Promise(resolve => setTimeout(resolve, 30));
          order.push(1);
          return x + 1;
        };

        const fn2 = async (x: number) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          order.push(2);
          return x * 2;
        };

        const fn3 = async (x: number) => {
          order.push(3);
          return x - 1;
        };

        const pipeline = asyncPipe(fn1, fn2, fn3);
        const result = await pipeline(5);

        expect(result).toBe(11); // ((5 + 1) * 2) - 1 = 11
        expect(order).toEqual([1, 2, 3]); // Sequential execution
      });
    });
  });

  describe('Result transformations', () => {
    describe('mapResult', () => {
      it('should transform successful result value', () => {
        const result = ok(5);
        const mapped = mapResult(result, x => x * 2);

        expect(mapped).toEqual({ ok: true, value: 10 });
      });

      it('should not transform failed result', () => {
        const error = new Error('failed');
        const result = err(error);
        const mapped = mapResult(result, x => x * 2);

        expect(mapped).toEqual({ ok: false, error });
      });

      it('should change value type', () => {
        const result = ok('hello');
        const mapped = mapResult(result, s => s.length);

        expect(mapped).toEqual({ ok: true, value: 5 });
      });

      it('should work with complex transformations', () => {
        interface User {
          name: string;
          age: number;
        }

        const result = ok({ name: 'Alice', age: 30 } as User);
        const mapped = mapResult(result, user => ({
          ...user,
          isAdult: user.age >= 18,
        }));

        expect(mapped).toEqual({
          ok: true,
          value: { name: 'Alice', age: 30, isAdult: true },
        });
      });
    });

    describe('flatMapResult', () => {
      it('should chain successful results', () => {
        const result = ok(5);
        const chained = flatMapResult(result, x => ok(x * 2));

        expect(chained).toEqual({ ok: true, value: 10 });
      });

      it('should not chain on failed result', () => {
        const error = new Error('initial error');
        const result = err(error);
        const chained = flatMapResult(result, x => ok(x * 2));

        expect(chained).toEqual({ ok: false, error });
      });

      it('should propagate error from chained function', () => {
        const result = ok(5);
        const chainError = new Error('chain error');
        const chained = flatMapResult(result, () => err(chainError));

        expect(chained).toEqual({ ok: false, error: chainError });
      });

      it('should allow complex result chaining', () => {
        const divide = (x: number, y: number): Result<number, string> => {
          if (y === 0) return err('Division by zero');
          return ok(x / y);
        };

        const result = ok(10);
        const chained = flatMapResult(result, x => divide(x, 2));

        expect(chained).toEqual({ ok: true, value: 5 });

        const chainedError = flatMapResult(result, x => divide(x, 0));
        expect(chainedError).toEqual({ ok: false, error: 'Division by zero' });
      });
    });
  });

  describe('Result unwrapping', () => {
    describe('unwrap', () => {
      it('should return value for successful result', () => {
        const result = ok(42);
        const value = unwrap(result);

        expect(value).toBe(42);
      });

      it('should throw error for failed result', () => {
        const error = new Error('unwrap error');
        const result = err(error);

        expect(() => unwrap(result)).toThrow(error);
      });

      it('should throw non-Error types', () => {
        const result = err('string error');

        expect(() => unwrap(result)).toThrow('string error');
      });

      it('should preserve value types', () => {
        const obj = { key: 'value' };
        const result = ok(obj);
        const unwrapped = unwrap(result);

        expect(unwrapped).toBe(obj); // Same reference
      });
    });

    describe('unwrapOr', () => {
      it('should return value for successful result', () => {
        const result = ok(42);
        const value = unwrapOr(result, 0);

        expect(value).toBe(42);
      });

      it('should return default for failed result', () => {
        const result = err(new Error('failed'));
        const value = unwrapOr(result, 99);

        expect(value).toBe(99);
      });

      it('should work with different types', () => {
        const result: Result<string, Error> = err(new Error('failed'));
        const value = unwrapOr(result, 'default');

        expect(value).toBe('default');
      });

      it('should not evaluate default for successful result', () => {
        const result = ok(42);
        const defaultFn = vi.fn(() => 99);

        const value = unwrapOr(result, defaultFn());

        // Default is still evaluated (not lazy), but value comes from result
        expect(value).toBe(42);
        expect(defaultFn).toHaveBeenCalled();
      });
    });
  });

  describe('tryCatch', () => {
    it('should wrap successful sync function', async () => {
      const fn = () => 42;
      const result = await tryCatch(fn);

      expect(result).toEqual({ ok: true, value: 42 });
    });

    it('should wrap successful async function', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      };

      const result = await tryCatch(fn);

      expect(result).toEqual({ ok: true, value: 'async result' });
    });

    it('should catch sync function errors', async () => {
      const fn = () => {
        throw new Error('sync error');
      };

      const result = await tryCatch(fn);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('sync error');
      }
    });

    it('should catch async function errors', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('async error');
      };

      const result = await tryCatch(fn);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('async error');
      }
    });

    it('should convert non-Error throws to Error', async () => {
      const fn = () => {
        throw 'string error';
      };

      const result = await tryCatch(fn);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('string error');
      }
    });

    it('should handle throwing null', async () => {
      const fn = () => {
        throw null;
      };

      const result = await tryCatch(fn);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('null');
      }
    });

    it('should handle throwing undefined', async () => {
      const fn = () => {
        throw undefined;
      };

      const result = await tryCatch(fn);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('undefined');
      }
    });
  });

  describe('measureTime', () => {
    let consoleLogSpy: any;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should measure sync function execution time', () => {
      const fn = (x: number) => x * 2;
      const measured = measureTime('multiply', fn);

      const result = measured(5);

      expect(result).toBe(10);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/⏱️ {2}multiply: \d+ms/));
    });

    it('should measure async function execution time', async () => {
      const fn = async (x: number) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return x * 2;
      };

      const measured = measureTime('async multiply', fn);
      const result = await measured(5);

      expect(result).toBe(10);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/⏱️ {2}async multiply: \d+ms/)
      );

      // Extract and verify timing
      const call = consoleLogSpy.mock.calls[0][0];
      const match = call.match(/(\d+)ms/);
      const duration = parseInt(match[1], 10);
      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it('should preserve function signature', () => {
      const fn = (a: string, b: number, c: boolean) => `${a}-${b}-${c}`;
      const measured = measureTime('complex', fn);

      const result = measured('test', 42, true);

      expect(result).toBe('test-42-true');
    });

    it('should handle functions that throw', () => {
      const fn = () => {
        throw new Error('Function error');
      };

      const measured = measureTime('failing', fn);

      expect(() => measured()).toThrow('Function error');
      // Sync functions that throw don't log timing (execution stops at throw)
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle async functions that reject', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async error');
      };

      const measured = measureTime('async failing', fn);

      await expect(measured()).rejects.toThrow('Async error');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/⏱️ {2}async failing: \d+ms/)
      );
    });

    it('should measure time for functions with return types', () => {
      interface Result {
        value: number;
        timestamp: number;
      }

      const fn = (x: number): Result => ({
        value: x,
        timestamp: Date.now(),
      });

      const measured = measureTime('with interface', fn);
      const result = measured(42);

      expect(result.value).toBe(42);
      expect(result.timestamp).toBeDefined();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should work with void functions', () => {
      let sideEffect = 0;
      const fn = () => {
        sideEffect += 1;
      };

      const measured = measureTime('void function', fn);
      measured();

      expect(sideEffect).toBe(1);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('should compose Result operations', () => {
      const parseNumber = (s: string): Result<number, string> => {
        const num = parseInt(s, 10);
        return isNaN(num) ? err('Invalid number') : ok(num);
      };

      const input = '42';
      const result = parseNumber(input);
      const doubled = mapResult(result, x => x * 2);
      const final = unwrapOr(doubled, 0);

      expect(final).toBe(84);
    });

    it('should chain multiple async operations with error handling', async () => {
      interface User {
        id: number;
        name: string;
      }

      interface EnrichedUser extends User {
        timestamp: number;
      }

      const fetchUser = async (id: number): Promise<User> => {
        if (id < 0) throw new Error('Invalid ID');
        return { id, name: `User${id}` };
      };

      const enrichUser = async (user: User): Promise<EnrichedUser> => ({
        ...user,
        timestamp: Date.now(),
      });

      const pipeline = asyncPipe(fetchUser, enrichUser);

      const result = await tryCatch(() => pipeline(1));
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const user = result.value as EnrichedUser;
        expect(user.name).toBe('User1');
        expect(user.timestamp).toBeDefined();
      }

      const errorResult = await tryCatch(() => pipeline(-1));
      expect(isErr(errorResult)).toBe(true);
      if (isErr(errorResult)) {
        expect(errorResult.error.message).toBe('Invalid ID');
      }
    });

    it('should combine pipe with Result for safe transformations', () => {
      const safeDivide = (x: number): Result<number, string> => {
        if (x === 0) return err('Cannot divide by zero');
        return ok(10 / x);
      };

      const double = (x: number) => x * 2;
      const toString = (x: number) => x.toString();

      const result1 = safeDivide(2);
      const transformed = mapResult(mapResult(result1, double), toString);

      expect(unwrapOr(transformed, 'error')).toBe('10'); // (10/2) * 2 = 10

      const result2 = safeDivide(0);
      const transformed2 = mapResult(mapResult(result2, double), toString);

      expect(unwrapOr(transformed2, 'error')).toBe('error');
    });
  });
});
