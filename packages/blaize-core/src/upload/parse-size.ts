/**
 * Size parsing and formatting utilities for file validation
 *
 * Task [T1.3]: Implement parseSize() Utility with Binary Units
 *
 * All units use **binary base-1024** (not decimal base-1000):
 * - 1 KB = 1024 bytes (not 1000)
 * - 1 MB = 1024^2 bytes = 1,048,576 bytes
 * - 1 GB = 1024^3 bytes = 1,073,741,824 bytes
 * - etc.
 *
 * @packageDocumentation
 */

// Use BlaizeJS ValidationError for consistency
import { ValidationError } from '../errors/validation-error';

/**
 * Size units mapping to bytes (binary base-1024)
 *
 * Supports both standard (KB, MB) and IEC (KiB, MiB) notations.
 * All units are binary: 1 KB = 1024 bytes, not 1000.
 */
const SIZE_UNITS = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
} as const;

type SizeUnit = keyof typeof SIZE_UNITS;

/**
 * Parse human-readable file size to bytes using **binary units**
 *
 * **IMPORTANT:** All units use base-1024 (binary), not base-1000:
 * - 1 KB = 1024 bytes
 * - 1 MB = 1,048,576 bytes (1024²)
 * - 1 GB = 1,073,741,824 bytes (1024³)
 * - 1 TB = 1,099,511,627,776 bytes (1024⁴)
 *
 * Supported units:
 * - Bytes: `B`
 * - Kilobytes: `KB` or `KiB`
 * - Megabytes: `MB` or `MiB`
 * - Gigabytes: `GB` or `GiB`
 * - Terabytes: `TB` or `TiB`
 *
 * @param size - Size string (e.g., "5MB", "100KB") or number (bytes)
 * @returns Size in bytes
 * @throws {Error} If size format is invalid, unit is unknown, or size is negative
 *
 * @example Parse standard units
 * ```typescript
 * parseSize('5MB');    // 5,242,880 bytes (5 * 1024 * 1024)
 * parseSize('100KB');  // 102,400 bytes (100 * 1024)
 * parseSize('1GB');    // 1,073,741,824 bytes (1024^3)
 * ```
 *
 * @example Parse with decimals
 * ```typescript
 * parseSize('1.5MB');  // 1,572,864 bytes
 * parseSize('0.5GB');  // 536,870,912 bytes
 * ```
 *
 * @example Parse IEC units
 * ```typescript
 * parseSize('5MiB');   // 5,242,880 bytes (same as 5MB)
 * parseSize('1GiB');   // 1,073,741,824 bytes (same as 1GB)
 * ```
 *
 * @example Numbers treated as bytes
 * ```typescript
 * parseSize(1024);     // 1024 bytes
 * parseSize('1024');   // 1024 bytes
 * ```
 *
 * @example Whitespace handling
 * ```typescript
 * parseSize('5 MB');   // 5,242,880 bytes (whitespace allowed)
 * parseSize('  10KB'); // 10,240 bytes (leading/trailing trimmed)
 * ```
 *
 * @example Error cases
 * ```typescript
 * parseSize('-5MB');   // throws "Size cannot be negative"
 * parseSize('5PB');    // throws "Invalid size unit: PB"
 * parseSize('abc');    // throws "Invalid size format"
 * ```
 */
export function parseSize(size: string | number): number {
  // Handle numeric input
  if (typeof size === 'number') {
    if (isNaN(size)) {
      throw new ValidationError('Invalid size format: NaN is not a valid size');
    }
    if (!isFinite(size)) {
      throw new ValidationError('Size cannot be Infinity');
    }
    if (size < 0) {
      throw new ValidationError('Size cannot be negative');
    }
    return Math.round(size);
  }

  // Handle string input
  const trimmed = size.trim();

  if (!trimmed) {
    throw new ValidationError('Invalid size format: empty string');
  }

  // Try to match pattern: number + optional whitespace + unit
  // Examples: "5MB", "5 MB", "1.5GB", "100B"
  const pattern = /^(-?[\d.]+)\s*([A-Za-z]+)?$/;
  const match = trimmed.match(pattern);

  if (!match) {
    throw new ValidationError(`Invalid size format: "${size}"`);
  }

  const [, numberStr, unitStr] = match;
  const number = parseFloat(numberStr!);

  // Validate number
  if (isNaN(number)) {
    throw new ValidationError(`Invalid size format: "${size}" contains invalid number`);
  }

  if (!isFinite(number)) {
    throw new ValidationError('Size cannot be Infinity');
  }

  if (number < 0) {
    throw new ValidationError('Size cannot be negative');
  }

  // If no unit specified, treat as bytes
  if (!unitStr) {
    return Math.round(number);
  }

  // Normalize unit (handle case variations like 'mb', 'Mb', 'MB')
  // unitStr is guaranteed to be string here because regex captured it
  const normalizedUnit = unitStr.replace(/^([kmgt])(i)?b$/i, (_match, base, i) => {
    return `${base.toUpperCase()}${i ? 'i' : ''}B`;
  });

  // Check if unit exists
  if (!(normalizedUnit in SIZE_UNITS)) {
    throw new ValidationError(
      `Invalid size unit: ${unitStr}. Supported units: ${Object.keys(SIZE_UNITS).join(', ')}`
    );
  }

  const multiplier = SIZE_UNITS[normalizedUnit as SizeUnit];
  const bytes = number * multiplier;

  return Math.round(bytes);
}

/**
 * Format bytes to human-readable size string
 *
 * Automatically selects the most appropriate unit (B, KB, MB, GB, TB).
 * Uses **binary units** (base-1024) to match parseSize() behavior.
 *
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted size string
 *
 * @example Format various sizes
 * ```typescript
 * formatBytes(0);                    // "0 B"
 * formatBytes(100);                  // "100 B"
 * formatBytes(1024);                 // "1 KB"
 * formatBytes(1536);                 // "1.5 KB"
 * formatBytes(5242880);              // "5 MB"
 * formatBytes(1073741824);           // "1 GB"
 * formatBytes(1099511627776);        // "1 TB"
 * ```
 *
 * @example Round-trip consistency
 * ```typescript
 * const size = '5MB';
 * const bytes = parseSize(size);     // 5,242,880
 * const formatted = formatBytes(bytes); // "5 MB"
 * const reparsed = parseSize(formatted); // 5,242,880
 * // bytes === reparsed ✅
 * ```
 *
 * @example Use in error messages
 * ```typescript
 * const maxSize = parseSize('10MB');
 * const actualSize = parseSize('15MB');
 *
 * throw new Error(
 *   `File size ${formatBytes(actualSize)} exceeds maximum ${formatBytes(maxSize)}`
 * );
 * // Error: File size 15 MB exceeds maximum 10 MB
 * ```
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  // Handle zero
  if (bytes === 0) {
    return '0 B';
  }

  // Handle negative (preserve sign)
  const isNegative = bytes < 0;
  const absBytes = Math.abs(bytes);

  // Determine appropriate unit
  const units: SizeUnit[] = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = absBytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  // Format number
  const formatted =
    size % 1 === 0
      ? size.toString() // Whole number, no decimals
      : size.toFixed(decimals).replace(/\.?0+$/, ''); // Remove trailing zeros

  const sign = isNegative ? '-' : '';
  return `${sign}${formatted} ${units[unitIndex]}`;
}
