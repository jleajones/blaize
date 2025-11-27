/**
 * Priority Queue Wrapper
 *
 * Type-safe wrapper around @datastructures-js/priority-queue providing
 * priority-based job scheduling with FIFO ordering within same priority.
 *
 * @module @blaizejs/queue/priority-queue
 * @since 0.4.0
 */

import { MaxPriorityQueue } from '@datastructures-js/priority-queue';

import type { PriorityQueue, PriorityQueueItem } from './types';

// ============================================================================
// Implementation
// ============================================================================

/**
 * Score multiplier for priority component
 *
 * This ensures priority always dominates over timestamp.
 * With timestamps in milliseconds (13 digits max for many years),
 * using 1 trillion ensures priority differences always win.
 */
const PRIORITY_MULTIPLIER = 1_000_000_000_000;

/**
 * Calculate composite score for priority ordering
 *
 * Formula: (priority * MULTIPLIER) - enqueuedAt
 *
 * This ensures:
 * - Higher priority = higher score = dequeued first
 * - Same priority: earlier timestamp = higher score = dequeued first (FIFO)
 *
 * @param priority - Priority level
 * @param enqueuedAt - Timestamp when enqueued
 * @returns Composite score for ordering
 *
 * @internal
 */
function calculateScore(priority: number, enqueuedAt: number): number {
  return priority * PRIORITY_MULTIPLIER - enqueuedAt;
}

/**
 * Create a new priority queue
 *
 * Returns a type-safe priority queue with:
 * - Higher priority items dequeued first
 * - FIFO ordering within same priority level
 * - O(log n) enqueue and dequeue operations
 *
 * @template T - Type of the data being queued
 * @returns A new PriorityQueue instance
 *
 * @example Basic usage
 * ```typescript
 * const queue = createPriorityQueue<string>();
 *
 * queue.enqueue('task-1', 5);
 * queue.enqueue('task-2', 10);
 *
 * console.log(queue.dequeue()); // 'task-2' (higher priority)
 * console.log(queue.dequeue()); // 'task-1'
 * ```
 *
 * @example FIFO within same priority
 * ```typescript
 * const queue = createPriorityQueue<string>();
 *
 * queue.enqueue('first', 5);
 * queue.enqueue('second', 5);
 * queue.enqueue('third', 5);
 *
 * console.log(queue.dequeue()); // 'first'
 * console.log(queue.dequeue()); // 'second'
 * console.log(queue.dequeue()); // 'third'
 * ```
 *
 * @example With complex objects
 * ```typescript
 * interface Task {
 *   id: string;
 *   name: string;
 * }
 *
 * const taskQueue = createPriorityQueue<Task>();
 * taskQueue.enqueue({ id: '1', name: 'Build' }, 5);
 * taskQueue.enqueue({ id: '2', name: 'Deploy' }, 10);
 *
 * const next = taskQueue.peek();
 * // next = { id: '2', name: 'Deploy' }
 * ```
 */
export function createPriorityQueue<T>(): PriorityQueue<T> {
  // Internal heap using MaxPriorityQueue with composite score
  const heap = new MaxPriorityQueue<PriorityQueueItem<T>>(item =>
    calculateScore(item.priority, item.enqueuedAt)
  );

  return {
    enqueue(item: T, priority: number): void {
      const queueItem: PriorityQueueItem<T> = {
        priority,
        data: item,
        enqueuedAt: Date.now(),
      };
      heap.enqueue(queueItem);
    },

    dequeue(): T | undefined {
      if (heap.isEmpty()) {
        return undefined;
      }
      const item = heap.dequeue();
      return item?.data;
    },

    peek(): T | undefined {
      if (heap.isEmpty()) {
        return undefined;
      }
      const item = heap.front();
      return item?.data;
    },

    size(): number {
      return heap.size();
    },

    isEmpty(): boolean {
      return heap.isEmpty();
    },

    clear(): void {
      heap.clear();
    },

    toArray(): T[] {
      // Get all items in priority order without modifying the queue
      const items = heap.toArray();
      // Sort by score (highest first) since toArray may not preserve heap order
      items.sort((a, b) => {
        const scoreA = calculateScore(a.priority, a.enqueuedAt);
        const scoreB = calculateScore(b.priority, b.enqueuedAt);
        return scoreB - scoreA; // Descending (highest first)
      });
      return items.map(item => item.data);
    },
  };
}
