import type { FastifyInstance } from 'fastify';
import { requireWrite } from '../auth/middleware.js';
import { db } from '../db/index.js';
import { createFirmware } from '../services/firmware.js';
import { storeUpload } from '../services/storage.js';

interface UploadMeta {
  title: string;
  version: string;
  patch_suffix?: string | null;
  channel_id?: number;
  channel_key?: string;
  changelog?: string;
  category_ids?: number[];
  tag_ids?: number[];
  tag_names?: string[];
}

function resolveChannel(meta: UploadMeta): number {
  if (meta.channel_id) {
    const row = db.prepare(`SELECT id FROM channels WHERE id = ?`).get(meta.channel_id);
    if (!row) throw new Error(`channel_id ${meta.channel_id} not found`);
    return meta.channel_id;
  }
  if (meta.channel_key) {
    const row = db.prepare(`SELECT id FROM channels WHERE key = ?`).get(meta.channel_key) as
      | { id: number }
      | undefined;
    if (!row) throw new Error(`channel_key ${meta.channel_key} not found`);
    return row.id;
  }
  throw new Error('channel_id or channel_key required');
}

function resolveTags(meta: UploadMeta): number[] {
  const ids = new Set<number>(meta.tag_ids ?? []);
  if (meta.tag_names?.length) {
    const insert = db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`);
    const select = db.prepare(`SELECT id FROM tags WHERE name = ?`);
    for (const name of meta.tag_names) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      insert.run(trimmed);
      const r = select.get(trimmed) as { id: number } | undefined;
      if (r) ids.add(r.id);
    }
  }
  return Array.from(ids);
}

export default async function uploadRoutes(app: FastifyInstance) {
  /**
   * 统一上传端点：管理员（Cookie 会话）或 API Token（写权限）。
   * Content-Type: multipart/form-data
   * 字段：
   *   file              — 固件二进制（必需）
   *   meta              — JSON 字符串，结构见 UploadMeta（必需）
   * 或者用平铺字段：title, version, channel_key, changelog, category_ids(逗号), tag_names(逗号)
   */
  app.post('/api/v1/firmwares', { preHandler: requireWrite }, async (req, reply) => {
    if (!req.isMultipart()) {
      return reply.code(400).send({ error: 'multipart_required' });
    }
    let stored: Awaited<ReturnType<typeof storeUpload>> | null = null;
    let meta: UploadMeta | null = null;
    let originalFilename = 'firmware.bin';

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.fieldname !== 'file') {
          // 丢弃未知文件字段
          part.file.resume();
          continue;
        }
        originalFilename = part.filename || 'firmware.bin';
        stored = await storeUpload(part.file);
      } else {
        if (part.fieldname === 'meta') {
          try {
            meta = JSON.parse(part.value as string);
          } catch {
            return reply.code(400).send({ error: 'invalid_meta_json' });
          }
        } else {
          // 平铺字段
          if (!meta) meta = {} as UploadMeta;
          const v = String(part.value ?? '');
          switch (part.fieldname) {
            case 'title':
              meta.title = v;
              break;
            case 'version':
              meta.version = v;
              break;
            case 'patch_suffix':
              meta.patch_suffix = v || null;
              break;
            case 'channel_id':
              meta.channel_id = parseInt(v, 10);
              break;
            case 'channel_key':
              meta.channel_key = v;
              break;
            case 'changelog':
              meta.changelog = v;
              break;
            case 'category_ids':
              meta.category_ids = v
                .split(',')
                .map((x) => parseInt(x.trim(), 10))
                .filter(Number.isFinite);
              break;
            case 'tag_ids':
              meta.tag_ids = v
                .split(',')
                .map((x) => parseInt(x.trim(), 10))
                .filter(Number.isFinite);
              break;
            case 'tag_names':
              meta.tag_names = v.split(',').map((x) => x.trim()).filter(Boolean);
              break;
          }
        }
      }
    }

    if (!stored) return reply.code(400).send({ error: 'file_required' });
    if (!meta || !meta.title || !meta.version) {
      return reply.code(400).send({ error: 'title_and_version_required' });
    }

    try {
      const channel_id = resolveChannel(meta);
      const tag_ids = resolveTags(meta);
      const uploader = req.admin?.username ?? (req.apiToken ? `token:${req.apiToken.name}` : null);
      const fw = createFirmware({
        title: meta.title,
        version: meta.version,
        patch_suffix: meta.patch_suffix ?? null,
        channel_id,
        changelog: meta.changelog ?? '',
        file_sha256: stored.sha256,
        file_size: stored.size,
        original_filename: originalFilename,
        category_ids: meta.category_ids ?? [],
        tag_ids,
        uploaded_by: uploader,
      });
      return reply.code(201).send({ ...fw, deduplicated: stored.deduped });
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });
}
