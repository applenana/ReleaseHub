import 'dotenv/config';
import { resolve } from 'node:path';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env: ${name}`);
  return v;
}

export const config = {
  port: parseInt(required('PORT', '3001'), 10),
  host: required('HOST', '127.0.0.1'),
  databasePath: resolve(required('DATABASE_PATH', './data/releasehub.db')),
  firmwareStorageDir: resolve(required('FIRMWARE_STORAGE_DIR', './storage/firmware')),
  sessionSecret: required('SESSION_SECRET'),
  cookieSecure: required('COOKIE_SECURE', 'false') === 'true',
  maxUploadBytes: parseInt(required('MAX_UPLOAD_BYTES', '10485760'), 10),
  xAccelRedirectPrefix: process.env.XACCEL_REDIRECT_PREFIX ?? '',
  corsOrigins: required('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

if (!/^[0-9a-fA-F]{64}$/.test(config.sessionSecret)) {
  throw new Error('SESSION_SECRET must be 64 hex characters (32 bytes)');
}
