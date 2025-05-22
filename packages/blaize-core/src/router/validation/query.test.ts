import { z } from 'zod';

import { validateQuery } from './query';

describe('validateQuery', () => {
  it('should validate simple query parameters', () => {
    // Define a simple schema
    const schema = z.object({
      search: z.string(),
      page: z.string(),
    });

    // Valid query params
    const query = {
      search: 'typescript',
      page: '1',
    };

    // Validate the query
    const result = validateQuery(query, schema);

    // Result should match input
    expect(result).toEqual(query);
  });

  it('should convert string parameters to appropriate types', () => {
    // Schema with type conversions
    const schema = z.object({
      page: z.coerce.number().int().positive(),
      limit: z.coerce.number().int().positive(),
      active: z.string().transform(s => s === 'true'),
    });

    // Query with string values
    const query = {
      page: '2',
      limit: '10',
      active: 'true',
    };

    // Expected result after transformation
    const expected = {
      page: 2,
      limit: 10,
      active: true,
    };

    // Validate and transform
    const result = validateQuery(query, schema);

    // Should match expected transformed values
    expect(result).toEqual(expected);

    // Type checks
    expect(typeof result.page).toBe('number');
    expect(typeof result.limit).toBe('number');
    expect(typeof result.active).toBe('boolean');
  });

  it('should handle array query parameters', () => {
    // Schema with array parameters
    const schema = z.object({
      tags: z.array(z.string()),
      ids: z.array(z.coerce.number().int().positive()),
    });

    // Query with array values
    const query = {
      tags: ['javascript', 'typescript', 'react'],
      ids: ['1', '2', '3'],
    };

    // Expected result with type conversions
    const expected = {
      tags: ['javascript', 'typescript', 'react'],
      ids: [1, 2, 3],
    };

    // Validate and transform
    const result = validateQuery(query, schema);

    // Should match expected values
    expect(result).toEqual(expected);

    // Type checks
    expect(Array.isArray(result.tags)).toBe(true);
    expect(Array.isArray(result.ids)).toBe(true);
    expect(typeof result.ids[0]).toBe('number');
  });

  it('should demonstrate how to set up schemas for flexible query parameter handling', () => {
    // EXAMPLE: How to properly configure a schema for query parameters
    // that might come as either single values or arrays
    const schema = z.object({
      // Pattern 1: Using preprocess for maximum flexibility
      tags: z.preprocess(val => {
        if (Array.isArray(val)) return val;
        if (val === undefined || val === null) return [];
        return [val];
      }, z.array(z.string())),

      // Pattern 2: Using union + transform (alternative approach)
      category: z.union([z.string(), z.array(z.string()), z.undefined()]).transform(val => {
        if (Array.isArray(val)) return val;
        if (val === undefined || val === null) return [];
        return [val];
      }),
    });

    // Test with different input formats that could come from query parameters
    const testCases = [
      // Case 1: Single values
      {
        input: { tags: 'javascript', category: 'frontend' },
        expected: { tags: ['javascript'], category: ['frontend'] },
      },
      // Case 2: Array values
      {
        input: { tags: ['javascript', 'typescript'], category: ['frontend'] },
        expected: { tags: ['javascript', 'typescript'], category: ['frontend'] },
      },
      // Case 3: Missing values
      {
        input: {},
        expected: { tags: [], category: [] },
      },
      // Case 4: Mixed formats
      {
        input: { tags: ['javascript'], category: 'frontend' },
        expected: { tags: ['javascript'], category: ['frontend'] },
      },
    ];

    // Run all test cases
    testCases.forEach(({ input, expected }) => {
      const result = validateQuery(input, schema);
      expect(result).toEqual(expected);
    });
  });

  it('should handle undefined query parameters', () => {
    // Schema with optional fields
    const schema = z.object({
      search: z.string().optional(),
      page: z.string().optional().default('1'),
      limit: z.string().optional(),
    });

    // Query with missing optional fields
    const query = {
      search: 'typescript',
      // page and limit are missing
    };

    // Expected result with defaults
    const expected = {
      search: 'typescript',
      page: '1', // Default value
      // limit remains undefined
    };

    // Validate
    const result = validateQuery(query, schema);

    // Should apply defaults
    expect(result).toEqual(expected);
  });

  it('should throw error for missing required parameters', () => {
    // Schema with required fields
    const schema = z.object({
      search: z.string(), // Required
      page: z.string().optional(),
    });

    // Query missing required field
    const query = {
      page: '2',
      // search is missing
    };

    // Should throw error
    expect(() => {
      validateQuery(query, schema);
    }).toThrow();
  });

  it('should handle complex filter parameters', () => {
    // Schema for filter query
    const schema = z.object({
      filter: z.string().transform(str => {
        try {
          return JSON.parse(str);
        } catch {
          return str;
        }
      }),
    });

    // Query with JSON string filter
    const query = {
      filter: '{"status":"active","priority":"high"}',
    };

    // Expected parsed result
    const expected = {
      filter: {
        status: 'active',
        priority: 'high',
      },
    };

    // Validate and transform
    const result = validateQuery(query, schema);

    // Should parse JSON string
    expect(result).toEqual(expected);
    expect(typeof result.filter).toBe('object');
  });

  it('should validate date query parameters', () => {
    // Schema with date conversion
    const schema = z.object({
      startDate: z.string().transform(s => new Date(`${s}T00:00:00Z`)),
      endDate: z.string().transform(s => new Date(`${s}T00:00:00Z`)),
    });

    // Query with date strings
    const query = {
      startDate: '2023-01-01',
      endDate: '2023-01-31',
    };

    // Validate and transform
    const result = validateQuery(query, schema);

    // Should convert to Date objects
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate).toBeInstanceOf(Date);

    // Verify dates using UTC methods to avoid timezone issues
    expect(result.startDate.getUTCFullYear()).toBe(2023);
    expect(result.startDate.getUTCMonth()).toBe(0); // January (0-based)
    expect(result.startDate.getUTCDate()).toBe(1);

    expect(result.endDate.getUTCFullYear()).toBe(2023);
    expect(result.endDate.getUTCMonth()).toBe(0); // January (0-based)
    expect(result.endDate.getUTCDate()).toBe(31);
  });

  it('should handle validation with conditional requirements', () => {
    // Schema with conditional validation
    const schema = z
      .object({
        type: z.enum(['product', 'category']),
        productId: z.string().optional(),
        categoryId: z.string().optional(),
      })
      .refine(
        data => {
          if (data.type === 'product') return !!data.productId;
          if (data.type === 'category') return !!data.categoryId;
          return true;
        },
        {
          message: 'ID field is required based on type',
          path: ['productId', 'categoryId'],
        }
      );

    // Valid product query
    const validProduct = {
      type: 'product',
      productId: '123',
    };

    // Valid category query
    const validCategory = {
      type: 'category',
      categoryId: '456',
    };

    // Invalid product query (missing productId)
    const invalidProduct = {
      type: 'product',
      // Missing productId
    };

    // Test valid queries
    expect(validateQuery(validProduct, schema)).toEqual(validProduct);
    expect(validateQuery(validCategory, schema)).toEqual(validCategory);

    // Test invalid query
    expect(() => {
      validateQuery(invalidProduct, schema);
    }).toThrow();
  });

  it('should handle sorting parameters with specific formats', () => {
    // Schema for sort parameters
    const schema = z.object({
      sort: z
        .string()
        .refine(s => /^[a-zA-Z]+:(asc|desc)$/.test(s), {
          message: "Sort must be in format 'field:direction'",
        })
        .transform(s => {
          const [field, direction] = s.split(':');
          return { field, direction };
        }),
    });

    // Valid sort query
    const validQuery = {
      sort: 'createdAt:desc',
    };

    // Invalid sort query
    const invalidQuery = {
      sort: 'createdAt-desc',
    };

    // Expected transformed result
    const expected = {
      sort: {
        field: 'createdAt',
        direction: 'desc',
      },
    };

    // Test valid query
    const result = validateQuery(validQuery, schema);
    expect(result).toEqual(expected);

    // Test invalid query
    expect(() => {
      validateQuery(invalidQuery, schema);
    }).toThrow();
  });

  it('should handle complex error reporting', () => {
    // Schema with multiple validation requirements
    const schema = z.object({
      page: z.coerce.number().int().positive(),
      limit: z.coerce.number().int().min(1).max(100),
      sort: z.enum(['asc', 'desc']),
      filters: z.string().optional(),
    });

    // Invalid query
    const invalidQuery = {
      page: '0', // Not positive
      limit: '200', // Exceeds max
      sort: 'invalid', // Not in enum
    };

    // Validate and expect error
    try {
      validateQuery(invalidQuery, schema);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Verify error details
        const issues = error.issues;

        // Check for specific field issues
        const pageIssues = issues.filter(issue => issue.path[0] === 'page');
        const limitIssues = issues.filter(issue => issue.path[0] === 'limit');
        const sortIssues = issues.filter(issue => issue.path[0] === 'sort');

        expect(pageIssues.length).toBeGreaterThan(0);
        expect(limitIssues.length).toBeGreaterThan(0);
        expect(sortIssues.length).toBeGreaterThan(0);

        // Check specific error types
        expect(pageIssues[0]!.code).toBe('too_small');
        expect(limitIssues[0]!.code).toBe('too_big');
        expect(sortIssues[0]!.code).toBe('invalid_enum_value');
      } else {
        throw new Error('Expected ZodError');
      }
    }
  });

  it('should handle URL-encoded array parameters with proper parsing', () => {
    // Schema expecting arrays
    const schema = z.object({
      ids: z.array(z.coerce.number()),
    });

    // Query as it might come from URL query string like ?ids=1&ids=2&ids=3
    const query = {
      ids: ['1', '2', '3'],
    };

    // Expected result after coercion
    const expected = {
      ids: [1, 2, 3],
    };

    // Validate and transform
    const result = validateQuery(query, schema);

    // Should convert string array to number array
    expect(result).toEqual(expected);
  });
});
