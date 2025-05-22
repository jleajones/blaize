import { z } from 'zod';

import { validateBody } from './body';

describe('validateBody', () => {
  it('should validate a simple object against a schema', () => {
    // Define a simple schema
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    // Valid data
    const validBody = {
      name: 'John Doe',
      age: 30,
    };

    // Validate the body
    const result = validateBody(validBody, schema);

    // The result should match the input
    expect(result).toEqual(validBody);
    // The result should be type-safe
    expect(typeof result.name).toBe('string');
    expect(typeof result.age).toBe('number');
  });

  it('should throw an error for invalid data', () => {
    // Define a schema
    const schema = z.object({
      name: z.string(),
      age: z.number().positive(),
    });

    // Invalid data (negative age)
    const invalidBody = {
      name: 'John Doe',
      age: -5,
    };

    // Validation should throw an error
    expect(() => {
      validateBody(invalidBody, schema);
    }).toThrow();
  });

  it('should transform data according to schema transformations', () => {
    // Schema with transform
    const schema = z.object({
      email: z
        .string()
        .email()
        .transform(val => val.toLowerCase()),
      tags: z.array(z.string()).transform(tags => [...new Set(tags)]), // Remove duplicates
    });

    // Input data
    const body = {
      email: 'USER@EXAMPLE.COM',
      tags: ['javascript', 'typescript', 'javascript'],
    };

    // Expected transformed output
    const expected = {
      email: 'user@example.com',
      tags: ['javascript', 'typescript'],
    };

    // Validate and transform
    const result = validateBody(body, schema);

    // Should match the transformed data
    expect(result).toEqual(expected);
  });

  it('should validate nested objects', () => {
    // Schema with nested objects
    const schema = z.object({
      user: z.object({
        profile: z.object({
          firstName: z.string(),
          lastName: z.string(),
        }),
      }),
    });

    // Valid nested data
    const validBody = {
      user: {
        profile: {
          firstName: 'John',
          lastName: 'Doe',
        },
      },
    };

    // Validate the body
    const result = validateBody(validBody, schema);

    // The result should match the input
    expect(result).toEqual(validBody);
  });

  it('should validate arrays', () => {
    // Schema with array
    const schema = z.object({
      items: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
        })
      ),
    });

    // Valid array data
    const validBody = {
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ],
    };

    // Validate the body
    const result = validateBody(validBody, schema);

    // The result should match the input
    expect(result).toEqual(validBody);
  });

  it('should handle optional fields', () => {
    // Schema with optional fields
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
      address: z.string().optional(),
    });

    // Data with missing optional field
    const validBody = {
      name: 'John Doe',
      // age and address are missing
    };

    // Validate the body
    const result = validateBody(validBody, schema);

    // The result should match the input
    expect(result).toEqual(validBody);
  });

  it('should throw detailed validation errors', () => {
    // Define a schema with multiple fields
    const schema = z.object({
      name: z.string().min(3),
      email: z.string().email(),
      age: z.number().int().positive(),
    });

    // Invalid data with multiple issues
    const invalidBody = {
      name: 'Jo', // Too short
      email: 'not-an-email',
      age: -1, // Negative
    };

    // Validation should throw an error
    try {
      validateBody(invalidBody, schema);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Type guard to check if it's a ZodError
      if (error instanceof z.ZodError) {
        // Now TypeScript knows it's a ZodError
        expect(error.name).toBe('ZodError');
        // Use a simpler approach by checking the issues array directly
        const issues = error.issues;

        // Check if we have issues for each field
        const nameIssues = issues.filter(issue => issue.path[0] === 'name');
        const emailIssues = issues.filter(issue => issue.path[0] === 'email');
        const ageIssues = issues.filter(issue => issue.path[0] === 'age');

        expect(nameIssues.length).toBeGreaterThan(0);
        expect(emailIssues.length).toBeGreaterThan(0);
        expect(ageIssues.length).toBeGreaterThan(0);
      } else {
        // If it's not a ZodError, fail the test
        expect(true).toBe(false);
        throw new Error('Expected ZodError but got a different error type');
      }
    }
  });

  it('should work with union types', () => {
    // Schema with union
    const schema = z.union([
      z.object({ type: z.literal('user'), userId: z.string() }),
      z.object({ type: z.literal('product'), productId: z.number() }),
    ]);

    // Valid user data
    const userData = {
      type: 'user',
      userId: 'user123',
    };

    // Valid product data
    const productData = {
      type: 'product',
      productId: 456,
    };

    // Both should validate
    expect(validateBody(userData, schema)).toEqual(userData);
    expect(validateBody(productData, schema)).toEqual(productData);

    // Invalid mixed data
    const invalidData = {
      type: 'user',
      productId: 789, // Wrong field for this type
    };

    // Should throw
    expect(() => {
      validateBody(invalidData, schema);
    }).toThrow();
  });

  it('should maintain type safety with generics', () => {
    // Define a schema with a specific output type
    interface User {
      id: string;
      name: string;
      active: boolean;
    }

    const userSchema = z.object({
      id: z.string().uuid(),
      name: z.string(),
      active: z.boolean(),
    }) as z.ZodType<User>;

    // Valid user data
    const validUser = {
      id: '123e4567-e89b-12d3-a456-426614174000', // UUID format
      name: 'Jane Smith',
      active: true,
    };

    // Validate with explicit type
    const result = validateBody<User>(validUser, userSchema);

    // Type checks (these validate at compile time)
    const id: string = result.id;
    const active: boolean = result.active;

    // Runtime checks
    expect(result).toEqual(validUser);
    expect(typeof id).toBe('string');
    expect(typeof active).toBe('boolean');
  });
});
