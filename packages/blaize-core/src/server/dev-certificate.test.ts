import * as fs from 'node:fs';
import * as path from 'node:path';

import { generateDevCertificates } from './dev-certificate';

// Mock the fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('mock-certificate-data')),
}));

describe('Development Certificates', () => {
  const certDir = path.join(process.cwd(), '.blaizejs', 'certs');
  const keyPath = path.join(certDir, 'dev.key');
  const certPath = path.join(certDir, 'dev.cert');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should generate certificates if they do not exist', async () => {
    // Mock that certificates don't exist
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const certs = await generateDevCertificates();

    // Ensure directory is created
    expect(fs.mkdirSync).toHaveBeenCalledWith(certDir, { recursive: true });

    // Ensure certificates are written
    expect(fs.writeFileSync).toHaveBeenCalledWith(keyPath, expect.any(Buffer));
    expect(fs.writeFileSync).toHaveBeenCalledWith(certPath, expect.any(Buffer));

    // Ensure paths are returned
    expect(certs).toEqual({
      keyFile: keyPath,
      certFile: certPath,
    });
  });

  it('should use existing certificates if they exist', async () => {
    // Mock that certificates exist
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const certs = await generateDevCertificates();

    // Directory should not be created
    expect(fs.mkdirSync).not.toHaveBeenCalled();

    // Certificates should not be written
    expect(fs.writeFileSync).not.toHaveBeenCalled();

    // Should return paths to existing certificates
    expect(certs).toEqual({
      keyFile: keyPath,
      certFile: certPath,
    });
  });
});
