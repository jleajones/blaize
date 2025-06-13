import { Router } from '../../../blaize-types/src/index';

/**
 * Create a mock router for testing
 */
export function createMockRouter(): Router {
  return {
    handleRequest: vi.fn().mockResolvedValue(undefined),
    getRoutes: vi.fn().mockReturnValue([]),
    addRoute: vi.fn(),
    addRouteDirectory: vi.fn().mockResolvedValue(undefined),
    getRouteConflicts: vi.fn().mockReturnValue([]),
  };
}
