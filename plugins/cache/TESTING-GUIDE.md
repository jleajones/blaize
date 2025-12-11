# Testing Guide: RedisAdapter Integration Tests

## Quick Start

### Option 1: Foreground Mode (Recommended for First Time)

**Terminal 1 - Start Redis:**

```bash
# Navigate to cache plugin
cd plugins/cache

# Start Redis (shows logs in real-time)
docker compose -f compose.test.yaml up

# ✋ Keep this terminal open! You'll see Redis logs here.
# Look for: "Ready to accept connections"
```

**Terminal 2 - Run Tests:**

```bash
# Open a NEW terminal window/tab
cd plugins/cache

# Run tests
pnpm test src/__tests__/redis.test.ts

# When done, go back to Terminal 1 and press Ctrl+C
# Then cleanup:
docker compose -f compose.test.yaml down
```

### Option 2: Background Mode (For Regular Use)

**Single Terminal:**

```bash
cd plugins/cache

# Start Redis in background (-d = detached)
docker compose -f compose.test.yaml up -d

# Wait for health check
sleep 5

# Run tests
pnpm test src/__tests__/redis.test.ts

# Stop Redis when done
docker compose -f compose.test.yaml down
```

---

## Step-by-Step Guide

### Understanding Terminal Windows

You have **two options** for running Redis:

1. **Foreground Mode** (Recommended for beginners)

   - Redis runs in Terminal 1 with live logs
   - Tests run in Terminal 2
   - Easy to see what's happening

2. **Background Mode** (Faster for regular use)
   - Redis runs in background
   - Tests run in same terminal
   - Fewer windows to manage

---

### Method 1: Foreground Mode (With Live Logs)

**Terminal Window 1 - Redis Server:**

```bash
cd plugins/cache

# Start Redis (you'll see logs here)
docker compose -f compose.test.yaml up
```

**What you'll see in Terminal 1:**

```
[+] Running 2/2
 ✔ Network blaize-cache-test-network  Created
 ✔ Container blaize-cache-redis-test  Started

blaize-cache-redis-test  | 1:C 10 Dec 2025 03:00:00.000 * oO0OoO0OoO0Oo Redis is starting oO0OoO0OoO0Oo
blaize-cache-redis-test  | 1:C 10 Dec 2025 03:00:00.000 * Redis version=8.0.0, bits=64, commit=00000000
blaize-cache-redis-test  | 1:M 10 Dec 2025 03:00:00.001 * Ready to accept connections tcp  <-- ✅ Wait for this!
```

**Terminal Window 2 - Tests:**

```bash
# Open a NEW terminal window or tab
cd plugins/cache

# Wait until you see "Ready to accept connections" in Terminal 1
# Then run tests
pnpm test src/__tests__/redis.test.ts
```

**When finished:**

- Go back to Terminal 1
- Press `Ctrl+C` to stop Redis
- Then run: `docker compose -f compose.test.yaml down`

---

### Method 2: Background Mode (Detached)

**Single Terminal:**

```bash
cd plugins/cache

# Start Redis in background (-d = detached)
docker compose -f compose.test.yaml up -d
```

**Expected Output:**

```
[+] Running 2/2
 ✔ Network blaize-cache-test-network  Created
 ✔ Container blaize-cache-redis-test  Started
```

**Verify it's running:**

```bash
# Check container status
docker compose -f compose.test.yaml ps
```

**Expected Output:**

```
NAME                        STATUS              PORTS
blaize-cache-redis-test     Up (healthy)        0.0.0.0:6379->6379/tcp
```

**Run tests:**

```bash
pnpm test src/__tests__/redis.test.ts
```

**When finished:**

```bash
# Stop and remove containers
docker compose -f compose.test.yaml down

# Or full cleanup (removes volumes too)
docker compose -f compose.test.yaml down -v
```

---

## Running Tests

Once Redis is ready, run tests:

```bash
# All tests (80+)
pnpm test src/__tests__/redis.test.ts

# With coverage report
pnpm test:coverage src/__tests__/redis.test.ts

# Watch mode (auto-rerun on file changes)
pnpm test:watch src/__tests__/redis.test.ts
```

### Expected Test Output

