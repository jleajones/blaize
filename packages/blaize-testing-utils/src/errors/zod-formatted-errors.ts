/**
 * Helper function to create formatted Zod errors for testing
 */
export function createFormattedZodError(fieldErrors: Record<string, string[]>): any {
  return {
    _errors: [], // Root level errors (usually empty for field-specific errors)
    ...Object.entries(fieldErrors).reduce(
      (acc, [field, errors]) => {
        acc[field] = { _errors: errors };
        return acc;
      },
      {} as Record<string, { _errors: string[] }>
    ),
  };
}
