# 🔒 @blaizejs/middleware-security

> **Production-ready security headers** middleware following OWASP best practices

[![npm version](https://img.shields.io/npm/v/@blaizejs/middleware-security.svg)](https://www.npmjs.com/package/@blaizejs/middleware-security)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 🎯 Purpose

Secure your BlaizeJS applications with battle-tested HTTP security headers following OWASP best practices. Built with zero dependencies, full TypeScript support, and runtime validation via Zod.

**Key Features:**

- 🛡️ **Content Security Policy (CSP)** - Prevent XSS, clickjacking, and code injection
- 🔐 **HTTP Strict Transport Security (HSTS)** - Enforce HTTPS connections
- 🚫 **X-Frame-Options** - Protection against clickjacking
- 🔒 **X-Content-Type-Options** - Prevent MIME-sniffing attacks
- 📊 **Referrer-Policy** - Control referrer information leakage
- 🎯 **Environment-Aware** - Auto-detects dev/production for sensible defaults
- 📦 **Type-Safe** - Full TypeScript support with Zod validation
- ⚡ **Zero Overhead** - Headers computed once at initialization

## 📦 Installation

```bash
npm install @blaizejs/middleware-security
# or
pnpm add @blaizejs/middleware-security
```

## 🚀 Quick Start

### Basic Usage (Zero-Config)

```typescript
import { createServer } from 'blaizejs';
import { createSecurityMiddleware } from '@blaizejs/middleware-security';

const securityMiddleware = createSecurityMiddleware();

const server = createServer({
  port: 3000,
  routesDir: './routes',
  middleware: [securityMiddleware], // ✅ Recommended: configure at creation
});

await server.listen();
```

**Alternative: Dynamic configuration**

```typescript
// Use server.use() when you need conditional/runtime middleware
const server = createServer({ port: 3000, routesDir: './routes' });

if (process.env.ENABLE_SECURITY) {
  server.use(createSecurityMiddleware()); // Add at runtime
}

await server.listen();
```

**Zero-config defaults:**

- **Production:** Strict CSP, HSTS enabled (1 year), `X-Frame-Options: DENY`
- **Development:** Permissive CSP for debugging, HSTS disabled, `X-Frame-Options: SAMEORIGIN`
- **All Environments:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`

### Custom Configuration

```typescript
import { createServer } from 'blaizejs';
import { createSecurityMiddleware } from '@blaizejs/middleware-security';

const securityMiddleware = createSecurityMiddleware({
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.example.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameOptions: 'SAMEORIGIN',
});

const server = createServer({
  port: 3000,
  routesDir: './routes',
  middleware: [securityMiddleware],
});

await server.listen();
```

## ✨ Features

- ✅ **Content Security Policy (CSP)** - XSS and injection attack prevention
- ✅ **Report-Only Mode** - Test CSP without blocking (monitor violations)
- ✅ **HTTP Strict Transport Security (HSTS)** - Force HTTPS connections
- ✅ **X-Frame-Options** - Clickjacking protection (DENY/SAMEORIGIN)
- ✅ **X-Content-Type-Options** - Prevent MIME-sniffing
- ✅ **Referrer-Policy** - Control information leakage
- ✅ **Hide X-Powered-By** - Remove server fingerprinting
- ✅ **Environment Profiles** - Auto-detect dev/staging/production
- ✅ **Route-Level Security** - Different policies per route
- ✅ **Type-Safe Config** - Full TypeScript + Zod validation
- ✅ **Zero Dependencies** - Only peer dependency on BlaizeJS core

## 🎨 Common Patterns

### Pattern 1: Environment-Based Configuration

```typescript
import { createServer } from 'blaizejs';
import { createSecurityMiddleware } from '@blaizejs/middleware-security';
import path from 'node:path';

const securityConfig = {
  development: {
    enabled: false, // Or use relaxed settings
  },
  staging: {
    csp: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
      reportOnly: true, // Test without blocking
      reportUri: '/csp-report',
    },
  },
  production: {
    csp: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.example.com'],
      },
    },
    hsts: {
      maxAge: 63072000, // 2 years
      includeSubDomains: true,
      preload: true,
    },
  },
};

const env = process.env.NODE_ENV || 'development';
const securityMiddleware = createSecurityMiddleware(securityConfig[env]);

const server = createServer({
  port: 3000,
  routesDir: path.resolve(__dirname, './routes'),
  middleware: [securityMiddleware],
});

await server.listen();
```

### Pattern 2: Route-Specific Security

```typescript
// routes/admin/index.ts - Strict security for admin routes
import { createGetRoute } from 'blaizejs';
import { createSecurityMiddleware } from '@blaizejs/middleware-security';

const strictSecurity = createSecurityMiddleware({
  csp: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      formAction: ["'self'"],
    },
  },
  frameOptions: 'DENY',
});

export const GET = createGetRoute({
  middleware: [strictSecurity],
  handler: async ctx => {
    return { admin: true };
  },
});
```

```typescript
// routes/embed/index.ts - Relaxed security for embeddable widgets
const relaxedSecurity = createSecurityMiddleware({
  frameOptions: false, // Allow embedding
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ['*'],
    },
  },
});

