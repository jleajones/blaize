# @blaizejs/example-api-demo

## 0.1.0

### Minor Changes

- 341b992: **🐛 Feature: Railway deployed Demo API**

  - 🛣️ `src/data/users.ts` — new GET /users/large route that returns 1000 generated users plus an uncompressedBytes field so you can see the raw payload size before compression

### Patch Changes

- Updated dependencies [341b992]
  - blaizejs@0.10.1
  - @blaizejs/middleware-compression@1.0.0
  - @blaizejs/middleware-security@5.0.0
  - @blaizejs/plugin-metrics@5.0.0
