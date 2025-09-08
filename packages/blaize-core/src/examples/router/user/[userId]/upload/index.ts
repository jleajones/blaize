import { z } from 'zod';

import { appRouter } from 'src/examples/basic';

import type { UploadedFile } from '../../../../../index';

// Schema for form fields (not files - those are handled separately)
const uploadBodySchema = z.object({
  description: z.string().min(1).max(500).optional(),
  userId: z.string().min(1).max(50),
  category: z.enum(['document', 'image', 'video', 'other']).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  metadata: z.string().optional(), // JSON string that can be parsed
});

// Schema for the successful response
const uploadResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  uploadId: z.string(),
  files: z.array(
    z.object({
      fieldName: z.string(),
      filename: z.string(),
      size: z.number(),
      mimetype: z.string(),
      uploadPath: z.string().optional(),
    })
  ),
  fields: z.record(z.union([z.string(), z.array(z.string())])),
  metadata: z.record(z.unknown()).optional(),
  stats: z.object({
    totalFiles: z.number(),
    totalSize: z.number(),
    uploadedAt: z.string(),
  }),
});

// Schema for error response
const uploadErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string(),
  details: z.string().optional(),
  code: z.string().optional(),
});

export const POST = appRouter.post({
  schema: {
    body: uploadBodySchema,
    response: z.union([uploadResponseSchema, uploadErrorResponseSchema]),
  },
  handler: async (ctx, _params) => {
    // Check for parsing errors first
    if (ctx.state._bodyError) {
      const error = ctx.state._bodyError;
      return {
        success: false as const,
        error: error.type,
        message: error.message,
        details: error.error instanceof Error ? error.error.message : String(error.error),
        code: getErrorCode(error.type),
      };
    }

    // Access validated form fields (validated by schema)
    const fields = ctx.request.body;

    // Access uploaded files (not validated by schema - handled separately)
    const files = (ctx.request as any).files as Record<string, UploadedFile | UploadedFile[]>;

    // Validate that at least one file was uploaded
    if (!files || Object.keys(files).length === 0) {
      return {
        success: false as const,
        error: 'no_files',
        message: 'No files were uploaded',
        code: 'NO_FILES_PROVIDED',
      };
    }

    // Validate file constraints
    const fileValidationResult = validateUploadedFiles(files);
    if (!fileValidationResult.valid) {
      return {
        success: false as const,
        error: 'file_validation_failed',
        message: fileValidationResult.message,
        code: 'FILE_VALIDATION_ERROR',
      };
    }

    // Generate unique upload ID
    const uploadId = generateUploadId();

    // Process uploaded files
    const processedFiles = Object.entries(files).flatMap(([fieldName, file]) => {
      const fileList = Array.isArray(file) ? file : [file];

      return fileList.map(fileData => {
        // In a real app, you'd save the file here
        const uploadPath = saveFile(fileData, uploadId); // Implement this

        return {
          fieldName,
          filename: fileData.filename || 'unnamed',
          size: fileData.size,
          mimetype: fileData.mimetype,
          uploadPath,
        };
      });
    });

    // Parse metadata if provided
    let parsedMetadata = {};

    // Extract metadata from fields to keep them separate
    const { metadata, ...otherFields } = fields;
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (error) {
        // Metadata parsing failed, but don't fail the whole upload
        console.warn('Failed to parse metadata:', error);
      }
    }

    return {
      success: true as const,
      message: `Successfully uploaded ${processedFiles.length} file(s)`,
      uploadId,
      files: processedFiles,
      fields: otherFields, // ✅ This now only contains string | string[] values
      metadata: parsedMetadata, // ✅ Separate metadata field
      stats: {
        totalFiles: processedFiles.length,
        totalSize: processedFiles.reduce((sum, f) => sum + f.size, 0),
        uploadedAt: new Date().toISOString(),
      },
    };
  },
});

// Utility functions
function getErrorCode(errorType: string): string {
  const errorCodes = {
    multipart_parse_error: 'MULTIPART_PARSE_FAILED',
    json_parse_error: 'JSON_PARSE_FAILED',
    form_parse_error: 'FORM_PARSE_FAILED',
    body_read_error: 'BODY_READ_FAILED',
  };
  return errorCodes[errorType as keyof typeof errorCodes] || 'UNKNOWN_ERROR';
}

function validateUploadedFiles(files: Record<string, UploadedFile | UploadedFile[]>): {
  valid: boolean;
  message: string;
} {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const maxSingleFileSize = 50 * 1024 * 1024; // 50MB
  const maxTotalSize = 100 * 1024 * 1024; // 100MB

  let totalSize = 0;
  const invalidFiles: string[] = [];

  for (const [_fieldName, file] of Object.entries(files)) {
    const fileList = Array.isArray(file) ? file : [file];

    for (const fileData of fileList) {
      totalSize += fileData.size;

      // Check individual file size
      if (fileData.size > maxSingleFileSize) {
        invalidFiles.push(
          `${fileData.filename || 'unnamed'} (too large: ${formatFileSize(fileData.size)})`
        );
      }

      // Check MIME type
      if (!allowedMimeTypes.includes(fileData.mimetype)) {
        invalidFiles.push(
          `${fileData.filename || 'unnamed'} (unsupported type: ${fileData.mimetype})`
        );
      }

      // Check for empty files
      if (fileData.size === 0) {
        invalidFiles.push(`${fileData.filename || 'unnamed'} (empty file)`);
      }
    }
  }

  // Check total size
  if (totalSize > maxTotalSize) {
    return {
      valid: false,
      message: `Total upload size (${formatFileSize(totalSize)}) exceeds limit (${formatFileSize(maxTotalSize)})`,
    };
  }

  if (invalidFiles.length > 0) {
    return {
      valid: false,
      message: `Invalid files: ${invalidFiles.join(', ')}`,
    };
  }

  return { valid: true, message: 'All files valid' };
}

function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function saveFile(file: UploadedFile, uploadId: string): string {
  // Implement actual file saving logic here
  // This is just a placeholder
  const filename = `${uploadId}_${file.filename || 'unnamed'}`;

  // For stream strategy:
  // const writeStream = fs.createWriteStream(`./uploads/${filename}`);
  // file.stream.pipe(writeStream);

  // For memory strategy:
  // fs.writeFileSync(`./uploads/${filename}`, file.buffer);

  // For temp strategy:
  // fs.copyFileSync(file.tempPath, `./uploads/${filename}`);

  return `/uploads/${filename}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
