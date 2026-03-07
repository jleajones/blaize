# @blaizejs/middleware-compression

Production-ready HTTP compression middleware for [BlaizeJS](https://github.com/jleajones/blaize). Supports **gzip**, **deflate**, **Brotli**, and **Zstandard** with automatic content negotiation, configurable presets, and graceful runtime fallback.

## Installation

```bash
# pnpm (recommended)
pnpm add @blaizejs/middleware-compression

# npm
npm install @blaizejs/middleware-compression
```

> **Peer dependency:** `blaizejs` must be installed in your project (`^0.9.2`).

## Quick Start

```ts
// src/app.ts
import path from 'node:path';
import { Blaize } from 'blaizejs';
import { compression } from '@blaizejs/middleware-compression';

const server = Blaize.createServer({
  port: 3000,
  routesDir: path.resolve(__dirname, './routes'),
  middleware: [
    compression(), // Zero-config — uses sensible defaults
  ],
});

await server.listen();
```

```ts
// src/routes/hello.ts
import { route } from '../app';

export const getHello = route.get({
  handler: async () => ({
    message: 'Hello, compressed world!',
  }),
});
```

## Configuration Reference

Pass a `CompressionOptions` object to customise behaviour:

```ts
compression({
  algorithms: ['br', 'gzip'],
  level: 'best',
  threshold: 512,
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `algorithms` | `CompressionAlgorithm[]` | `['zstd','br','gzip','deflate']` | Preferred algorithm order for negotiation. |
| `level` | `'fastest' \| 'default' \| 'best' \| number` | `'default'` | Compression level — named preset or numeric value clamped to the algorithm's valid range. |
| `threshold` | `number` | `1024` | Minimum response size in bytes before compression is applied. |
| `contentTypeFilter` | `boolean \| function \| { include?, exclude? }` | Built-in list | Filter which MIME types are compressed. Supports wildcard patterns (e.g., `text/*`) in `include`/`exclude` arrays. |
| `skip` | `(ctx: Context) => boolean \| Promise<boolean>` | — | Return `true` to skip compression for a request. |
| `vary` | `boolean` | `true` | Whether to set the `Vary: Accept-Encoding` response header. |
| `flush` | `boolean` | `false` | Flush compression buffers after each write. Useful for streaming. |
| `memoryLevel` | `number` (1–9) | `8` | Memory allocation level. **Only affects gzip and deflate.** |
| `windowBits` | `number` | — | Window size for zlib-based algorithms (gzip/deflate). |
| `brotliQuality` | `number` (0–11) | — | Brotli-specific quality override. |
| `preset` | `CompressionPreset` | — | Use a named preset (see below). |

## Presets

Five built-in presets cover common use cases. Use them directly or via convenience factories:

```ts
import {
  compression,
  compressionFast,
  compressionBest,
  compressionTextOnly,
  compressionStreaming,
  getCompressionPreset,
} from '@blaizejs/middleware-compression';

// Via preset option — pass in middleware array
compression({ preset: 'fast' })

// Via convenience factory
compressionFast()

// Via getCompressionPreset helper
compression(getCompressionPreset('best'))
```

| Preset | `threshold` | `level` | `flush` | `contentTypeFilter` | Use Case |
|---|---|---|---|---|---|
| `default` | 1024 | `'default'` | `false` | — | Balanced default for most apps. |
| `fast` | 1024 | `'fastest'` | `false` | — | Low-latency APIs where CPU is constrained. |
| `best` | 512 | `'best'` | `false` | — | Maximum compression ratio (static assets, infrequent responses). |
| `text-only` | 1024 | `'default'` | `false` | `{ include: ['text/*'] }` | Only compress text content types; skip binary payloads. |
| `streaming` | 0 | `'default'` | `true` | — | Streaming responses where `Content-Length` is unknown. |

## Per-Route Configuration

Override compression settings on individual routes using the `middleware` option in route definitions:

```ts
// src/routes/reports/[reportId].ts
import { route } from '../../app';
import { compression } from '@blaizejs/middleware-compression';

export const getReport = route.get({
  middleware: [compression({ level: 'best', threshold: 256 })],
  handler: async ({ params }) => {
    return generateReport(params.reportId);
  },
});
```

```ts
// src/routes/api/realtime/feed.ts
import { route } from '../../../app';
import { compressionFast } from '@blaizejs/middleware-compression';

export const getFeed = route.get({
  middleware: [compressionFast()],
  handler: async () => {
    return getRealtimeFeed();
  },
});
```

## Flush Modes

The `flush` option controls how aggressively compression buffers are flushed. This matters most for streaming responses.

| Value | Behaviour | Trade-off |
|---|---|---|
| `false` | No explicit flushing (default). | Best compression ratio; data may be buffered. |
| `true` | `Z_SYNC_FLUSH` after each write. | Lower latency for streamed chunks; slightly worse ratio. |

## Logging

Compression events are logged through BlaizeJS's built-in logger at the **debug** level. Set your server's log level to `debug` to see compression diagnostics:

```
Compression skipped  { reason: 'below-threshold' }
Compressed response  { algorithm: 'br', originalSize: 14280, compressedSize: 3912, ratio: 0.274 }
```

Error-level logs are emitted when compression fails (the response is sent uncompressed as a fallback):

```
Compression failed, sending uncompressed  { error: '...', algorithm: 'gzip' }
```

## Algorithm Notes

| Algorithm | Encoding | Node.js Requirement | Notes |
|---|---|---|---|
| **Zstandard** | `zstd` | 22.15.0+ / 24.0.0+ | Best ratio + speed. Falls back gracefully if `zlib.createZstdCompress` is unavailable. |
| **Brotli** | `br` | 10.16.0+ | Excellent ratio for text. Available on all modern Node.js versions. |
| **gzip** | `gzip` | All | Universally supported. Good baseline. |
| **deflate** | `deflate` | All | Similar to gzip, slightly less overhead. |

### Fallback Chain

When the middleware is created, `detectAvailableAlgorithms` checks which algorithms are available in the current Node.js runtime. Unavailable algorithms (e.g., `zstd` on Node.js < 22.15) are excluded from negotiation. At request time, the client's `Accept-Encoding` header is matched against the remaining available algorithms in priority order. If no match is found, the response is sent uncompressed. If compression fails at runtime, the response falls back to uncompressed delivery and the error is logged.

## Middleware Placement

Compression middleware should be registered **early** in the middleware chain — before any middleware that sends responses.

```ts
const server = Blaize.createServer({
  port: 3000,
  routesDir: path.resolve(__dirname, './routes'),
  middleware: [
    // ✅ Compression FIRST — order matters
    compression(),
    authMiddleware,
    rateLimitMiddleware,
  ],
});
```

The middleware works by wrapping `ctx.response.json`, `ctx.response.text`, `ctx.response.html`, and `ctx.response.stream` **before** `next()` is called. If registered too late (after a middleware that already sends the response), responses go out uncompressed — this is a silent failure. This follows the same pattern as Express's `compression()` middleware.

## HTTP/2

No special handling is needed. The compression middleware works transparently with HTTP/2 connections — content negotiation via `Accept-Encoding` operates identically regardless of protocol version.

## API Reference

### Exports

| Export | Type | Description |
|---|---|---|
| `compression(options?)` | `(options?: CompressionOptions) => Middleware` | Main factory — creates a compression middleware instance. |
| `compressionFast()` | `() => Middleware` | Convenience factory using the `fast` preset. |
| `compressionBest()` | `() => Middleware` | Convenience factory using the `best` preset. |
| `compressionTextOnly()` | `() => Middleware` | Convenience factory using the `text-only` preset. |
| `compressionStreaming()` | `() => Middleware` | Convenience factory using the `streaming` preset. |
| `getCompressionPreset(name)` | `(name: CompressionPreset) => CompressionOptions` | Returns the options object for a named preset. |
| `compressionPresets` | `Record<CompressionPreset, CompressionOptions>` | Direct access to all preset option objects. |

## License

MIT
