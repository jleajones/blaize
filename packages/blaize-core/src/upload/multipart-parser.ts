import { randomUUID } from 'node:crypto';
import { createWriteStream, type WriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { extractBoundary, parseContentDisposition, parseContentType } from './utils';

import type { UnifiedRequest } from '@blaize-types/context';
import type { UploadedFile, MultipartData, ParseOptions, ParserState } from '@blaize-types/upload';

// Default options with sensible defaults
const DEFAULT_OPTIONS: Required<ParseOptions> = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  maxFieldSize: 1 * 1024 * 1024, // 1MB
  allowedMimeTypes: [],
  allowedExtensions: [],
  strategy: 'stream',
  tempDir: tmpdir(),
  computeHash: false,
};

/**
 * Create initial parser state
 */
function createParserState(boundary: string, options: Partial<ParseOptions> = {}): ParserState {
  return {
    boundary: Buffer.from(`--${boundary}`),
    options: { ...DEFAULT_OPTIONS, ...options },
    fields: new Map(),
    files: new Map(),
    buffer: Buffer.alloc(0),
    stage: 'boundary',
    currentHeaders: '',
    currentField: null,
    currentFilename: undefined,
    currentMimetype: 'application/octet-stream',
    currentContentLength: 0,
    fileCount: 0,
    fieldCount: 0,
    currentBufferChunks: [],
    currentStream: null,
    currentTempPath: null,
    currentWriteStream: null,
    streamController: null,
    cleanupTasks: [],
    // Track validation state
    hasFoundValidBoundary: false,
    hasProcessedAnyPart: false,
    isFinished: false,
  };
}

/**
 * Process a chunk of data through the parser state machine
 */
async function processChunk(state: ParserState, chunk: Buffer): Promise<ParserState> {
  const newBuffer = Buffer.concat([state.buffer, chunk]);
  let currentState = { ...state, buffer: newBuffer };

  // Process buffer until no more progress can be made
  while (currentState.buffer.length > 0 && !currentState.isFinished) {
    const nextState = await processCurrentStage(currentState);
    if (nextState === currentState) break; // No progress made, need more data
    currentState = nextState;
  }

  return currentState;
}

/**
 * Process current stage of parsing
 */
async function processCurrentStage(state: ParserState): Promise<ParserState> {
  switch (state.stage) {
    case 'boundary':
      return processBoundary(state);
    case 'headers':
      return processHeaders(state);
    case 'content':
      return processContent(state);
    default:
      throw new Error(`Invalid parser stage: ${state.stage}`);
  }
}

/**
 * Process boundary detection
 */
function processBoundary(state: ParserState): ParserState {
  const boundaryIndex = state.buffer.indexOf(state.boundary);
  if (boundaryIndex === -1) return state;

  // Mark that we found at least one boundary
  const hasFoundValidBoundary = true;

  // Consume boundary and check for end
  let buffer = state.buffer.subarray(boundaryIndex + state.boundary.length);

  // Check for end boundary (-- after boundary)
  if (buffer.length >= 2 && buffer.subarray(0, 2).equals(Buffer.from('--'))) {
    return {
      ...state,
      buffer,
      hasFoundValidBoundary,
      isFinished: true,
      stage: 'boundary',
    };
  }

  // Skip CRLF after boundary
  if (buffer.length >= 2 && buffer.subarray(0, 2).equals(Buffer.from('\r\n'))) {
    buffer = buffer.subarray(2);
  }

  return {
    ...state,
    buffer,
    hasFoundValidBoundary,
    stage: 'headers',
    currentHeaders: '',
  };
}

/**
 * Process headers section
 */
function processHeaders(state: ParserState): ParserState {
  const headerEnd = state.buffer.indexOf('\r\n\r\n');
  if (headerEnd === -1) return state;

  const headers = state.buffer.subarray(0, headerEnd).toString('utf8');
  const buffer = state.buffer.subarray(headerEnd + 4);

  const disposition = parseContentDisposition(headers);
  if (!disposition) {
    throw new Error('Missing Content-Disposition header');
  }

  const mimetype = parseContentType(headers);
  const isFile = disposition.filename !== undefined;

  // Validation
  if (isFile && state.fileCount >= state.options.maxFiles) {
    throw new Error(`Too many files. Maximum ${state.options.maxFiles} allowed`);
  }

  if (
    isFile &&
    state.options.allowedMimeTypes.length > 0 &&
    !state.options.allowedMimeTypes.includes(mimetype)
  ) {
    throw new Error(`File type ${mimetype} not allowed`);
  }

  return {
    ...state,
    buffer,
    stage: 'content',
    currentHeaders: headers,
    currentField: disposition.name,
    currentFilename: disposition.filename,
    currentMimetype: mimetype,
    currentContentLength: 0,
    fileCount: isFile ? state.fileCount + 1 : state.fileCount,
    fieldCount: isFile ? state.fieldCount : state.fieldCount + 1,
    currentBufferChunks: [],
  };
}

