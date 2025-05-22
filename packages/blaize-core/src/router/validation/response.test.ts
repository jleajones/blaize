import { z } from 'zod';

import { validateResponse } from './response';

describe('validateResponse', () => {
  it('should validate a simple response object', () => {
    // Define a simple schema
    const schema = z.object({
      id: z.string(),
      name: z.string(),
      createdAt: z.string(),
    });

    // Valid response data
    const response = {
      id: '123',
      name: 'Example',
      createdAt: '2023-06-15T10:00:00Z',
    };

    // Validate the response
    const result = validateResponse(response, schema);

    // Result should match input
    expect(result).toEqual(response);
  });

  it('should throw an error for invalid response data', () => {
    // Define a schema with strict requirements
    const schema = z.object({
      id: z.string().uuid(),
      count: z.number().int().positive(),
      isActive: z.boolean(),
    });

    // Invalid response data
    const invalidResponse = {
      id: 'not-a-uuid',
      count: -5, // Not positive
      isActive: 'yes', // Not a boolean
    };

    // Should throw error
    expect(() => {
      validateResponse(invalidResponse, schema);
    }).toThrow();
  });

  it('should validate nested response objects', () => {
    // Schema with nested objects
    const schema = z.object({
      user: z.object({
        id: z.string(),
        profile: z.object({
          firstName: z.string(),
          lastName: z.string(),
          email: z.string().email(),
        }),
      }),
      metadata: z.object({
        version: z.string(),
        timestamp: z.number(),
      }),
    });

    // Valid nested response
    const response = {
      user: {
        id: '123',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
        },
      },
      metadata: {
        version: '1.0.0',
        timestamp: 1623744000000,
      },
    };

    // Validate the response
    const result = validateResponse(response, schema);

    // Result should match input
    expect(result).toEqual(response);
  });

  it('should validate array responses', () => {
    // Schema for array response
    const schema = z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        value: z.number(),
      })
    );

    // Valid array response
    const response = [
      { id: '1', name: 'Item 1', value: 100 },
      { id: '2', name: 'Item 2', value: 200 },
      { id: '3', name: 'Item 3', value: 300 },
    ];

    // Validate the response
    const result = validateResponse(response, schema);

    // Result should match input
    expect(result).toEqual(response);
  });

  it('should handle response transformation', () => {
    // Schema with transformations
    const schema = z.object({
      id: z.string(),
      createdAt: z.string().transform(s => new Date(s)),
      updatedAt: z.string().transform(s => new Date(s)),
      count: z.number().transform(n => n.toString()),
    });

    // Response with string dates
    const response = {
      id: '123',
      createdAt: '2023-06-15T10:00:00Z',
      updatedAt: '2023-06-16T15:30:00Z',
      count: 42,
    };

    // Validate and transform
    const result = validateResponse(response, schema);

    // Check transformed types
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(typeof result.count).toBe('string');

    // Check transformed values
    expect(result.createdAt.toISOString()).toBe('2023-06-15T10:00:00.000Z');
    expect(result.updatedAt.toISOString()).toBe('2023-06-16T15:30:00.000Z');
    expect(result.count).toBe('42');
  });

  it('should validate paged response structures', () => {
    // Define a schema for a paged response
    const userSchema = z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
    });

    const pagedResponseSchema = z.object({
      data: z.array(userSchema),
      pagination: z.object({
        total: z.number().int().nonnegative(),
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        totalPages: z.number().int().nonnegative(),
      }),
    });

    // Valid paged response
    const response = {
      data: [
        { id: '1', name: 'User 1', email: 'user1@example.com' },
        { id: '2', name: 'User 2', email: 'user2@example.com' },
      ],
      pagination: {
        total: 10,
        page: 1,
        pageSize: 2,
        totalPages: 5,
      },
    };

    // Validate the response
    const result = validateResponse(response, pagedResponseSchema);

    // Result should match input
    expect(result).toEqual(response);
  });

  it('should handle optional fields in responses', () => {
    // Schema with optional fields
    const schema = z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      metadata: z
        .object({
          tags: z.array(z.string()).optional(),
          category: z.string().optional(),
        })
        .optional(),
    });

    // Response with some optional fields missing
    const response = {
      id: '123',
      name: 'Example',
      // description is missing
      metadata: {
        // tags is missing
        category: 'test',
      },
    };

    // Validate the response
    const result = validateResponse(response, schema);

    // Result should match input
    expect(result).toEqual(response);
  });

  it('should enforce required fields in responses', () => {
    // Schema with required fields
    const schema = z.object({
      id: z.string(),
      name: z.string(),
      createdAt: z.string(),
    });

    // Response missing a required field
    const invalidResponse = {
      id: '123',
      name: 'Example',
      // createdAt is missing
    };

    // Should throw error
    expect(() => {
      validateResponse(invalidResponse, schema);
    }).toThrow();
  });

  it('should validate different response types with discriminated unions', () => {
    // Schema with discriminated union
    const successSchema = z.object({
      status: z.literal('success'),
      data: z.object({
        id: z.string(),
        name: z.string(),
      }),
    });

    const errorSchema = z.object({
      status: z.literal('error'),
      error: z.object({
        code: z.string(),
        message: z.string(),
      }),
    });

    const responseSchema = z.discriminatedUnion('status', [successSchema, errorSchema]);

    // Success response
    const successResponse = {
      status: 'success',
      data: {
        id: '123',
        name: 'Example',
      },
    };

    // Error response
    const errorResponse = {
      status: 'error',
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    };

    // Validate both types
    const successResult = validateResponse(successResponse, responseSchema);
    const errorResult = validateResponse(errorResponse, responseSchema);

    // Results should match inputs
    expect(successResult).toEqual(successResponse);
    expect(errorResult).toEqual(errorResponse);

    // Invalid response (missing discriminator field)
    const invalidResponse = {
      data: {
        id: '123',
        name: 'Example',
      },
    };

    // Should throw error
    expect(() => {
      validateResponse(invalidResponse, responseSchema);
    }).toThrow();
  });

  it('should validate and transform date fields in responses', () => {
    // Schema with date validation and transformation
    const schema = z.object({
      id: z.string(),
      dates: z.object({
        created: z
          .string()
          .datetime()
          .transform(s => new Date(s)),
        updated: z
          .string()
          .datetime()
          .transform(s => new Date(s)),
        // Optional date that might be null
        deleted: z
          .string()
          .datetime()
          .transform(s => new Date(s))
          .nullable(),
      }),
    });

    // Response with date strings
    const response = {
      id: '123',
      dates: {
        created: '2023-06-15T10:00:00Z',
        updated: '2023-06-16T15:30:00Z',
        deleted: null,
      },
    };

    // Validate and transform
    const result = validateResponse(response, schema);

    // Check types and values
    expect(result.dates.created).toBeInstanceOf(Date);
    expect(result.dates.updated).toBeInstanceOf(Date);
    expect(result.dates.deleted).toBeNull();

    expect(result.dates.created.toISOString()).toBe('2023-06-15T10:00:00.000Z');
    expect(result.dates.updated.toISOString()).toBe('2023-06-16T15:30:00.000Z');
  });

  it('should report detailed validation errors', () => {
    // Schema with multiple validations
    const schema = z.object({
      id: z.string().uuid(),
      user: z.object({
        name: z.string().min(3),
        email: z.string().email(),
        age: z.number().int().min(18),
      }),
      items: z.array(
        z.object({
          id: z.string(),
          quantity: z.number().positive(),
        })
      ),
    });

    // Response with multiple validation issues
    const invalidResponse = {
      id: 'not-a-uuid',
      user: {
        name: 'Jo', // Too short
        email: 'not-an-email',
        age: 16, // Too young
      },
      items: [
        { id: '1', quantity: 5 }, // Valid
        { id: '2', quantity: 0 }, // Not positive
        { id: '3', quantity: -1 }, // Not positive
      ],
    };

    // Validate and expect error
    try {
      validateResponse(invalidResponse, schema);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Check for specific error issues
        const issues = error.issues;

        // Should have issues for all invalid fields
        const idIssues = issues.filter(issue => issue.path[0] === 'id');
        const nameIssues = issues.filter(
          issue => issue.path[0] === 'user' && issue.path[1] === 'name'
        );
        const emailIssues = issues.filter(
          issue => issue.path[0] === 'user' && issue.path[1] === 'email'
        );
        const ageIssues = issues.filter(
          issue => issue.path[0] === 'user' && issue.path[1] === 'age'
        );
        const itemIssues = issues.filter(issue => issue.path[0] === 'items');

        expect(idIssues.length).toBeGreaterThan(0);
        expect(nameIssues.length).toBeGreaterThan(0);
        expect(emailIssues.length).toBeGreaterThan(0);
        expect(ageIssues.length).toBeGreaterThan(0);
        expect(itemIssues.length).toBeGreaterThan(0);
      } else {
        throw new Error('Expected ZodError');
      }
    }
  });

  it('should maintain type safety with generics', () => {
    // Define typed interfaces
    interface User {
      id: string;
      name: string;
      email: string;
    }

    interface ApiResponse<T> {
      data: T;
      meta: {
        timestamp: number;
        version: string;
      };
    }

    // Create schemas matching the interfaces
    const userSchema = z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
    });

    // Generic response schema
    const apiResponseSchema = z.object({
      data: userSchema,
      meta: z.object({
        timestamp: z.number(),
        version: z.string(),
      }),
    });

    // Response matching the schema
    const response = {
      data: {
        id: '123',
        name: 'Example User',
        email: 'user@example.com',
      },
      meta: {
        timestamp: 1686825600000,
        version: '1.0.0',
      },
    };

    // Validate with explicit type
    const result = validateResponse<ApiResponse<User>>(response, apiResponseSchema);

    // Type checks (compile-time)
    const id: string = result.data.id;
    const meta: { timestamp: number; version: string } = result.meta;

    // Runtime checks
    expect(result).toEqual(response);
    expect(id).toEqual(response.data.id);
    expect(meta.timestamp).toEqual(response.meta.timestamp);
    expect(meta.version).toEqual(response.meta.version);
  });
});
