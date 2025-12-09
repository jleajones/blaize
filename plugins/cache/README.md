# @blaizejs/plugin-cache

> Event-driven cache plugin for BlaizeJS with Redis support and multi-server coordination

[![npm version](https://badge.fury.io/js/%40blaizejs%2Fplugin-cache.svg)](https://badge.fury.io/js/%40blaizejs%2Fplugin-cache)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🚀 Features

- 🎯 **Zero Configuration** - Works locally with in-memory adapter by default
- 🔄 **Event-Driven** - Automatic event emission on cache changes
- 🌐 **Multi-Server** - Redis pub/sub for distributed cache coordination
- 📊 **Monitoring** - Built-in stats endpoint and SSE event streaming
- ⚡ **High Performance** - <5ms p95 (memory), <10ms p95 (Redis)
- 🔒 **Type-Safe** - Full TypeScript support with strict typing
- 🧪 **Well Tested** - >90% test coverage

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @blaizejs/plugin-cache

# Using npm
npm install @blaizejs/plugin-cache

# Using yarn
yarn add @blaizejs/plugin-cache
```

## 🏃 Quick Start

```typescript
import { createServer } from 'blaizejs';
import { createCachePlugin } from '@blaizejs/plugin-cache';

const server = createServer();

// Zero configuration - uses in-memory adapter
server.register(createCachePlugin());

await server.listen(3000);
```

## 📖 Documentation

(Full documentation coming soon)

---

## 🧪 Testing Infrastructure

### Test Environment Setup

The cache plugin includes a Docker Compose configuration for running integration tests against a real Redis instance.

#### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

#### Connection Details

| Service | URL                      | Database | Password |
|---------|--------------------------|----------|----------|
| Redis   | `redis://localhost:6379` | 0        | None     |

**⚠️ Security Note**: This configuration is for **development and testing only**. The Redis instance has no password and should never be exposed to production environments.

#### Starting Test Services

```bash
# Start Redis in detached mode
docker-compose -f compose.test.yml up -d

# Verify Redis is healthy (should show "healthy")
docker-compose -f compose.test.yml ps

# View Redis logs
docker-compose -f compose.test.yml logs -f redis
```

#### Running Tests

```bash
# Run all tests (requires Redis to be running)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run only integration tests
# TODO
```

#### Stopping Test Services

```bash
# Stop services (preserves data volumes)
docker-compose -f compose.test.yml down

# Stop and remove volumes (full cleanup)
docker-compose -f compose.test.yml down -v
```

#### Health Checks

Redis includes a health check that runs every 5 seconds:

```bash
# Check if Redis is ready
docker-compose -f compose.test.yml exec redis redis-cli ping
# Expected output: PONG
```

The health check ensures Redis is fully operational before integration tests begin running.

#### Troubleshooting

**Port Already in Use**

If port 6379 is already in use, you can either:

1. Stop the conflicting service:
   ```bash
   # Find process using port 6379
   lsof -i :6379
   # Kill the process
   kill -9 <PID>
   ```

2. Or modify `docker-compose.test.yml` to use a different port:
   ```yaml
   ports:
     - "6380:6379"  # Use port 6380 instead
   ```

**Redis Not Starting**

```bash
# Check container logs
docker-compose -f docker-compose.test.yml logs redis

# Remove old volumes and restart
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

**Tests Failing to Connect**

Ensure Redis is healthy before running tests:

```bash
# Wait for health check to pass
docker-compose -f docker-compose.test.yml up -d
sleep 10
pnpm test
```

#### CI/CD Integration

For continuous integration environments:

```yaml
# Example GitHub Actions workflow
- name: Start Redis
  run: docker-compose -f plugins/cache/docker-compose.test.yml up -d

- name: Wait for Redis
  run: |
    timeout 30 bash -c 'until docker-compose -f plugins/cache/docker-compose.test.yml exec -T redis redis-cli ping; do sleep 1; done'

- name: Run Tests
  run: pnpm --filter @blaizejs/plugin-cache test

- name: Cleanup
  if: always()
  run: docker-compose -f plugins/cache/docker-compose.test.yml down -v
```

#### Network Isolation

The test infrastructure uses an isolated Docker network (`blaize-cache-test-network`) to prevent conflicts with:

- Other BlaizeJS plugin test environments
- Local Redis instances
- Other Docker Compose projects

This ensures tests run reliably in parallel without port or network conflicts.

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

---

## 📄 License

MIT © J.Lea-Jones

---

**Built with ❤️ for the BlaizeJS ecosystem**