/**
 * Process content section
 */
async function processContent(state: ParserState): Promise<ParserState> {
  const nextBoundaryIndex = state.buffer.indexOf(state.boundary);

  let contentChunk: Buffer;
  let isComplete = false;
  let buffer = state.buffer;

  if (nextBoundaryIndex === -1) {
    // No boundary found, process safely
    const safeLength = Math.max(0, state.buffer.length - state.boundary.length);
    if (safeLength === 0) return state; // Need more data

    contentChunk = state.buffer.subarray(0, safeLength);
    buffer = state.buffer.subarray(safeLength);
  } else {
    // Found boundary, process content before it (minus CRLF)
    const contentEnd = Math.max(0, nextBoundaryIndex - 2);
    contentChunk = state.buffer.subarray(0, contentEnd);
    buffer = state.buffer.subarray(nextBoundaryIndex);
    isComplete = true;
  }

  let updatedState = { ...state, buffer };

  if (contentChunk.length > 0) {
    updatedState = await processContentChunk(updatedState, contentChunk);
  }

  if (isComplete) {
    updatedState = await finalizeCurrentPart(updatedState);
    updatedState = {
      ...updatedState,
      stage: 'boundary' as const,
      hasProcessedAnyPart: true, // Mark that we've processed at least one part
    };
  }

  return updatedState;
}

/**
 * Process a chunk of content data
 */
async function processContentChunk(state: ParserState, chunk: Buffer): Promise<ParserState> {
  const newContentLength = state.currentContentLength + chunk.length;

  // Size validation
  const maxSize =
    state.currentFilename !== undefined ? state.options.maxFileSize : state.options.maxFieldSize;

  if (newContentLength > maxSize) {
    const type = state.currentFilename !== undefined ? 'file' : 'field';
    throw new Error(`${type} too large. Maximum ${maxSize} bytes allowed`);
  }

  if (state.currentFilename !== undefined) {
    return processFileChunk(state, chunk, newContentLength);
  } else {
    return {
      ...state,
      currentContentLength: newContentLength,
      currentBufferChunks: [...state.currentBufferChunks, chunk],
    };
  }
}

/**
 * Process file chunk based on strategy
 */
async function processFileChunk(
  state: ParserState,
  chunk: Buffer,
  newContentLength: number
): Promise<ParserState> {
  switch (state.options.strategy) {
    case 'memory':
      return {
        ...state,
        currentContentLength: newContentLength,
        currentBufferChunks: [...state.currentBufferChunks, chunk],
      };

    case 'stream':
      if (state.streamController) {
        state.streamController.enqueue(chunk);
      }
      return { ...state, currentContentLength: newContentLength };

    case 'temp':
      if (state.currentWriteStream) {
        await writeToStream(state.currentWriteStream, chunk);
      }
      return { ...state, currentContentLength: newContentLength };

    default:
      throw new Error(`Invalid strategy: ${state.options.strategy}`);
  }
}

/**
 * Initialize file processing for current part
 */
async function initializeFileProcessing(state: ParserState): Promise<ParserState> {
  if (state.currentFilename === undefined) return state;

  switch (state.options.strategy) {
    case 'memory':
      return { ...state, currentBufferChunks: [] };

    case 'stream': {
      let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
      const stream = new ReadableStream<Uint8Array>({
        start: controller => {
          streamController = controller;
        },
      });

      return {
        ...state,
        currentStream: stream as any, // Type cast for Node.js compatibility
        streamController,
      };
    }

    case 'temp': {
      const tempPath = join(state.options.tempDir, `upload-${randomUUID()}`);
      const writeStream = createWriteStream(tempPath);
      const cleanupTask = async () => {
        try {
          const { unlink } = await import('node:fs/promises');
          await unlink(tempPath);
        } catch (error) {
          console.warn(`Failed to cleanup temp file: ${tempPath}`, error);
        }
      };

      return {
        ...state,
        currentTempPath: tempPath,
        currentWriteStream: writeStream,
        cleanupTasks: [...state.cleanupTasks, cleanupTask],
      };
    }

    default:
      throw new Error(`Invalid strategy: ${state.options.strategy}`);
  }
}

/**
 * Finalize current part and add to collections
 */
async function finalizeCurrentPart(state: ParserState): Promise<ParserState> {
  if (!state.currentField) return resetCurrentPart(state);

  if (state.currentFilename !== undefined) {
    return finalizeFile(state);
  } else {
    return finalizeField(state);
  }
}

