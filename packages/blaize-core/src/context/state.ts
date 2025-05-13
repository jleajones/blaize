import { getContext } from './store';

/**
 * Gets a value from the current context's state with type safety
 *
 * @param key The key to retrieve from state
 * @param defaultValue Optional default value if key doesn't exist
 * @returns The value from state or the default value
 */
export function getState<T>(key: string, defaultValue?: T): T | undefined {
  const context = getContext();
  if (!context) {
    return defaultValue;
  }

  const value = context.state[key] as T | undefined;
  return value !== undefined ? value : defaultValue;
}

/**
 * Sets a value in the current context's state
 *
 * @param key The key to set in state
 * @param value The value to store
 * @returns true if successful, false if no context available
 */
export function setState<T>(key: string, value: T): boolean {
  const context = getContext();
  if (!context) {
    return false;
  }

  context.state[key] = value;
  return true;
}

/**
 * Removes a value from the current context's state
 *
 * @param key The key to remove from state
 * @returns true if successful, false if no context available
 */
export function removeState(key: string): boolean {
  const context = getContext();
  if (!context) {
    return false;
  }

  if (key in context.state) {
    delete context.state[key];
    return true;
  }

  return false;
}

/**
 * Gets multiple values from state at once
 *
 * @param keys The keys to retrieve
 * @returns Object with requested values
 */
export function getStateMany<T extends Record<string, unknown>>(keys: Array<keyof T>): Partial<T> {
  const context = getContext();
  if (!context) {
    return {};
  }

  const result = {} as Partial<T>;

  for (const key of keys) {
    const strKey = String(key);
    if (strKey in context.state) {
      result[key as keyof T] = context.state[strKey] as T[keyof T];
    }
  }

  return result;
}

/**
 * Sets multiple values in state at once
 *
 * @param values Object containing key-value pairs to set
 * @returns true if successful, false if no context available
 */
export function setStateMany<T extends Record<string, unknown>>(values: T): boolean {
  const context = getContext();
  if (!context) {
    return false;
  }

  Object.assign(context.state, values);
  return true;
}

/**
 * Create a namespaced state accessor to avoid key collisions
 *
 * @param namespace The namespace for this accessor
 * @returns Object with state access methods prefixed with namespace
 */
export function createNamespacedState(namespace: string) {
  return {
    /**
     * Gets a value from the namespaced section of state
     */
    get<T>(key: string, defaultValue?: T): T | undefined {
      return getState<T>(`${namespace}.${key}`, defaultValue);
    },

    /**
     * Sets a value in the namespaced section of state
     */
    set<T>(key: string, value: T): boolean {
      return setState<T>(`${namespace}.${key}`, value);
    },

    /**
     * Removes a value from the namespaced section of state
     */
    remove(key: string): boolean {
      return removeState(`${namespace}.${key}`);
    },

    /**
     * Gets all keys from this namespace
     */
    getAllKeys(): string[] {
      const context = getContext();
      if (!context) {
        return [];
      }

      const prefix = `${namespace}.`;
      return Object.keys(context.state)
        .filter(key => key.startsWith(prefix))
        .map(key => key.slice(prefix.length));
    },

    /**
     * Clears all state in this namespace
     */
    clear(): boolean {
      const context = getContext();
      if (!context) {
        return false;
      }

      const prefix = `${namespace}.`;
      const keysToRemove = Object.keys(context.state).filter(key => key.startsWith(prefix));

      for (const key of keysToRemove) {
        delete context.state[key];
      }

      return true;
    },
  };
}

/**
 * Type-safe way to extend the state with a specific shape
 *
 * @example
 * // Define your state shape
 * interface UserState {
 *   id: string;
 *   name: string;
 *   isAdmin: boolean;
 * }
 *
 * // Create a typed namespace
 * const userState = createTypedState<UserState>('user');
 *
 * // Now you have type-safe access
 * userState.set('id', '123'); // Works
 * userState.set('role', 'admin'); // TypeScript error
 */
export function createTypedState<T extends object>(namespace: string) {
  return {
    /**
     * Gets a typed value from state
     */
    get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] | undefined {
      return getState<T[K]>(`${namespace}.${String(key)}`, defaultValue);
    },

    /**
     * Sets a typed value in state
     */
    set<K extends keyof T>(key: K, value: T[K]): boolean {
      return setState<T[K]>(`${namespace}.${String(key)}`, value);
    },

    /**
     * Removes a typed value from state
     */
    remove<K extends keyof T>(key: K): boolean {
      return removeState(`${namespace}.${String(key)}`);
    },

    /**
     * Gets all typed values from this namespace
     */
    getAll(): Partial<T> {
      const context = getContext();
      if (!context) {
        return {};
      }

      const result = {} as Partial<T>;
      const prefix = `${namespace}.`;

      Object.entries(context.state)
        .filter(([key]) => key.startsWith(prefix))
        .forEach(([key, value]) => {
          const shortKey = key.slice(prefix.length) as keyof T;
          result[shortKey] = value as T[keyof T];
        });

      return result;
    },

    /**
     * Sets multiple typed values at once
     */
    setMany(values: Partial<T>): boolean {
      const context = getContext();
      if (!context) {
        return false;
      }

      const prefixedValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values)) {
        prefixedValues[`${namespace}.${key}`] = value;
      }

      Object.assign(context.state, prefixedValues);
      return true;
    },

    /**
     * Clears all state in this namespace
     */
    clear(): boolean {
      const context = getContext();
      if (!context) {
        return false;
      }

      const prefix = `${namespace}.`;
      const keysToRemove = Object.keys(context.state).filter(key => key.startsWith(prefix));

      for (const key of keysToRemove) {
        delete context.state[key];
      }

      return true;
    },
  };
}
