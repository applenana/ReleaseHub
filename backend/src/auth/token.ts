import { createHash, randomBytes } from 'node:crypto';

// 生成原始 token：以 rh_ 开头，便于识别
export function generateRawToken(): string {
  return 'rh_' + randomBytes(24).toString('base64url');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function tokenPrefix(raw: string): string {
  return raw.slice(0, 11); // 'rh_' + 8 chars
}
