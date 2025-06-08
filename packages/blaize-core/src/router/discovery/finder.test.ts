import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { findRouteFiles } from './finder';

// Mock the fs module
vi.mock('node:fs/promises');
vi.mock('node:path');

describe('findRouteFiles', () => {
  // Setup and teardown
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();

    // Mock implementation for path.isAbsolute
    vi.mocked(path.isAbsolute).mockImplementation(p => p.startsWith('/'));

    // Mock implementation for path.resolve
    vi.mocked(path.resolve).mockImplementation((...segments) =>
      segments.join('/').replace(/\/+/g, '/')
    );

    // Mock implementation for path.join
    vi.mocked(path.join).mockImplementation((...segments) =>
      segments.join('/').replace(/\/+/g, '/')
    );

    // Suppress console output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error if routes directory does not exist', async () => {
    // Mock fs.stat to throw ENOENT error
    vi.mocked(fs.stat).mockRejectedValueOnce({
      code: 'ENOENT',
      message: 'Directory not found',
    } as NodeJS.ErrnoException);

    // Assert that findRouteFiles throws with the expected error message
    await expect(findRouteFiles('/routes')).rejects.toThrow('Route directory not found: /routes');
  });

  it('should throw error if routes path is not a directory', async () => {
    // Mock fs.stat to return a non-directory
    vi.mocked(fs.stat).mockResolvedValueOnce({
      isDirectory: () => false,
    } as any);

    // Assert that findRouteFiles throws with the expected error message
    await expect(findRouteFiles('/routes')).rejects.toThrow(
      'Route directory is not a directory: /routes'
    );
  });

  it('should throw original error if fs.stat fails with non-ENOENT error', async () => {
    const originalError = new Error('Some other error');
    vi.mocked(fs.stat).mockRejectedValueOnce(originalError);

    await expect(findRouteFiles('/routes')).rejects.toThrow(originalError);
  });

  it('should convert relative paths to absolute paths', async () => {
    // Mock path.isAbsolute to return false for relative paths
    vi.mocked(path.isAbsolute).mockReturnValue(false);

    // Mock process.cwd to return a specific directory
    vi.spyOn(process, 'cwd').mockReturnValue('/current/dir');

    // Mock fs.stat to return a directory
    vi.mocked(fs.stat).mockResolvedValueOnce({
      isDirectory: () => true,
    } as any);

    // Mock fs.readdir to return an empty array
    vi.mocked(fs.readdir).mockResolvedValueOnce([]);

    // Call the function with a relative path
    await findRouteFiles('routes');

    // Verify path.resolve was called with the expected arguments
    expect(path.resolve).toHaveBeenCalledWith('/current/dir', 'routes');
  });

  it('should find all valid route files in a directory', async () => {
    // Mock fs.stat to return a directory
    vi.mocked(fs.stat).mockResolvedValueOnce({
      isDirectory: () => true,
    } as any);

    // Use explicit any type for our mock Dirent objects
    const mockDirents: any[] = [
      { name: 'users.ts', isDirectory: () => false },
      { name: 'posts.js', isDirectory: () => false },
      { name: '_middleware.ts', isDirectory: () => false }, // Should be ignored (starts with _)
      { name: 'index.ts', isDirectory: () => false }, // Should be ignored (is index.ts)
      { name: 'auth', isDirectory: () => true },
      { name: 'node_modules', isDirectory: () => true }, // Should be ignored
    ];

    vi.mocked(fs.readdir).mockResolvedValueOnce(mockDirents);

    // Mock readdir for the auth directory
    const mockAuthDirents: any[] = [
      { name: 'login.ts', isDirectory: () => false },
      { name: 'register.ts', isDirectory: () => false },
    ];

    vi.mocked(fs.readdir).mockResolvedValueOnce(mockAuthDirents);

    // Call the function
    const result = await findRouteFiles('/routes');

    // Expected routes to be found
    expect(result).toEqual([
      '/routes/users.ts',
      '/routes/posts.js',
      '/routes/index.ts',
      '/routes/auth/login.ts',
      '/routes/auth/register.ts',
    ]);
  });

  it('should respect custom ignore patterns', async () => {
    // Mock fs.stat to return a directory
    vi.mocked(fs.stat).mockResolvedValueOnce({
      isDirectory: () => true,
    } as any);

    // Mock fs.readdir to return a list of files and directories
    const mockDirents: any[] = [
      { name: 'users.ts', isDirectory: () => false },
      { name: 'temp', isDirectory: () => true }, // Custom ignore
      { name: 'docs', isDirectory: () => true },
    ];

    vi.mocked(fs.readdir).mockResolvedValueOnce(mockDirents);

    // Mock readdir for the docs directory
    const mockDocsDirents: any[] = [{ name: 'api.ts', isDirectory: () => false }];

    vi.mocked(fs.readdir).mockResolvedValueOnce(mockDocsDirents);

    // Call the function with custom ignore
    const result = await findRouteFiles('/routes', { ignore: ['temp', 'node_modules'] });

    // Expected routes to be found (temp directory should be ignored)
    expect(result).toEqual(['/routes/users.ts', '/routes/docs/api.ts']);
  });

  it('should handle nested directories correctly', async () => {
    // Mock fs.stat to return a directory
    vi.mocked(fs.stat).mockResolvedValueOnce({
      isDirectory: () => true,
    } as any);

    // Mock fs.readdir for root directory
    vi.mocked(fs.readdir).mockResolvedValueOnce([{ name: 'api', isDirectory: () => true } as any]);

    // Mock readdir for /routes/api
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'v1', isDirectory: () => true } as any,
      { name: 'v2', isDirectory: () => true } as any,
    ]);

    // Mock readdir for /routes/api/v1
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'users.ts', isDirectory: () => false } as any,
    ]);

    // Mock readdir for /routes/api/v2
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'users.ts', isDirectory: () => false } as any,
      { name: 'products.ts', isDirectory: () => false } as any,
    ]);

    // Call the function
    const result = await findRouteFiles('/routes');

    // Expected routes to be found
    expect(result).toEqual([
      '/routes/api/v1/users.ts',
      '/routes/api/v2/users.ts',
      '/routes/api/v2/products.ts',
    ]);
  });

  it('should return an empty array if no route files are found', async () => {
    // Mock fs.stat to return a directory
    vi.mocked(fs.stat).mockResolvedValueOnce({
      isDirectory: () => true,
    } as any);

    // Mock fs.readdir to return only non-route files
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: '_middleware.ts', isDirectory: () => false } as any,
      { name: 'README.md', isDirectory: () => false } as any,
    ]);

    // Call the function
    const result = await findRouteFiles('/routes');

    // Expect an empty array
    expect(result).toEqual([]);
  });

  it('should include index.ts files and handle them correctly', async () => {
    // Mock fs.stat to return a directory
    vi.mocked(fs.stat).mockResolvedValueOnce({
      isDirectory: () => true,
    } as any);

    const mockDirents: any[] = [
      { name: 'index.ts', isDirectory: () => false }, // Root index route
      { name: 'users.ts', isDirectory: () => false },
      { name: 'api', isDirectory: () => true },
    ];

    vi.mocked(fs.readdir).mockResolvedValueOnce(mockDirents);

    // Mock readdir for the api directory with its own index
    const mockApiDirents: any[] = [
      { name: 'index.ts', isDirectory: () => false }, // API index route
      { name: 'users.ts', isDirectory: () => false },
    ];

    vi.mocked(fs.readdir).mockResolvedValueOnce(mockApiDirents);

    const result = await findRouteFiles('/routes');

    expect(result).toEqual([
      '/routes/index.ts', // Should be included now
      '/routes/users.ts',
      '/routes/api/index.ts', // Should be included now
      '/routes/api/users.ts',
    ]);
  });

  it('should handle nested index routes correctly', async () => {
    // Mock fs.stat to return a directory
    vi.mocked(fs.stat).mockResolvedValueOnce({
      isDirectory: () => true,
    } as any);

    // Mock complex nested structure with multiple index files
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'users', isDirectory: () => true } as any,
    ]);

    // Mock /routes/users with index and subdirectory
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'index.ts', isDirectory: () => false } as any,
      { name: 'profile', isDirectory: () => true } as any,
    ]);

    // Mock /routes/users/profile with its own index
    vi.mocked(fs.readdir).mockResolvedValueOnce([
      { name: 'index.ts', isDirectory: () => false } as any,
      { name: 'settings.ts', isDirectory: () => false } as any,
    ]);

    const result = await findRouteFiles('/routes');

    expect(result).toEqual([
      '/routes/users/index.ts', // maps to /users
      '/routes/users/profile/index.ts', // maps to /users/profile
      '/routes/users/profile/settings.ts',
    ]);
  });
});
