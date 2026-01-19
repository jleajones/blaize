/**
 * Type-level tests for file upload type inference
 *
 * Task [T1.4]: Type Inference Proof-of-Concept
 *
 * **CRITICAL CHECKPOINT:** These tests verify end-to-end type inference
 * from Zod schema to handler context. If any of these tests fail, we must
 * STOP and reassess the type system strategy before proceeding to Week 2.
 *
 * Test scenarios:
 * 1. Single required file
 * 2. Optional file
 * 3. Array of files
 * 4. Mixed body + files
 * 5. Nested file objects
 * 6. Optional file in nested object
 * 7. Array of files with min/max constraints
 * 8. Multiple different file fields
 * 9. Backward compatibility (no files schema)
 * 10. Compile-time errors for invalid access
 * 11. File with .refine() custom validation
 * 12. Full integration example
 *
 * Run with: vitest run file-schema.test-d.ts
 *
 * Location: packages/blaize-core/src/upload/file-schema.test-d.ts
 *
 * @packageDocumentation
 */

import { z } from 'zod';

import { file } from '../upload/schema';

import type {
  UploadedFile,
  RouteHandler,
  Infer,
  Context,
  State,
  Services,
  QueryParams,
} from '@blaize-types';
import type { EventSchemas } from '@blaize-types/events';