export const GET = createGetRoute({
  middleware: [relaxedSecurity],
  handler: async ctx => {
    return { widget: true };
  },
});
```

### Pattern 3: Progressive CSP Rollout

```typescript
import { createServer } from 'blaizejs';
import { createSecurityMiddleware } from '@blaizejs/middleware-security';
import path from 'node:path';

// Phase 1: Report-only mode (1-2 weeks) - monitor violations
const reportOnlySecurity = createSecurityMiddleware({
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.example.com'],
    },
    reportOnly: true,
    reportUri: '/csp-report',
  },
});

const server = createServer({
  port: 3000,
  routesDir: path.resolve(__dirname, './routes'),
  middleware: [reportOnlySecurity],
});

await server.listen();

// Phase 2: Enforce after testing (update config, redeploy)
// const enforcedSecurity = createSecurityMiddleware({
//   csp: {
//     directives: {
//       defaultSrc: ["'self'"],
//       scriptSrc: ["'self'", 'https://cdn.example.com'],
//     },
//     reportOnly: false, // Now enforcing!
//   },
// });
//
// const server = createServer({
//   port: 3000,
//   routesDir: path.resolve(__dirname, './routes'),
//   middleware: [enforcedSecurity],
// });
```

---

### 💡 **When to Use Each Approach**

**✅ Use `createServer({ middleware: [...] })` (Recommended) when:**

- Middleware is always needed (like security headers)
- Configuration is static/known at startup
- You want type-safe middleware composition
- Example: Production apps with fixed middleware stack

**✅ Use `server.use(middleware)` when:**

- Middleware needs to be added conditionally
- Configuration comes from runtime sources (database, feature flags)
- You're adding middleware after server creation
- Example: Plugin systems, A/B testing, feature flags

```typescript
// Static configuration (recommended)
const server = createServer({
  middleware: [securityMiddleware, ratelimitMiddleware],
});

// Dynamic configuration (when needed)
const server = createServer();
if (process.env.ENABLE_SECURITY) {
  server.use(securityMiddleware);
}
if (await featureFlags.get('enable-rate-limit')) {
  server.use(ratelimitMiddleware);
}
```

## 📖 API Reference

### Main Export

```typescript
function createSecurityMiddleware(options?: SecurityOptions): Middleware;
```

### Key Types

```typescript
interface SecurityOptions {
  enabled?: boolean; // Master switch (default: true)
  csp?: CSPOptions | false; // Content Security Policy
  hsts?: HSTSOptions | false; // HTTP Strict Transport Security
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  noSniff?: boolean; // X-Content-Type-Options
  xssFilter?: boolean; // X-XSS-Protection (legacy)
  referrerPolicy?: ReferrerPolicyValue;
  hidePoweredBy?: boolean; // Remove X-Powered-By header
}

interface CSPOptions {
  directives?: CSPDirectives;
  reportOnly?: boolean; // Test mode (don't block)
  reportUri?: string; // Violation reporting endpoint
}

interface CSPDirectives {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  frameSrc?: string[];
  objectSrc?: string[];
  // ... and more
}

interface HSTSOptions {
  maxAge: number; // Seconds (31536000 = 1 year)
  includeSubDomains?: boolean;
  preload?: boolean; // HSTS preload list eligibility
}

type ReferrerPolicyValue =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';
```

### Error Handling

```typescript
import {
  createSecurityMiddleware,
  SecurityConfigurationError,
} from '@blaizejs/middleware-security';

try {
  server.use(
    createSecurityMiddleware({
      hsts: { maxAge: -1 }, // Invalid!
    })
  );
} catch (error) {
  if (error instanceof SecurityConfigurationError) {
    console.error(error.message);
    // "Invalid security configuration: HSTS maxAge must be positive"
    console.error(error.details); // { field: "hsts.maxAge" }
  }
}
```

## 📚 Documentation

- 📖 **[Security Guide](https://blaizejs.com/docs/guides/security)** - Complete best practices
- 🎯 **[CSP Configuration](https://blaizejs.com/docs/middleware/security/csp)** - Policy examples
- 🔐 **[HSTS Setup](https://blaizejs.com/docs/middleware/security/hsts)** - Implementation guide
- 🧪 **[Testing Security](https://blaizejs.com/docs/middleware/security/testing)** - Verify headers
- 💡 **[Real-World Examples](https://blaizejs.com/examples/security)** - SaaS, E-commerce, APIs
- 🔧 **[Troubleshooting](https://blaizejs.com/docs/middleware/security/troubleshooting)** - Common issues

## 🔗 Related Packages

- [`blaizejs`](../blaize-core) - Core BlaizeJS framework
- [`@blaizejs/middleware-rate-limit`](../middleware-rate-limit) - Rate limiting _(planned)_

## 🤝 Contributing

See [Contributing Guide](../../CONTRIBUTING.md)

## 📄 License

MIT © BlaizeJS Team
