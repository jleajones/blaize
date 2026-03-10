# @blaizejs/testing-utils

## 0.7.0

### Minor Changes

- e937085: **🐛 Fix: Plugin lifecycle duplication and router initialization race condition**

  - 🚀 `router.ready` promise exposed on `Router` interface — plugins that need routes can await it explicitly in `register` or `initialize`
  - ⚡ `handleRequest` awaits initialization promise instead of re-calling `initialize()` — eliminates race condition on concurrent first requests
  - 🔁 Plugin `register` deferred to `listen()` via `pluginManager.registerPlugins()` — eliminates double-registration for plugins added via `server.register()`
  - 🧹 Removed duplicate `initializePlugins` call from `start.ts` — plugin lifecycle exclusively owned by `pluginManager`
  - ✅ `registerPlugins` added to `PluginLifecycleManager` interface and implementation
  - 🧪 `createMockRouter` updated with `ready` property and `overrides` parameter
  - 🧪 `createMockPluginLifecycleManager` updated with `registerPlugins` mock

## 0.6.0

### Minor Changes

- 0251b7e: enhance create-blaize-app to work and support 2 templates

### Patch Changes

- 1280a0e: Add assertion helpers to reduce test boilerplate:

  - `logger.assertInfoCalled()` / `assertErrorCalled()` etc.
  - `eventBus.assertPublished()` / `assertNotPublished()`
  - New `createRouteTestContext()` helper

## 0.5.2

### Patch Changes

- 8ddc869: ✨ Add type safe file handling

## 0.5.1

### Patch Changes

- 5b01ab7: ✨ Event Driven changes

## 0.5.0

### Minor Changes

- 20e0903: ✨ BlaizeLogger

### Patch Changes

- 87585c5: ✨ Made BlaizeLogger a first class citizen

## 0.4.1

### Patch Changes

- 3267373: ✨ fix createPlugin API

## 0.4.0

### Minor Changes

- a5de72d: enhanced server and client w/ SSE

## 0.3.1

### Patch Changes

- d5c246f: ✨ enhanced type safety by introducing generics; types flow from server to route handlers

## 0.3.0

### Minor Changes

- 06432ac: 🔨 Fixed broken type defintions
- 155d310: ✨ Fixed blaize client

## 0.2.0

### Minor Changes

- 5f595d1: ✨ Add automatic type-safe error handling system with correlation tracking

### Patch Changes

- 0d4bc0d: ✨ New Feature: Support for file upload and multipart formdata

## 0.1.5

### Patch Changes

- d3099e9: ✨ Enhanced testing mocks

## 0.1.4

### Patch Changes

- 5293caa: Optimize route loading with a registry and cache

## 0.1.3

### Patch Changes

- 4b9614e: Test automation token publishing

## 0.1.2

### Patch Changes

- dddaaa2: - Update to release workflow
  - Core/Client/Testing: Update package description

## 0.1.1

### Patch Changes

- - Core: Fixed bugs; Include type definitions in package; Plugin Support
  - Client: Fixed bugs; Included type definition in package;
  - Testing Utils: Intial release to help with testing blaize application
