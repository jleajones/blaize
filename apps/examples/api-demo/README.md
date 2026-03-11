# 🔥 BlaizeJS API Demo

> A minimal BlaizeJS application demonstrating core framework features — deployed live, zero external dependencies.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://blaizejsexample-api-demo-production.up.railway.app)
[![Node.js](https://img.shields.io/badge/node-%3E%3D23-blue)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D10-orange)](https://pnpm.io)

No database. No Redis. No queue. Just the framework doing what it does — clone it, run it, and hit the endpoints in under 5 minutes.

**Live:** https://blaizejsexample-api-demo-production.up.railway.app

---

## 📡 Endpoints

| Method | Path         | Description                                         |
| ------ | ------------ | --------------------------------------------------- |
| `GET`  | `/`          | Welcome message and full endpoint map               |
| `GET`  | `/health`    | Health check — status, uptime, timestamp            |
| `GET`  | `/users`     | List all users                                      |
| `POST` | `/users`     | Create a user (Zod-validated body)                  |
| `GET`  | `/users/:id` | Get user by ID — returns `NotFoundError` if missing |
| `GET`  | `/sse/time`  | Live SSE ticker — one event/sec for 60 seconds      |

---

## ⚡ Try it live

```bash
# Health check
curl https://blaizejsexample-api-demo-production.up.railway.app/health

# List users
curl https://blaizejsexample-api-demo-production.up.railway.app/users

# Get a specific user
curl https://blaizejsexample-api-demo-production.up.railway.app/users/usr_1

# Trigger a typed error — user does not exist
curl https://blaizejsexample-api-demo-production.up.railway.app/users/not-real

# Create a user
curl -X POST https://blaizejsexample-api-demo-production.up.railway.app/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Dana Park","email":"dana@example.com","role":"user"}'

# Trigger Zod validation — missing required field
curl -X POST https://blaizejsexample-api-demo-production.up.railway.app/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Dana Park"}'

# Verify compression — check Content-Encoding: gzip in response headers
curl -v -H "Accept-Encoding: gzip" \
  https://blaizejsexample-api-demo-production.up.railway.app/users

# SSE stream — Ctrl+C to disconnect early
curl -N https://blaizejsexample-api-demo-production.up.railway.app/sse/time
```

---

## 🚀 Run locally

**Prerequisites:** Node.js >= 23, pnpm >= 10

```bash
# Clone the monorepo
git clone https://github.com/jleajones/blaize.git
cd blaize

# Install all workspace dependencies
pnpm install

# Build the framework and workspace dependencies
pnpm --filter @blaizejs/example-api-demo... build

# Start the dev server
pnpm --filter @blaizejs/example-api-demo dev
```

Server starts at **https://localhost:7485**

> 💡 The dev server runs HTTP/2 with a self-signed certificate. Accept the browser warning or use `curl -k` to skip certificate verification locally.

---

## 📁 Project structure

```
src/
├── index.ts          — entry point, starts the server
├── server.ts         — server instance, middleware config
├── app-router.ts     — typed route factory (shared by all routes)
├── data/
│   └── users.ts      — in-memory user store (resets on restart)
└── routes/
    ├── index.ts      — GET /
    ├── health.ts     — GET /health
    ├── users/
    │   ├── index.ts  — GET + POST /users
    │   └── [id].ts   — GET /users/:id
    └── sse/
        └── time.ts   — GET /sse/time
```

> The directory structure under `src/routes/` **is** the API. There is no manual route registration — BlaizeJS discovers routes automatically at startup.

> User data is stored in memory and resets on every server restart. This is intentional — the demo has no database.

---

## 🔍 What to look at

**File-based routing** — the folder structure is the API. Add a file, get a route.

**Zod validation** — `POST /users` rejects bad input with typed, structured error responses. Try sending an invalid email or omitting the `name` field.

**Typed errors** — `GET /users/not-real` returns a `NotFoundError` with `type`, `title`, `status`, and `correlationId` — not a generic 500.

**SSE** — `GET /sse/time` opens a persistent connection and streams a typed `tick` event every second. Auto-closes after 60 ticks to avoid leaked connections in the demo environment.

**Response headers** — Run `curl -v -H "Accept-Encoding: br" https://blaizejsexample-api-demo-production.up.railway.app/users` and look at what comes back:

```
Content-Encoding: br
Vary: Accept-Encoding
x-correlation-id: req_mml7vrxj_6abb3es8w
content-security-policy: ...
strict-transport-security: ...
x-frame-options: SAMEORIGIN
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
x-xss-protection: 0
```

Three BlaizeJS features visible in a single response without any explanation needed — Brotli compression (`Content-Encoding: br`), distributed tracing (`x-correlation-id`), and the full security header suite from `@blaizejs/middleware-security`. `Vary: Accept-Encoding` is set automatically by the compression middleware for correct cache behavior. Open DevTools or run curl; it's all there.

---

## 🚢 Deploy your own

Connect the repo to Railway via the Railway dashboard and it handles the rest. Three things that matter on any PaaS:

- `host: '0.0.0.0'` — required inside containers
- `http2: { enabled: !isProduction }` — Railway (and most PaaS) terminate TLS at the edge
- `entry: ['src/**/*.ts']` in `tsup.config.mjs` — preserves the routes directory structure in `dist/` so file-based routing works after build

---

## 🔗 Related

- [BlaizeJS Core](../../packages/blaize-core) — The framework powering this demo
- [BlaizeJS Docs](../../docs) — Full documentation
- [Root README](../../README.md) — Monorepo overview and ecosystem
