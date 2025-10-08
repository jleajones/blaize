import { getDependencies, getDevDependencies } from '../../utils/versions';

/**
 * Template file type
 */
export interface TemplateFile {
  path: string;
  content: string;
}

/**
 * Template type
 */
export interface Template {
  name: string;
  files: TemplateFile[];
  getDependencies: (options?: { latest?: boolean }) => Promise<Record<string, string>>;
  getDevDependencies: (options?: { latest?: boolean }) => Promise<Record<string, string>>;
  scripts: Record<string, string>;
}

/**
 * Minimal template - A basic BlaizeJS API with testing
 */
export const minimalTemplate: Template = {
  name: 'minimal',
  files: [
    {
      path: 'src/app.ts',
      content: `import { Blaize, type InferContext } from 'blaizejs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ESM path resolution (required for route discovery)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const routesDir = path.resolve(__dirname, './routes');

// Create server using the Blaize namespace
const app = Blaize.createServer({
  host: 'localhost',
  port: process.env.PORT ? parseInt(process.env.PORT) : 7485,
  routesDir,
  http2: {
    enabled: true
  }
});

// Create a typed route factory for use in route files
type AppContext = InferContext<typeof app>;
export const route = Blaize.Router.createRouteFactory<
  AppContext['state'],
  AppContext['services']
>();

try {
  // Start the server
  await app.listen();
  console.log(\`🚀 Server running at https://\${app.host}:\${app.port}\`);
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}
`,
    },
    {
      path: 'src/routes/index.ts',
      content: `import { route } from '../app';
import { z } from 'zod';

// GET / - Welcome endpoint
export const GET = route.get({
  schema: {
    response: z.object({
      message: z.string(),
      timestamp: z.string(),
      version: z.string()
    })
  },
  handler: async (ctx) => ({
    message: 'Welcome to BlaizeJS!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
});
`,
    },
    {
      path: 'src/routes/health.ts',
      content: `import { route } from '../app';
import { NotFoundError } from 'blaizejs';
import { z } from 'zod';

const HealthStatus = z.enum(['healthy', 'degraded', 'unhealthy']);

// GET /health - Health check endpoint
export const GET = route.get({
  schema: {
    response: z.object({
      status: HealthStatus,
      uptime: z.number(),
      timestamp: z.string(),
      checks: z.object({
        database: z.boolean().optional(),
        redis: z.boolean().optional()
      }).optional()
    })
  },
  handler: async (ctx) => {
    // Example of error handling
    if (process.env.FORCE_UNHEALTHY) {
      throw new NotFoundError('Health check failed');
    }
    
    return {
      status: 'healthy' as const,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database: true,
        redis: true
      }
    };
  }
});
`,
    },
    {
      path: 'src/routes/users/[userId].ts',
      content: `import { route } from '../../app';
import { NotFoundError } from 'blaizejs';
import { z } from 'zod';

// Dynamic parameter schema
const paramsSchema = z.object({
  userId: z.string().uuid()
});

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string()
});

// GET /users/:userId - Get user by ID
export const GET = route.get({
  schema: {
    params: paramsSchema,
    response: userSchema
  },
  handler: async (ctx, params) => {
    // Example with typed params from dynamic route
    const { userId } = params;
    
    // Simulated database lookup
    if (userId === '00000000-0000-0000-0000-000000000000') {
      throw new NotFoundError(\`User \${userId} not found\`);
    }
    
    return {
      id: userId,
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date().toISOString()
    };
  }
});

// DELETE /users/:userId - Delete user
export const DELETE = route.delete({
  schema: {
    params: paramsSchema,
    response: z.object({
      success: z.boolean(),
      message: z.string()
    })
  },
  handler: async (ctx, params) => {
    const { userId } = params;
    
    // Simulated deletion
    return {
      success: true,
      message: \`User \${userId} deleted successfully\`
    };
  }
});
`,
    },
    {
      path: 'src/routes/users/index.ts',
      content: `import { route } from '../../app';
import { z } from 'zod';

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string()
});

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8)
});

// GET /users - List all users
export const GET = route.get({
  schema: {
    query: z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(10)
    }),
    response: z.object({
      users: z.array(userSchema),
      total: z.number(),
      page: z.number(),
      limit: z.number()
    })
  },
  handler: async (ctx) => {
    const { page, limit } = ctx.request.query;
    
    // Simulated database query
    return {
      users: [
        {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          name: 'John Doe',
          email: 'john@example.com',
          createdAt: new Date().toISOString()
        }
      ],
      total: 1,
      page,
      limit
    };
  }
});

// POST /users - Create new user
export const POST = route.post({
  schema: {
    body: createUserSchema,
    response: userSchema
  },
  handler: async (ctx) => {
    const { name, email, password } = ctx.body;
    
    // Simulated user creation
    const newUser = {
      id: crypto.randomUUID(),
      name,
      email,
      createdAt: new Date().toISOString()
    };
    
    // In real app: hash password, save to database
    console.log('Creating user with password length:', password.length);
    
    return newUser;
  }
});
`,
    },
  ],
  getDependencies,
  getDevDependencies,
  scripts: {
    dev: 'NODE_ENV=development tsx --watch src/app.ts',
    build: 'tsc',
    start: 'node dist/app.js',
    'type-check': 'tsc --noEmit',
    clean: 'rimraf dist',
  },
};
