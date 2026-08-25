import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const envPath = resolve(root, '.env');
const dataDir = resolve(root, 'data');
const certDir = resolve(root, 'certs');

mkdirSync(dataDir, { recursive: true });
mkdirSync(certDir, { recursive: true });

if (!existsSync(envPath)) {
  const key = randomBytes(32).toString('base64');
  writeFileSync(
    envPath,
    [
      'DATABASE_URL="file:../data/nightingale.db"',
      `DATA_ENCRYPTION_KEY="${key}"`,
      'DEMO_MODE="true"',
      'SESSION_COOKIE_SECURE="false"',
      'APP_ORIGIN="http://localhost:3000"',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  console.log('Created local environment configuration.');
} else {
  console.log('Kept existing local environment configuration.');
}

const keyPath = resolve(certDir, 'localhost-key.pem');
const certPath = resolve(certDir, 'localhost-cert.pem');

if (!existsSync(keyPath) || !existsSync(certPath)) {
  execFileSync('/usr/bin/openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-sha256',
    '-days',
    '30',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost,IP:127.0.0.1',
    '-keyout',
    keyPath,
    '-out',
    certPath,
  ], { stdio: 'ignore' });
  console.log('Created local HTTPS certificate.');
}
