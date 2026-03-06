import type { Context } from '../../../packages/blaize-types/src/context';

/**
 * Supported compression algorithms
 */
export type CompressionAlgorithm = 'gzip' | 'deflate' | 'br' | 'identity';

/**
 * Compression level presets
 */
export type CompressionLevel = 'fastest' | 'default' | 'best' | number;

/**
 * Function-based content type filter
 */
export type ContentTypeFilterFunction = (contentType: string) => boolean;

/**
 * Configuration-based content type filter
 */
export interface ContentTypeFilterConfig {
  /** Content types to include (supports glob patterns) */
  include?: string[];
  /** Content types to exclude (supports glob patterns) */
  exclude?: string[];
}

/**
 * Content type filter — can be a function or a config object
 */
export type ContentTypeFilter = ContentTypeFilterFunction | ContentTypeFilterConfig;

/**
 * Compression middleware options
 */
export interface CompressionOptions {
  /** Preferred algorithm order (default: ['br', 'gzip', 'deflate']) */
  algorithms?: CompressionAlgorithm[];

  /** Compression level (default: 'default') */
  level?: CompressionLevel;

  /** Minimum response size in bytes to compress (default: 1024) */
  threshold?: number;

  /** Content type filter for deciding what to compress */
  contentTypeFilter?: ContentTypeFilter;

  /** Custom skip function — return true to skip compression */
  skip?: (ctx: Context) => boolean | Promise<boolean>;

  /** Whether to set the Vary: Accept-Encoding header (default: true) */
  vary?: boolean;

  /** Whether to flush compression buffers on each write (default: false) */
  flush?: boolean;

  /** Memory level for zlib-based algorithms (1-9) */
  memoryLevel?: number;

  /** Window bits for zlib-based algorithms */
  windowBits?: number;

  /** Brotli-specific quality setting (0-11) */
  brotliQuality?: number;

  /** Use a preset configuration */
  preset?: CompressionPreset;
}

/**
 * Reason why compression was skipped for a response
 */
export type CompressionSkipReason =
  | 'below-threshold'
  | 'content-type-excluded'
  | 'no-acceptable-encoding'
  | 'already-compressed'
  | 'skip-function'
  | 'no-content'
  | 'cache-hit';

/**
 * Result of a compression operation
 */
export interface CompressionResult {
  /** Whether the response was compressed */
  compressed: boolean;
  /** Algorithm used (if compressed) */
  algorithm?: CompressionAlgorithm;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes (equals originalSize if not compressed) */
  compressedSize: number;
  /** Compression ratio (0-1, lower is better) */
  ratio: number;
  /** Reason compression was skipped (if not compressed) */
  skipReason?: CompressionSkipReason;
}

/**
 * Metrics collected during compression
 */
export interface CompressionMetrics {
  /** Total requests processed */
  totalRequests: number;
  /** Total requests compressed */
  compressedRequests: number;
  /** Total requests skipped */
  skippedRequests: number;
  /** Total original bytes */
  totalOriginalBytes: number;
  /** Total compressed bytes */
  totalCompressedBytes: number;
  /** Average compression ratio */
  averageRatio: number;
  /** Breakdown by algorithm */
  byAlgorithm: Record<CompressionAlgorithm, number>;
  /** Breakdown by skip reason */
  bySkipReason: Record<CompressionSkipReason, number>;
}

/**
 * Named compression presets for common use cases
 */
export type CompressionPreset = 'fast' | 'balanced' | 'maximum' | 'api' | 'static';