describe('File Upload Type Inference', () => {
  // ==========================================================================
  // Test 1: Single Required File
  // ==========================================================================

  describe('Single Required File', () => {
    it('should infer single required file type correctly', () => {
      const _schema = z.object({
        avatar: file({ maxSize: '5MB', accept: ['image/*'] }),
      });

      type FilesType = Infer<typeof _schema>;
      // Verify schema inference
      expectTypeOf<FilesType>().toEqualTypeOf<{
        avatar: UploadedFile;
      }>();
    });

    it('should type handler context correctly for single file', () => {
      const _schema = z.object({
        avatar: file({ maxSize: '5MB', accept: ['image/*'] }),
      });

      type FilesType = Infer<typeof _schema>;

      const handler: RouteHandler<
        Record<string, string>, // params
        Record<string, string | string[] | undefined>, // query
        unknown, // body
        void, // response
        State,
        Services,
        EventSchemas,
        FilesType // files
      > = async ({ ctx }) => {
        // Should be able to access avatar
        expectTypeOf(ctx.request.files.avatar).toEqualTypeOf<UploadedFile>();
        expectTypeOf(ctx.request.files!.avatar).toEqualTypeOf<UploadedFile>();

        // Should have UploadedFile properties
        expectTypeOf(ctx.request.files!.avatar.originalname).toEqualTypeOf<string>();
        expectTypeOf(ctx.request.files!.avatar.mimetype).toEqualTypeOf<string>();
        expectTypeOf(ctx.request.files!.avatar.size).toEqualTypeOf<number>();
        expectTypeOf(ctx.request.files!.avatar.buffer).toEqualTypeOf<Buffer | undefined>();
      };

      expectTypeOf(handler).toBeFunction();
    });
  });

  // ==========================================================================
  // Test 2: Optional File
  // ==========================================================================

  describe('Optional File', () => {
    it('should infer optional file type correctly', () => {
      const _schema = z.object({
        avatar: file({ maxSize: '5MB' }).optional(),
      });

      type FilesType = Infer<typeof _schema>;
      // Verify schema inference includes undefined
      expectTypeOf<FilesType>().toEqualTypeOf<{
        avatar?: UploadedFile | undefined;
      }>();
    });

    it('should type handler context correctly for optional file', () => {
      const _schema = z.object({
        avatar: file({ maxSize: '5MB' }).optional(),
      });

      type FilesType = Infer<typeof _schema>;
      const handler: RouteHandler<any, any, any, void, any, any, any, FilesType> = async ({
        ctx,
      }) => {
        // Should be UploadedFile | undefined
        expectTypeOf(ctx.request.files.avatar).toEqualTypeOf<UploadedFile | undefined>();

        // Should require null check
        expectTypeOf(ctx.request.files.avatar!.originalname).toEqualTypeOf<string>();
      };

      expectTypeOf(handler).toBeFunction();
    });
  });

  // ==========================================================================
  // Test 3: Array of Files
  // ==========================================================================

  describe('Array of Files', () => {
    it('should infer array of files type correctly', () => {
      const _schema = z.object({
        photos: z.array(file({ maxSize: '10MB', accept: ['image/*'] })),
      });

      type FilesType = Infer<typeof _schema>;

      // Verify schema inference
      expectTypeOf<FilesType>().toEqualTypeOf<{
        photos: UploadedFile[];
      }>();
    });

    it('should type handler context correctly for file array', () => {
      const _schema = z.object({
        photos: z.array(file({ maxSize: '10MB', accept: ['image/*'] })),
      });

      type FilesType = Infer<typeof _schema>;

      const handler: RouteHandler<any, any, any, void, any, any, any, FilesType> = async ({
        ctx,
      }) => {
        // Should be UploadedFile[]
        expectTypeOf(ctx.request.files!.photos).toEqualTypeOf<UploadedFile[]>();
        // Should have array methods
        expectTypeOf(ctx.request.files!.photos.length).toEqualTypeOf<number>();
        expectTypeOf(ctx.request.files!.photos[0]!).toEqualTypeOf<UploadedFile>();

        // Should be able to map over array
        ctx.request.files!.photos.forEach(photo => {
          expectTypeOf(photo).toEqualTypeOf<UploadedFile>();
          expectTypeOf(photo.originalname).toEqualTypeOf<string>();
        });
      };

      expectTypeOf(handler).toBeFunction();
    });
  });

  // ==========================================================================
  // Test 4: Mixed Body + Files
  // ==========================================================================

  describe('Mixed Body and Files', () => {
    it('should infer both body and files types correctly', () => {
      const _bodySchema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number(),
      });

      const _filesSchema = z.object({
        avatar: file({ maxSize: '5MB' }),
        resume: file({ maxSize: '10MB', accept: ['application/pdf'] }),
      });

      type BodyType = Infer<typeof _bodySchema>;
      type FilesType = Infer<typeof _filesSchema>;

      // Verify body schema inference
      expectTypeOf<BodyType>().toEqualTypeOf<{
        name: string;
        email: string;
        age: number;
      }>();

      // Verify files schema inference
      expectTypeOf<FilesType>().toEqualTypeOf<{
        avatar: UploadedFile;
        resume: UploadedFile;
      }>();
    });

    it('should type handler context correctly with both body and files', () => {
      const _bodySchema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number(),
      });

      const _filesSchema = z.object({
        avatar: file({ maxSize: '5MB' }),
        resume: file({ maxSize: '10MB', accept: ['application/pdf'] }),
      });

      type BodyType = Infer<typeof _bodySchema>;
      type FilesType = Infer<typeof _filesSchema>;

      const handler: RouteHandler<
        any, // params
        any, // query
        BodyType, // body
        void, // response
        any,
        any,
        any,
        FilesType // files
      > = async ({ ctx }) => {
        // Should have typed body
        expectTypeOf(ctx.request.body.name).toEqualTypeOf<string>();
        expectTypeOf(ctx.request.body.email).toEqualTypeOf<string>();
        expectTypeOf(ctx.request.body.age).toEqualTypeOf<number>();

        // Should have typed files
        expectTypeOf(ctx.request.files!.avatar).toEqualTypeOf<UploadedFile>();
        expectTypeOf(ctx.request.files!.resume).toEqualTypeOf<UploadedFile>();

        // Resume should have mimetype
        expectTypeOf(ctx.request.files!.resume.mimetype).toEqualTypeOf<string>();
      };

      expectTypeOf(handler).toBeFunction();
    });
  });

  // ==========================================================================
  // Test 5: Nested File Objects
  // ==========================================================================

  describe('Nested File Objects', () => {
    it('should infer nested file object types correctly', () => {
      const _schema = z.object({
        profile: z.object({
          avatar: file({ maxSize: '5MB' }),
          banner: file({ maxSize: '10MB' }).optional(),
        }),
      });

      type FilesType = Infer<typeof _schema>;

      // Verify schema inference
      expectTypeOf<FilesType>().toEqualTypeOf<{
        profile: {
          avatar: UploadedFile;
          banner?: UploadedFile | undefined;
        };
      }>();
    });

    it('should type handler context correctly for nested files', () => {
      const _schema = z.object({
        profile: z.object({
          avatar: file({ maxSize: '5MB' }),
          banner: file({ maxSize: '10MB' }).optional(),
        }),
      });

      type FilesType = Infer<typeof _schema>;

      const handler: RouteHandler<any, any, any, void, any, any, any, FilesType> = async ({
        ctx,
      }) => {
        // Should access nested files
        if (ctx.request.files) {
          expectTypeOf(ctx.request.files.profile.avatar).toEqualTypeOf<UploadedFile>();
          expectTypeOf(ctx.request.files.profile.banner).toEqualTypeOf<UploadedFile | undefined>();

          // Nested required file doesn't need null check
          expectTypeOf(ctx.request.files.profile.avatar.originalname).toEqualTypeOf<string>();
          // Nested optional file needs null check
          if (ctx.request.files.profile.banner) {
            expectTypeOf(ctx.request.files.profile.banner.originalname).toEqualTypeOf<string>();
          }
        }
      };

      expectTypeOf(handler).toBeFunction();
    });
  });

  // ==========================================================================
  // Test 6: Optional Nested Object
  // ==========================================================================

  describe('Optional Nested Object', () => {
    it('should infer optional nested object type correctly', () => {
      const _schema = z.object({
        documents: z
          .object({
            cv: file().optional(),
            cover_letter: file().optional(),
          })
          .optional(),
      });

      type FilesType = Infer<typeof _schema>;

      // Verify schema inference - entire object is optional
      expectTypeOf<FilesType>().toEqualTypeOf<{
        documents?:
          | {
              cv?: UploadedFile | undefined;
              cover_letter?: UploadedFile | undefined;
            }
          | undefined;
      }>();
    });

    it('should require double null check for optional nested files', () => {
      const _schema = z.object({
        documents: z
          .object({
            cv: file().optional(),
            cover_letter: file().optional(),
          })
          .optional(),
      });

      type FilesType = Infer<typeof _schema>;

      const handler: RouteHandler<any, any, any, void, any, any, any, FilesType> = async ({
        ctx,
      }) => {
        // Should require double null check
        if (ctx.request.files) {
          if (ctx.request.files.documents) {
            expectTypeOf(ctx.request.files.documents).toEqualTypeOf<{
              cv?: UploadedFile | undefined;
              cover_letter?: UploadedFile | undefined;
            }>();

            if (ctx.request.files.documents.cv) {
              expectTypeOf(ctx.request.files.documents.cv).toEqualTypeOf<UploadedFile>();
            }
          }
        }
      };

      expectTypeOf(handler).toBeFunction();
    });
  });

  // ==========================================================================
  // Test 7: Array with Constraints
  // ==========================================================================

  describe('Array with Min/Max Constraints', () => {
    it('should infer array type correctly with constraints', () => {
      const _schema = z.object({
        photos: z
          .array(file({ maxSize: '5MB' }))
          .min(1)
          .max(10),
      });

      type FilesType = Infer<typeof _schema>;

      // Verify schema inference - array constraints don't affect type
      expectTypeOf<FilesType>().toEqualTypeOf<{
        photos: UploadedFile[];
      }>();
    });

    it('should type array correctly in handler (constraints at runtime)', () => {
      const _schema = z.object({
        photos: z
          .array(file({ maxSize: '5MB' }))
          .min(1)
          .max(10),
      });

      type FilesType = Infer<typeof _schema>;

      const handler: RouteHandler<any, any, any, void, any, any, any, FilesType> = async ({
        ctx,
      }) => {
        // Should still be UploadedFile[]
        if (ctx.request.files) {
          expectTypeOf(ctx.request.files.photos).toEqualTypeOf<UploadedFile[]>();

          // Validation happens at runtime, not in types
          // But we can still use array methods
          expectTypeOf(ctx.request.files.photos.length).toEqualTypeOf<number>();
        }
      };

      expectTypeOf(handler).toBeFunction();
    });
  });

  // ==========================================================================
  // Test 8: Multiple Different File Fields
  // ==========================================================================

  describe('Multiple Different File Fields', () => {
    it('should infer multiple file field types correctly', () => {
      const _schema = z.object({
        avatar: file({ maxSize: '5MB', accept: ['image/*'] }),
        documents: z.array(file({ maxSize: '10MB', accept: ['application/pdf'] })),
        signature: file({ maxSize: '1MB', accept: ['image/png', 'image/jpeg'] }).optional(),
      });

      type FilesType = Infer<typeof _schema>;

      // Verify schema inference
      expectTypeOf<FilesType>().toEqualTypeOf<{
        avatar: UploadedFile;
        documents: UploadedFile[];
        signature?: UploadedFile | undefined;
      }>();
    });

    it('should type all file fields correctly in handler', () => {
      const _schema = z.object({
        avatar: file({ maxSize: '5MB', accept: ['image/*'] }),
        documents: z.array(file({ maxSize: '10MB', accept: ['application/pdf'] })),
        signature: file({ maxSize: '1MB', accept: ['image/png', 'image/jpeg'] }).optional(),
      });

      type FilesType = Infer<typeof _schema>;

      const handler: RouteHandler<any, any, any, void, any, any, any, FilesType> = async ({
        ctx,
      }) => {
        // All three file types correctly typed
        if (ctx.request.files) {
          expectTypeOf(ctx.request.files.avatar).toEqualTypeOf<UploadedFile>();
          expectTypeOf(ctx.request.files.documents).toEqualTypeOf<UploadedFile[]>();
          expectTypeOf(ctx.request.files.signature).toEqualTypeOf<UploadedFile | undefined>();
        }
      };

      expectTypeOf(handler).toBeFunction();
    });
  });

  // ==========================================================================
  // Test 9: Backward Compatibility (No Files)
  // ==========================================================================

  describe('Backward Compatibility', () => {
    it('should default to unknown when no files schema provided', () => {
      const handler: RouteHandler = async ({ ctx }) => {
        // files should be unknown when no schema provided
        expectTypeOf(ctx.request.files).toEqualTypeOf<unknown>();
      };

      expectTypeOf(handler).toBeFunction();
    });

    it('should work with routes that have no files', () => {
      const handler: RouteHandler<
        { userId: string }, // params
        QueryParams, // query
        { name: string }, // body
        { id: string } // response
      > = async ({ ctx, params }) => {
        // Should still have typed params and body
        expectTypeOf(params.userId).toEqualTypeOf<string>();
        expectTypeOf(ctx.request.body.name).toEqualTypeOf<string>();

        // Files is unknown (default)
        expectTypeOf(ctx.request.files).toEqualTypeOf<unknown>();

        return { id: params.userId };
      };

      expectTypeOf(handler).toBeFunction();
    });
  });

  // ==========================================================================
  // Test 10: Compile-Time Errors
  // ==========================================================================

  describe('Compile-Time Errors', () => {
    it('should catch invalid property access at compile time', () => {
      const _schema = z.object({
        avatar: file(),
      });

      type FilesType = Infer<typeof _schema>;
      const handler: RouteHandler<any, any, any, void, any, any, any, FilesType> = async ({
        ctx,
      }) => {
        // ✅ Valid access
        if (ctx.request.files) {
          expectTypeOf(ctx.request.files.avatar).toEqualTypeOf<UploadedFile>();
        }

        // ❌ Invalid access should error at compile time
        // @ts-expect-error - Property 'nonexistent' does not exist
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        ctx.request.files.nonexistent;
      };

      expectTypeOf(handler).toBeFunction();
    });

    it('should catch type mismatches at compile time', () => {
      // ❌ Cannot assign string to UploadedFile
      // @ts-expect-error - Type 'string' is not assignable to type 'UploadedFile'
      const _file: UploadedFile = 'not a file';
    });
  });

  // ==========================================================================
  // Test 11: File with .refine() Custom Validation
  // ==========================================================================

  describe('Custom Validation with .refine()', () => {
    it('should preserve type through .refine()', () => {
      const _schema = z.object({
        image: file({ maxSize: '5MB' }).refine(file => file.originalname.endsWith('.jpg'), {
          message: 'Only .jpg files allowed',
        }),
      });

      type FilesType = Infer<typeof _schema>;

      // Verify .refine() doesn't break type inference
      expectTypeOf<FilesType>().toEqualTypeOf<{
        image: UploadedFile;
      }>();
    });

    it('should type refined file correctly in handler', () => {
      const _schema = z.object({
        image: file({ maxSize: '5MB' }).refine(file => file.originalname.endsWith('.jpg'), {
          message: 'Only .jpg files allowed',
        }),
      });

      type FilesType = Infer<typeof _schema>;

      const handler: RouteHandler<any, any, any, void, any, any, any, FilesType> = async ({
        ctx,
      }) => {
        // Should still be UploadedFile after .refine()
        if (ctx.request.files) {
          expectTypeOf(ctx.request.files.image).toEqualTypeOf<UploadedFile>();
          expectTypeOf(ctx.request.files.image.originalname).toEqualTypeOf<string>();
        }
      };

      expectTypeOf(handler).toBeFunction();
    });
  });

  // ==========================================================================
  // Test 12: Full Integration Example
  // ==========================================================================

  describe('Full Integration Example', () => {
    it('should infer all types correctly in realistic scenario', () => {
      // Realistic example: User profile update with avatar
      const _profileUpdateSchema = {
        params: z.object({
          userId: z.string().uuid(),
        }),
        body: z.object({
          name: z.string().min(1),
          bio: z.string().max(500).optional(),
        }),
        files: z.object({
          avatar: file({
            maxSize: '5MB',
            accept: ['image/jpeg', 'image/png', 'image/webp'],
          }).optional(),
        }),
        response: z.object({
          id: z.string(),
          name: z.string(),
          avatarUrl: z.string().optional(),
        }),
      };

      type Params = Infer<typeof _profileUpdateSchema.params>;
      type Body = Infer<typeof _profileUpdateSchema.body>;
      type Files = Infer<typeof _profileUpdateSchema.files>;
      type Response = Infer<typeof _profileUpdateSchema.response>;

      // Verify all inference
      expectTypeOf<Params>().toEqualTypeOf<{ userId: string }>();
      expectTypeOf<Body>().toEqualTypeOf<{ name: string; bio?: string | undefined }>();
      expectTypeOf<Files>().toEqualTypeOf<{ avatar?: UploadedFile | undefined }>();
      expectTypeOf<Response>().toEqualTypeOf<{
        id: string;
        name: string;
        avatarUrl?: string | undefined;
      }>();
    });

    it('should type full handler correctly with all schemas', () => {
      const _profileUpdateSchema = {
        params: z.object({
          userId: z.string().uuid(),
        }),
        body: z.object({
          name: z.string().min(1),
          bio: z.string().max(500).optional(),
        }),
        files: z.object({
          avatar: file({
            maxSize: '5MB',
            accept: ['image/jpeg', 'image/png', 'image/webp'],
          }).optional(),
        }),
        response: z.object({
          id: z.string(),
          name: z.string(),
          avatarUrl: z.string().optional(),
        }),
      };

      type Params = Infer<typeof _profileUpdateSchema.params>;
      type Body = Infer<typeof _profileUpdateSchema.body>;
      type Files = Infer<typeof _profileUpdateSchema.files>;
      type Response = Infer<typeof _profileUpdateSchema.response>;

      const handler: RouteHandler<
        Params,
        any, // query
        Body,
        Response,
        any,
        any,
        any,
        Files
      > = async ({ ctx, params }) => {
        // All properly typed
        expectTypeOf(params.userId).toEqualTypeOf<string>();
        expectTypeOf(ctx.request.body.name).toEqualTypeOf<string>();
        expectTypeOf(ctx.request.body.bio).toEqualTypeOf<string | undefined>();
        expectTypeOf(ctx.request.files?.avatar).toEqualTypeOf<UploadedFile | undefined>();

        // Example logic
        let avatarUrl: string | undefined;

        if (ctx.request.files) {
          if (ctx.request.files.avatar) {
            // TypeScript knows avatar exists here
            expectTypeOf(ctx.request.files.avatar).toEqualTypeOf<UploadedFile>();
            avatarUrl = `/uploads/${ctx.request.files.avatar.originalname}`;
          }
        }

        // Return typed response
        return {
          id: params.userId,
          name: ctx.request.body.name,
          avatarUrl,
        };
      };

      expectTypeOf(handler).toBeFunction();
    });
  });

  // ==========================================================================
  // Cross-Context Type Consistency
  // ==========================================================================

  describe('Cross-Context Type Consistency', () => {
    it('should maintain consistent file types across different contexts', () => {
      const _schema = z.object({ avatar: file() });
      type FilesType = Infer<typeof _schema>;

      // Same file type in different handler signatures
      const handler1: RouteHandler<any, any, any, void, any, any, any, FilesType> = async ({
        ctx,
      }) => {
        if (ctx.request.files) {
          expectTypeOf(ctx.request.files.avatar).toEqualTypeOf<UploadedFile>();
        }
      };

      const handler2: RouteHandler<any, any, any, void, any, any, any, FilesType> = async ({
        ctx,
      }) => {
        if (ctx.request.files) {
          expectTypeOf(ctx.request.files.avatar).toEqualTypeOf<UploadedFile>();
        }
      };

      // Both should have same type
      expectTypeOf(handler1).toEqualTypeOf(handler2);
    });

    it('should work with context type directly', () => {
      const _schema = z.object({ avatar: file() });
      type FilesType = Infer<typeof _schema>;

      type MyContext = Context<State, Services, unknown, QueryParams, FilesType>;

      // ✅ FIX: Type-level assertions only (no runtime access)
      // Assert that MyContext['request']['files'] matches FilesType
      expectTypeOf<MyContext['request']['files']>().toEqualTypeOf<FilesType>();

      // Assert that the avatar property has the correct type
      expectTypeOf<
        NonNullable<MyContext['request']['files']>['avatar']
      >().toEqualTypeOf<UploadedFile>();
    });
  });
});

/**
 * ✅ CHECKPOINT VALIDATION
 *
 * If all tests above pass without TypeScript errors:
 * - Type inference is working end-to-end ✅
 * - Generic threading is correct ✅
 * - Zod schema inference works ✅
 * - Handler context typing works ✅
 * - Backward compatibility maintained ✅
 *
 * → PROCEED to Task T1.5 and Week 2 tasks
 *
 * If ANY test fails:
 * - 🛑 STOP implementation
 * - Review type system architecture
 * - Fix root cause in type definitions
 * - Re-run tests until all pass
 * - Only proceed when checkpoint passes
 */
