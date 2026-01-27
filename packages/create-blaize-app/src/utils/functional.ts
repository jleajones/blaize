/**
 * Functional utilities for the CLI pipeline
 */

import type { Result } from '@/types';

/**
 * Create a successful result
 */
export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

/**
 * Create a failed result
 */
export const err = <E = Error>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

/**
 * Check if a result is successful
 */
export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } =>
  result.ok === true;

/**
 * Check if a result is an error
 */
export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } =>
  result.ok === false;

/**
 * Compose functions into a pipeline
 */
export const pipe =
  <T>(...fns: Array<(arg: any) => any>) =>
  (initialValue: T) =>
    fns.reduce((acc, fn) => fn(acc), initialValue);

/**
 * Compose async functions into a pipeline
 */
export const asyncPipe =
  <T>(...fns: Array<(arg: any) => Promise<any> | any>) =>
  async (initialValue: T) => {
    let result = initialValue;
    for (const fn of fns) {
      result = await fn(result);
    }
    return result;
  };

/**
 * Map over a Result type
 */
export const mapResult = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> => {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
};

/**
 * FlatMap over a Result type
 */
export const flatMapResult = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
};

/**
 * Unwrap a Result or throw
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
};

/**
 * Unwrap a Result or return default value
 */
export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
};

/**
 * Try-catch wrapper that returns Result
 */
export const tryCatch = async <T>(fn: () => Promise<T> | T): Promise<Result<T, Error>> => {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
};

/**
 * Measure execution time of a function
 */
export const measureTime = <T extends (...args: any[]) => any>(label: string, fn: T): T => {
  return ((...args: Parameters<T>) => {
    const start = Date.now();
    const result = fn(...args);

    // Handle both sync and async functions
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = Date.now() - start;
        console.log(`⏱️  ${label}: ${duration}ms`);
      });
    }

    const duration = Date.now() - start;
    console.log(`⏱️  ${label}: ${duration}ms`);
    return result;
  }) as T;
};
