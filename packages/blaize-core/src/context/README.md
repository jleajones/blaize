# BlaizeJS Context Module

The Context Module is a core component of BlaizeJS that provides request-scoped context management. It leverages Node.js AsyncLocalStorage to make the current request context available throughout the request lifecycle without explicitly passing it through function parameters.

## Files

- `types.ts` - Type definitions for the Context API
- `store.ts` - AsyncLocalStorage implementation for context storage and retrieval
- `create.ts` - Context creation and initialization
- `state.ts` - State management utilities for the request context

## Key Features

### Context Management

The Context Module provides a unified interface for handling both HTTP/1.1 and HTTP/2 requests, giving you:

- Access to request and response objects
- Helper methods for common response patterns
- Type-safe state management
- Protocol detection (HTTP vs HTTPS, HTTP/1.1 vs HTTP/2)

```typescript
// Access the current context from anywhere in your request pipeline
import { getContext } from '@blaizejs/core/context';

function someBusinessLogic() {
  const ctx = getContext();
  if (!ctx) return;
  
  // Access request information
  const { method, path } = ctx.request;
  
  // Send a response
  ctx.response.json({ success: true });
}
```

### State Management

The Context Module provides a powerful state management system for storing and retrieving data during the request lifecycle:

```typescript
// Simple state access
import { getState, setState } from '@blaizejs/core/context';

// Store and retrieve values
setState('user.id', '123');
const userId = getState('user.id');

// Create namespaced state to avoid collisions
import { createNamespacedState } from '@blaizejs/core/context';

const userState = createNamespacedState('user');
userState.set('name', 'Alice');
userState.set('role', 'admin');
const userName = userState.get('name'); // 'Alice'

// Type-safe state access with TypeScript
import { createTypedState } from '@blaizejs/core/context';

interface UserState {
  id: string;
  name: string;
  role: string;
  preferences: {
    theme: 'light' | 'dark';
    language: string;
  };
  [key: string]: unknown;
}

const typedUserState = createTypedState<UserState>('user');
typedUserState.set('id', '123');
typedUserState.set('name', 'Bob');
typedUserState.set('role', 'admin');
typedUserState.set('preferences', { theme: 'dark', language: 'en' });

// TypeScript will catch this error:
// typedUserState.set('invalid', true); // Error: Property 'invalid' does not exist on type 'UserState'
```

## Usage

### Creating a Context

Typically, you won't need to create contexts manually as BlaizeJS handles this for you in the request pipeline. However, if you need to create one:

```typescript
import { createContext } from '@blaizejs/core/context';

// Create a context for a request/response pair
const ctx = await createContext(req, res, {
  parseBody: true,  // Optional: Parse request body
  initialState: { /* Initial state values */ }
});
```

### Running Code with Context

To ensure code has access to the current context:

```typescript
import { runWithContext } from '@blaizejs/core/context';

// Run a function with context
await runWithContext(ctx, async () => {
  // Any code here can access the context with getContext()
  await someBusinessLogic();
});
```

### Context in Middleware

BlaizeJS automatically sets up the context for middleware. Your middleware functions can access the context directly:

```typescript
// Middleware function
async function authMiddleware(ctx, next) {
  const token = ctx.request.header('authorization');
  if (!token) {
    return ctx.response.json({ error: 'Unauthorized' }, 401);
  }
  
  // Store user information in state
  setState('user.authenticated', true);
  setState('user.token', token);
  
  await next();
}
```

## Type-Safe State

The state management system provides type safety to prevent common errors:

```typescript
// Create a typed state namespace
interface SessionState {
  id: string;
  user: {
    id: string;
    permissions: string[];
  };
  expires: Date;
  [key: string]: unknown;
}

const sessionState = createTypedState<SessionState>('session');

// TypeScript enforces the correct types
sessionState.set('id', '123'); // OK
sessionState.set('user', { id: 'user123', permissions: ['read', 'write'] }); // OK
sessionState.set('expires', new Date(Date.now() + 3600000)); // OK

// These would cause TypeScript errors:
// sessionState.set('id', 123); // Error: Type 'number' is not assignable to type 'string'
// sessionState.set('invalid', true); // Error: Property 'invalid' does not exist on type 'SessionState'
```

## Best Practices

1. **Use the context helpers**: Rather than accessing raw request/response objects, use the context helpers for cleaner code.

2. **Leverage namespaced state**: Use namespaced or typed state to avoid collisions between different parts of your application.

3. **Check for context existence**: When accessing the context outside of middleware, always check if it exists.

4. **Keep state data clean**: Store only what you need in the state and clean it up when you're done.

5. **Avoid circular references**: Don't store values in state that can't be easily serialized.

## Advanced Usage

### Custom Context Factories

Create context factories with specific default options:

```typescript
import { createContextFactory } from '@blaizejs/core/context';

// Create a factory with default options
const createApiContext = createContextFactory({
  parseBody: true,
  initialState: {
    'api.version': '1.0',
    'api.startTime': Date.now()
  }
});

// Use the factory
const ctx = await createApiContext(req, res);
```

### Binding to Context

Preserve the current context across asynchronous boundaries:

```typescript
import { bindContext } from '@blaizejs/core/context';

// Bind a function to the current context
const boundFunction = bindContext(async () => {
  // This function will have access to the same context
  // even when called later or in a different async context
  const ctx = getContext();
  // ...
});

// Later, in a different async context:
await boundFunction(); // Still has access to the original context
```

## Integration with Other Modules

The Context Module integrates with other BlaizeJS modules:

- **Router Module**: Maps routes to handlers and provides them with context
- **Middleware Module**: Ensures middleware functions have access to context
- **Plugin Module**: Plugins can store and access state data via the context

## Internal Architecture

For contributors and those interested in the internals:

- **AsyncLocalStorage**: The module uses Node.js AsyncLocalStorage to store context
- **Factory Pattern**: Context creation follows a factory pattern for flexibility
- **Composition over Inheritance**: The module uses composition rather than inheritance
- **Functional Approach**: Most utilities follow a functional programming style