```
 ✓ src/__tests__/redis.test.ts (80+ tests) in 5.2s
   ✓ RedisAdapter Integration Tests
     ✓ Connection Management (10 tests) 850ms
       ✓ connects to Redis successfully
       ✓ disconnects gracefully
       ✓ throws error on connection to invalid host
       ✓ retries connection with retry strategy
       ... 6 more
     ✓ Basic Operations (12 tests) 420ms
       ✓ set and get a value
       ✓ returns null for non-existent key
       ✓ deletes existing key
       ... 9 more
     ✓ TTL Expiration (12 tests) 2.4s
       ✓ sets value with TTL
       ✓ TTL does not affect permanent values
       ... 10 more
     ✓ Batch Operations (14 tests) 380ms
     ✓ Statistics (6 tests) 240ms
     ✓ Health Check (6 tests) 180ms
     ✓ Validation (8 tests) 120ms
     ✓ Error Handling (4 tests) 200ms
     ✓ Large Data (4 tests) 580ms
     ✓ Special Characters (6 tests) 150ms
     ✓ Concurrent Operations (4 tests) 320ms

 Test Files  1 passed (1)
      Tests  80+ passed (80+)
   Start at  14:23:45
   Duration  5.24s (transform 32ms, setup 0ms, collect 89ms, tests 5.12s)
```

---

## Viewing Redis Logs

### If Running in Foreground:

Logs appear automatically in Terminal 1 where you ran `docker compose up`

### If Running in Background:

```bash
# View all logs
docker compose -f compose.test.yaml logs redis

# Follow logs in real-time
docker compose -f compose.test.yaml logs -f redis

# View last 50 lines
docker compose -f compose.test.yaml logs --tail=50 redis
```

### Using Docker Exec:

```bash
# Monitor Redis commands in real-time
docker exec -it blaize-cache-redis-test redis-cli MONITOR

# Check Redis info
docker exec -it blaize-cache-redis-test redis-cli INFO

# Interactive Redis CLI
docker exec -it blaize-cache-redis-test redis-cli
```

---

## Test Configuration

### Connection Settings

Tests use these defaults (from `redis.test.ts`):

```typescript
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const TEST_CONFIG = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  db: 15, // Uses db 15 to avoid conflicts
};
```

### Override Connection

```bash
# Use different Redis instance
export REDIS_HOST=my-redis-server.local
export REDIS_PORT=6380

pnpm test src/__tests__/redis.test.ts
```

---

## Advanced Testing Scenarios

### Test Against Production-like Redis

```yaml
# Create docker-compose.prod-test.yml
services:
  redis:
    image: redis:8-alpine
    command: >
      redis-server
      --requirepass mypassword
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    ports:
      - '6380:6379'
```

```bash
docker-compose -f docker-compose.prod-test.yml up -d

# Test with auth
REDIS_HOST=localhost REDIS_PORT=6380 pnpm test src/__tests__/redis.test.ts
```

### Test Specific Scenarios

```bash
# Test only connection management
pnpm test src/__tests__/redis.test.ts -t "Connection Management"

# Test only TTL expiration
pnpm test src/__tests__/redis.test.ts -t "TTL Expiration"

# Test batch operations
pnpm test src/__tests__/redis.test.ts -t "Batch Operations"
```

### Debug Mode

```bash
# Run tests with verbose output
pnpm test src/__tests__/redis.test.ts --reporter=verbose

# Run specific test and show logs
pnpm test src/__tests__/redis.test.ts -t "connects to Redis successfully"
```

---

## Troubleshooting

### Problem: "Redis not available"

**Symptom:**

```
Error: Redis connection failed
    at RedisAdapter.connect
```

**Solutions:**

1. **Check if Redis is running:**

   ```bash
   docker compose -f compose.test.yaml ps
   ```

2. **Check Redis health:**

   ```bash
   docker exec blaize-cache-redis-test redis-cli ping
   ```

3. **Restart Redis:**

   ```bash
   docker compose -f compose.test.yaml restart
   ```

4. **Check logs:**
   ```bash
   docker compose -f compose.test.yaml logs redis
   ```

### Problem: Port 6379 already in use

**Symptom:**

```
Error: bind: address already in use
```

**Solution 1: Stop conflicting Redis**

```bash
# Find what's using port 6379
lsof -i :6379

# Stop local Redis service
sudo systemctl stop redis
# OR
brew services stop redis
```

**Solution 2: Use different port**

```yaml
# Edit docker-compose.test.yml
ports:
  - '6380:6379' # Change to 6380
```

