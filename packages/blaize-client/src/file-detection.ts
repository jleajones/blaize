/**
 * Platform-Aware File Detection for BlaizeJS Client
 *
 * Task [T2.1]: Implement Platform-Aware File Detection
 *
 * Detects File/Blob objects across different runtime environments:
 * - Browser (File, Blob)
 * - Node.js (fs.ReadStream, Buffer, File/Blob from node:buffer)
 *
 * Uses duck-typing for maximum compatibility.
 * Recursively searches objects and arrays up to 2 levels deep.
 *
 * @packageDocumentation
 */

/**
 * Check if a value is a File object (browser or Node.js)
 *
 * Detection strategy:
 * 1. instanceof File (if available in environment)
 * 2. Duck-typing: has name, size, type properties and methods
 *
 * @param value - Value to check
 * @returns true if value is a File-like object
 *
 * @internal
 */
function isFile(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  // Strategy 1: instanceof File (if File constructor exists)
  // Works in: Browser, Node.js 20+ (node:buffer)
  if (typeof File !== 'undefined' && value instanceof File) {
    return true;
  }

  // Strategy 2: Duck-typing for File-like objects
  // Required properties: name, size, type
  // Required methods: arrayBuffer, slice, stream, text
  const obj = value as any;

  const hasFileProps =
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    typeof obj.size === 'number' &&
    typeof obj.type === 'string';

  const hasFileMethods =
    typeof obj.arrayBuffer === 'function' &&
    typeof obj.slice === 'function' &&
    typeof obj.stream === 'function' &&
    typeof obj.text === 'function';

  return hasFileProps && hasFileMethods;
}

/**
 * Check if a value is a Blob object
 *
 * Detection strategy:
 * 1. instanceof Blob (if available in environment)
 * 2. Duck-typing: has size, type properties and methods
 *
 * @param value - Value to check
 * @returns true if value is a Blob-like object
 *
 * @internal
 */
function isBlob(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  // Strategy 1: instanceof Blob (if Blob constructor exists)
  // Works in: Browser, Node.js 18+ (node:buffer)
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return true;
  }

  // Strategy 2: Duck-typing for Blob-like objects
  // Required properties: size, type
  // Required methods: arrayBuffer, slice, stream, text
  const obj = value as any;

  const hasBlobProps =
    typeof obj === 'object' && typeof obj.size === 'number' && typeof obj.type === 'string';

  const hasBlobMethods =
    typeof obj.arrayBuffer === 'function' &&
    typeof obj.slice === 'function' &&
    typeof obj.stream === 'function' &&
    typeof obj.text === 'function';

  return hasBlobProps && hasBlobMethods;
}

/**
 * Check if a value is a Node.js Buffer
 *
 * Buffers are used in Node.js for binary data and can be sent
 * as file content in multipart/form-data.
 *
 * @param value - Value to check
 * @returns true if value is a Buffer
 *
 * @internal
 */
function isBuffer(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  // Check if Buffer exists (Node.js environment)
  if (typeof Buffer === 'undefined') {
    return false;
  }

  // Use Buffer.isBuffer() if available
  if (typeof Buffer.isBuffer === 'function') {
    return Buffer.isBuffer(value);
  }

  // Fallback: duck-typing
  const obj = value as any;
  return (
    typeof obj === 'object' &&
    typeof obj.length === 'number' &&
    typeof obj.toString === 'function' &&
    typeof obj.slice === 'function'
  );
}

/**
 * Check if a value is a Node.js Readable Stream (e.g., fs.ReadStream)
 *
 * Readable streams are commonly used in Node.js for file uploads.
 *
 * @param value - Value to check
 * @returns true if value is a Readable stream
 *
 * @internal
 */
function isReadableStream(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  const obj = value as any;

  // Duck-typing for Node.js Readable stream
  // Required: readable property and pipe/read methods
  return (
    typeof obj === 'object' &&
    obj.readable === true &&
    typeof obj.pipe === 'function' &&
    typeof obj.read === 'function' &&
    typeof obj.on === 'function'
  );
}

