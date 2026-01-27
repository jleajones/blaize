/**
 * Config template files for minimal template
 *
 * Includes:
 * - package.json - Package configuration with scripts
 * - README.md - Comprehensive documentation
 * - tsconfig.json - TypeScript configuration
 * - .gitignore - Git ignore patterns
 */

import { TemplateFile } from '@/types';

export const configFiles: TemplateFile[] = [
  {
    path: 'package.json',
    content: `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "{{description}}",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "type-check": "tsc --noEmit",
    "clean": "rimraf dist"
  },
  "keywords": ["blaizejs", "api", "typescript", "server"],
  "author": "{{author}}",
  "license": "{{license}}",
  "dependencies": {
    "blaizejs": "^0.9.0",
    "zod": "^3.24.4"
  },
  "devDependencies": {
    "@blaizejs/testing-utils": "^0.6.0",
    "@types/node": "^23.0.0",
    "@vitest/coverage-v8": "^3.1.0",
    "rimraf": "^6.0.1",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.1.0"
  }
}
`,
  },
  {
    path: 'README.md',
    content: `# {{projectName}}

{{description}}

BlaizeJS minimal template - Production-ready starter with core features.

## Features

- 🚀 **File-based routing** - Automatic route discovery
- 📝 **Type-safe file uploads** - Zod schemas with \`file()\` helper
- 🔄 **Server-Sent Events (SSE)** - Real-time event streaming
- 📡 **EventBus** - Publish/subscribe for decoupled architecture
- 🧪 **Comprehensive test suite** - 30 tests, 80%+ coverage
- 📊 **Structured logging** - Context-aware logging
- 🔒 **Security best practices** - File upload validation, sanitization
- ✨ **TypeScript** - Full type safety throughout

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server running at https://localhost:7485
\`\`\`

Visit \`https://localhost:7485\` to see the API in action!

## Architecture

### File Structure

\`\`\`
src/
├── app.ts              # Server creation and lifecycle
├── app-router.ts       # Type-safe route factory
├── app-type.ts         # Route registry for type-safe client
├── events.ts           # Event schemas
├── routes/
│   ├── index.ts        # GET /
│   ├── health.ts       # GET /health
│   ├── upload.ts       # POST /upload
│   ├── users/
│   │   ├── index.ts    # GET /users
│   │   └── [userId]/
│   │       └── index.ts # GET /users/:userId
│   └── events/
│       └── stream.ts   # GET /events/stream (SSE)
└── __tests__/
    ├── setup.ts
    └── routes/         # Tests for all routes
\`\`\`

### Why app-router.ts?

Separating the route factory from server creation provides:

- **Cleaner imports** - Routes import \`route\` from \`../app-router\`, not \`../app\`
- **Type inference** - Type extraction happens once, not per route
- **Easier testing** - No server dependency in route tests
- **Best practices** - Matches recommended BlaizeJS patterns

### Event-Driven Architecture

The template demonstrates EventBus for decoupled communication:

1. **Define event schemas** in \`src/events.ts\`
2. **Publish events** in route handlers
3. **Subscribe** in SSE route or other handlers
4. **Type-safe** end-to-end with Zod

## Available Scripts

### Development

\`\`\`bash
npm run dev          # Start dev server with hot reload
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled server
npm run type-check   # Check TypeScript without compiling
npm run clean        # Remove dist/ directory
\`\`\`

### Testing

\`\`\`bash
npm test             # Run tests once
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
\`\`\`

Coverage thresholds are set to 80% for all metrics (lines, functions, branches, statements).

## API Endpoints

### GET /

Welcome message with API information.

**Response:**
\`\`\`json
{
  "message": "Welcome to BlaizeJS!",
  "version": "1.0.0",
  "timestamp": "2025-01-27T12:00:00.000Z",
  "endpoints": ["GET /", "GET /health", ...]
}
\`\`\`

### GET /health

Health check endpoint for monitoring.

**Response:**
\`\`\`json
{
  "status": "ok",
  "timestamp": 1706356800000,
  "uptime": 123456
}
\`\`\`

### GET /users

List users with pagination.

**Query Parameters:**
- \`limit\` (optional) - Number of users to return (1-100, default: 10)

**Response:**
\`\`\`json
{
  "users": [
    {
      "id": "user-1",
      "name": "Alice Admin",
      "email": "alice@example.com",
      "role": "admin"
    }
  ],
  "total": 3
}
\`\`\`

### GET /users/:userId

Get user by ID. Publishes \`user:viewed\` event.

**Response:**
\`\`\`json
{
  "id": "test-123",
  "name": "Demo User",
  "email": "demo@example.com",
  "role": "user"
}
\`\`\`

### POST /upload

Type-safe file upload with validation.

**Security Features:**
- File size limit (10MB)
- MIME type allowlist
- Filename sanitization
- Path traversal prevention

**Form Data:**
- \`document\` (optional) - Single file
- \`attachments\` (optional) - Multiple files

At least one file must be uploaded.

**Response:**
\`\`\`json
{
  "message": "Successfully uploaded 1 file(s)",
  "files": [
    {
      "filename": "test.jpg",
      "size": 1024,
      "mimetype": "image/jpeg"
    }
  ]
}
\`\`\`

**Example:**
\`\`\`bash
curl -F "document=@test.jpg" https://localhost:7485/upload
\`\`\`

### GET /events/stream

Server-Sent Events (SSE) endpoint for real-time updates.

**Events:**
- \`user:viewed\` - When a user is fetched
- \`file:uploaded\` - When a file is uploaded
- \`demo:event\` - Connection message, heartbeats

**Example (Browser):**
\`\`\`javascript
const es = new EventSource('https://localhost:7485/events/stream');

es.addEventListener('user:viewed', (e) => {
  const data = JSON.parse(e.data);
  console.log('User viewed:', data.userId);
});

es.addEventListener('file:uploaded', (e) => {
  const data = JSON.parse(e.data);
  console.log('File uploaded:', data.filename);
});
\`\`\`

## Type-Safe File Uploads

BlaizeJS provides a \`file()\` helper for Zod schemas:

\`\`\`typescript
import { route } from './app-router';
import { z } from 'zod';
import { file } from 'blaizejs';

export const uploadRoute = route.post({
  schema: {
    files: z.object({
      avatar: file(),                    // Single file
      documents: z.array(file()).optional(), // Multiple files
    }),
  },
  handler: async ({ ctx, logger, eventBus }) => {
    const { avatar, documents } = ctx.request.files;
    
    // Files are typed as UploadedFile:
    // - avatar.filename: string
    // - avatar.size: number
    // - avatar.mimetype: string
    // - avatar.data: Buffer
    
    return { success: true };
  },
});
\`\`\`

### Security Best Practices

The upload route demonstrates production-ready patterns:

1. **File size validation** - Reject files over limit
2. **MIME type allowlist** - Only allow specific types (not blocklist!)
3. **Filename sanitization** - Remove unsafe characters, prevent path traversal
4. **EventBus integration** - Publish for audit trail

See \`src/routes/upload.ts\` for complete implementation.

## Testing

The template includes a comprehensive test suite:

- **30 test cases** across all routes
- **80%+ coverage** for all routes
- **Phase 0 utilities** - \`createRouteTestContext()\`, \`createSSEMockContext()\`
- **Assertion helpers** - Reduce boilerplate by ~70%

### Running Tests

\`\`\`bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
\`\`\`

### Example Test

\`\`\`typescript
import { createTestContext, createRouteTestContext } from '@blaizejs/testing-utils';
import { postUpload } from '../routes/upload';

it('should handle file upload', async () => {
  const { logger, eventBus, cleanup } = createRouteTestContext();
  
  const ctx = createTestContext({
    files: {
      document: {
        filename: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        data: Buffer.from('fake image'),
      },
    },
  });
  
  const result = await postUpload.handler({ ctx, logger, eventBus });
  
  expect(result.files).toHaveLength(1);
  logger.assertInfoCalled('Files uploaded', { count: 1 });
  eventBus.assertPublished('file:uploaded');
  
  cleanup();
});
\`\`\`

## Type-Safe Client

Generate a type-safe API client using \`app-type.ts\`:

\`\`\`typescript
import bc from '@blaizejs/client';
import { routes } from './src/app-type';

const client = bc.create('https://localhost:7485', routes);

// Fully typed!
const user = await client.$get.getUserById({ 
  params: { userId: '123' } 
});

console.log(user.name); // TypeScript knows the response shape
\`\`\`

## Environment Variables

The template uses sensible defaults. To customize:

\`\`\`bash
# .env (optional)
PORT=7485
NODE_ENV=development
\`\`\`

## Production Deployment

### Build for Production

\`\`\`bash
npm run build
npm start
\`\`\`

### Production Checklist

Before deploying, consider:

- [ ] Replace demo data with real database
- [ ] Add authentication/authorization
- [ ] Configure CORS properly
- [ ] Set up error monitoring (e.g., Sentry)
- [ ] Add rate limiting
- [ ] Configure reverse proxy (nginx, Caddy)
- [ ] Set up SSL certificates
- [ ] Configure logging aggregation
- [ ] Add health check monitoring
- [ ] Review file upload limits for your use case

### File Upload Production

The upload route includes TODOs for production:

- [ ] Virus scanning (ClamAV)
- [ ] Cloud storage (S3, GCS)
- [ ] Content verification
- [ ] Thumbnail generation for images
- [ ] Rate limiting per user

## Learn More

- **BlaizeJS Docs** - [https://blaizejs.dev](https://blaizejs.dev)
- **API Reference** - [https://docs.blaizejs.dev](https://docs.blaizejs.dev)
- **GitHub** - [https://github.com/blaizejs/blaize](https://github.com/blaizejs/blaize)
- **Discord** - Join our community for help and discussions

## Next Steps

1. **Explore the routes** - Check out \`src/routes/\` for examples
2. **Add your features** - Build on the template structure
3. **Write tests** - Follow the patterns in \`src/__tests__/\`
4. **Deploy** - Follow the production checklist above

## Contributing

Found a bug or have a suggestion? Please open an issue!

## License

{{license}}
`,
  },
  {
    path: 'tsconfig.json',
    content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
`,
  },
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

# Uploads (demo - in production, use cloud storage)
uploads/
`,
  },
];