```bash
# Update test config
export REDIS_PORT=6380
pnpm test src/__tests__/redis.test.ts
```

### Problem: Tests fail randomly

**Symptom:**

```
Test "sets value with TTL" failed intermittently
```

**Cause:** TTL tests use `wait()` which can be flaky

**Solution:** Run tests with more tolerance

```typescript
// In test file, increase wait times if needed
await wait(2100); // Wait for 2s TTL + 100ms buffer
```

### Problem: "Cannot find module 'ioredis'"

**Symptom:**

```
Error: Cannot find module 'ioredis'
```

**Solution:**

```bash
# Install dependencies
cd plugins/cache
pnpm install

# Verify ioredis is installed
pnpm list ioredis
```

### Problem: Docker container won't start

**Symptom:**

```
Container exited with code 1
```

**Solutions:**

1. **Check Docker daemon:**

   ```bash
   docker info
   ```

2. **Check for conflicting containers:**

   ```bash
   docker ps -a | grep redis
   docker rm blaize-cache-redis-test
   ```

3. **Pull latest Redis image:**

   ```bash
   docker pull redis:8-alpine
   ```

4. **Full cleanup and restart:**
   ```bash
   docker compose -f compose.test.yaml down -v
   docker compose -f compose.test.yaml up -d
   ```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Cache Plugin Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      redis:
        image: redis:8-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Run Redis integration tests
        run: pnpm test src/__tests__/redis.test.ts
        env:
          REDIS_HOST: localhost
          REDIS_PORT: 6379
```

---

## Performance Testing

### Benchmark Redis Operations

```bash
# Run tests with timing info
time pnpm test src/__tests__/redis.test.ts

# Profile memory usage
node --expose-gc --max-old-space-size=256 \
  node_modules/.bin/vitest src/__tests__/redis.test.ts
```

### Redis Performance Monitoring

```bash
# Monitor Redis in real-time while tests run
docker exec -it blaize-cache-redis-test redis-cli

# In redis-cli:
> MONITOR
> INFO stats
> INFO memory
> SLOWLOG GET 10
```

---

## Test Data Cleanup

Tests use **database 15** to avoid conflicts, but you can manually clean:

```bash
# Clear test database
docker exec blaize-cache-redis-test redis-cli -n 15 FLUSHDB

# Clear all databases (careful!)
docker exec blaize-cache-redis-test redis-cli FLUSHALL
```

---

## Quick Commands Reference

```bash
# Start Redis
docker compose -f compose.test.yaml up -d

# Check status
docker compose -f compose.test.yaml ps

# View logs
docker compose -f compose.test.yaml logs -f redis

# Run tests
pnpm test src/__tests__/redis.test.ts

# Stop Redis
docker compose -f compose.test.yaml down

# Full cleanup
docker compose -f compose.test.yaml down -v
```

---

## What's Being Tested?

The integration tests cover:

✅ **Connection Management** (10 tests)

- Connect/disconnect
- Retry logic
- Connection failures
- Exponential backoff

✅ **Basic Operations** (12 tests)

- GET/SET/DELETE
- Null handling
- Overwrites

✅ **TTL Expiration** (12 tests)

- SETEX command
- Expiration timing
- TTL updates
- Validation

✅ **Batch Operations** (14 tests)

- MGET/MSET
- Pipeline optimization
- Per-entry TTL
- Empty arrays

✅ **Statistics** (6 tests)

- INFO command parsing
- Hit/miss tracking
- Memory/key counts

✅ **Health Checks** (6 tests)

- PING command
- Latency measurement
- Connection status

✅ **Validation** (8 tests)

- Empty keys
- Invalid TTL
- Error messages

✅ **Error Handling** (4 tests)

- Redis errors wrapped
- Original errors preserved

✅ **Large Data** (4 tests)

- 100KB values
- 100+ keys

✅ **Special Characters** (6 tests)

- Unicode
- JSON
- Escape sequences

✅ **Concurrency** (4 tests)

- Parallel operations
- Race conditions

---

## Need Help?

- Check logs: `docker compose -f compose.test.yaml logs redis`
- Test connection: `docker exec blaize-cache-redis-test redis-cli ping`
- Restart fresh: `docker compose -f compose.test.yaml down -v && docker compose -f compose.test.yaml up -d`

Happy testing! 🎉
