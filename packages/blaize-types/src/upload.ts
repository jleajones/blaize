/**
 * Upload types for BlaizeJS
 *
 * Updated in Task [T1.2] to support file validation
 * - Added originalname field (standard in multipart parsers)
 * - Added encoding field
 * - Made buffer non-optional (always available with memory strategy)
 *
 * @packageDocumentation
 */

import { WriteStream } from 'node:fs';
import { Readable } from 'node:stream';

/**
 * Represents an uploaded file in a multipart/form-data request
 *
 * This interface matches the standard output from multipart parsers
 * like multer, busboy, and formidable.
 *
 */
export interface UploadedFile {
  /** Form field name this file was uploaded under */
  readonly fieldname: string;

  /**
   * Original filename from the client
   *
   * @example "photo.jpg", "document.pdf"
   */
  readonly originalname: string;

  /**
   * File encoding (e.g., "7bit", "8bit", "binary")
   *
   */
  readonly encoding: string;

  /** MIME type of the uploaded file */
  readonly mimetype: string;

  /** Size of the file in bytes */
  readonly size: number;

  /**
   * Stream containing the file data
   *
   * Available with 'stream' strategy.
   * For 'memory' strategy, create stream from buffer if needed.
   */
  readonly stream?: Readable;

  /**
   * Buffer containing complete file data
   *
   * Optional with 'stream' or 'temp' strategies.
   */
  readonly buffer?: Buffer;

  /**
   * Path to temporary file on disk
   *
   * Only available with 'temp' strategy.
   */
  readonly tempPath?: string;

  /**
   * SHA-256 hash of file content
   *
   * Only computed if `computeHash: true` in parse options.
   */
  readonly hash?: string;
}

/**
 * Complete multipart/form-data parsed content
 */
export interface MultipartData {
  /** Form fields (non-file inputs) */
  readonly fields: Record<string, string | string[]>;

  /** Uploaded files */
  readonly files: Record<string, UploadedFile | UploadedFile[]>;
}

/**
 * Options for parsing multipart/form-data
 */
export interface ParseOptions {
  /** Maximum size for individual files in bytes (default: 10MB) */
  readonly maxFileSize?: number;

  /** Maximum number of files per request (default: 10) */
  readonly maxFiles?: number;

  /** Maximum size for form fields in bytes (default: 1MB) */
  readonly maxFieldSize?: number;

  /** Allowed MIME types (empty array = allow all) */
  readonly allowedMimeTypes?: readonly string[];

  /** Allowed file extensions (empty array = allow all) */
  readonly allowedExtensions?: readonly string[];

  /** Processing strategy for file data */
  readonly strategy: 'memory' | 'stream' | 'temp';

  /** Directory for temporary files (strategy: 'temp' only) */
  readonly tempDir?: string;

  /** Whether to compute SHA-256 hash of files */
  readonly computeHash?: boolean;
}

/**
 * Result of parsing multipart data with metadata
 */
export interface ParseResult {
  /** Parsed multipart data */
  readonly data: MultipartData;

  /** Parsing metadata */
  readonly metadata: {
    /** Total time spent parsing (milliseconds) */
    readonly parseTime: number;

    /** Total size of all uploaded content */
    readonly totalSize: number;

    /** Number of files processed */
    readonly fileCount: number;

    /** Number of fields processed */
    readonly fieldCount: number;
  };
}

/**
 * Error information for multipart parsing failures
 */
export interface MultipartError {
  /** Error type/code */
  readonly type:
    | 'boundary_missing'
    | 'size_exceeded'
    | 'file_limit_exceeded'
    | 'mime_type_forbidden'
    | 'extension_forbidden'
    | 'parse_error'
    | 'stream_error'
    | 'temp_file_error';

  /** Human-readable error message */
  readonly message: string;

  /** Additional context (field name, file name, etc.) */
  readonly context?: Record<string, unknown>;

  /** Original error if available */
  readonly cause?: Error;
}

/**
 * Configuration for file upload validation
 */
export interface ValidationConfig {
  /** File size constraints */
  readonly size?: {
    readonly min?: number;
    readonly max?: number;
  };

  /** File count constraints */
  readonly count?: {
    readonly min?: number;
    readonly max?: number;
  };

  /** MIME type constraints */
  readonly mimeTypes?: {
    readonly allowed?: readonly string[];
    readonly forbidden?: readonly string[];
  };

