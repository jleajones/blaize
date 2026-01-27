import { generatePackageJson } from './generate-package-json';

import type { Template } from '@/types';

describe('generatePackageJson', () => {
  // Create a mock template
  const createMockTemplate = (overrides: Partial<Template> = {}): Template => ({
    name: 'minimal',
    files: [],
    getDependencies: vi.fn().mockResolvedValue({
      blaize: '^1.0.0',
      zod: '^3.22.0',
    }),
    getDevDependencies: vi.fn().mockResolvedValue({
      '@types/node': '^20.0.0',
      typescript: '^5.3.0',
      vitest: '^1.0.0',
    }),
    scripts: {
      dev: 'blaize dev',
      build: 'blaize build',
      test: 'vitest',
    },
    ...overrides,
  });

  it('should generate package.json with correct structure', async () => {
    const template = createMockTemplate();

    const result = await generatePackageJson('my-app', template, false);

    expect(result).toEqual({
      name: 'my-app',
      version: '0.1.0',
      private: true,
      type: 'module',
      description: 'A BlaizeJS application',
      scripts: {
        dev: 'blaize dev',
        build: 'blaize build',
        test: 'vitest',
      },
      dependencies: {
        blaize: '^1.0.0',
        zod: '^3.22.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.3.0',
        vitest: '^1.0.0',
      },
      engines: {
        node: '>=23.0.0',
      },
    });
  });

  it('should use project name from parameter', async () => {
    const template = createMockTemplate();

    const result = await generatePackageJson('custom-project-name', template, false);

    expect(result.name).toBe('custom-project-name');
  });

  it('should call getDependencies with latest flag', async () => {
    const template = createMockTemplate();

    await generatePackageJson('my-app', template, true);

    expect(template.getDependencies).toHaveBeenCalledWith({ latest: true });
    expect(template.getDevDependencies).toHaveBeenCalledWith({ latest: true });
  });

  it('should call getDependencies without latest flag when false', async () => {
    const template = createMockTemplate();

    await generatePackageJson('my-app', template, false);

    expect(template.getDependencies).toHaveBeenCalledWith({ latest: false });
    expect(template.getDevDependencies).toHaveBeenCalledWith({ latest: false });
  });

  it('should handle empty dependencies', async () => {
    const template = createMockTemplate({
      getDependencies: vi.fn().mockResolvedValue({}),
      getDevDependencies: vi.fn().mockResolvedValue({}),
    });

    const result = await generatePackageJson('my-app', template, false);

    expect(result.dependencies).toEqual({});
    expect(result.devDependencies).toEqual({});
  });

  it('should handle empty scripts', async () => {
    const template = createMockTemplate({
      scripts: {},
    });

    const result = await generatePackageJson('my-app', template, false);

    expect(result.scripts).toEqual({});
  });

  it('should use template scripts', async () => {
    const customScripts = {
      start: 'node index.js',
      lint: 'eslint .',
      format: 'prettier --write .',
    };

    const template = createMockTemplate({
      scripts: customScripts,
    });

    const result = await generatePackageJson('my-app', template, false);

    expect(result.scripts).toEqual(customScripts);
  });

  it('should handle different dependency versions based on latest flag', async () => {
    const template = createMockTemplate({
      getDependencies: vi
        .fn()
        .mockImplementation(async ({ latest }) =>
          latest ? { blaize: 'latest', zod: 'latest' } : { blaize: '^1.0.0', zod: '^3.22.0' }
        ),
      getDevDependencies: vi
        .fn()
        .mockImplementation(async ({ latest }) =>
          latest
            ? { typescript: 'latest', vitest: 'latest' }
            : { typescript: '^5.3.0', vitest: '^1.0.0' }
        ),
    });

    const stableResult = await generatePackageJson('my-app', template, false);
    expect(stableResult.dependencies).toEqual({
      blaize: '^1.0.0',
      zod: '^3.22.0',
    });

    const latestResult = await generatePackageJson('my-app', template, true);
    expect(latestResult.dependencies).toEqual({
      blaize: 'latest',
      zod: 'latest',
    });
  });

  it('should handle getDependencies rejection', async () => {
    const template = createMockTemplate({
      getDependencies: vi.fn().mockRejectedValue(new Error('Failed to fetch dependencies')),
    });

    await expect(generatePackageJson('my-app', template, false)).rejects.toThrow(
      'Failed to fetch dependencies'
    );
  });

  it('should handle getDevDependencies rejection', async () => {
    const template = createMockTemplate({
      getDevDependencies: vi.fn().mockRejectedValue(new Error('Failed to fetch dev dependencies')),
    });

    await expect(generatePackageJson('my-app', template, false)).rejects.toThrow(
      'Failed to fetch dev dependencies'
    );
  });

  it('should maintain consistent package.json structure', async () => {
    const template = createMockTemplate();

    const result = await generatePackageJson('test-app', template, false);

    // Verify all required fields are present
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('version');
    expect(result).toHaveProperty('private');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('scripts');
    expect(result).toHaveProperty('dependencies');
    expect(result).toHaveProperty('devDependencies');
    expect(result).toHaveProperty('engines');

    // Verify types
    expect(typeof result.name).toBe('string');
    expect(typeof result.version).toBe('string');
    expect(typeof result.private).toBe('boolean');
    expect(typeof result.type).toBe('string');
    expect(typeof result.description).toBe('string');
    expect(typeof result.scripts).toBe('object');
    expect(typeof result.dependencies).toBe('object');
    expect(typeof result.devDependencies).toBe('object');
    expect(typeof result.engines).toBe('object');
  });

  it('should set correct default values', async () => {
    const template = createMockTemplate();

    const result = await generatePackageJson('my-app', template, false);

    expect(result.version).toBe('0.1.0');
    expect(result.private).toBe(true);
    expect(result.type).toBe('module');
    expect(result.description).toBe('A BlaizeJS application');
    expect(result.engines.node).toBe('>=23.0.0');
  });
});
