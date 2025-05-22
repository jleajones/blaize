# BlaizeJS Router Module

The BlaizeJS Router Module provides a modern, file-based routing system with built-in TypeScript support, parameter extraction, and schema validation.

## Overview

The BlaizeJS Router enables:

- **File-based routing**: Files in your routes directory automatically become API endpoints
- **Type-safe route definitions**: Full TypeScript support for parameters, handlers, and responses
- **Schema validation**: Integration with Zod (or similar) for request/response validation
- **Parameter extraction**: Automatic extraction of route parameters from file paths
- **Middleware integration**: Apply middleware at the route level

## Installation

The router module is part of the BlaizeJS framework:

```bash
npm install blaizejs
```

## Basic Usage

### Creating Routes

Create route files in your `routes` directory:

```typescript
// routes/hello.ts
import { createRoute } from 'blaizejs';

export default createRoute({
  GET: {
    handler: () => {
      return { message: "Hello, World!" };
    }
  }
});
```

This creates a GET endpoint at `/hello` that returns a JSON response.

### Dynamic Parameters

Include dynamic segments in file paths using square brackets:

```
routes/users/[id].ts → /users/:id
```

Access parameters in your handler:

```typescript
// routes/users/[id].ts
import { createRoute } from 'blaizejs';

export default createRoute({
  GET: {
    handler: ({ params }) => {
      return { id: params.id };
    }
  }
});
```

### Multiple HTTP Methods

Handle different HTTP methods in the same route file:

```typescript
// routes/users/[id].ts
import { createRoute } from 'blaizejs';
import { z } from 'zod';

export default createRoute({
  GET: {
    handler: async ({ params }) => {
      const user = await getUserById(params.id);
      return user;
    }
  },
  
  PUT: {
    schema: {
      body: z.object({
        name: z.string()
      })
    },
    handler: async ({ params, body }) => {
      const updatedUser = await updateUser(params.id, body);
      return updatedUser;
    }
  },
  
  DELETE: {
    handler: async ({ params }) => {
      await deleteUser(params.id);
      return { success: true };
    }
  }
});
```

### Using Schema Validation

Add validation for request and response data:

```typescript
// routes/users/index.ts
import { createRoute } from 'blaizejs';
import { z } from 'zod';

export default createRoute({
  POST: {
    schema: {
      body: z.object({
        name: z.string().min(2),
        email: z.string().email(),
        age: z.number().min(18).optional()
      }),
      response: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string()
      })
    },
    handler: async ({ body }) => {
      const id = generateId();
      const user = await createUser({ id, ...body });
      return { id, name: user.name, email: user.email };
    }
  }
});
```

### Applying Middleware

Apply middleware to specific routes:

```typescript
// routes/admin/dashboard.ts
import { createRoute } from 'blaizejs';
import { authMiddleware } from '../../middleware/auth';

export default createRoute({
  GET: {
    middleware: [authMiddleware],
    handler: ({ state }) => {
      // Only accessible after passing auth middleware
      const user = state.user;
      return { user, dashboard: { stats: [/*...*/] } };
    }
  }
});
```

## Route Handler Context

Route handlers receive a context object with:

```typescript
handler: async ({
  // The full context object
  ctx,
  
  // Route parameters (from file path)
  params,
  
  // Query parameters (?key=value)
  query,
  
  // Request body (for POST, PUT, etc.)
  body,
  
  // Request object with headers, etc.
  request,
  
  // Response object with methods like status(), json(), etc.
  response,
  
  // State storage for the request lifecycle
  state
}) => {
  // Handler implementation
}
```

## Advanced Usage

### Index Routes

Files named `index.ts` or `index.js` map to their parent directory:

```
routes/products/index.ts → /products
```

### Route Options

Pass additional options when creating routes:

```typescript
import { createRoute } from 'blaizejs';

export default createRoute(
  {
    GET: { handler: () => ({ message: "Hello" }) }
  },
  {
    // Route options
    basePath: '/api' // Prefixes the route path
  }
);
```

### Error Handling

Errors thrown in route handlers are automatically caught and formatted:

```typescript
import { createRoute } from 'blaizejs';

export default createRoute({
  GET: {
    handler: () => {
      throw new Error('Something went wrong');
      // Results in a 500 response with error details
    }
  }
});
```

### Type-Safe Handlers

Leverage TypeScript for fully type-safe route handlers:

