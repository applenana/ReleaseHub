import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { buildTree, listAllCategories } from '../services/category.js';
import {
  getFirmwareById,
  incrementDownload,
  listFirmwares,
} from '../services/firmware.js';
import { resolveStoredPath, readStoredStream } from '../services/storage.js';

function parseIdList(v: unknown): number[] | undefined {
  if (v == null || v === '') return undefined;
  const s = Array.isArray(v) ? v.join(',') : String(v);
  const out = s
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return out.length ? out : undefined;
}

export default async function publicRoutes(app: FastifyInstance) {
  app.get('/api/categories', async () => {
    const rows = listAllCategories();
    return { flat: rows, tree: buildTree(rows) };
  });

  app.get('/api/channels', async () => {
    return db
      .prepare(`SELECT * FROM channels ORDER BY sort_order, id`)
      .all();
  });

  app.get('/api/tags', async () => {
    return db.prepare(`SELECT * FROM tags ORDER BY name`).all();
  });

  app.get('/api/firmwares', async (req) => {
    const q = req.query as Record<string, unknown>;
    return listFirmwares({
      categoryIds: parseIdList(q.category_ids),
      categoryMatchAll: q.category_match === 'all',
      channelIds: parseIdList(q.channel_ids),
      tagIds: parseIdList(q.tag_ids),
      tagMatchAll: q.tag_match === 'all',
      keyword: typeof q.q === 'string' ? q.q : undefined,
      page: q.page ? parseInt(String(q.page), 10) : 1,
      pageSize: q.page_size ? parseInt(String(q.page_size), 10) : 20,
    });
  });

  app.get<{ Params: { id: string } }>('/api/firmwares/:id', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const fw = getFirmwareById(id);
    if (!fw || fw.is_yanked) return reply.code(404).send({ error: 'not_found' });
    return fw;
  });

  app.get<{ Params: { id: string } }>(
    '/api/firmwares/:id/download',
    async (req, reply) => {
      const id = parseInt(req.params.id, 10);
      const fw = getFirmwareById(id);
      if (!fw || fw.is_yanked) return reply.code(404).send({ error: 'not_found' });

      incrementDownload(id, req.ip, req.headers['user-agent']);

      const downloadName = fw.original_filename;
      reply.header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(downloadName)}"`,
      );
      reply.header('X-Firmware-SHA256', fw.file_sha256);

      // 生产：X-Accel-Redirect 让 Nginx 接管传输
      if (config.xAccelRedirectPrefix) {
        const internal = `${config.xAccelRedirectPrefix.replace(/\/$/, '')}/${fw.file_sha256.slice(0, 2)}/${fw.file_sha256}`;
        reply.header('X-Accel-Redirect', internal);
        reply.header('Content-Type', 'application/octet-stream');
        return reply.send('');
      }

      // 开发：Node 直接流式发送
      const { exists } = resolveStoredPath(fw.file_sha256);
      if (!exists) return reply.code(410).send({ error: 'file_missing' });
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Length', fw.file_size);
      return reply.send(readStoredStream(fw.file_sha256));
    },
  );
}
