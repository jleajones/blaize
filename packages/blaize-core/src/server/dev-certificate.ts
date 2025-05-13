import * as fs from 'node:fs';
import * as path from 'node:path';

import * as selfsigned from 'selfsigned';

export interface DevCertificates {
  keyFile: string;
  certFile: string;
}

export async function generateDevCertificates(): Promise<DevCertificates> {
  const certDir = path.join(process.cwd(), '.blaizejs', 'certs');
  const keyPath = path.join(certDir, 'dev.key');
  const certPath = path.join(certDir, 'dev.cert');
  
  // Check if certificates already exist
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      keyFile: keyPath,
      certFile: certPath
    };
  }
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }
  
  // Generate self-signed certificate
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const options = {
    days: 365,
    algorithm: 'sha256',
    keySize: 2048,
    extensions: [
      { name: 'basicConstraints', cA: true },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' }
        ]
      }
    ]
  };
  
  // Generate the certificates
  const pems = selfsigned.generate(attrs, options);
  
  // Write the key and certificate to files
  fs.writeFileSync(keyPath, Buffer.from(pems.private, 'utf-8'));
  fs.writeFileSync(certPath, Buffer.from(pems.cert, 'utf-8'));
  
  console.log(`\n🔒 Generated self-signed certificates for development at ${certDir}\n`);
  
  return {
    keyFile: keyPath,
    certFile: certPath
  };
}