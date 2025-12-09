/**
 * @blaizejs/plugin-cache
 *
 * Event-driven cache plugin for BlaizeJS with Redis support
 * and multi-server coordination via pub/sub.
 *
 * @packageDocumentation
 */
import config from '../package.json';

export type { CacheAdapter, CacheStats, MemoryAdapterConfig } from './types';

export { MemoryAdapter } from './storage';

// Placeholder exports - will be implemented in subsequent tasks
export const version = config.version;
