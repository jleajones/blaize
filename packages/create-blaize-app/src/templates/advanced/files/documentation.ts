/**
 * Documentation for Advanced Template (T2.10)
 *
 * This is the README.md that users see when they scaffold the advanced template.
 * It should be comprehensive, friendly, and get users productive quickly.
 */

import type { TemplateFile } from '@/types';

export const documentationFiles: TemplateFile[] = [
  // ==========================================================================
  // MAIN README - Complete getting started guide
  // ==========================================================================
  {
    path: 'README.md',
    content: `# {{projectName}}

A production-ready BlaizeJS application with Queue, Cache, and Metrics plugins.

## 🚀 Quick Start

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Start Redis (required for Queue, Cache, EventBus)
docker compose up -d

# 3. Start development server
npm run dev

# 4. Visit http://localhost:7485
\`\`\`

**That's it!** Your BlaizeJS app is running with all plugins enabled.

---

## 📋 Requirements

- **Node.js 23+** (use \`nvm use\` to switch versions)
- **Docker** (for Redis) - [Install Docker](https://docs.docker.com/get-docker/)
- **npm/pnpm/yarn/bun** (any package manager works)

### Check Your Setup

\`\`\`bash
# Verify Node version
node --version
# Should show: v23.x.x

# Verify Docker
docker --version
# Should show: Docker version 20.10.0 or higher

# Verify Docker Compose
docker compose version
# Should show: Docker Compose version v2.x.x
\`\`\`

---

## 🎯 What's Included

This template includes everything you need for production:

### ✅ **Three Powerful Plugins**
- **Queue Plugin** - Background job processing with Redis
- **Cache Plugin** - High-performance caching with Redis  
- **Metrics Plugin** - Prometheus-compatible metrics

### ✅ **Production-Ready Features**
- TypeScript with strict type checking
- Comprehensive test suite (80%+ coverage)
- Docker Compose for local development
- Environment-based configuration
- Structured logging
- Event-driven architecture

### ✅ **Example Routes**
- Health checks (\`/health\`)
- Metrics dashboard (\`/metrics\`, \`/metrics/dashboard\`)
- Queue management (\`/queue/*\`)
- Cache operations (\`/cache/*\`)
- User management (\`/user/*\`)
- Real-time SSE streams

### ✅ **Developer Experience**
- Hot reload in development
- Type-safe route handlers
- Zod schema validation
- Testing utilities included
- Comprehensive documentation

---

## 📁 Project Structure

\`\`\`
{{projectName}}/
├── src/
│   ├── index.ts              # Server entry point
│   ├── config.ts             # Configuration (Redis, etc.)
│   ├── events.ts             # Event schemas
│   ├── handlers.ts           # Queue job handlers
│   ├── app-router.ts         # Route factory
│   ├── app-type.ts           # Type exports
│   ├── routes/               # API routes
│   │   ├── index.ts
│   │   ├── health/           # Health checks
│   │   ├── metrics/          # Prometheus metrics
│   │   ├── queue/            # Queue management
│   │   ├── cache/            # Cache operations
│   │   └── user/             # User management
│   ├── data/                 # Mock data (replace with real DB)
│   │   └── users.ts
│   └── __tests__/            # Test suite
│       ├── setup.ts
│       ├── routes/           # Unit tests (mocked)
│       └── integration/      # Integration tests (Redis)
├── docker-compose.yml        # Redis services
├── .env.sample              # Environment variables template
├── tsconfig.json            # TypeScript configuration
├── vitest.config.ts         # Test configuration
└── package.json             # Dependencies & scripts
\`\`\`

---

## 🔧 Configuration

### Environment Variables

\`\`\`bash
# Copy sample to .env
cp .env.sample .env

# Edit as needed
nano .env
\`\`\`

**Key Variables:**

\`\`\`env
# Server
NODE_ENV=development
PORT=7485

# Redis (used by Queue, Cache, EventBus)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Docker Compose
COMPOSE_PROJECT_NAME={{projectName}}
\`\`\`

### Redis Configuration

Redis is **required** for:
- ✅ **EventBus** - Pub/sub communication
- ✅ **Queue Plugin** - Background job processing
- ✅ **Cache Plugin** - High-speed caching

**Start Redis:**
\`\`\`bash
docker compose up -d
\`\`\`

**Verify Redis is running:**
\`\`\`bash
docker compose ps
# Should show redis service as "Up"

# Test connection
redis-cli ping
# Should return: PONG
\`\`\`

**Stop Redis:**
\`\`\`bash
docker compose down
\`\`\`

**Optional Redis GUI:**
\`\`\`bash
# Start Redis with web interface
docker compose --profile gui up -d

# Access at http://localhost:8081
# Credentials: admin/admin (configurable in .env)
\`\`\`

---

## 🛠️ Available Scripts

### Development

\`\`\`bash
# Start dev server with hot reload
npm run dev

# Start dev server + Redis
npm run dev:services
\`\`\`

### Building

\`\`\`bash
# Build for production
npm run build

# Type check without building
npm run type-check
\`\`\`

### Running Production Build

\`\`\`bash
npm run build
npm start
\`\`\`

### Testing

\`\`\`bash
# Run all tests (requires Redis)
docker compose up -d
npm test

# Run unit tests only (no Redis needed)
npm test src/__tests__/routes

# Run integration tests (requires Redis)
docker compose up -d
npm test src/__tests__/integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
open coverage/index.html
\`\`\`

### Docker

\`\`\`bash
# Start Redis
npm run docker:up

# Stop Redis
npm run docker:down

# Clean Redis data
npm run docker:clean

# View logs
npm run docker:logs
\`\`\`

### Cleanup

\`\`\`bash
# Remove build artifacts
npm run clean
\`\`\`

---

## 🧪 Testing

This template includes **49 test cases** covering routes, services, and integrations.

### Test Types

#### 1. Unit Tests (Fast, No Dependencies)

Located in \`src/__tests__/routes/\`

**What:** Test individual routes with mocked services  
**Speed:** ~5-10ms per test  
**Redis:** Not required

\`\`\`bash
npm test src/__tests__/routes
\`\`\`

**Example tests:**
- Health endpoint (\`health.test.ts\`)
- Queue demo route (\`queue-demo.test.ts\`)
- Cache operations (\`cache-demo.test.ts\`)
- User signup flow (\`user-signup.test.ts\`)

#### 2. Integration Tests (Real Redis)

Located in \`src/__tests__/integration/\`

**What:** Test with real Redis adapters  
**Speed:** ~100ms-1s per test  
**Redis:** **Required**

\`\`\`bash
# Start Redis first!
docker compose up -d

# Run integration tests
npm test src/__tests__/integration
\`\`\`

**Example tests:**
- Redis cache operations (\`redis.test.ts\`)
- Queue job processing (\`queue-processing.test.ts\`)

### Writing Tests

Example route test:

\`\`\`typescript
import { describe, it, expect } from 'vitest';
import { createRouteTestContext } from '@blaizejs/testing-utils';
import { getYourRoute } from '../routes/your-route';

describe('GET /your-route', () => {
  it('should return expected data', async () => {
    const { logger, cleanup } = createRouteTestContext();
    
    const result = await getYourRoute.handler({
      ctx: { /* mock context */ },
      logger,
    });
    
    expect(result.status).toBe(200);
    cleanup();
  });
});
\`\`\`

See \`src/__tests__/README.md\` for complete testing guide.

### Coverage Goals

- **Overall:** 80%+
- **Routes:** 80%+
- **Handlers:** 70%+

View coverage:
\`\`\`bash
npm run test:coverage
open coverage/index.html
\`\`\`

---

## 🌐 API Documentation

### Health & Metrics

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/\` | GET | Root endpoint |
| \`/health\` | GET | Health check (Redis, Cache, Queue) |
| \`/metrics\` | GET | Prometheus metrics (JSON) |
| \`/metrics/dashboard\` | GET | Metrics HTML dashboard |
| \`/metrics/prometheus\` | GET | Prometheus scrape endpoint |

### Queue Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/queue/demo\` | GET | Create demo jobs (via query params) |
| \`/queue/demo\` | POST | Create demo jobs (via request body) |
| \`/queue/stream\` | GET | SSE stream of queue events |
| \`/queue/status\` | GET | Queue status & stats |
| \`/queue/dashboard\` | GET | Queue HTML dashboard |
| \`/queue/prometheus\` | GET | Queue metrics for Prometheus |

**Example: Create Demo Jobs (GET)**
\`\`\`bash
curl "http://localhost:7485/queue/demo?includeLongRunning=true&includeUnreliable=false"
\`\`\`

**Example: Create Demo Jobs (POST)**
\`\`\`bash
curl -X POST http://localhost:7485/queue/demo \\
  -H "Content-Type: application/json" \\
  -d '{
    "count": 5,
    "includeUnreliable": false,
    "includeLongRunning": true
  }'
\`\`\`

**Example: Watch Queue Events (SSE)**
\`\`\`bash
curl -N http://localhost:7485/queue/stream
\`\`\`

### Cache Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/cache/demo\` | GET | Populate cache with demo data |
| \`/cache/demo?pattern=*\` | DELETE | Clear cache entries |
| \`/cache/stream\` | GET | SSE stream of cache events |
| \`/cache/prometheus\` | GET | Cache metrics for Prometheus |

**Example: Populate Cache**
\`\`\`bash
curl "http://localhost:7485/cache/demo?includeUsers=true&includeSessions=true"
\`\`\`

**Example: Clear Cache**
\`\`\`bash
curl -X DELETE "http://localhost:7485/cache/demo?pattern=session:*"
\`\`\`

### User Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/user\` | GET | List all users |
| \`/user/signup\` | POST | Create new user (queues welcome email) |
| \`/user/:userId\` | GET | Get user by ID (cache-first) |
| \`/user/:userId/notifications\` | GET | SSE stream of user notifications |

**Example: User Signup**
\`\`\`bash
curl -X POST http://localhost:7485/user/signup \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "avatar": "https://example.com/avatar.jpg"
  }'
\`\`\`

Response includes:
- Created user object
- Job IDs (welcome email, avatar processing)
- Monitoring URLs for queue/cache

**Example: Watch User Notifications (SSE)**
\`\`\`bash
curl -N http://localhost:7485/user/user_123/notifications
\`\`\`

---

## 🔌 Plugin Configuration

### Queue Plugin

Handles background job processing with Redis.

**Queues:**
- \`emails\` - Email sending (concurrency: 5)
- \`reports\` - Report generation (concurrency: 2)
- \`processing\` - Data processing (concurrency: 3)
- \`longRunning\` - Long tasks (concurrency: 1)
- \`notifications\` - Push notifications (concurrency: 10)

**Job Handlers** (in \`src/handlers.ts\`):
- \`emails/send\` - Send email
- \`emails/verify\` - Verify email address
- \`reports/generate\` - Generate PDF report
- \`processing/image\` - Process uploaded images
- \`processing/data-sync\` - Sync external data

**Configuration:**
\`\`\`typescript
const queuePlugin = createQueuePlugin({
  storage: queueAdapter,
  concurrency: {
    emails: 5,
    reports: 2,
    processing: 3,
  },
  handlers: { /* see src/handlers.ts */ },
  logger: Blaize.logger,
});
\`\`\`

**Adding Jobs:**
\`\`\`typescript
const jobId = await queue.add(
  'emails',           // Queue name
  'send',            // Handler name
  {                  // Job data
    to: 'user@example.com',
    subject: 'Welcome!',
    body: 'Thanks for signing up',
  },
  { priority: 8 }    // Options
);
\`\`\`

### Cache Plugin

High-performance caching with Redis.

**Configuration:**
\`\`\`typescript
const cachePlugin = createCachePlugin({
  adapter: cacheAdapter,
  serverId: '{{projectName}}-server-1',
});
\`\`\`

**Usage:**
\`\`\`typescript
// Set cache
await cache.set('user:123', JSON.stringify(user), 1800); // 30min TTL

// Get cache
const cached = await cache.get('user:123');
const user = cached ? JSON.parse(cached) : null;

// Clear by pattern
await cache.clear('user:*');
\`\`\`

### Metrics Plugin

Prometheus-compatible metrics collection.

**Configuration:**
\`\`\`typescript
const metricsPlugin = createMetricsPlugin({
  port: 7485,
  path: '/metrics',
  collectDefaultMetrics: true,
  labels: { service: '{{projectName}}' },
});
\`\`\`

**Scraping:**
\`\`\`bash
# Prometheus format
curl http://localhost:7485/metrics/prometheus

# JSON format
curl http://localhost:7485/metrics

# HTML dashboard
open http://localhost:7485/metrics/dashboard
\`\`\`

---

## 📡 Event-Driven Architecture

This app uses BlaizeJS EventBus for real-time communication.

**Event Categories:**
- \`user:*\` - User events (created, updated, viewed)
- \`queue:job:*\` - Queue job lifecycle
- \`cache:*\` - Cache operations (set, get, clear)
- \`system:*\` - System events
- \`notification:*\` - Notification events
- \`order:*\` - Order events
- \`report:*\` - Report generation events

**Publishing Events:**
\`\`\`typescript
await eventBus.publish('user:created', {
  userId: user.id,
  email: user.email,
  timestamp: Date.now(),
});
\`\`\`

**Subscribing to Events:**
\`\`\`typescript
const unsubscribe = eventBus.subscribe('user:*', (event) => {
  console.log('User event:', event);
});

// Later: cleanup
unsubscribe();
\`\`\`

**SSE Streams:**

Users can subscribe to real-time events via Server-Sent Events:

\`\`\`bash
# Queue events
curl -N http://localhost:7485/queue/stream

# Cache events
curl -N http://localhost:7485/cache/stream

# User notifications
curl -N http://localhost:7485/user/:userId/notifications
\`\`\`

---

## 🚀 Deployment

### Production Build

\`\`\`bash
# 1. Build TypeScript
npm run build

# 2. Set environment
export NODE_ENV=production
export PORT=7485
export REDIS_HOST=your-redis-host.com

# 3. Start server
npm start
\`\`\`

### Environment Variables (Production)

\`\`\`env
NODE_ENV=production
PORT=7485

# Redis (managed service recommended)
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0

# Optional: Connection URL
REDIS_URL=redis://:password@host:6379/0
\`\`\`

### Redis in Production

**Options:**

1. **Managed Services** (Recommended)
   - AWS ElastiCache
   - Google Cloud Memorystore
   - Azure Cache for Redis
   - Upstash (serverless)
   - Redis Cloud

2. **Self-Hosted**
   - Redis Cluster for high availability
   - Redis Sentinel for failover
   - Regular backups (RDB + AOF)

**Security:**
- ✅ Enable authentication (\`requirepass\`)
- ✅ Use TLS/SSL for connections
- ✅ Restrict network access (VPC/firewall)
- ✅ Regular updates and patches
- ✅ Monitor with Prometheus

### Docker Deployment

\`\`\`dockerfile
# See Dockerfile for multi-stage build example
# Build: docker build -t {{projectName}} .
# Run: docker run -p 7485:7485 {{projectName}}
\`\`\`

### Health Checks

Configure your load balancer/orchestrator:

\`\`\`yaml
healthCheck:
  path: /health
  interval: 30s
  timeout: 5s
  healthyThreshold: 2
  unhealthyThreshold: 3
\`\`\`

### Monitoring

**Prometheus + Grafana:**

1. Scrape metrics from \`/metrics/prometheus\`
2. Create dashboards for:
   - Request rate, latency, errors
   - Queue depth and job processing
   - Cache hit/miss rates
   - Redis connection health

**Example Prometheus config:**
\`\`\`yaml
scrape_configs:
  - job_name: '{{projectName}}'
    static_configs:
      - targets: ['your-app.com:7485']
    metrics_path: '/metrics/prometheus'
    scrape_interval: 15s
\`\`\`

### Scaling

**Horizontal Scaling:**
- Multiple app instances OK
- Shared Redis for Queue/Cache/EventBus
- Load balancer in front

**Queue Processing:**
- Increase concurrency per queue
- Add more worker instances
- Monitor queue depth

**Caching:**
- Tune TTL values
- Monitor hit/miss ratios
- Consider Redis Cluster for large datasets

---

## 🛠️ Development Guide

### Adding a New Route

1. **Create route file:**
\`\`\`typescript
// src/routes/products/index.ts
import { route } from '../../app-router';
import { z } from 'zod';

export const getProducts = route.get({
  schema: {
    response: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
    })),
  },
  handler: async ({ logger }) => {
    logger.info('Fetching products');
    
    // Your logic here
    return [
      { id: '1', name: 'Product 1', price: 99.99 },
    ];
  },
});
\`\`\`

2. **Export from routes/index.ts:**
\`\`\`typescript
export * from './products';
\`\`\`

3. **Add test:**
\`\`\`typescript
// src/__tests__/routes/products.test.ts
import { describe, it, expect } from 'vitest';
import { createRouteTestContext } from '@blaizejs/testing-utils';
import { getProducts } from '../../routes/products';

describe('GET /products', () => {
  it('should return products', async () => {
    const { logger } = createRouteTestContext();
    
    const result = await getProducts.handler({ logger } as any);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Product 1');
  });
});
\`\`\`

### Adding a Queue Handler

1. **Create handler function:**
\`\`\`typescript
// src/handlers.ts
export async function processOrder(data: { orderId: string }) {
  console.log('Processing order:', data.orderId);
  
  // Your processing logic
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return { processed: true, orderId: data.orderId };
}
\`\`\`

2. **Register in handlers object:**
\`\`\`typescript
handlers: {
  orders: {
    process: processOrder,
  },
}
\`\`\`

3. **Queue a job:**
\`\`\`typescript
await queue.add('orders', 'process', { orderId: '123' });
\`\`\`

### Adding an Event Type

1. **Define in events.ts:**
\`\`\`typescript
export const playgroundEvents = {
  // ... existing events
  'product:created': z.object({
    productId: z.string(),
    name: z.string(),
    timestamp: z.number(),
  }),
};
\`\`\`

2. **Publish event:**
\`\`\`typescript
await eventBus.publish('product:created', {
  productId: 'prod_123',
  name: 'New Product',
  timestamp: Date.now(),
});
\`\`\`

3. **Subscribe to event:**
\`\`\`typescript
eventBus.subscribe('product:*', (event) => {
  console.log('Product event:', event);
});
\`\`\`

---

## 🐛 Troubleshooting

### Common Issues

#### "ECONNREFUSED" - Can't connect to Redis

**Problem:** Redis is not running

**Solution:**
\`\`\`bash
docker compose up -d
docker compose ps  # Verify redis is "Up"
\`\`\`

#### "Port 7485 already in use"

**Problem:** Another process is using the port

**Solution:**
\`\`\`bash
# Find process
lsof -i :7485

# Kill process or change PORT in .env
PORT=8080 npm run dev
\`\`\`

#### Tests timing out

**Problem:** Redis not running for integration tests

**Solution:**
\`\`\`bash
# Start Redis before tests
docker compose up -d

# Then run tests
npm test
\`\`\`

#### "Module not found" errors

**Problem:** Dependencies not installed

**Solution:**
\`\`\`bash
rm -rf node_modules
npm install
\`\`\`

#### Type errors in tests

**Problem:** Testing types not recognized

**Solution:**
\`\`\`bash
# Make sure testing-utils is installed
npm install @blaizejs/testing-utils --save-dev

# Rebuild
npm run build
\`\`\`

---

## 📚 Learn More

### BlaizeJS Documentation
- [Official Docs](https://docs.blaizejs.dev)
- [API Reference](https://docs.blaizejs.dev/api)
- [Plugin Guide](https://docs.blaizejs.dev/plugins)
- [Testing Guide](https://docs.blaizejs.dev/testing)

### Community
- [GitHub](https://github.com/blaizejs/blaize)
- [Discord](https://discord.gg/blaizejs)
- [Twitter](https://twitter.com/blaizejs)

### Related Projects
- [BlaizeJS Core](https://github.com/blaizejs/blaize)
- [Redis Adapter](https://github.com/blaizejs/adapter-redis)
- [Queue Plugin](https://github.com/blaizejs/plugin-queue)
- [Cache Plugin](https://github.com/blaizejs/plugin-cache)

---

## 📝 License

MIT © {{author}}

---

## 🙏 Acknowledgments

Built with [BlaizeJS](https://blaizejs.dev) - The TypeScript web framework focused on simplicity and developer experience.
`,
  },

  // ==========================================================================
  // DEPLOYMENT GUIDE - Detailed deployment documentation
  // ==========================================================================
  {
    path: 'DEPLOYMENT.md',
    content: `# Deployment Guide

Complete guide for deploying {{projectName}} to production.

---

## 📋 Pre-Deployment Checklist

- [ ] Environment variables configured
- [ ] Redis connection tested
- [ ] Production build successful
- [ ] Tests passing
- [ ] Health check endpoint working
- [ ] Monitoring configured
- [ ] Security review complete

---

## 🔐 Security Checklist

### Environment Variables
- [ ] All secrets in environment variables (not committed)
- [ ] \`.env\` file in \`.gitignore\`
- [ ] Redis password set
- [ ] CORS configured appropriately
- [ ] Rate limiting enabled (if applicable)

### Redis Security
- [ ] Authentication enabled (\`requirepass\`)
- [ ] TLS/SSL for connections
- [ ] Network access restricted
- [ ] Regular backups configured
- [ ] maxmemory policy set

### Application Security
- [ ] Input validation with Zod schemas
- [ ] Error messages don't leak sensitive info
- [ ] Logging doesn't include secrets
- [ ] Dependencies updated (npm audit)

---

## ☁️ Deployment Platforms

### Platform.sh / Railway / Render

**1. Add \`Procfile\`:**
\`\`\`
web: npm start
\`\`\`

**2. Environment Variables:**
\`\`\`
NODE_ENV=production
REDIS_URL=redis://...
\`\`\`

**3. Deploy:**
\`\`\`bash
git push platform main
\`\`\`

### AWS (Elastic Beanstalk / ECS / EC2)

**1. Build Docker image:**
\`\`\`bash
docker build -t {{projectName}} .
\`\`\`

**2. Push to ECR:**
\`\`\`bash
aws ecr get-login-password | docker login --username AWS ...
docker tag {{projectName}}:latest xxx.dkr.ecr.region.amazonaws.com/{{projectName}}
docker push xxx.dkr.ecr.region.amazonaws.com/{{projectName}}
\`\`\`

**3. Use ElastiCache for Redis:**
- Create Redis cluster
- Configure security groups
- Set REDIS_HOST in environment

### Google Cloud (Cloud Run / GKE)

**1. Build and push:**
\`\`\`bash
gcloud builds submit --tag gcr.io/PROJECT_ID/{{projectName}}
\`\`\`

**2. Deploy:**
\`\`\`bash
gcloud run deploy {{projectName}} \\
  --image gcr.io/PROJECT_ID/{{projectName}} \\
  --platform managed \\
  --region us-central1 \\
  --allow-unauthenticated
\`\`\`

**3. Use Memorystore for Redis**

### Kubernetes

**1. Create deployment.yaml:**
\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{projectName}}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: {{projectName}}
  template:
    metadata:
      labels:
        app: {{projectName}}
    spec:
      containers:
      - name: app
        image: your-registry/{{projectName}}:latest
        ports:
        - containerPort: 7485
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: host
        livenessProbe:
          httpGet:
            path: /health
            port: 7485
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 7485
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: {{projectName}}
spec:
  selector:
    app: {{projectName}}
  ports:
  - protocol: TCP
    port: 80
    targetPort: 7485
  type: LoadBalancer
\`\`\`

**2. Apply:**
\`\`\`bash
kubectl apply -f deployment.yaml
\`\`\`

---

## 🗄️ Redis Setup (Production)

### Managed Redis Services (Recommended)

#### AWS ElastiCache
\`\`\`bash
# Create cluster
aws elasticache create-replication-group \\
  --replication-group-id {{projectName}}-redis \\
  --replication-group-description "Redis for {{projectName}}" \\
  --engine redis \\
  --cache-node-type cache.t3.micro \\
  --num-cache-clusters 2

# Get endpoint
aws elasticache describe-replication-groups \\
  --replication-group-id {{projectName}}-redis
\`\`\`

#### Google Cloud Memorystore
\`\`\`bash
gcloud redis instances create {{projectName}}-redis \\
  --size=1 \\
  --region=us-central1 \\
  --tier=basic

# Get connection info
gcloud redis instances describe {{projectName}}-redis \\
  --region=us-central1
\`\`\`

#### Upstash (Serverless)
1. Go to [upstash.com](https://upstash.com)
2. Create Redis database
3. Copy REDIS_URL
4. Set in environment

### Self-Hosted Redis (Advanced)

**With Redis Cluster:**

\`\`\`yaml
# docker-compose.prod.yml
version: '3.8'

services:
  redis-1:
    image: redis:8-alpine
    command: redis-server --requirepass YOUR_PASSWORD --appendonly yes
    volumes:
      - redis-1-data:/data
    restart: always

  redis-2:
    image: redis:8-alpine
    command: redis-server --requirepass YOUR_PASSWORD --appendonly yes
    volumes:
      - redis-2-data:/data
    restart: always

volumes:
  redis-1-data:
  redis-2-data:
\`\`\`

---

## 📊 Monitoring Setup

### Prometheus + Grafana

**1. Prometheus Configuration:**

\`\`\`yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: '{{projectName}}'
    static_configs:
      - targets: ['your-app.com:7485']
    metrics_path: '/metrics/prometheus'
\`\`\`

**2. Key Metrics to Monitor:**

- \`http_request_duration_seconds\` - Request latency
- \`http_requests_total\` - Request count
- \`queue_jobs_total\` - Queue job count
- \`queue_processing_duration_seconds\` - Job processing time
- \`cache_hits_total\` - Cache hits
- \`cache_misses_total\` - Cache misses
- \`redis_connected\` - Redis connection status

**3. Alerts:**

\`\`\`yaml
# alerts.yml
groups:
  - name: {{projectName}}
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"

      - alert: RedisDown
        expr: redis_connected == 0
        for: 1m
        annotations:
          summary: "Redis connection lost"

      - alert: HighQueueDepth
        expr: queue_depth > 1000
        for: 10m
        annotations:
          summary: "Queue backlog building up"
\`\`\`

### Application Logs

**Structured Logging:**

BlaizeJS logger outputs JSON for easy parsing:

\`\`\`json
{
  "level": "info",
  "message": "User created",
  "userId": "user_123",
  "timestamp": "2025-01-27T12:00:00.000Z"
}
\`\`\`

**Log Aggregation:**

- **Datadog**: Forward logs via agent
- **Splunk**: HTTP Event Collector
- **ELK Stack**: Filebeat → Logstash → Elasticsearch
- **CloudWatch**: AWS CloudWatch Logs

---

## 🔄 CI/CD Pipeline

### GitHub Actions

\`\`\`yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:8-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 23
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          # Your deployment commands
\`\`\`

### GitLab CI

\`\`\`yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  image: node:23-alpine
  services:
    - redis:8-alpine
  script:
    - npm ci
    - npm test

build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/

deploy:
  stage: deploy
  script:
    - # Deploy commands
  only:
    - main
\`\`\`

---

## 🔁 Zero-Downtime Deployment

### Blue-Green Deployment

1. Deploy new version (green)
2. Health check green environment
3. Switch traffic to green
4. Keep blue for rollback

### Rolling Updates (Kubernetes)

\`\`\`yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
\`\`\`

### Database Migrations

For schema changes:
1. Deploy backward-compatible changes first
2. Run migrations
3. Deploy code using new schema
4. Remove old schema support

---

## 🚨 Rollback Procedure

### Quick Rollback

**Docker:**
\`\`\`bash
# Rollback to previous image
docker tag {{projectName}}:previous {{projectName}}:latest
docker-compose up -d
\`\`\`

**Kubernetes:**
\`\`\`bash
# Rollback deployment
kubectl rollout undo deployment/{{projectName}}

# Rollback to specific revision
kubectl rollout undo deployment/{{projectName}} --to-revision=2
\`\`\`

**Platform Services:**
\`\`\`bash
# Most platforms support instant rollback
railway rollback
render rollback
\`\`\`

---

## 🏗️ Scaling Guide

### Horizontal Scaling

**Requirements:**
- Stateless application ✅ (state in Redis)
- Load balancer
- Shared Redis instance

**Scale Up:**
\`\`\`bash
# Kubernetes
kubectl scale deployment {{projectName}} --replicas=5

# Docker Swarm
docker service scale {{projectName}}=5
\`\`\`

### Queue Scaling

**Increase Concurrency:**
\`\`\`typescript
concurrency: {
  emails: 10,      // Was 5
  reports: 5,      // Was 2
  processing: 6,   // Was 3
}
\`\`\`

**Add Worker Instances:**

Deploy additional app instances to process more jobs concurrently.

### Redis Scaling

**Vertical:** Increase memory/CPU  
**Horizontal:** Redis Cluster for sharding

---

## ✅ Post-Deployment

### Smoke Tests

\`\`\`bash
# Health check
curl https://your-app.com/health

# Metrics
curl https://your-app.com/metrics

# Create test user
curl -X POST https://your-app.com/user/signup \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Test","email":"test@example.com"}'
\`\`\`

### Monitor for 24-48 hours

- Check error rates
- Monitor queue depth
- Watch memory usage
- Review logs for issues

---

## 📞 Support

If you encounter issues:

1. Check logs: \`docker compose logs\` or platform logs
2. Verify environment variables
3. Test Redis connection
4. Review [BlaizeJS Docs](https://docs.blaizejs.dev)
5. Ask in [Discord](https://discord.gg/blaizejs)

---

## 🎯 Next Steps

- [ ] Set up monitoring dashboards
- [ ] Configure alerts
- [ ] Document runbook procedures
- [ ] Plan scaling strategy
- [ ] Schedule regular backups
- [ ] Review security posture

**Happy deploying! 🚀**
`,
  },
];
