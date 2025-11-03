# 🛡️ @blaizejs/security

> Security middleware for BlaizeJS applications

🚧 **Work in Progress** 🚧

This package is currently under active development.

## Features (Planned)

- 🛡️ Content Security Policy (CSP) with 8 core directives
- 🔒 HTTP Strict Transport Security (HSTS)
- 🚫 X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- 📋 Environment-aware defaults (development vs production)
- ⚡ Zero-config with sensible defaults
- 🎯 4 preset configurations
- 🔍 Audit mode for testing configurations

## Installation

```bash
pnpm add @blaizejs/security
```

## Quick Start

```typescript
import { createServer } from 'blaizejs';
import { security } from '@blaizejs/security';

const server = createServer({ port: 3000 });
server.use(security()); // Zero-config with environment detection
await server.listen();
```

## Documentation

Full documentation coming soon...

## License

MIT © BlaizeJS Team
