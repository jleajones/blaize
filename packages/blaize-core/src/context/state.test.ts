import {
  getState,
  setState,
  removeState,
  getStateMany,
  setStateMany,
  createNamespacedState,
  createTypedState,
} from './state';
import { getContext } from './store';

import type { Context, UnifiedRequest, UnifiedResponse } from '@blaize-types/context';

class MockContextError extends Error {
  constructor(message: string = 'Mock context is not defined') {
    super(message);
    this.name = 'MockContextError';
  }
}

// Create a module-level variable to store the mock context
let mockContext: Context | undefined = undefined;

// Mock the store module
vi.mock('./store', () => {
  return {
    getContext: vi.fn(() => mockContext),
  };
});

describe('State Management', () => {
  beforeEach(() => {
    // Create a fresh mock context for each test
    mockContext = {
      request: {
        raw: {} as UnifiedRequest,
        method: 'GET',
        path: '/',
        url: null,
        query: {},
        params: {},
        protocol: 'http:',
        body: {},
        isHttp2: false,
        header: vi.fn().mockReturnValue(undefined),
        headers: vi.fn().mockReturnValue({}),
      },
      response: {
        raw: {} as UnifiedResponse,
        sent: false,
        status: vi.fn().mockReturnThis(),
        header: vi.fn().mockReturnThis(),
        headers: vi.fn().mockReturnThis(),
        type: vi.fn().mockReturnThis(),
        json: vi.fn(),
        text: vi.fn(),
        html: vi.fn(),
        redirect: vi.fn(),
        stream: vi.fn(),
      },
      state: {},
    };

    // Clear previous mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear the mock context after each test
    mockContext = undefined;
  });

  describe('getState and setState', () => {
    test('gets value from state', () => {
      // Ensure mockContext is defined
      if (!mockContext) throw new MockContextError();

      mockContext.state.testKey = 'testValue';

      const result = getState('testKey');

      expect(result).toBe('testValue');
      expect(getContext).toHaveBeenCalled();
    });

    test('returns default value when key not found', () => {
      const result = getState('nonExistentKey', 'defaultValue');

      expect(result).toBe('defaultValue');
    });

    test('returns undefined when key not found and no default provided', () => {
      const result = getState('nonExistentKey');

      expect(result).toBeUndefined();
    });

    test('sets value in state', () => {
      if (!mockContext) throw new MockContextError();

      const success = setState('testKey', 'newValue');

      expect(success).toBe(true);
      expect(mockContext.state.testKey).toBe('newValue');
    });

    test('returns false when setting state with no context', () => {
      mockContext = undefined;

      const success = setState('testKey', 'newValue');

      expect(success).toBe(false);
    });
  });

  describe('removeState', () => {
    test('removes value from state', () => {
      if (!mockContext) throw new MockContextError();

      mockContext.state.testKey = 'testValue';

      const success = removeState('testKey');

      expect(success).toBe(true);
      expect(mockContext.state.testKey).toBeUndefined();
    });

    test('returns false when key not found', () => {
      const success = removeState('nonExistentKey');

      expect(success).toBe(false);
    });

    test('returns false when no context', () => {
      mockContext = undefined;

      const success = removeState('testKey');

      expect(success).toBe(false);
    });
  });

  describe('getStateMany and setStateMany', () => {
    test('gets multiple values from state', () => {
      if (!mockContext) throw new MockContextError();

      mockContext.state.key1 = 'value1';
      mockContext.state.key2 = 'value2';
      mockContext.state.key3 = 'value3';

      const result = getStateMany(['key1', 'key3', 'nonExistent']);

      expect(result).toEqual({
        key1: 'value1',
        key3: 'value3',
      });
    });

    test('returns empty object when no context', () => {
      mockContext = undefined;

      const result = getStateMany(['key1', 'key2']);

      expect(result).toEqual({});
    });

    test('sets multiple values in state', () => {
      if (!mockContext) throw new MockContextError();

      const values = {
        key1: 'value1',
        key2: 'value2',
      };

      const success = setStateMany(values);

      expect(success).toBe(true);
      expect(mockContext.state.key1).toBe('value1');
      expect(mockContext.state.key2).toBe('value2');
    });

    test('returns false when setting multiple values with no context', () => {
      mockContext = undefined;

      const success = setStateMany({ key1: 'value1' });

      expect(success).toBe(false);
    });
  });

  describe('createNamespacedState', () => {
    test('creates namespaced state accessor', () => {
      if (!mockContext) throw new MockContextError();

      const userState = createNamespacedState('user');

      userState.set('name', 'Alice');
      userState.set('age', 30);

      expect(mockContext.state['user.name']).toBe('Alice');
      expect(mockContext.state['user.age']).toBe(30);
      expect(userState.get('name')).toBe('Alice');
      expect(userState.get('age')).toBe(30);
    });

    test('gets all keys in namespace', () => {
      if (!mockContext) throw new MockContextError();

      const userState = createNamespacedState('user');

      userState.set('name', 'Alice');
      userState.set('age', 30);
      mockContext.state.otherKey = 'value';

      const keys = userState.getAllKeys();

      expect(keys).toContain('name');
      expect(keys).toContain('age');
      expect(keys).not.toContain('otherKey');
    });

    test('clears all keys in namespace', () => {
      if (!mockContext) throw new MockContextError();

      const userState = createNamespacedState('user');

      userState.set('name', 'Alice');
      userState.set('age', 30);
      mockContext.state.otherKey = 'value';

      const success = userState.clear();

      expect(success).toBe(true);
      expect(mockContext.state['user.name']).toBeUndefined();
      expect(mockContext.state['user.age']).toBeUndefined();
      expect(mockContext.state.otherKey).toBe('value');
    });

    test('removes key from namespace', () => {
      if (!mockContext) throw new MockContextError();

      const userState = createNamespacedState('user');

      userState.set('name', 'Alice');
      userState.set('age', 30);

      const success = userState.remove('name');

      expect(success).toBe(true);
      expect(mockContext.state['user.name']).toBeUndefined();
      expect(mockContext.state['user.age']).toBe(30);
    });
  });

  describe('createTypedState', () => {
    // Fix the TypeScript error with the UserState interface
    interface UserState {
      id: string;
      name: string;
      age: number;
      isAdmin: boolean;
      [key: string]: unknown; // Allow string indexing
    }

    test('provides type-safe state access', () => {
      if (!mockContext) throw new MockContextError();

      const userState = createTypedState<UserState>('user');

      userState.set('id', '123');
      userState.set('name', 'Bob');
      userState.set('age', 25);
      userState.set('isAdmin', true);

      expect(mockContext.state['user.id']).toBe('123');
      expect(mockContext.state['user.name']).toBe('Bob');
      expect(mockContext.state['user.age']).toBe(25);
      expect(mockContext.state['user.isAdmin']).toBe(true);

      expect(userState.get('id')).toBe('123');
      expect(userState.get('name')).toBe('Bob');
    });

    test('gets all typed values', () => {
      if (!mockContext) throw new MockContextError();

      const userState = createTypedState<UserState>('user');

      userState.set('id', '123');
      userState.set('name', 'Bob');
      // Intentionally not setting age and isAdmin

      const allValues = userState.getAll();

      expect(allValues).toEqual({
        id: '123',
        name: 'Bob',
      });
    });

    test('sets multiple typed values', () => {
      if (!mockContext) throw new MockContextError();

      const userState = createTypedState<UserState>('user');

      const success = userState.setMany({
        id: '123',
        name: 'Charlie',
        age: 35,
      });

      expect(success).toBe(true);
      expect(mockContext.state['user.id']).toBe('123');
      expect(mockContext.state['user.name']).toBe('Charlie');
      expect(mockContext.state['user.age']).toBe(35);
      expect(mockContext.state['user.isAdmin']).toBeUndefined();
    });

    test('clears all typed values', () => {
      if (!mockContext) throw new MockContextError();

      const userState = createTypedState<UserState>('user');

      userState.set('id', '123');
      userState.set('name', 'Dave');
      userState.set('age', 40);
      mockContext.state.otherKey = 'value';

      const success = userState.clear();

      expect(success).toBe(true);
      expect(mockContext.state['user.id']).toBeUndefined();
      expect(mockContext.state['user.name']).toBeUndefined();
      expect(mockContext.state['user.age']).toBeUndefined();
      expect(mockContext.state.otherKey).toBe('value');
    });
  });

  test('returns appropriate values when context is unavailable', () => {
    mockContext = undefined;

    const userState = createNamespacedState('user');
    expect(userState.get('name')).toBeUndefined();
    expect(userState.set('name', 'Alice')).toBe(false);
    expect(userState.remove('name')).toBe(false);
    expect(userState.getAllKeys()).toEqual([]);
    expect(userState.clear()).toBe(false);

    const typedState = createTypedState<{ name: string; [key: string]: unknown }>('typed');
    expect(typedState.get('name')).toBeUndefined();
    expect(typedState.set('name', 'Bob')).toBe(false);
    expect(typedState.getAll()).toEqual({});
    expect(typedState.setMany({ name: 'Charlie' })).toBe(false);
    expect(typedState.clear()).toBe(false);
  });
});
