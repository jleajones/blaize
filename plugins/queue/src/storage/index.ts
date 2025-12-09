/**
 * Storage Adapters for Queue Plugin
 *
 * This module exports storage adapter implementations for the queue plugin.
 * Storage adapters enable swappable backends for job persistence.
 *
 * @module @blaizejs/queue/storage
 */

// ============================================================================
// In-Memory Storage (Default)
// ============================================================================
// TODO: Implement in in-memory.ts
// export { createInMemoryStorage, InMemoryStorage } from './in-memory';

// ============================================================================
// Storage Adapter Interface
// ============================================================================
// Re-export from types for convenience
// TODO: Import from ../types.ts when implemented
export type { QueueStorageAdapter } from '../types';

export { createInMemoryStorage, InMemoryStorage } from './memory';
