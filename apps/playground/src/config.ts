export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  db: parseInt(process.env.REDIS_DB ?? '0', 10),
  keyPrefix: 'playground:',
};