  /** File extension constraints */
  readonly extensions?: {
    readonly allowed?: readonly string[];
    readonly forbidden?: readonly string[];
  };

  /** Custom validation function */
  readonly custom?: (file: UploadedFile) => Promise<boolean> | boolean;
}

/**
 * File processing configuration
 */
export interface ProcessingConfig {
  /** Whether to process files concurrently */
  readonly concurrent?: boolean;

  /** Maximum concurrent processing operations */
  readonly maxConcurrency?: number;

  /** Processing timeout in milliseconds */
  readonly timeout?: number;

  /** Whether to preserve original files during processing */
  readonly preserveOriginal?: boolean;
}

/**
 * Upload progress information (for future streaming uploads)
 */
export interface UploadProgress {
  /** Bytes uploaded so far */
  readonly bytesUploaded: number;

  /** Total bytes to upload */
  readonly totalBytes: number;

  /** Upload percentage (0-100) */
  readonly percentage: number;

  /** Upload speed in bytes per second */
  readonly speed: number;

  /** Estimated time remaining in milliseconds */
  readonly eta: number;
}

/**
 * Internal state for multipart parser state machine
 */
export interface ParserState {
  // Parsing configuration
  boundary: Buffer;
  options: Required<ParseOptions>;

  // Collections
  fields: Map<string, string[]>;
  files: Map<string, UploadedFile[]>;

  // Buffer management
  buffer: Buffer<ArrayBufferLike>;
  stage: 'boundary' | 'headers' | 'content';

  // Current part state
  currentHeaders: string;
  currentField: string | null;
  currentFilename: string | undefined;
  currentMimetype: string;
  currentContentLength: number;

  // Counters
  fileCount: number;
  fieldCount: number;

  // Processing state
  currentBufferChunks: Buffer[];
  currentStream: Readable | null;
  currentTempPath: string | null;
  currentWriteStream: WriteStream | null;
  streamController: ReadableStreamDefaultController<Uint8Array> | null;

  // Cleanup
  cleanupTasks: Array<() => Promise<void>>;

  // Validation tracking
  hasFoundValidBoundary: boolean;
  hasProcessedAnyPart: boolean;
  isFinished: boolean;
}

/**
 * Options for file schema validation
 *
 * @example Basic size limit
 * ```typescript
 * const schema = file({ maxSize: '5MB' });
 * ```
 *
 * @example MIME type restrictions
 * ```typescript
 * const schema = file({
 *   accept: ['image/jpeg', 'image/png'],
 *   maxSize: '10MB'
 * });
 * ```
 *
 * @example Wildcard MIME types
 * ```typescript
 * const schema = file({
 *   accept: ['image/*', 'video/*'],
 *   maxSize: '50MB'
 * });
 * ```
 */
export interface FileSchemaOptions {
  /**
   * Maximum file size
   *
   * Accepts human-readable strings (e.g., "5MB") or bytes as number.
   * Uses binary units: 1 MB = 1,048,576 bytes (1024²).
   *
   * @example
   * ```typescript
   * maxSize: '5MB'      // 5,242,880 bytes
   * maxSize: '100KB'    // 102,400 bytes
   * maxSize: 1024000    // 1,024,000 bytes
   * ```
   */
  maxSize?: string | number;

  /**
   * Minimum file size
   *
   * Accepts human-readable strings (e.g., "100KB") or bytes as number.
   * Useful for preventing empty or tiny files.
   *
   * @example
   * ```typescript
   * minSize: '100KB'    // Require at least 100KB
   * minSize: '1MB'      // Require at least 1MB
   * ```
   */
  minSize?: string | number;

  /**
   * Accepted MIME types
   *
   * Array of exact MIME types or wildcard patterns.
   * Wildcards use `type/*` syntax (e.g., `image/*`).
   *
   * @example Exact matches
   * ```typescript
   * accept: ['image/jpeg', 'image/png', 'application/pdf']
   * ```
   *
   * @example Wildcards
   * ```typescript
   * accept: ['image/*']  // All images
   * accept: ['video/*']  // All videos
   * ```
   *
   * @example Mixed
   * ```typescript
   * accept: ['image/*', 'application/pdf']  // All images + PDFs
   * ```
   */
  accept?: string[];
}
