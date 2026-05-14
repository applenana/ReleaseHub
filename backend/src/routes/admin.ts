import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth/middleware.js';
import { verifyPassword } from '../auth/password.js';
import { generateRawToken, hashToken, tokenPrefix } from '../auth/token.js';
import { db } from '../db/index.js';
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  moveCategory,
  updateCategory,
} from '../services/category.js';
import { deleteFirmware, updateFirmware } from '../services/firmware.js';

export default async function adminRoutes(app: FastifyInstance) {
  // ===== 认证 =====
  app.post<{ Body: { username: string; password: string } }>(
    '/api/admin/login',
    async (req, reply) => {
      const { username, password } = req.body ?? ({} as any);
      if (!username || !password) {
        return reply.code(400).send({ error: 'bad_request' });
      }
      const admin = db
        .prepare(`SELECT id, username, password_hash FROM admins WHERE username = ?`)
        .get(username) as { id: number; username: string; password_hash: string } | undefined;
      if (!admin) return reply.code(401).send({ error: 'invalid_credentials' });
      const ok = await verifyPassword(admin.password_hash, password);
      if (!ok) return reply.code(401).send({ error: 'invalid_credentials' });
      req.session.set('adminId', admin.id);
      req.session.set('username', admin.username);
      db.prepare(`UPDATE admins SET last_login_at = unixepoch() WHERE id = ?`).run(admin.id);
      return { id: admin.id, username: admin.username };
    },
  );

  app.post('/api/admin/logout', async (req) => {
    req.session.delete();
    return { ok: true };
  });

  app.get('/api/admin/me', { preHandler: requireAdmin }, async (req) => {
    return req.admin;
  });

  // ===== 分类 =====
  app.post<{
    Body: {
      parent_id: number | null;
      name: string;
      slug?: string;
      description?: string | null;
      sort_order?: number;
    };
  }>('/api/admin/categories', { preHandler: requireAdmin }, async (req, reply) => {
    try {
      return createCategory(req.body);
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  app.patch<{ Params: { id: string }; Body: any }>(
    '/api/admin/categories/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10);
      const body = (req.body ?? {}) as any;
      try {
        if ('parent_id' in body) {
          moveCategory(id, body.parent_id);
        }
        return updateCategory(id, body);
      } catch (e: any) {
        return reply.code(400).send({ error: e.message });
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/admin/categories/:id',
    { preHandler: requireAdmin },
    async (req) => {
      deleteCategory(parseInt(req.params.id, 10));
      return { ok: true };
    },
  );

  // ===== 通道 =====
  app.post<{
    Body: { key: string; label: string; color?: string; description?: string; sort_order?: number };
  }>('/api/admin/channels', { preHandler: requireAdmin }, async (req, reply) => {
    const { key, label, color, description, sort_order } = req.body;
    if (!key || !label) return reply.code(400).send({ error: 'bad_request' });
    const info = db
      .prepare(
        `INSERT INTO channels (key, label, color, description, sort_order) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(key, label, color ?? '#1890ff', description ?? null, sort_order ?? 0);
    return db.prepare(`SELECT * FROM channels WHERE id = ?`).get(info.lastInsertRowid);
  });

  app.patch<{ Params: { id: string }; Body: any }>(
    '/api/admin/channels/:id',
    { preHandler: requireAdmin },
    async (req) => {
      const id = parseInt(req.params.id, 10);
      const body = (req.body ?? {}) as any;
      const fields = ['label', 'color', 'description', 'sort_order'];
      const sets: string[] = [];
      const params: any[] = [];
      for (const k of fields) {
        if (k in body) {
          sets.push(`${k} = ?`);
          params.push(body[k]);
        }
      }
      if (sets.length) {
        params.push(id);
        db.prepare(`UPDATE channels SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      }
      return db.prepare(`SELECT * FROM channels WHERE id = ?`).get(id);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/admin/channels/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const id = parseInt(req.params.id, 10);
      const inUse = (db.prepare(`SELECT COUNT(*) AS n FROM firmwares WHERE channel_id = ?`).get(id) as { n: number }).n;
      if (inUse) return reply.code(400).send({ error: 'channel_in_use' });
      db.prepare(`DELETE FROM channels WHERE id = ?`).run(id);
      return { ok: true };
    },
  );

  // ===== 标签 =====
  app.post<{ Body: { name: string; color?: string; description?: string } }>(
    '/api/admin/tags',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { name, color, description } = req.body;
      if (!name) return reply.code(400).send({ error: 'bad_request' });
      try {
        const info = db
          .prepare(`INSERT INTO tags (name, color, description) VALUES (?, ?, ?)`)
          .run(name, color ?? '#52c41a', description ?? null);
        return db.prepare(`SELECT * FROM tags WHERE id = ?`).get(info.lastInsertRowid);
      } catch (e: any) {
        return reply.code(400).send({ error: e.message });
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: any }>(
    '/api/admin/tags/:id',
    { preHandler: requireAdmin },
    async (req) => {
      const id = parseInt(req.params.id, 10);
      const body = (req.body ?? {}) as any;
      const fields = ['name', 'color', 'description'];
      const sets: string[] = [];
      const params: any[] = [];
      for (const k of fields) {
        if (k in body) {
          sets.push(`${k} = ?`);
          params.push(body[k]);
        }
      }
      if (sets.length) {
        params.push(id);
        db.prepare(`UPDATE tags SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      }
      return db.prepare(`SELECT * FROM tags WHERE id = ?`).get(id);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/admin/tags/:id',
    { preHandler: requireAdmin },
    async (req) => {
      db.prepare(`DELETE FROM tags WHERE id = ?`).run(parseInt(req.params.id, 10));
      return { ok: true };
    },
  );

  // ===== 固件编辑 / 删除（上传见 upload.ts，写权限可走 token） =====
  app.patch<{ Params: { id: string }; Body: any }>(
    '/api/admin/firmwares/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      try {
        return updateFirmware(parseInt(req.params.id, 10), req.body ?? {});
      } catch (e: any) {
        return reply.code(400).send({ error: e.message });
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/admin/firmwares/:id',
    { preHandler: requireAdmin },
    async (req) => {
      deleteFirmware(parseInt(req.params.id, 10));
      return { ok: true };
    },
  );

  // ===== API Token 管理 =====
  app.get('/api/admin/tokens', { preHandler: requireAdmin }, async () => {
    return db
      .prepare(
        `SELECT id, name, token_prefix, scope, created_at, last_used_at, revoked
         FROM api_tokens ORDER BY id DESC`,
      )
      .all();
  });

  app.post<{ Body: { name: string; scope?: 'read' | 'write' } }>(
    '/api/admin/tokens',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const { name, scope } = req.body;
      if (!name) return reply.code(400).send({ error: 'bad_request' });
      const raw = generateRawToken();
      const hash = hashToken(raw);
      const prefix = tokenPrefix(raw);
      const info = db
        .prepare(
          `INSERT INTO api_tokens (name, token_hash, token_prefix, scope) VALUES (?, ?, ?, ?)`,
        )
        .run(name, hash, prefix, scope ?? 'write');
      return {
        id: info.lastInsertRowid,
        name,
        scope: scope ?? 'write',
        token_prefix: prefix,
        token: raw, // 仅此一次返回明文
      };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/admin/tokens/:id',
    { preHandler: requireAdmin },
    async (req) => {
      db.prepare(`UPDATE api_tokens SET revoked = 1 WHERE id = ?`).run(
        parseInt(req.params.id, 10),
      );
      return { ok: true };
    },
  );
}
