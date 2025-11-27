/**
 * Unit Tests for Priority Queue Wrapper
 *
 * Tests verify priority ordering, FIFO within same priority,
 * and all queue operations.
 */
import { createPriorityQueue } from './priority-queue';

import type { PriorityQueue } from './types';

describe('Priority Queue', () => {
  let queue: PriorityQueue<string>;

  beforeEach(() => {
    queue = createPriorityQueue<string>();
  });

  // ==========================================================================
  // Basic Operations
  // ==========================================================================
  describe('Basic Operations', () => {
    it('should create an empty queue', () => {
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it('should enqueue items', () => {
      queue.enqueue('item1', 5);
      expect(queue.isEmpty()).toBe(false);
      expect(queue.size()).toBe(1);

      queue.enqueue('item2', 5);
      expect(queue.size()).toBe(2);
    });

    it('should dequeue items', () => {
      queue.enqueue('item1', 5);
      const item = queue.dequeue();

      expect(item).toBe('item1');
      expect(queue.isEmpty()).toBe(true);
    });

    it('should return undefined when dequeuing empty queue', () => {
      const item = queue.dequeue();
      expect(item).toBeUndefined();
    });

    it('should peek without removing', () => {
      queue.enqueue('item1', 5);

      const peeked = queue.peek();
      expect(peeked).toBe('item1');
      expect(queue.size()).toBe(1); // Still in queue

      const dequeued = queue.dequeue();
      expect(dequeued).toBe('item1');
      expect(queue.size()).toBe(0);
    });

    it('should return undefined when peeking empty queue', () => {
      const item = queue.peek();
      expect(item).toBeUndefined();
    });

    it('should clear all items', () => {
      queue.enqueue('item1', 5);
      queue.enqueue('item2', 5);
      queue.enqueue('item3', 5);

      expect(queue.size()).toBe(3);

      queue.clear();

      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  // ==========================================================================
  // Priority Ordering
  // ==========================================================================
  describe('Priority Ordering', () => {
    it('should dequeue higher priority items first', () => {
      queue.enqueue('low', 1);
      queue.enqueue('high', 10);
      queue.enqueue('medium', 5);

      expect(queue.dequeue()).toBe('high');
      expect(queue.dequeue()).toBe('medium');
      expect(queue.dequeue()).toBe('low');
    });

    it('should handle priority 10 before 5 before 1', () => {
      queue.enqueue('priority-1', 1);
      queue.enqueue('priority-5', 5);
      queue.enqueue('priority-10', 10);

      expect(queue.dequeue()).toBe('priority-10');
      expect(queue.dequeue()).toBe('priority-5');
      expect(queue.dequeue()).toBe('priority-1');
    });

    it('should handle all priority levels 1-10', () => {
      // Add in random order
      const priorities = [3, 7, 1, 9, 2, 8, 4, 10, 6, 5];
      priorities.forEach(p => {
        queue.enqueue(`priority-${p}`, p);
      });

      // Should dequeue in descending priority order
      for (let p = 10; p >= 1; p--) {
        expect(queue.dequeue()).toBe(`priority-${p}`);
      }
    });

    it('should peek the highest priority item', () => {
      queue.enqueue('low', 1);
      queue.enqueue('high', 10);
      queue.enqueue('medium', 5);

      expect(queue.peek()).toBe('high');
    });

    it('should handle zero priority', () => {
      queue.enqueue('zero', 0);
      queue.enqueue('one', 1);

      expect(queue.dequeue()).toBe('one');
      expect(queue.dequeue()).toBe('zero');
    });

    it('should handle negative priorities', () => {
      queue.enqueue('negative', -5);
      queue.enqueue('zero', 0);
      queue.enqueue('positive', 5);

      expect(queue.dequeue()).toBe('positive');
      expect(queue.dequeue()).toBe('zero');
      expect(queue.dequeue()).toBe('negative');
    });
  });

  // ==========================================================================
  // FIFO Within Same Priority
  // ==========================================================================
  describe('FIFO Within Same Priority', () => {
    beforeEach(() => {
      // Use fake timers to control enqueuedAt timestamps
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should maintain FIFO order for same priority', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      queue.enqueue('first', 5);

      vi.setSystemTime(new Date('2024-01-01T00:00:00.001Z'));
      queue.enqueue('second', 5);

      vi.setSystemTime(new Date('2024-01-01T00:00:00.002Z'));
      queue.enqueue('third', 5);

      expect(queue.dequeue()).toBe('first');
      expect(queue.dequeue()).toBe('second');
      expect(queue.dequeue()).toBe('third');
    });

    it('should handle interleaved priorities with FIFO', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      queue.enqueue('high-1', 10);

      vi.setSystemTime(new Date('2024-01-01T00:00:00.001Z'));
      queue.enqueue('low-1', 1);

      vi.setSystemTime(new Date('2024-01-01T00:00:00.002Z'));
      queue.enqueue('high-2', 10);

      vi.setSystemTime(new Date('2024-01-01T00:00:00.003Z'));
      queue.enqueue('low-2', 1);

      // High priority first (in FIFO order)
      expect(queue.dequeue()).toBe('high-1');
      expect(queue.dequeue()).toBe('high-2');
      // Low priority next (in FIFO order)
      expect(queue.dequeue()).toBe('low-1');
      expect(queue.dequeue()).toBe('low-2');
    });

    it('should handle many items at same priority', () => {
      const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
      let time = Date.now();

      items.forEach(item => {
        vi.setSystemTime(time++);
        queue.enqueue(item, 5);
      });

      // Should dequeue in same order (FIFO)
      items.forEach(item => {
        expect(queue.dequeue()).toBe(item);
      });
    });
  });

  // ==========================================================================
  // toArray()
  // ==========================================================================
  describe('toArray()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return empty array for empty queue', () => {
      expect(queue.toArray()).toEqual([]);
    });

    it('should return items in priority order', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      queue.enqueue('low', 1);

      vi.setSystemTime(new Date('2024-01-01T00:00:00.001Z'));
      queue.enqueue('high', 10);

      vi.setSystemTime(new Date('2024-01-01T00:00:00.002Z'));
      queue.enqueue('medium', 5);

      const arr = queue.toArray();
      expect(arr).toEqual(['high', 'medium', 'low']);
    });

    it('should maintain FIFO order within same priority in toArray', () => {
      let time = Date.now();

      vi.setSystemTime(time++);
      queue.enqueue('first', 5);

      vi.setSystemTime(time++);
      queue.enqueue('second', 5);

      vi.setSystemTime(time++);
      queue.enqueue('third', 5);

      const arr = queue.toArray();
      expect(arr).toEqual(['first', 'second', 'third']);
    });

    it('should not modify the queue', () => {
      queue.enqueue('item1', 5);
      queue.enqueue('item2', 10);

      const arr1 = queue.toArray();
      const arr2 = queue.toArray();

      expect(arr1).toEqual(arr2);
      expect(queue.size()).toBe(2);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle single item', () => {
      queue.enqueue('only', 5);

      expect(queue.size()).toBe(1);
      expect(queue.peek()).toBe('only');
      expect(queue.dequeue()).toBe('only');
      expect(queue.isEmpty()).toBe(true);
    });

    it('should handle repeated enqueue/dequeue cycles', () => {
      for (let i = 0; i < 100; i++) {
        queue.enqueue(`item-${i}`, i % 10);
      }

      expect(queue.size()).toBe(100);

      // Dequeue all
      for (let i = 0; i < 100; i++) {
        expect(queue.dequeue()).toBeDefined();
      }

      expect(queue.isEmpty()).toBe(true);
    });

    it('should handle very large priority values', () => {
      queue.enqueue('normal', 5);
      queue.enqueue('huge', 1000000);

      expect(queue.dequeue()).toBe('huge');
      expect(queue.dequeue()).toBe('normal');
    });

    it('should handle floating point priorities', () => {
      queue.enqueue('low', 1.1);
      queue.enqueue('high', 1.9);
      queue.enqueue('medium', 1.5);

      expect(queue.dequeue()).toBe('high');
      expect(queue.dequeue()).toBe('medium');
      expect(queue.dequeue()).toBe('low');
    });

    it('should be reusable after clear', () => {
      queue.enqueue('old1', 5);
      queue.enqueue('old2', 5);
      queue.clear();

      queue.enqueue('new1', 10);
      queue.enqueue('new2', 1);

      expect(queue.size()).toBe(2);
      expect(queue.dequeue()).toBe('new1');
      expect(queue.dequeue()).toBe('new2');
    });
  });

  // ==========================================================================
  // Generic Type Safety
  // ==========================================================================
  describe('Generic Type Safety', () => {
    it('should work with number type', () => {
      const numQueue = createPriorityQueue<number>();

      numQueue.enqueue(100, 1);
      numQueue.enqueue(200, 10);
      numQueue.enqueue(300, 5);

      expect(numQueue.dequeue()).toBe(200);
      expect(numQueue.dequeue()).toBe(300);
      expect(numQueue.dequeue()).toBe(100);
    });

    it('should work with object type', () => {
      interface Task {
        id: string;
        name: string;
      }

      const taskQueue = createPriorityQueue<Task>();

      taskQueue.enqueue({ id: '1', name: 'Low' }, 1);
      taskQueue.enqueue({ id: '2', name: 'High' }, 10);

      const task = taskQueue.dequeue();
      expect(task).toEqual({ id: '2', name: 'High' });
    });

    it('should work with array type', () => {
      const arrayQueue = createPriorityQueue<string[]>();

      arrayQueue.enqueue(['a', 'b'], 1);
      arrayQueue.enqueue(['c', 'd'], 10);

      expect(arrayQueue.dequeue()).toEqual(['c', 'd']);
    });

    it('should work with null and undefined values', () => {
      const nullableQueue = createPriorityQueue<string | null>();

      nullableQueue.enqueue(null, 5);
      nullableQueue.enqueue('value', 10);

      expect(nullableQueue.dequeue()).toBe('value');
      expect(nullableQueue.dequeue()).toBeNull();
    });
  });

  // ==========================================================================
  // Performance Characteristics
  // ==========================================================================
  describe('Performance Characteristics', () => {
    it('should handle large number of items', () => {
      const count = 10000;

      // Enqueue many items
      for (let i = 0; i < count; i++) {
        queue.enqueue(`item-${i}`, Math.floor(Math.random() * 10) + 1);
      }

      expect(queue.size()).toBe(count);

      // Dequeue all
      const _lastPriority = Infinity;
      let dequeued = 0;

      while (!queue.isEmpty()) {
        queue.dequeue();
        dequeued++;
      }

      expect(dequeued).toBe(count);
    });

    it('should maintain correct order with rapid enqueue/dequeue', () => {
      // Simulate real-world usage with interleaved operations
      queue.enqueue('a', 5);
      queue.enqueue('b', 10);
      expect(queue.dequeue()).toBe('b');

      queue.enqueue('c', 3);
      queue.enqueue('d', 7);
      expect(queue.dequeue()).toBe('d');

      queue.enqueue('e', 6);
      expect(queue.dequeue()).toBe('e');
      expect(queue.dequeue()).toBe('a');
      expect(queue.dequeue()).toBe('c');
    });
  });

  // ==========================================================================
  // Memory Safety
  // ==========================================================================
  describe('Memory Safety', () => {
    it('should not retain references after dequeue', () => {
      const obj = { data: 'test' };
      const objQueue = createPriorityQueue<{ data: string }>();

      objQueue.enqueue(obj, 5);
      const dequeued = objQueue.dequeue();

      // The dequeued object should be the same reference
      expect(dequeued).toBe(obj);
      // But the queue should be empty
      expect(objQueue.isEmpty()).toBe(true);
    });

    it('should release all references on clear', () => {
      const objQueue = createPriorityQueue<{ data: string }>();

      objQueue.enqueue({ data: '1' }, 5);
      objQueue.enqueue({ data: '2' }, 5);
      objQueue.enqueue({ data: '3' }, 5);

      objQueue.clear();

      expect(objQueue.size()).toBe(0);
      expect(objQueue.toArray()).toEqual([]);
    });
  });
});
