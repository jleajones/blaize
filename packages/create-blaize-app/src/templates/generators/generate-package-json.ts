import type { ValidatedInputs } from '../../commands/validate';

/**
 * Generate package.json content
 */
export async function generatePackageJson(
  projectName: string,
  template: ValidatedInputs['template'],
  latest: boolean
): Promise<Record<string, any>> {
  const dependencies = await template.getDependencies({ latest });
  const devDependencies = await template.getDevDependencies({ latest });

  return {
    name: projectName,
    version: '0.1.0',
    private: true,
    type: 'module',
    description: 'A BlaizeJS application',
    scripts: template.scripts,
    dependencies,
    devDependencies,
    engines: {
      node: '>=23.0.0',
    },
  };
}
