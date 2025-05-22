import { z } from 'zod';

import { validateParams } from './params';

describe('validateParams', () => {
  it('should validate simple route parameters against a schema', () => {
    // Define a simple schema for route parameters
    const schema = z.object({
      id: z.string().uuid(),
      slug: z.string(),
    });

    // Valid params
    const validParams = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      slug: 'hello-world',
    };

    // Validate the params
    const result = validateParams(validParams, schema);

    // Result should match input
    expect(result).toEqual(validParams);
  });

  it('should convert string parameters to numbers when schema requires', () => {
    // Define a schema that expects numbers
    const schema = z.object({
      id: z.coerce.number().int().positive(),
      page: z.coerce.number().int().nonnegative(),
    });

    // Params from URL (always strings)
    const params = {
      id: '123',
      page: '5',
    };

    // Validate and expect conversion
    const result = validateParams(params, schema);

    // Result should have numbers, not strings
    expect(result).toEqual({
      id: 123,
      page: 5,
    });

    // Type check
    expect(typeof result.id).toBe('number');
    expect(typeof result.page).toBe('number');
  });

  it('should throw an error for invalid parameters', () => {
    // Define schema with validation rules
    const schema = z.object({
      id: z.string().uuid(),
      status: z.enum(['active', 'inactive', 'pending']),
    });

    // Invalid parameters
    const invalidParams = {
      id: 'not-a-uuid',
      status: 'unknown',
    };

    // Should throw error
    expect(() => {
      validateParams(invalidParams, schema);
    }).toThrow();
  });

  it('should handle optional parameters', () => {
    // Schema with optional fields
    const schema = z.object({
      id: z.string(),
      filter: z.string().optional(),
      sort: z.string().optional(),
    });

    // Params with only required field
    const params = {
      id: '123',
    };

    // Should validate
    const result = validateParams(params, schema);
    expect(result).toEqual(params);
  });

  it('should transform parameters according to schema transformations', () => {
    // Schema with transformations
    const schema = z.object({
      slug: z.string().transform(s => s.toLowerCase()),
      category: z.string().transform(s => s.toUpperCase()),
    });

    // Params with mixed case
    const params = {
      slug: 'Hello-World',
      category: 'technology',
    };

    // Expected transformed result
    const expected = {
      slug: 'hello-world',
      category: 'TECHNOLOGY',
    };

    // Validate and transform
    const result = validateParams(params, schema);
    expect(result).toEqual(expected);
  });

  it('should handle boolean parameters', () => {
    // Schema with boolean conversion
    const schema = z.object({
      active: z.string().transform(v => v === 'true'),
      featured: z.string().transform(v => v === 'true'),
    });

    // String params (as they would come from URL)
    const params = {
      active: 'true',
      featured: 'false',
    };

    // Expected result after transformation
    const expected = {
      active: true,
      featured: false,
    };

    // Validate and transform
    const result = validateParams(params, schema);
    expect(result).toEqual(expected);

    // Type check
    expect(typeof result.active).toBe('boolean');
    expect(typeof result.featured).toBe('boolean');
  });

  it('should handle date parameters', () => {
    // Schema with date transformation
    const schema = z.object({
      createdAt: z.string().transform(s => {
        return new Date(`${s}T00:00:00Z`);
      }),
    });

    // Date as string parameter
    const params = {
      createdAt: '2023-06-15',
    };

    // Validate and transform
    const result = validateParams(params, schema);

    // Result should contain a Date object
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.getUTCFullYear()).toBe(2023);
    expect(result.createdAt.getUTCMonth()).toBe(5); // 0-based (June is 5)
    expect(result.createdAt.getUTCDate()).toBe(15);
  });

  it('should validate parameters with regex patterns', () => {
    // Schema with regex patterns
    const schema = z.object({
      zip: z.string().regex(/^\d{5}$/),
      code: z.string().regex(/^[A-Z]{2}-\d{3}$/),
    });

    // Valid params
    const validParams = {
      zip: '12345',
      code: 'AB-123',
    };

    // Invalid params
    const invalidParams = {
      zip: '1234', // Too short
      code: 'abc-123', // Wrong format
    };

    // Valid should pass
    expect(validateParams(validParams, schema)).toEqual(validParams);

    // Invalid should throw
    expect(() => {
      validateParams(invalidParams, schema);
    }).toThrow();
  });

  it('should handle complex validation with custom refinements', () => {
    // Schema with custom refinement
    const schema = z.object({
      range: z.string().refine(
        s => {
          const [start, end] = s.split('-').map(Number);
          if (!start || !end) return false;
          if (isNaN(start) || isNaN(end)) return false;
          return start < end;
        },
        { message: 'Start value must be less than end value' }
      ),
    });

    // Valid range
    const validParams = {
      range: '10-20',
    };

    // Invalid range
    const invalidParams = {
      range: '30-20',
    };

    // Valid should pass
    expect(validateParams(validParams, schema)).toEqual(validParams);

    // Invalid should throw
    expect(() => {
      validateParams(invalidParams, schema);
    }).toThrow();
  });

  it('should properly report validation errors', () => {
    // Schema for validation
    const schema = z.object({
      id: z.string().uuid(),
      page: z.coerce.number().int().positive(),
    });

    // Invalid params
    const invalidParams = {
      id: 'not-a-uuid',
      page: '0', // Not positive
    };

    // Validate and expect error
    try {
      validateParams(invalidParams, schema);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Check for specific error issues
        const issues = error.issues;

        // Should have issues for both fields
        const idIssues = issues.filter(issue => issue.path[0] === 'id');
        const pageIssues = issues.filter(issue => issue.path[0] === 'page');

        expect(idIssues.length).toBeGreaterThan(0);
        expect(pageIssues.length).toBeGreaterThan(0);

        // Check specific error codes
        expect(idIssues[0]!.code).toBe('invalid_string');
        expect(pageIssues[0]!.code).toBe('too_small');
      } else {
        throw new Error('Expected ZodError');
      }
    }
  });

  it('should maintain type safety with generics', () => {
    // Define a typed interface for the params
    interface RouteParams {
      userId: string;
      section: 'profile' | 'settings' | 'dashboard';
    }

    // Create a schema that matches the interface
    const schema = z.object({
      userId: z.string(),
      section: z.enum(['profile', 'settings', 'dashboard']),
    }) as z.ZodType<RouteParams>;

    // Valid params
    const params = {
      userId: 'user123',
      section: 'profile' as const,
    };

    // Validate with explicit type
    const result = validateParams<RouteParams>(params, schema);

    // Type checks (compile-time)
    const userId: string = result.userId;
    const section: 'profile' | 'settings' | 'dashboard' = result.section;
    // This would error if section wasn't properly typed:
    // const section: 'profile' | 'settings' | 'dashboard' = result.section;

    // Runtime checks
    expect(result).toEqual(params);
    expect(userId).toEqual('user123');
    expect(section).toEqual('profile');
  });
});