/**
 * Finalize file processing
 */
async function finalizeFile(state: ParserState): Promise<ParserState> {
  if (!state.currentField || state.currentFilename === undefined) {
    return resetCurrentPart(state);
  }

  let stream: Readable;
  let buffer: Buffer | undefined;
  let tempPath: string | undefined;

  switch (state.options.strategy) {
    case 'memory':
      buffer = Buffer.concat(state.currentBufferChunks);
      stream = Readable.from(buffer);
      break;

    case 'stream':
      if (state.streamController) {
        state.streamController.close();
      }
      stream = state.currentStream!;
      break;

    case 'temp':
      if (state.currentWriteStream) {
        await closeStream(state.currentWriteStream);
      }
      tempPath = state.currentTempPath!;
      stream = Readable.from(Buffer.alloc(0)); // Placeholder
      break;

    default:
      throw new Error(`Invalid strategy: ${state.options.strategy}`);
  }

  const file: UploadedFile = {
    filename: state.currentFilename,
    fieldname: state.currentField,
    mimetype: state.currentMimetype,
    size: state.currentContentLength,
    stream,
    buffer,
    tempPath,
  };

  const updatedFiles = addToCollection(state.files, state.currentField, file);

  return {
    ...resetCurrentPart(state),
    files: updatedFiles,
  };
}

/**
 * Finalize field processing
 */
function finalizeField(state: ParserState): ParserState {
  if (!state.currentField) return resetCurrentPart(state);

  const value = Buffer.concat(state.currentBufferChunks).toString('utf8');
  const updatedFields = addToCollection(state.fields, state.currentField, value);

  return {
    ...resetCurrentPart(state),
    fields: updatedFields,
  };
}

/**
 * Reset current part state
 */
function resetCurrentPart(state: ParserState): ParserState {
  return {
    ...state,
    currentField: null,
    currentFilename: undefined,
    currentContentLength: 0,
    currentBufferChunks: [],
    currentStream: null,
    streamController: null,
    currentTempPath: null,
    currentWriteStream: null,
  };
}

/**
 * Add item to collection immutably
 */
function addToCollection<T>(collection: Map<string, T[]>, key: string, value: T): Map<string, T[]> {
  const newCollection = new Map(collection);
  const existing = newCollection.get(key) || [];
  newCollection.set(key, [...existing, value]);
  return newCollection;
}

/**
 * Finalize parsing and return results
 */
function finalize(state: ParserState): MultipartData {
  // Validate that we found valid multipart data
  if (!state.hasFoundValidBoundary) {
    throw new Error('No valid multipart data found');
  }

  // If we found boundaries but didn't process any parts, it's empty/invalid
  if (state.hasFoundValidBoundary && !state.hasProcessedAnyPart) {
    throw new Error('No valid multipart data found');
  }

  const fields: Record<string, string | string[]> = {};
  for (const [key, values] of state.fields.entries()) {
    fields[key] = values.length === 1 ? values[0]! : values;
  }

  const files: Record<string, UploadedFile | UploadedFile[]> = {};
  for (const [key, fileList] of state.files.entries()) {
    files[key] = fileList.length === 1 ? fileList[0]! : fileList;
  }

  return { fields, files };
}

/**
 * Cleanup resources
 */
async function cleanup(state: ParserState): Promise<void> {
  // Execute all cleanup tasks
  await Promise.allSettled(state.cleanupTasks.map(task => task()));

  // Close any open streams
  if (state.streamController) {
    state.streamController.close();
  }

  if (state.currentWriteStream) {
    await closeStream(state.currentWriteStream);
  }
}

// Helper functions
async function writeToStream(stream: WriteStream, chunk: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(chunk, error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function closeStream(stream: WriteStream): Promise<void> {
  return new Promise(resolve => {
    stream.end(() => resolve());
  });
}

/**
 * Main parsing function (functional interface)
 */
export async function parseMultipartRequest(
  request: UnifiedRequest,
  options: Partial<ParseOptions> = {}
): Promise<MultipartData> {
  const contentType = (request.headers['content-type'] as string) || '';
  const boundary = extractBoundary(contentType);

  if (!boundary) {
    throw new Error('Missing boundary in multipart content-type');
  }

  let state = createParserState(boundary, options);

  // Initialize file processing if needed
  if (state.currentFilename !== undefined) {
    state = await initializeFileProcessing(state);
  }

  try {
    // Process request stream
    for await (const chunk of request) {
      state = await processChunk(state, chunk as Buffer);
    }

    return finalize(state);
  } finally {
    await cleanup(state);
  }
}
