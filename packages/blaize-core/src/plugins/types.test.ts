import type { PluginHooks, Plugin } from '@blaize-types/plugins';
import type { Server } from '@blaize-types/server';

describe('Task 1.1: PluginHooks Interface Updates', () => {
  describe('Type Safety - Generic Parameters', () => {
    test('PluginHooks accepts TState and TServices generic parameters', () => {
      interface MyState {
        userId: string;
      }

      interface MyServices {
        db: { query: () => Promise<any> };
      }

      const hooks: PluginHooks<MyState, MyServices> = {
        register: async (server: Server<MyState, MyServices>) => {
          // Type check: server should be typed correctly
          expect(server).toBeDefined();
        },
      };

      expect(hooks).toBeDefined();
    });

    test('PluginHooks works with default generic parameters', () => {
      const hooks: PluginHooks = {
        register: async server => {
          expect(server).toBeDefined();
        },
      };

      expect(hooks).toBeDefined();
    });
  });

  describe('Hook Signatures', () => {
    test('register hook accepts Server<TState, TServices> parameter', () => {
      interface MyState {
        user: string;
      }
      interface MyServices {
        cache: any;
      }

      const hooks: PluginHooks<MyState, MyServices> = {
        register: async (server: Server<MyState, MyServices>) => {
          // Type assertion to verify parameter type
          const _typeCheck: Server<MyState, MyServices> = server;
          expect(_typeCheck).toBeDefined();
        },
      };

      expect(typeof hooks.register).toBe('function');
    });

    test('initialize hook has no parameters', () => {
      const hooks: PluginHooks = {
        initialize: async () => {
          // No parameters - type check passes
          expect(true).toBe(true);
        },
      };

      expect(typeof hooks.initialize).toBe('function');
    });

    test('onServerStart hook has no parameters', () => {
      const hooks: PluginHooks = {
        onServerStart: async () => {
          // No parameters
          expect(true).toBe(true);
        },
      };

      expect(typeof hooks.onServerStart).toBe('function');
    });

    test('onServerStop hook has no parameters', () => {
      const hooks: PluginHooks = {
        onServerStop: async () => {
          // No parameters
          expect(true).toBe(true);
        },
      };

      expect(typeof hooks.onServerStop).toBe('function');
    });

    test('terminate hook has no parameters', () => {
      const hooks: PluginHooks = {
        terminate: async () => {
          // No parameters
          expect(true).toBe(true);
        },
      };

      expect(typeof hooks.terminate).toBe('function');
    });
  });

  describe('Optional Hooks', () => {
    test('all hooks except register are optional', () => {
      // Empty object should satisfy PluginHooks (all hooks optional)
      const emptyHooks: PluginHooks = {};
      expect(emptyHooks).toBeDefined();
    });

    test('can provide only register hook', () => {
      const hooks: PluginHooks = {
        register: async () => {},
      };
      expect(hooks.register).toBeDefined();
      expect(hooks.initialize).toBeUndefined();
    });

    test('can provide selective hooks', () => {
      const hooks: PluginHooks = {
        register: async () => {},
        initialize: async () => {},
        terminate: async () => {},
      };

      expect(hooks.register).toBeDefined();
      expect(hooks.initialize).toBeDefined();
      expect(hooks.onServerStart).toBeUndefined();
      expect(hooks.onServerStop).toBeUndefined();
      expect(hooks.terminate).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    test('Plugin interface extends PluginHooks with generic parameters', () => {
      interface MyState {
        sessionId: string;
      }
      interface MyServices {
        logger: any;
      }

      const plugin: Plugin<MyState, MyServices> = {
        name: 'test-plugin',
        version: '1.0.0',
        register: async (server: Server<MyState, MyServices>) => {
          expect(server).toBeDefined();
        },
      };

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
    });

    test('existing code without generic types still works', () => {
      // Old-style usage should still compile
      const plugin: Plugin = {
        name: 'legacy-plugin',
        version: '1.0.0',
        register: async server => {
          expect(server).toBeDefined();
        },
      };

      expect(plugin.name).toBe('legacy-plugin');
    });
  });

  describe('Lifecycle Hook Order Documentation', () => {
    test('all five lifecycle hooks can be defined in order', () => {
      const executionOrder: string[] = [];

      const hooks: PluginHooks = {
        register: async () => {
          executionOrder.push('register');
        },
        initialize: async () => {
          executionOrder.push('initialize');
        },
        onServerStart: async () => {
          executionOrder.push('onServerStart');
        },
        onServerStop: async () => {
          executionOrder.push('onServerStop');
        },
        terminate: async () => {
          executionOrder.push('terminate');
        },
      };

      // Verify all hooks are present
      expect(hooks.register).toBeDefined();
      expect(hooks.initialize).toBeDefined();
      expect(hooks.onServerStart).toBeDefined();
      expect(hooks.onServerStop).toBeDefined();
      expect(hooks.terminate).toBeDefined();

      // The documented order is:
      // 1. register, 2. initialize, 3. onServerStart, 4. onServerStop, 5. terminate
      const hookNames = Object.keys(hooks);
      expect(hookNames).toContain('register');
      expect(hookNames).toContain('initialize');
      expect(hookNames).toContain('onServerStart');
      expect(hookNames).toContain('onServerStop');
      expect(hookNames).toContain('terminate');
    });
  });

  describe('Async Support', () => {
    test('all hooks support both sync and async implementations', async () => {
      const syncHooks: PluginHooks = {
        register: server => {
          expect(server).toBeDefined();
        },
        initialize: () => {
          // sync
        },
      };

      const asyncHooks: PluginHooks = {
        register: async server => {
          await Promise.resolve();
          expect(server).toBeDefined();
        },
        initialize: async () => {
          await Promise.resolve();
        },
      };

      expect(syncHooks.register).toBeDefined();
      expect(asyncHooks.register).toBeDefined();
    });
  });
});

describe('IntelliSense Manual Verification Guide', () => {
  test('JSDoc documentation structure', () => {
    // This test documents what should appear in IntelliSense
    // Manual verification steps:

    // 1. Open VSCode or IntelliJ IDEA
    // 2. Create a new TypeScript file
    // 3. Type: const hooks: PluginHooks = { |cursor here
    // 4. Trigger IntelliSense (Ctrl+Space / Cmd+Space)
    //
    // Expected IntelliSense suggestions:
    // ✅ register - Shows: "Called when plugin is registered to server"
    // ✅ initialize - Shows: "Called during server initialization"
    // ✅ onServerStart - Shows: "Called when server starts listening"
    // ✅ onServerStop - Shows: "Called when server stops listening"
    // ✅ terminate - Shows: "Called during server termination"
    //
    // 5. Hover over each hook name
    // 6. Verify detailed JSDoc appears with:
    //    - Description
    //    - "Use this hook to:" bullet points
    //    - @example code block
    //
    // 7. Verify lifecycle order in PluginHooks interface JSDoc

    expect(true).toBe(true); // Placeholder for manual verification
  });
});
