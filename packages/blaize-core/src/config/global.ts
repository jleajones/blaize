// core/config.ts
interface GlobalConfig {
  routesDir?: string;
  basePath?: string;
}

let globalConfig: GlobalConfig = {
  routesDir: './routes', // default
  basePath: '/',
};

export function setGlobalConfig(config: Partial<GlobalConfig>) {
  globalConfig = { ...globalConfig, ...config };
}

export function getGlobalConfig(): GlobalConfig {
  return globalConfig;
}
