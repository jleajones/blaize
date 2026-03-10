---
'@blaizejs/testing-utils': minor
'blaizejs': minor
---

**🐛 Fix: Plugin lifecycle duplication and router initialization race condition**

- 🚀 `router.ready` promise exposed on `Router` interface — plugins that need routes can await it explicitly in `register` or `initialize`
- ⚡ `handleRequest` awaits initialization promise instead of re-calling `initialize()` — eliminates race condition on concurrent first requests
- 🔁 Plugin `register` deferred to `listen()` via `pluginManager.registerPlugins()` — eliminates double-registration for plugins added via `server.register()`
- 🧹 Removed duplicate `initializePlugins` call from `start.ts` — plugin lifecycle exclusively owned by `pluginManager`
- ✅ `registerPlugins` added to `PluginLifecycleManager` interface and implementation
- 🧪 `createMockRouter` updated with `ready` property and `overrides` parameter
- 🧪 `createMockPluginLifecycleManager` updated with `registerPlugins` mock