```typescript
import { createRoute } from 'blaizejs';
import { z } from 'zod';

// Define your schemas
const userParams = z.object({ id: z.string() });
const userResponse = z.object({ id: z.string(), name: z.string() });

// TypeScript will infer the types from the schemas
export default createRoute({
  GET: {
    schema: {
      params: userParams,
      response: userResponse
    },
    handler: async ({ params }) => {
      // params is typed as { id: string }
      const user = await getUserById(params.id);
      
      // Return must match the response schema
      return { id: params.id, name: user.name };
    }
  }
});
```

## Router API Reference

### `createRoute`

Creates a route definition for use in route files.

```typescript
function createRoute(
  definition: RouteDefinition, 
  options?: RouteOptions
): Route;
```

#### Parameters:
- `definition`: An object mapping HTTP methods to handlers and options
- `options`: Optional route configuration

#### Usage:
```typescript
createRoute({
  GET: { handler: () => ({ message: "Hello" }) },
  POST: { handler: ({ body }) => ({ received: body }) }
}, {
  basePath: '/api'
});
```

### Types

#### `HttpMethod`
```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
```

#### `RouteHandler`
```typescript
type RouteHandler<TParams = any, TQuery = any, TBody = any, TResponse = any> = (context: {
  ctx: Context;
  params: TParams;
  query: TQuery;
  body: TBody;
  request: Context['request'];
  response: Context['response'];
  state: Context['state'];
}) => Promise<TResponse> | TResponse;
```

#### `RouteSchema`
```typescript
interface RouteSchema<TParams = any, TQuery = any, TBody = any, TResponse = any> {
  params?: any;
  query?: any;
  body?: any;
  response?: any;
}
```

#### `RouteMethodOptions`
```typescript
interface RouteMethodOptions<TParams = any, TQuery = any, TBody = any, TResponse = any> {
  handler: RouteHandler<TParams, TQuery, TBody, TResponse>;
  middleware?: Middleware[];
  schema?: RouteSchema<TParams, TQuery, TBody, TResponse>;
  options?: Record<string, any>;
}
```

#### `RouteDefinition`
```typescript
interface RouteDefinition {
  GET?: RouteMethodOptions;
  POST?: RouteMethodOptions;
  PUT?: RouteMethodOptions;
  DELETE?: RouteMethodOptions;
  PATCH?: RouteMethodOptions;
  HEAD?: RouteMethodOptions;
  OPTIONS?: RouteMethodOptions;
}
```

#### `RouteOptions`
```typescript
interface RouteOptions {
  basePath?: string;
}
```

## Internal Architecture

The router module consists of several key components:

1. **Route Discovery**: Scans the filesystem for route files
2. **Route Matching**: Matches incoming requests to route handlers
3. **Parameter Extraction**: Extracts and validates route parameters
4. **Schema Validation**: Validates request and response data
5. **Handler Execution**: Executes route handlers with middleware

For more details on the implementation, see the [BlaizeJS Router Architecture](https://blaizejs.dev/docs/architecture/router) documentation.

## Best Practices

### Organization

Organize routes by feature or resource:

```
routes/
├── users/
│   ├── index.ts       # GET/POST /users
│   ├── [id].ts        # GET/PUT/DELETE /users/:id
│   └── [id]/
│       ├── profile.ts # GET/PUT /users/:id/profile
│       └── posts.ts   # GET /users/:id/posts
├── products/
│   ├── index.ts       # GET/POST /products
│   ├── [id].ts        # GET/PUT/DELETE /products/:id
│   └── search.ts      # GET /products/search
└── auth/
    ├── login.ts       # POST /auth/login
    └── logout.ts      # POST /auth/logout
```

### Validation

Always validate user input using schemas:

```typescript
schema: {
  params: z.object({ /* ... */ }),
  query: z.object({ /* ... */ }),
  body: z.object({ /* ... */ })
}
```

### Error Handling

Use try/catch blocks for specific error handling:

```typescript
handler: async ({ params }) => {
  try {
    const result = await someOperation(params.id);
    return result;
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      throw { status: 404, message: 'Resource not found' };
    }
    throw error; // Let the framework handle other errors
  }
}
```

### Response Types

Be consistent with response formats:

```typescript
// Success response
return {
  success: true,
  data: { /* result data */ }
};

// Error response
throw {
  status: 400,
  error: 'Bad Request',
  message: 'Invalid input data'
};
```

## Next Steps

- Read the [BlaizeJS Server Documentation](https://blaizejs.dev/docs/server)
- Explore [Middleware Usage](https://blaizejs.dev/docs/middleware)
- Learn about [Schema Validation](https://blaizejs.dev/docs/validation)
- See [Type Safety Examples](https://blaizejs.dev/docs/typescript)