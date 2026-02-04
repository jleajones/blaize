import { getDependencies, getDevDependencies } from './versions';

import type { VersionOptions } from '@/types';

describe('Version Management', () => {
  describe('getDependencies', () => {
    it('should return dependencies with correct versions', async () => {
      const dependencies = await getDependencies();

      expect(dependencies).toBeDefined();
      expect(typeof dependencies).toBe('object');
      expect(Object.keys(dependencies).length).toBeGreaterThan(0);
    });

    it('should always use latest for BlaizeJS packages', async () => {
      const dependencies = await getDependencies();

      expect(dependencies.blaizejs).toBe('latest');
    });

    it('should use major version ranges for external packages', async () => {
      const dependencies = await getDependencies();

      expect(dependencies.zod).toBe('^3.24.4');
      expect(dependencies.zod).toMatch(/^\^[\d]+\.[\d]+\.[\d]+$/);
    });

    it('should return consistent dependencies structure', async () => {
      const deps1 = await getDependencies();
      const deps2 = await getDependencies();

      expect(deps1).toEqual(deps2);
      expect(Object.keys(deps1)).toEqual(Object.keys(deps2));
    });

    it('should include all required dependencies', async () => {
      const dependencies = await getDependencies();
      const requiredDeps = ['blaizejs', 'zod'];

      requiredDeps.forEach(dep => {
        expect(dependencies).toHaveProperty(dep);
        expect(dependencies[dep]).toBeTruthy();
      });
    });

    it('should not include dev dependencies', async () => {
      const dependencies = await getDependencies();

      expect(dependencies).not.toHaveProperty('@types/node');
      expect(dependencies).not.toHaveProperty('typescript');
      expect(dependencies).not.toHaveProperty('tsx');
    });

    it('should handle async nature properly', async () => {
      const promise = getDependencies();

      expect(promise).toBeInstanceOf(Promise);

      const result = await promise;
      expect(result).toBeDefined();
    });

    it('should return valid semver ranges', async () => {
      const dependencies = await getDependencies();

      Object.entries(dependencies).forEach(([_name, version]) => {
        if (version !== 'latest') {
          // Check if it's a valid semver range (starts with ^, ~, >=, etc.)
          expect(version).toMatch(/^[\^~>=<]?[\d]+\.[\d]+\.[\d]+/);
        }
      });
    });
  });

  describe('getDevDependencies', () => {
    it('should return dev dependencies with correct versions', async () => {
      const devDependencies = await getDevDependencies();

      expect(devDependencies).toBeDefined();
      expect(typeof devDependencies).toBe('object');
      expect(Object.keys(devDependencies).length).toBeGreaterThan(0);
    });

    it('should include TypeScript-related packages', async () => {
      const devDependencies = await getDevDependencies();

      expect(devDependencies).toHaveProperty('@types/node');
      expect(devDependencies).toHaveProperty('typescript');
      expect(devDependencies).toHaveProperty('tsx');
    });

    it('should return consistent dev dependencies structure', async () => {
      const devDeps1 = await getDevDependencies();
      const devDeps2 = await getDevDependencies();

      expect(devDeps1).toEqual(devDeps2);
      expect(Object.keys(devDeps1)).toEqual(Object.keys(devDeps2));
    });

    it('should not include runtime dependencies', async () => {
      const devDependencies = await getDevDependencies();

      expect(devDependencies).not.toHaveProperty('blaizejs');
      expect(devDependencies).not.toHaveProperty('zod');
    });

    it('should handle async nature properly', async () => {
      const promise = getDevDependencies();

      expect(promise).toBeInstanceOf(Promise);

      const result = await promise;
      expect(result).toBeDefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should provide complete package.json dependencies section', async () => {
      const [deps, devDeps] = await Promise.all([getDependencies(), getDevDependencies()]);

      // Simulate package.json structure
      const packageJson = {
        dependencies: deps,
        devDependencies: devDeps,
      };

      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.devDependencies).toBeDefined();
      expect(packageJson.dependencies.blaizejs).toBe('latest');
      expect(packageJson.devDependencies.typescript).toMatch(/^\^5\./);
    });

    it('should handle concurrent calls efficiently', async () => {
      const promises = [
        getDependencies(),
        getDevDependencies(),
        getDependencies(),
        getDevDependencies(),
      ];

      const results = await Promise.all(promises);

      expect(results[0]).toEqual(results[2]); // Same dependencies
      expect(results[1]).toEqual(results[3]); // Same dev dependencies
    });

    it('should maintain version consistency', async () => {
      const deps = await getDependencies();
      const devDeps = await getDevDependencies();

      // No overlapping packages between deps and devDeps
      const depKeys = Object.keys(deps);
      const devDepKeys = Object.keys(devDeps);

      const intersection = depKeys.filter(key => devDepKeys.includes(key));
      expect(intersection).toHaveLength(0);
    });

    it('should provide minimal required dependencies', async () => {
      const deps = await getDependencies();

      // Should only include essential runtime dependencies
      const depCount = Object.keys(deps).length;
      expect(depCount).toBeGreaterThanOrEqual(2); // At least blaizejs and zod
      expect(depCount).toBeLessThanOrEqual(10); // Not too many dependencies
    });

    it('should provide standard dev dependencies', async () => {
      const devDeps = await getDevDependencies();

      // Should include standard TypeScript development tools
      const devDepCount = Object.keys(devDeps).length;
      expect(devDepCount).toBeGreaterThanOrEqual(3); // At least @types/node, typescript, tsx
      expect(devDepCount).toBeLessThanOrEqual(15); // Not too many dev dependencies
    });
  });

  describe('Version strategy', () => {
    it('should follow latest strategy for BlaizeJS packages', async () => {
      const deps = await getDependencies();

      // All BlaizeJS packages should use 'latest'
      Object.entries(deps).forEach(([name, version]) => {
        if (name.startsWith('blaize') || name.includes('blaize')) {
          expect(version).toBe('latest');
        }
      });
    });

    it('should follow major version strategy for external packages', async () => {
      const deps = await getDependencies();
      const devDeps = await getDevDependencies();

      const allExternalDeps = { ...deps, ...devDeps };

      Object.entries(allExternalDeps).forEach(([name, version]) => {
        if (!name.includes('blaize') && version !== 'latest') {
          // Should use caret (^) for major version compatibility
          expect(version).toMatch(/^\^/);
        }
      });
    });

    it('should use appropriate versions for TypeScript ecosystem', async () => {
      const devDeps = await getDevDependencies();

      // TypeScript should be version 5.x
      expect(devDeps.typescript).toMatch(/^\^5\./);

      // Node types should be recent LTS version
      expect(devDeps['@types/node']).toMatch(/^\^(22)\./);

      // tsx should be version 4.x
      expect(devDeps.tsx).toMatch(/^\^4\./);
    });
  });

  describe('Error handling', () => {
    it('should always return valid objects even if implementation changes', async () => {
      // Even if the implementation is modified, these should never throw
      await expect(getDependencies()).resolves.toBeDefined();
      await expect(getDevDependencies()).resolves.toBeDefined();
    });

    it('should never return null or undefined', async () => {
      const deps = await getDependencies();
      const devDeps = await getDevDependencies();

      expect(deps).not.toBeNull();
      expect(deps).not.toBeUndefined();
      expect(devDeps).not.toBeNull();
      expect(devDeps).not.toBeUndefined();
    });

    it('should never return empty objects', async () => {
      const deps = await getDependencies();
      const devDeps = await getDevDependencies();

      expect(Object.keys(deps).length).toBeGreaterThan(0);
      expect(Object.keys(devDeps).length).toBeGreaterThan(0);
    });
  });

  describe('Type safety', () => {
    it('should return Record<string, string> type', async () => {
      const deps = await getDependencies();
      const devDeps = await getDevDependencies();

      // All keys should be strings
      Object.keys(deps).forEach(key => {
        expect(typeof key).toBe('string');
      });

      Object.keys(devDeps).forEach(key => {
        expect(typeof key).toBe('string');
      });

      // All values should be strings
      Object.values(deps).forEach(value => {
        expect(typeof value).toBe('string');
      });

      Object.values(devDeps).forEach(value => {
        expect(typeof value).toBe('string');
      });
    });

    it('should not include any undefined or null values', async () => {
      const deps = await getDependencies();
      const devDeps = await getDevDependencies();

      Object.values(deps).forEach(value => {
        expect(value).not.toBeUndefined();
        expect(value).not.toBeNull();
        expect(value).not.toBe('');
      });

      Object.values(devDeps).forEach(value => {
        expect(value).not.toBeUndefined();
        expect(value).not.toBeNull();
        expect(value).not.toBe('');
      });
    });
  });

  describe('Future extensibility', () => {
    it('should handle potential options parameter (even if unused)', async () => {
      // Test that functions could accept options in the future
      const options: VersionOptions = { latest: true };

      // Functions don't currently accept options, but test the type exists
      expect(options).toBeDefined();
      expect(options.latest).toBe(true);
    });

    it('should be easy to add new dependencies', async () => {
      const deps = await getDependencies();

      // Should be able to spread and add new deps
      const extendedDeps = {
        ...deps,
        'new-package': '^1.0.0',
      };

      expect(extendedDeps).toHaveProperty('blaizejs');
      expect(extendedDeps).toHaveProperty('new-package');
    });

    it('should be easy to override versions', async () => {
      const deps = await getDependencies();

      // Should be able to override specific versions
      const overriddenDeps: Record<string, string> = {
        ...deps,
        zod: '^4.0.0', // Override zod version
      };

      expect(overriddenDeps.zod).toBe('^4.0.0');
      expect(overriddenDeps['blaizejs']).toBe('latest'); // Others unchanged
    });
  });

  describe('Performance', () => {
    it('should handle many concurrent calls', async () => {
      const callCount = 100;
      const promises = [];

      for (let i = 0; i < callCount; i++) {
        promises.push(getDependencies());
        promises.push(getDevDependencies());
      }

      const results = await Promise.all(promises);

      // All results should be consistent
      for (let i = 0; i < results.length; i += 2) {
        expect(results[i]).toEqual(results[0]);
        expect(results[i + 1]).toEqual(results[1]);
      }
    });
  });
});
