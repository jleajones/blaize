/**
 * Docker Configuration for Advanced Template (T2.7)
 *
 * Contains:
 * - .env.example - Environment template with Redis configuration (committed)
 * - docker-compose.yml - Redis service for local development
 * - .dockerignore - Files to exclude from Docker builds
 * - tsconfig.json - TypeScript configuration
 * - vitest.config.ts - Testing configuration
 * - .nvmrc - Node version specification
 */

import type { TemplateFile } from '@/types';

export const configFiles: TemplateFile[] = [
  // ==========================================================================
  // ENVIRONMENT TEMPLATE
  // ==========================================================================
  {
    path: '.env.example',
    content: `# Environment Configuration Template
# Copy this to .env and customize as needed:
#   cp .env.example .env

# ==========================================================================
# Application Settings
# ==========================================================================
NODE_ENV=development
PORT=7485

# ==========================================================================
# Redis Configuration
# ==========================================================================
# Redis connection settings (used by BlaizeJS adapters)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# Alternative: Redis connection URL (overrides individual settings)
# REDIS_URL=redis://localhost:6379/0

# Production example:
# REDIS_URL=redis://:your-password@your-redis-host:6379/0

# ==========================================================================
# Docker Compose Settings
# ==========================================================================
COMPOSE_PROJECT_NAME={{projectName}}

# Redis Commander credentials (optional, only if using --profile gui)
REDIS_COMMANDER_USER=admin
REDIS_COMMANDER_PASSWORD=admin

# ==========================================================================
# Queue Plugin Settings (Optional)
# ==========================================================================
# Override queue configuration via environment
# QUEUE_CONCURRENCY_EMAILS=5
# QUEUE_CONCURRENCY_REPORTS=2
# QUEUE_CONCURRENCY_PROCESSING=3

# ==========================================================================
# Cache Plugin Settings (Optional)
# ==========================================================================
# Cache TTL defaults (seconds)
# CACHE_DEFAULT_TTL=3600
# CACHE_MAX_ENTRIES=10000

# ==========================================================================
# Metrics Plugin Settings (Optional)
# ==========================================================================
# Metrics collection interval (milliseconds)
# METRICS_COLLECTION_INTERVAL=60000
# METRICS_HISTOGRAM_LIMIT=1000
`,
  },

  // ==========================================================================
  // DOCKER COMPOSE - Redis for local development
  // ==========================================================================
  {
    path: 'docker-compose.yml',
    content: `# Docker Compose for {{projectName}}
# 
# Services:
# - redis: Redis server for EventBus, Queue, and Cache
# - redis-commander: Optional Redis GUI (http://localhost:8081)
#
# Usage:
#   Start:    docker compose up -d
#   Stop:     docker compose down
#   Logs:     docker compose logs -f
#   Redis:    docker compose up -d redis
#   With GUI: docker compose --profile gui up -d
#
# Note: Uses Compose v4 format (no version field)

services:
  # ==========================================================================
  # Redis - Primary data store for Queue, Cache, and EventBus
  # ==========================================================================
  redis:
    image: redis:8-alpine
    container_name: \${COMPOSE_PROJECT_NAME:-{{projectName}}}-redis
    ports: ["\${REDIS_PORT:-6379}:6379"]
    volumes:
      - redis-data:/data
    command: >
      redis-server
      --appendonly yes
      --appendfsync everysec
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 5s
    restart: unless-stopped
    networks: [{{projectName}}-network]

  # ==========================================================================
  # Redis Commander - Web-based Redis GUI (Optional)
  # ==========================================================================
  # Access at http://localhost:8081
  # Enable with: docker compose --profile gui up -d
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: \${COMPOSE_PROJECT_NAME:-{{projectName}}}-redis-commander
    profiles: [gui]
    environment:
      - REDIS_HOSTS=local:redis:6379
      - HTTP_USER=\${REDIS_COMMANDER_USER:-admin}
      - HTTP_PASSWORD=\${REDIS_COMMANDER_PASSWORD:-admin}
    ports: ["8081:8081"]
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks: [{{projectName}}-network]

# ==========================================================================
# Volumes
# ==========================================================================
volumes:
  redis-data:

# ==========================================================================
# Networks
# ==========================================================================
networks:
  {{projectName}}-network:
`,
  },

  // ==========================================================================
  // DOCKERIGNORE - Exclude files from Docker builds
  // ==========================================================================
  {
    path: '.dockerignore',
    content: `# Git files
.git
.gitignore

# Dependencies
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Environment files
.env
.env.local
.env.*.local

# Build outputs
dist
build
*.tsbuildinfo

# Testing
coverage
.nyc_output

# IDE files
.vscode
.idea
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Temporary files
*.log
*.tmp
.cache

# Documentation
*.md
docs/

# CI/CD
.github
.gitlab-ci.yml
.travis.yml

# Docker files (avoid recursion)
Dockerfile*
docker-compose*.yml
.dockerignore
`,
  },

  // ==========================================================================
  // TYPESCRIPT CONFIG
  // ==========================================================================
  {
    path: 'tsconfig.json',
    content: `{
  "compilerOptions": {
    // Target and module (matches playground)
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",

    // Output
    "outDir": "./dist",
    "rootDir": "./src",
    "tsBuildInfoFile": "./.tsbuildinfo",

    // Strict type checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,

    // Additional checks
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,

    // Module interop
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "isolatedModules": true,

    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // Path aliases
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`,
  },

  // ==========================================================================
  // VITEST CONFIG - Testing configuration
  // ==========================================================================
  {
    path: 'vitest.config.ts',
    content: `import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.ts',
        '**/types.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
`,
  },

  // ==========================================================================
  // NVMRC - Node version specification
  // ==========================================================================
  {
    path: '.nvmrc',
    content: `23
`,
  },

  // ==========================================================================
  // GITIGNORE
  // ==========================================================================
  {
    path: '.gitignore',
    content: `# Dependencies
node_modules/
.pnpm-store/

# Build output
dist/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Test coverage
coverage/
.nyc_output/

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Temporary files
*.tmp
.cache/
.temp/

# Docker volumes (local development)
redis-data/
`,
  },
];
