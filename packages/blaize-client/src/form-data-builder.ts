/**
 * FormData Builder for BlaizeJS Client
 *
 * Task [T2.2]: Implement FormData Builder with Serialization Strategy
 *
 * Converts request arguments (body + files) to FormData for multipart uploads.
 * Supports both legacy body-only pattern and new body+files pattern.
 *
 * @packageDocumentation
 */

import type { InternalRequestArgs } from '@blaize-types/client';

/**
 * Check if a value is a File object (browser or Node.js)
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
  if (typeof File !== 'undefined' && value instanceof File) {
    return true;
  }

  // Strategy 2: Duck-typing for File-like objects
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
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return true;
  }

  // Strategy 2: Duck-typing for Blob-like objects
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

  return false;
}

/**
 * Check if a value is a File, Blob, or Buffer
 *
 * @param value - Value to check
 * @returns true if value is a file-like object
 *
 * @internal
 */
function isFileOrBlob(value: unknown): boolean {
  return isFile(value) || isBlob(value) || isBuffer(value);
}

/**
 * Build FormData from request arguments
 *
 * Handles both legacy body-only pattern and new body+files pattern.
 * Converts various data types to appropriate FormData entries.
 *
 * **Serialization Strategy (priority order):**
 * 1. Files/Blob/Buffer → append directly (native)
 * 2. String → append as-is (no transformation)
 * 3. Number/Boolean → String(value)
 * 4. Object/Array → JSON.stringify(value)
 * 5. undefined/null → skip (don't append)
 * 6. Function → skip (with dev warning)
 *
 * **Array Handling:**
 * - Array of files → append multiple times with same key
 * - Array of primitives → JSON.stringify
 * - Mixed array → JSON.stringify (files should be in separate field)
 *
 * **Precedence:**
 * When both `body` and `files` properties exist, `files` takes precedence
 * for keys that appear in both objects.
 *
 * @param args - Request arguments with optional body and files
 * @returns FormData ready for multipart upload
 *
 * @example Primitives
 * ```typescript
 * const formData = buildFormData({
 *   body: { name: 'John', age: 30, active: true }
 * });
 * // FormData: name="John", age="30", active="true"
 * ```
 *
 * @example Objects and Arrays
 * ```typescript
 * const formData = buildFormData({
 *   body: {
 *     user: { name: 'John', role: 'admin' },
 *     tags: ['typescript', 'nodejs']
 *   }
 * });
 * // FormData: user='{"name":"John","role":"admin"}', tags='["typescript","nodejs"]'
 * ```
 *
 * @example File Upload
 * ```typescript
 * const formData = buildFormData({
 *   files: { avatar: fileObject }
 * });
 * // FormData: avatar=<File object>
 * ```
 *
 * @example Mixed (body + files)
 * ```typescript
 * const formData = buildFormData({
 *   body: {
 *     title: 'Document',
 *     metadata: { author: 'John', version: 1 }
 *   },
 *   files: {
 *     document: pdfFile
 *   }
 * });
 * // FormData: title="Document", metadata='{"author":"John","version":1}', document=<File>
 * ```
 *
 * @example File Array
 * ```typescript
 * const formData = buildFormData({
 *   files: {
 *     photos: [img1, img2, img3]
 *   }
 * });
 * // FormData: photos=<File>, photos=<File>, photos=<File>
 * // Server receives array of files
 * ```
 *
 * @example Server Coercion
 * ```typescript
 * const formData = buildFormData({
 *   body: { count: '42', price: '99.99' }
 * });
 * // Server with z.object({ count: z.coerce.number(), price: z.coerce.number() })
 * // Receives: { count: 42, price: 99.99 } (numbers, not strings)
 * ```
 */
export function buildFormData(args: InternalRequestArgs): FormData {
  const formData = new FormData();

  // Merge body and files (files take precedence for same keys)
  // Start with body, then override with files
  const allData: Record<string, any> = {};

  // Add body properties first
  if (args.body && typeof args.body === 'object') {
    Object.assign(allData, args.body);
  }

  // Add/override with files properties (takes precedence)
  if (args.files && typeof args.files === 'object') {
    Object.assign(allData, args.files);
  }

  // Process each field
  for (const [key, value] of Object.entries(allData)) {
    appendToFormData(formData, key, value);
  }

  return formData;
}

/**
 * Append a value to FormData with appropriate serialization
 *
 * @param formData - FormData to append to
 * @param key - Field name
 * @param value - Value to append
 *
 * @internal
 */
function appendToFormData(formData: FormData, key: string, value: unknown): void {
  // 1. Skip null/undefined
  if (value === null || value === undefined) {
    return;
  }

  // 2. Skip functions (with dev warning)
  if (typeof value === 'function') {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.warn(
        `[BlaizeJS Client] Skipping function value for key "${key}". ` +
          `Functions cannot be serialized in FormData.`
      );
    }
    return;
  }

  // 3. File/Blob/Buffer → append directly
  if (isFileOrBlob(value)) {
    formData.append(key, value as File | Blob);
    return;
  }

  // 4. Array handling
  if (Array.isArray(value)) {
    // Empty array → skip
    if (value.length === 0) {
      return;
    }

    // Array of files → append each file with same key
    if (value.every(isFileOrBlob)) {
      value.forEach(file => {
        formData.append(key, file as File | Blob);
      });
      return;
    }

    // Mixed or primitive array → JSON stringify
    // Note: Mixed arrays (files + primitives) should be avoided
    // Files should be in separate fields for clarity
    formData.append(key, JSON.stringify(value));
    return;
  }

  // 5. String → append as-is
  if (typeof value === 'string') {
    formData.append(key, value);
    return;
  }

  // 6. Number → String(value)
  if (typeof value === 'number') {
    formData.append(key, String(value));
    return;
  }

  // 7. Boolean → String(value)
  if (typeof value === 'boolean') {
    formData.append(key, String(value));
    return;
  }

  // 8. Object → JSON stringify
  if (typeof value === 'object') {
    formData.append(key, JSON.stringify(value));
    return;
  }

  // 9. Unknown type → skip with dev warning
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.warn(
      `[BlaizeJS Client] Skipping unsupported value type "${typeof value}" for key "${key}".`
    );
  }
}
