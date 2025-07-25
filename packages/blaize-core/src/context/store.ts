import { AsyncLocalStorage } from 'node:async_hooks';

import type { Context, QueryParams, State, UnknownFunction } from '@blaize-types/context';

/**
 * AsyncLocalStorage instance for storing request context
 */
export const contextStorage = new AsyncLocalStorage<Context>();

/**
 * Returns the current context from AsyncLocalStorage
 */
export function getContext<S extends State = State, TBody = unknown, TQuery = QueryParams>():
  | Context<S, TBody, TQuery>
  | undefined {
  return contextStorage.getStore() as Context<S, TBody, TQuery> | undefined;
}

/**
 * Wraps a callback function with a context
 */
export function runWithContext<T>(
  context: Context,
  callback: () => T | Promise<T>
): T | Promise<T> {
  return contextStorage.run(context, callback);
}

/**
 * Middleware function that ensures a context is available in AsyncLocalStorage
 */
export async function contextMiddleware(
  context: Context,
  next: () => Promise<void>
): Promise<void> {
  return runWithContext(context, next);
}

/**
 * Utility to check if code is running within a context
 */
export function hasContext(): boolean {
  return contextStorage.getStore() !== undefined;
}

/**
 * Creates a function that will run with the current context
 *
 * @param fn The function to bind to the current context
 * @returns A function that will execute with the bound context
 */
export function bindContext<TFunction extends UnknownFunction>(fn: TFunction): TFunction {
  const context = getContext();
  if (!context) {
    return fn;
  }

  // Using function instead of arrow function to preserve 'this'
  return function (this: unknown, ...args: Parameters<TFunction>): ReturnType<TFunction> {
    return runWithContext(context, () => fn.apply(this, args)) as ReturnType<TFunction>;
  } as TFunction;
}
