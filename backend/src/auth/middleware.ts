import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/index.js';
import { hashToken } from './token.js';

declare module '@fastify/secure-session' {
  interface SessionData {
    adminId: number;
    username: string;
  }
}

export interface AdminContext {
  id: number;
  username: string;
}

export interface ApiTokenContext {
  id: number;
  name: string;
  scope: 'read' | 'write';
}

declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminContext;
    apiToken?: ApiTokenContext;
  }
}

/** 仅允许已登录管理员 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const adminId = req.session.get('adminId');
  const username = req.session.get('username');
  if (!adminId || !username) {
    return reply.code(401).send({ error: 'unauthorized', message: '需要登录' });
  }
  req.admin = { id: adminId, username };
}

/** 接受 Bearer API Token；或者已登录管理员 */
export async function requireAdminOrToken(req: FastifyRequest, reply: FastifyReply) {
  const adminId = req.session.get('adminId');
  const username = req.session.get('username');
  if (adminId && username) {
    req.admin = { id: adminId, username };
    return;
  }
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'unauthorized', message: '缺少凭证' });
  }
  const raw = auth.slice(7).trim();
  const hash = hashToken(raw);
  const row = db
    .prepare(
      `SELECT id, name, scope, revoked FROM api_tokens WHERE token_hash = ?`,
    )
    .get(hash) as
    | { id: number; name: string; scope: 'read' | 'write'; revoked: number }
    | undefined;
  if (!row || row.revoked) {
    return reply.code(401).send({ error: 'invalid_token' });
  }
  db.prepare('UPDATE api_tokens SET last_used_at = unixepoch() WHERE id = ?').run(row.id);
  req.apiToken = { id: row.id, name: row.name, scope: row.scope };
}

/** 写权限：管理员 或 scope=write 的 token */
export async function requireWrite(req: FastifyRequest, reply: FastifyReply) {
  await requireAdminOrToken(req, reply);
  if (reply.sent) return;
  if (req.apiToken && req.apiToken.scope !== 'write') {
    return reply.code(403).send({ error: 'forbidden', message: 'token 仅有读权限' });
  }
}
