# blaizejs

## 0.10.1

### Patch Changes

- 341b992: **🐛 Feature: Railway deployed Demo API**

  - 🛣️ `src/data/users.ts` — new GET /users/large route that returns 1000 generated users plus an uncompressedBytes field so you can see the raw payload size before compression

## 0.10.0

### Minor Changes

- e937085: **🐛 Fix: Plugin lifecycle duplication and router initialization race condition**

  - 🚀 `router.ready` promise exposed on `Router` interface — plugins that need routes can await it explicitly in `register` or `initialize`
  - ⚡ `handleRequest` awaits initialization promise instead of re-calling `initialize()` — eliminates race condition on concurrent first requests
  - 🔁 Plugin `register` deferred to `listen()` via `pluginManager.registerPlugins()` — eliminates double-registration for plugins added via `server.register()`
  - 🧹 Removed duplicate `initializePlugins` call from `start.ts` — plugin lifecycle exclusively owned by `pluginManager`
  - ✅ `registerPlugins` added to `PluginLifecycleManager` interface and implementation
  - 🧪 `createMockRouter` updated with `ready` property and `overrides` parameter
  - 🧪 `createMockPluginLifecycleManager` updated with `registerPlugins` mock

## 0.9.2

### Patch Changes

- 0251b7e: enhance create-blaize-app to work and support 2 templates

## 0.9.1

### Patch Changes

- 8ddc869: ✨ Add type safe file handling

## 0.9.0

### Minor Changes

- c2001d8: ✨ introduce event bus, redis adapter for queue, cache

## 0.8.0

### Minor Changes

- 6516254: 🔨 fixed buffer size for sse events; 🛝 fixed playgroud example

### Patch Changes

- 4f74774: ✨ cache plugin! yay

## 0.7.1

### Patch Changes

- 82cc912: 🚀 update queue plugin to work with blaizejs applications
- 7ad7571: 🚀 queue plugin
- 15684e4: ✨ Add logger to SSE routes

## 0.7.0

### Minor Changes

- 20e0903: ✨ BlaizeLogger

### Patch Changes

- 87585c5: ✨ Made BlaizeLogger a first class citizen
- 2279a75: 🧹 clean up directory structure

## 0.6.0

### Minor Changes

- 3267373: ✨ fix createPlugin API

## 0.5.3

### Patch Changes

- acacde9: ✨ Enhance metric plugin errors w/ correlationId; ✨Remove \_bodyError and replaced with blaize errors
- 4d5cd4c: ✨ new security middleware

## 0.5.2

### Patch Changes

- a632eb8: ✨ server configuration now support body limits

## 0.5.1

### Patch Changes

- 9b7df51: ✨ Official blaizejs metrics plugin and blaize-core plugin enhancements

## 0.5.0

### Minor Changes

- a5de72d: enhanced server and client w/ SSE

### Patch Changes

- 8f8fe4f: 🚀 Support for CORS

## 0.4.0

### Minor Changes

- 3d0a769: 🚀 introduced end-to-end request tracing with correlationIds

### Patch Changes

- d5c246f: ✨ enhanced type safety by introducing generics; types flow from server to route handlers

## 0.3.4

### Patch Changes

- 669096a: 🐛 build was broken

## 0.3.3

### Patch Changes

- 64a475e: ✨ Enhanced zod schema validation and type inference; add support for transformation
- d9c9149: ✨ 🐛 Enhancements and bug fixes

## 0.3.2

### Patch Changes

- b47ca23: ✨ Exposed additional error types

## 0.3.1

### Patch Changes

- 06432ac: 🔨 Fixed broken type defintions
- 155d310: ✨ Fixed blaize client

## 0.3.0

### Minor Changes

- 5f595d1: ✨ Add automatic type-safe error handling system with correlation tracking

### Patch Changes

- 0d4bc0d: ✨ New Feature: Support for file upload and multipart formdata

## 0.2.3

### Patch Changes

- 5293caa: Optimize route loading with a registry and cache

## 0.2.2

### Patch Changes

- 4b9614e: Test automation token publishing

## 0.2.1

### Patch Changes

- dddaaa2: - Update to release workflow
  - Core/Client/Testing: Update package description

## 0.2.0

### Minor Changes

- - Core: Fixed bugs; Include type definitions in package; Plugin Support
  - Client: Fixed bugs; Included type definition in package;
  - Testing Utils: Intial release to help with testing blaize application
