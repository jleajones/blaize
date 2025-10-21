/**
 * Transport utility functions
 *
 * Shared utilities for error serialization and metadata processing.
 *
 * @internal
 */

import type { LogMetadata, SerializedError } from '@blaize-types/logger';

/**
 * Check if a value is an Error object
 *
 * @param value - Value to check
 * @returns true if value is an Error
 */
function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Serialize an Error object to a plain object
 *
 * Extracts message, name, and stack trace for logging.
 *
 * @param error - Error object to serialize
 * @returns Serialized error object
 */
function serializeError(error: Error): SerializedError {
  return {
    message: error.message,
    name: error.name,
    stack: error.stack,
  };
}

/**
 * Serialize metadata, handling Error objects and circular references
 *
 * Recursively processes metadata to convert Error objects to plain objects
 * with message, name, and stack properties. Dates and other primitives pass through.
 *
 * @param meta - Metadata to serialize
 * @returns Serialized metadata safe for JSON.stringify
 */
export function serializeMetadata(meta: LogMetadata): LogMetadata {
  const serialized: LogMetadata = {};

  for (const [key, value] of Object.entries(meta)) {
    if (isError(value)) {
      // Serialize Error objects
      serialized[key] = serializeError(value);
    } else if (Array.isArray(value)) {
      // Handle arrays (may contain errors)
      serialized[key] = value.map(item => (isError(item) ? serializeError(item) : item));
    } else if (value instanceof Date) {
      // Dates pass through - JSON.stringify will convert to ISO string
      serialized[key] = value;
    } else if (value && typeof value === 'object') {
      // Handle nested objects (shallow check only for errors)
      // Deep recursion avoided to keep performance predictable
      const nested: Record<string, unknown> = {};
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        if (isError(nestedValue)) {
          nested[nestedKey] = serializeError(nestedValue);
        } else {
          // Let other values (including nested Dates) pass through
          nested[nestedKey] = nestedValue;
        }
      }
      serialized[key] = nested;
    } else {
      // Primitive values pass through
      serialized[key] = value;
    }
  }

  return serialized;
}

/**
 * JSON replacer function to handle circular references
 *
 * Replaces circular references with '[Circular]' marker.
 *
 * @returns Replacer function for JSON.stringify
 */
export function createCircularReplacer() {
  const seen = new WeakSet();

  return (_key: string, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  };
}
