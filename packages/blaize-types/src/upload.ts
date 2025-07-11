import { WriteStream } from 'node:fs';
import { Readable } from 'node:stream';

/**
 * Represents an uploaded file in a multipart/form-data request
 */
export interface UploadedFile {
  /** Original filename provided by the client (may be undefined) */
  readonly filename: string | undefined;

  /** Form field name this file was uploaded under */
  readonly fieldname: string;

  /** MIME type of the uploaded file */
  readonly mimetype: string;

  /** Size of the file in bytes */
  readonly size: number;

  /** Stream containing the file data (always available) */
  readonly stream: Readable;

  /** Buffer containing file data (only available with 'memory' strategy) */
  readonly buffer?: Buffer;

  /** Path to temporary file (only available with 'temp' strategy) */
  readonly tempPath?: string;

  /** SHA-256 hash of file content (if computed) */
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
  buffer: Buffer;
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

  // 🆕 NEW: Validation tracking
  /**
   * Whether we've found at least one valid boundary marker
   */
  hasFoundValidBoundary: boolean;

  /**
   * Whether we've successfully processed at least one complete part (field or file)
   */
  hasProcessedAnyPart: boolean;

  /**
   * Whether parsing has reached the end boundary
   */
  isFinished: boolean;
}
