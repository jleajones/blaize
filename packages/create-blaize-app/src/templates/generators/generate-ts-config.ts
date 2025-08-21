/**
 * Generate TypeScript configuration
 */
export const generateTsConfig = (): string => {
  const config = {
    $schema: 'https://json.schemastore.org/tsconfig',
    compilerOptions: {
      // Target and module settings
      target: 'ES2022',
      lib: ['ES2022'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',

      // Strict type checking
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      strictFunctionTypes: true,
      strictBindCallApply: true,
      strictPropertyInitialization: true,
      noImplicitThis: true,
      useUnknownInCatchVariables: true,
      alwaysStrict: true,

      // Additional checks
      noUncheckedIndexedAccess: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,

      // Module settings
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      allowJs: false,
      isolatedModules: true,
      verbatimModuleSyntax: true,

      // Emit settings
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      outDir: './dist',
      rootDir: './src',
      tsBuildInfoFile: './.tsbuildinfo',

      // Path mapping
      baseUrl: '.',
      paths: {
        '@/*': ['./src/*'],
        '@tests/*': ['./src/__tests__/*'],
      },

      // Type roots
      types: ['vitest/globals', 'node'],
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', '**/*.test.ts', '**/*.spec.ts'],
  };

  return JSON.stringify(config, null, 2);
};