/**
 * Check if a value contains File or Blob objects
 *
 * Recursively searches through objects and arrays (2 levels deep)
 * to detect File/Blob/Buffer/Stream objects that require
 * multipart/form-data encoding.
 *
 * @param obj - Object to check for file objects
 * @returns true if any File-like objects are found
 *
 * @example Direct file
 * ```typescript
 * const file = new File(['content'], 'test.txt');
 * containsFileObjects(file); // true
 * ```
 *
 * @example File in object
 * ```typescript
 * const data = {
 *   name: 'John',
 *   avatar: new File(['...'], 'avatar.jpg')
 * };
 * containsFileObjects(data); // true
 * ```
 *
 * @example File in array
 * ```typescript
 * const data = {
 *   images: [
 *     new File(['...'], 'image1.jpg'),
 *     new File(['...'], 'image2.jpg')
 *   ]
 * };
 * containsFileObjects(data); // true
 * ```
 *
 * @example Nested file (1 level)
 * ```typescript
 * const data = {
 *   profile: {
 *     avatar: new File(['...'], 'avatar.jpg')
 *   }
 * };
 * containsFileObjects(data); // true
 * ```
 *
 * @example Deeply nested file (2 levels)
 * ```typescript
 * const data = {
 *   user: {
 *     profile: {
 *       avatar: new File(['...'], 'avatar.jpg')
 *     }
 *   }
 * };
 * containsFileObjects(data); // true
 * ```
 *
 * @example No files
 * ```typescript
 * const data = {
 *   name: 'John',
 *   age: 30,
 *   tags: ['developer', 'designer']
 * };
 * containsFileObjects(data); // false
 * ```
 */
export function containsFileObjects(obj: unknown): boolean {
  return containsFileObjectsRecursive(obj, 0);
}

/**
 * Internal recursive helper for file detection with depth tracking
 *
 * @param obj - Object to check
 * @param depth - Current recursion depth
 * @returns true if files found
 *
 * @internal
 */
function containsFileObjectsRecursive(obj: unknown, depth: number): boolean {
  // Null/undefined check
  if (obj === null || obj === undefined) {
    return false;
  }

  // Direct check: is this a File/Blob/Buffer/Stream?
  if (isFile(obj) || isBlob(obj) || isBuffer(obj) || isReadableStream(obj)) {
    return true;
  }

  // Stop recursion at depth limit (2 levels)
  if (depth >= 3) {
    return false;
  }

  // Not an object - no files possible
  if (typeof obj !== 'object') {
    return false;
  }

  // Check arrays
  if (Array.isArray(obj)) {
    return obj.some(item => containsFileObjectsRecursive(item, depth + 1));
  }

  // Check object properties
  const values = Object.values(obj);

  for (const value of values) {
    if (containsFileObjectsRecursive(value, depth + 1)) {
      return true;
    }
  }

  return false;
}

/**
 * Log development warning when files are detected in GET/DELETE requests
 *
 * GET and DELETE requests should not have request bodies according to
 * HTTP specifications, so files in these requests are likely a mistake.
 *
 * This warning only appears in development mode (NODE_ENV !== 'production').
 *
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 *
 * @internal
 */
export function warnFileInInvalidMethod(method: string): void {
  // Only warn in development
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return;
  }

  const upperMethod = method.toUpperCase();

  // Methods that should not have bodies
  const invalidMethods = ['GET', 'DELETE', 'HEAD', 'OPTIONS'];

  if (invalidMethods.includes(upperMethod)) {
    console.warn(
      `[BlaizeJS Client] Warning: File objects detected in ${upperMethod} request. ` +
        `${upperMethod} requests should not have request bodies. ` +
        `The files will be ignored by most servers. ` +
        `Consider using POST or PUT instead.`
    );
  }
}
