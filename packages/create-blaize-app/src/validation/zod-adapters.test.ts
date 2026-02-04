import { z } from 'zod';

import { ValidationError } from './error';
import { ZodValidator, createValidator } from './zod-adapter';

describe('ZodValidator', () => {
  describe('constructor', () => {
    it('should create a ZodValidator instance with a schema', () => {
      const schema = z.string();
      const validator = new ZodValidator(schema);

      expect(validator).toBeInstanceOf(ZodValidator);
      expect(validator).toHaveProperty('parse');
      expect(validator).toHaveProperty('safeParse');
    });
  });

  describe('parse', () => {
    describe('with simple types', () => {
      it('should return ok result for valid string', () => {
        const schema = z.string();
        const validator = new ZodValidator(schema);

        const result = validator.parse('hello');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe('hello');
        }
      });

      it('should return err result for invalid string', () => {
        const schema = z.string();
        const validator = new ZodValidator(schema);

        const result = validator.parse(123);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(ValidationError);
          expect(result.error.message).toContain('Expected string');
          expect(result.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.field).toBeUndefined();
        }
      });

      it('should handle number validation', () => {
        const schema = z.number().min(0).max(100);
        const validator = new ZodValidator(schema);

        const validResult = validator.parse(50);
        expect(validResult.ok).toBe(true);
        if (validResult.ok) {
          expect(validResult.value).toBe(50);
        }

        const invalidResult = validator.parse(150);
        expect(invalidResult.ok).toBe(false);
        if (!invalidResult.ok) {
          expect(invalidResult.error.message).toContain('Number must be less than or equal to 100');
        }
      });

      it('should handle boolean validation', () => {
        const schema = z.boolean();
        const validator = new ZodValidator(schema);

        const validResult = validator.parse(true);
        expect(validResult.ok).toBe(true);
        if (validResult.ok) {
          expect(validResult.value).toBe(true);
        }

        const invalidResult = validator.parse('true');
        expect(invalidResult.ok).toBe(false);
        if (!invalidResult.ok) {
          expect(invalidResult.error.message).toContain('Expected boolean');
        }
      });
    });

    describe('with object types', () => {
      it('should validate object with correct structure', () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });
        const validator = new ZodValidator(schema);

        const result = validator.parse({ name: 'John', age: 30 });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual({ name: 'John', age: 30 });
        }
      });

      it('should return error with field path for nested object errors', () => {
        const schema = z.object({
          user: z.object({
            profile: z.object({
              email: z.string().email(),
            }),
          }),
        });
        const validator = new ZodValidator(schema);

        const result = validator.parse({
          user: {
            profile: {
              email: 'invalid-email',
            },
          },
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.field).toBe('user.profile.email');
          expect(result.error.message).toContain('Invalid email');
        }
      });

      it('should handle missing required fields', () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });
        const validator = new ZodValidator(schema);

        const result = validator.parse({ name: 'John' });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.field).toBe('age');
          expect(result.error.message).toContain('Required');
        }
      });

      it('should handle optional fields', () => {
        const schema = z.object({
          name: z.string(),
          nickname: z.string().optional(),
        });
        const validator = new ZodValidator(schema);

        const result = validator.parse({ name: 'John' });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual({ name: 'John' });
        }
      });
    });

    describe('with array types', () => {
      it('should validate array of primitives', () => {
        const schema = z.array(z.number());
        const validator = new ZodValidator(schema);

        const validResult = validator.parse([1, 2, 3]);
        expect(validResult.ok).toBe(true);
        if (validResult.ok) {
          expect(validResult.value).toEqual([1, 2, 3]);
        }

        const invalidResult = validator.parse([1, 'two', 3]);
        expect(invalidResult.ok).toBe(false);
        if (!invalidResult.ok) {
          expect(invalidResult.error.field).toBe('1');
          expect(invalidResult.error.message).toContain('Expected number');
        }
      });

      it('should validate array length constraints', () => {
        const schema = z.array(z.string()).min(2).max(4);
        const validator = new ZodValidator(schema);

        const tooShort = validator.parse(['one']);
        expect(tooShort.ok).toBe(false);
        if (!tooShort.ok) {
          expect(tooShort.error.message).toContain('Array must contain at least 2 element(s)');
        }

        const tooLong = validator.parse(['one', 'two', 'three', 'four', 'five']);
        expect(tooLong.ok).toBe(false);
        if (!tooLong.ok) {
          expect(tooLong.error.message).toContain('Array must contain at most 4 element(s)');
        }
      });
    });

    describe('with union types', () => {
      it('should validate union of primitives', () => {
        const schema = z.union([z.string(), z.number()]);
        const validator = new ZodValidator(schema);

        const stringResult = validator.parse('hello');
        expect(stringResult.ok).toBe(true);
        if (stringResult.ok) {
          expect(stringResult.value).toBe('hello');
        }

        const numberResult = validator.parse(42);
        expect(numberResult.ok).toBe(true);
        if (numberResult.ok) {
          expect(numberResult.value).toBe(42);
        }

        const invalidResult = validator.parse(true);
        expect(invalidResult.ok).toBe(false);
      });
    });

    describe('with transform and refine', () => {
      it('should apply transformations', () => {
        const schema = z.string().transform(str => str.toUpperCase());
        const validator = new ZodValidator(schema);

        const result = validator.parse('hello');

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe('HELLO');
        }
      });

      it('should handle refinements', () => {
        const schema = z
          .string()
          .refine(str => str.length > 5, { message: 'String must be longer than 5 characters' });
        const validator = new ZodValidator(schema);

        const validResult = validator.parse('hello world');
        expect(validResult.ok).toBe(true);

        const invalidResult = validator.parse('hi');
        expect(invalidResult.ok).toBe(false);
        if (!invalidResult.ok) {
          expect(invalidResult.error.message).toBe('String must be longer than 5 characters');
        }
      });
    });

    describe('edge cases', () => {
      it('should handle null and undefined', () => {
        const nullableSchema = z.string().nullable();
        const validator = new ZodValidator(nullableSchema);

        const nullResult = validator.parse(null);
        expect(nullResult.ok).toBe(true);
        if (nullResult.ok) {
          expect(nullResult.value).toBe(null);
        }

        const undefinedResult = validator.parse(undefined);
        expect(undefinedResult.ok).toBe(false);
      });

      it('should handle empty error array gracefully', () => {
        // Mock a Zod schema that somehow produces no errors but fails
        const schema = z.string();
        const validator = new ZodValidator(schema);

        // Spy on the schema's safeParse to return a failure with no errors
        const safeParseStub = vi.spyOn(schema, 'safeParse').mockReturnValueOnce({
          success: false,
          error: new z.ZodError([]),
        } as any);

        const result = validator.parse('test');

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(ValidationError);
          expect(result.error.message).toBe('Validation failed');
          expect(result.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.field).toBeUndefined();
        }

        safeParseStub.mockRestore();
      });

      it('should handle complex nested paths', () => {
        const schema = z.object({
          deeply: z.object({
            nested: z.object({
              structure: z.object({
                value: z.string().email(),
              }),
            }),
          }),
        });
        const validator = new ZodValidator(schema);

        const result = validator.parse({
          deeply: {
            nested: {
              structure: {
                value: 'not-an-email',
              },
            },
          },
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.field).toBe('deeply.nested.structure.value');
        }
      });
    });
  });

  describe('safeParse', () => {
    it('should return success object for valid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const validator = new ZodValidator(schema);

      const result = validator.safeParse({ name: 'Alice', age: 25 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Alice', age: 25 });
      expect(result.error).toBeUndefined();
    });

    it('should return error object for invalid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const validator = new ZodValidator(schema);

      const result = validator.safeParse({ name: 'Alice', age: 'twenty-five' });

      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error?.field).toBe('age');
    });

    it('should handle field paths in errors', () => {
      const schema = z.object({
        user: z.object({
          email: z.string().email(),
        }),
      });
      const validator = new ZodValidator(schema);

      const result = validator.safeParse({
        user: { email: 'invalid' },
      });

      expect(result.success).toBe(false);
      expect(result.error?.field).toBe('user.email');
    });

    it('should handle empty error array', () => {
      const schema = z.string();
      const validator = new ZodValidator(schema);

      // Mock safeParse to return empty error array
      const safeParseStub = vi.spyOn(schema, 'safeParse').mockReturnValueOnce({
        success: false,
        error: new z.ZodError([]),
      } as any);

      const result = validator.safeParse('test');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error?.message).toBe('Validation failed');
      expect(result.error?.field).toBeUndefined();

      safeParseStub.mockRestore();
    });
  });

  describe('createValidator helper', () => {
    it('should create a validator from a Zod schema', () => {
      const schema = z.object({
        username: z.string().min(3),
        password: z.string().min(8),
      });

      const validator = createValidator(schema);

      expect(validator).toBeInstanceOf(ZodValidator);
      expect(validator).toHaveProperty('parse');
      expect(validator).toHaveProperty('safeParse');
    });

    it('should produce a working validator', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      const validator = createValidator(schema);

      const validResult = validator.parse({
        email: 'user@example.com',
        age: 21,
      });

      expect(validResult.ok).toBe(true);
      if (validResult.ok) {
        expect(validResult.value).toEqual({
          email: 'user@example.com',
          age: 21,
        });
      }

      const invalidResult = validator.parse({
        email: 'not-an-email',
        age: 16,
      });

      expect(invalidResult.ok).toBe(false);
      if (!invalidResult.ok) {
        // Will report the first error (email)
        expect(invalidResult.error.field).toBe('email');
      }
    });

    it('should work with complex schemas', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string(),
            bio: z.string().optional(),
            tags: z.array(z.string()).min(1),
          }),
        }),
        settings: z.object({
          notifications: z.boolean(),
          theme: z.enum(['light', 'dark']),
        }),
      });

      const validator = createValidator(schema);

      const validData = {
        user: {
          profile: {
            name: 'John Doe',
            tags: ['developer', 'typescript'],
          },
        },
        settings: {
          notifications: true,
          theme: 'dark' as const,
        },
      };

      const result = validator.parse(validData);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(validData);
      }
    });

    it('should preserve type information', () => {
      // This is more of a compile-time test, but we can verify runtime behavior
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });

      const validator = createValidator(schema);
      const result = validator.parse({ id: 1, name: 'Test' });

      if (result.ok) {
        // TypeScript should know the exact shape here
        expect(typeof result.value.id).toBe('number');
        expect(typeof result.value.name).toBe('string');
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle real-world user registration schema', () => {
      const userRegistrationSchema = z
        .object({
          username: z
            .string()
            .min(3)
            .max(20)
            .regex(/^[a-zA-Z0-9_]+$/),
          email: z.string().email(),
          password: z
            .string()
            .min(8)
            .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
          confirmPassword: z.string(),
          age: z.number().min(13).max(120),
          termsAccepted: z.literal(true),
        })
        .refine(data => data.password === data.confirmPassword, {
          message: "Passwords don't match",
          path: ['confirmPassword'],
        });

      const validator = createValidator(userRegistrationSchema);

      // Valid registration
      const validResult = validator.parse({
        username: 'john_doe',
        email: 'john@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        age: 25,
        termsAccepted: true,
      });

      expect(validResult.ok).toBe(true);

      // Invalid: passwords don't match
      const mismatchResult = validator.parse({
        username: 'john_doe',
        email: 'john@example.com',
        password: 'SecurePass123',
        confirmPassword: 'DifferentPass123',
        age: 25,
        termsAccepted: true,
      });

      expect(mismatchResult.ok).toBe(false);
      if (!mismatchResult.ok) {
        expect(mismatchResult.error.field).toBe('confirmPassword');
        expect(mismatchResult.error.message).toBe("Passwords don't match");
      }
    });

    it('should handle API request validation schema', () => {
      const apiRequestSchema = z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
        headers: z.record(z.string()),
        body: z.unknown().optional(),
        query: z.record(z.string()).optional(),
        params: z.record(z.string()).optional(),
      });

      const validator = createValidator(apiRequestSchema);

      const result = validator.parse({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        body: { data: 'test' },
        query: { page: '1' },
      });

      expect(result.ok).toBe(true);
    });

    it('should work with discriminated unions', () => {
      const eventSchema = z.discriminatedUnion('type', [
        z.object({
          type: z.literal('click'),
          x: z.number(),
          y: z.number(),
        }),
        z.object({
          type: z.literal('keypress'),
          key: z.string(),
          modifiers: z.array(z.enum(['ctrl', 'alt', 'shift'])),
        }),
      ]);

      const validator = createValidator(eventSchema);

      const clickResult = validator.parse({
        type: 'click',
        x: 100,
        y: 200,
      });

      expect(clickResult.ok).toBe(true);

      const keypressResult = validator.parse({
        type: 'keypress',
        key: 'Enter',
        modifiers: ['ctrl'],
      });

      expect(keypressResult.ok).toBe(true);

      const invalidResult = validator.parse({
        type: 'click',
        key: 'Enter', // Wrong properties for click type
      });

      expect(invalidResult.ok).toBe(false);
    });
  });
});
