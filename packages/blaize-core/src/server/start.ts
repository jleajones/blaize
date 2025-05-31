import * as fs from 'node:fs';
import * as http from 'node:http';
import * as http2 from 'node:http2';

import { Http2Options, Server, ServerOptions } from '@blaizejs/types';

import { generateDevCertificates } from './dev-certificate';
import { createRequestHandler } from './request-handler';

// Extract certificate handling to a separate function
async function prepareCertificates(
  http2Options: Http2Options
): Promise<{ keyFile?: string; certFile?: string }> {
  // Not using HTTP/2? No certificates needed
  if (!http2Options.enabled) {
    return {};
  }

  const { keyFile, certFile } = http2Options;

  // If certificates are missing and in development, generate them
  const isDevMode = process.env.NODE_ENV === 'development';
  const certificatesMissing = !keyFile || !certFile;

  if (certificatesMissing && isDevMode) {
    const devCerts = await generateDevCertificates();
    return devCerts;
  }

  // If certificates are still missing, throw error
  if (certificatesMissing) {
    throw new Error(
      'HTTP/2 requires SSL certificates. Provide keyFile and certFile in http2 options. ' +
        'In development, set NODE_ENV=development to generate them automatically.'
    );
  }

  return { keyFile, certFile };
}

// Create server based on protocol
function createServerInstance(
  isHttp2: boolean,
  certOptions: { keyFile?: string; certFile?: string }
): http.Server | http2.Http2SecureServer {
  if (!isHttp2) {
    return http.createServer();
  }

  // Create HTTP/2 server options
  const http2ServerOptions: http2.SecureServerOptions = {
    allowHTTP1: true, // Allow fallback to HTTP/1.1
  };

  // Read certificate files
  try {
    if (certOptions.keyFile) {
      http2ServerOptions.key = fs.readFileSync(certOptions.keyFile);
    }
    if (certOptions.certFile) {
      http2ServerOptions.cert = fs.readFileSync(certOptions.certFile);
    }
  } catch (err) {
    throw new Error(
      `Failed to read certificate files: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return http2.createSecureServer(http2ServerOptions);
}

// Start listening on the specified port and host
function listenOnPort(
  server: http.Server | http2.Http2SecureServer,
  port: number,
  host: string,
  isHttp2: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      const protocol = isHttp2 ? 'https' : 'http';
      const url = `${protocol}://${host}:${port}`;
      console.log(`
🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥

    ⚡ BlaizeJS DEVELOPMENT SERVER HOT AND READY ⚡
    
    🚀 Server: ${url}
    🔥 Hot Reload: Enabled
    🛠️  Mode: Development
    
    Time to build something amazing! 🚀

🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
`);
      resolve();
    });

    server.on('error', err => {
      console.error('Server error:', err);
      reject(err);
    });
  });
}

async function initializePlugins(serverInstance: Server): Promise<void> {
  for (const plugin of serverInstance.plugins) {
    if (typeof plugin.initialize === 'function') {
      await plugin.initialize(serverInstance);
    }
  }
}

// Main server start function - now with much lower complexity
export async function startServer(
  serverInstance: Server,
  serverOptions: ServerOptions
): Promise<void> {
  // Server already running? Do nothing.
  if (serverInstance.server) {
    return;
  }

  try {
    // Get effective port and host
    const port = serverOptions.port;
    const host = serverOptions.host;

    // Initialize all registered plugins
    await initializePlugins(serverInstance);

    // Determine if using HTTP/2
    const http2Options = serverOptions.http2 || { enabled: true };
    const isHttp2 = !!http2Options.enabled;

    // Prepare certificates if needed
    const certOptions = await prepareCertificates(http2Options);

    // Update the server options if we generated certificates
    if (serverOptions.http2 && certOptions.keyFile && certOptions.certFile) {
      serverOptions.http2.keyFile = certOptions.keyFile;
      serverOptions.http2.certFile = certOptions.certFile;
    }

    // Create the server instance
    const server = createServerInstance(isHttp2, certOptions);

    // Store the server in the instance
    serverInstance.server = server;

    // Update server instance properties
    serverInstance.port = port;
    serverInstance.host = host;

    // Configure request handling
    const requestHandler = createRequestHandler(serverInstance);
    server.on('request', requestHandler);

    // Start listening
    await listenOnPort(server, port, host, isHttp2);
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}
