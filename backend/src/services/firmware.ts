import { db } from '../db/index.js';
import { getCategoryById } from './category.js';

export interface FirmwareRow {
  id: number;
  title: string;
  version: string;
  patch_suffix: string | null;
  channel_id: number;
  changelog: string;
  file_sha256: string;
  file_size: number;
  original_filename: string;
  download_count: number;
  is_yanked: number;
  uploaded_at: number;
  uploaded_by: string | null;
}

export interface FirmwareDetail extends FirmwareRow {
  channel: { id: number; key: string; label: string; color: string } | null;
  categories: { id: number; name: string; path: string; depth: number }[];
  tags: { id: number; name: string; color: string }[];
}

const baseSelect = `
  SELECT f.*, c.key AS ch_key, c.label AS ch_label, c.color AS ch_color
  FROM firmwares f
  LEFT JOIN channels c ON c.id = f.channel_id
`;

function attachRelations(rows: any[]): FirmwareDetail[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const cats = db
    .prepare(
      `SELECT fc.firmware_id, ct.id, ct.name, ct.path, ct.depth
       FROM firmware_categories fc
       JOIN categories ct ON ct.id = fc.category_id
       WHERE fc.firmware_id IN (${placeholders})
       ORDER BY ct.depth, ct.sort_order, ct.id`,
    )
    .all(...ids) as any[];
  const tags = db
    .prepare(
      `SELECT ft.firmware_id, t.id, t.name, t.color
       FROM firmware_tags ft
       JOIN tags t ON t.id = ft.tag_id
       WHERE ft.firmware_id IN (${placeholders})
       ORDER BY t.name`,
    )
    .all(...ids) as any[];
  const catMap = new Map<number, any[]>();
  const tagMap = new Map<number, any[]>();
  for (const r of cats) {
    const arr = catMap.get(r.firmware_id) ?? [];
    arr.push({ id: r.id, name: r.name, path: r.path, depth: r.depth });
    catMap.set(r.firmware_id, arr);
  }
  for (const r of tags) {
    const arr = tagMap.get(r.firmware_id) ?? [];
    arr.push({ id: r.id, name: r.name, color: r.color });
    tagMap.set(r.firmware_id, arr);
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    version: r.version,
    patch_suffix: r.patch_suffix,
    channel_id: r.channel_id,
    changelog: r.changelog,
    file_sha256: r.file_sha256,
    file_size: r.file_size,
    original_filename: r.original_filename,
    download_count: r.download_count,
    is_yanked: r.is_yanked,
    uploaded_at: r.uploaded_at,
    uploaded_by: r.uploaded_by,
    channel: r.channel_id
      ? { id: r.channel_id, key: r.ch_key, label: r.ch_label, color: r.ch_color }
      : null,
    categories: catMap.get(r.id) ?? [],
    tags: tagMap.get(r.id) ?? [],
  }));
}

export function getFirmwareById(id: number): FirmwareDetail | null {
  const row = db.prepare(`${baseSelect} WHERE f.id = ?`).get(id) as any;
  if (!row) return null;
  return attachRelations([row])[0];
}

export interface ListFirmwareFilter {
  /** category id 列表；任一选中节点匹配其自身或后代即可（OR） */
  categoryIds?: number[];
  /** 多 category 是否全部都要满足（AND） */
  categoryMatchAll?: boolean;
  channelIds?: number[];
  tagIds?: number[];
  tagMatchAll?: boolean;
  keyword?: string;
  includeYanked?: boolean;
  page?: number;
  pageSize?: number;
}

export function listFirmwares(f: ListFirmwareFilter): {
  total: number;
  items: FirmwareDetail[];
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 20));
  const where: string[] = [];
  const params: any[] = [];

  if (!f.includeYanked) where.push('f.is_yanked = 0');

  if (f.channelIds && f.channelIds.length) {
    where.push(`f.channel_id IN (${f.channelIds.map(() => '?').join(',')})`);
    params.push(...f.channelIds);
  }

  if (f.keyword) {
    where.push(`(f.title LIKE ? OR f.version LIKE ? OR f.original_filename LIKE ?)`);
    const kw = `%${f.keyword}%`;
    params.push(kw, kw, kw);
  }

  // 分类筛选：每个选中的 category，找出其所有后代节点 id，要求 firmware 至少（OR 模式）/全部（AND 模式）命中
  if (f.categoryIds && f.categoryIds.length) {
    const groups: number[][] = [];
    for (const cid of f.categoryIds) {
      const cat = getCategoryById(cid);
      if (!cat) continue;
      const subtree = db
        .prepare(`SELECT id FROM categories WHERE path LIKE ?`)
        .all(`${cat.path}%`) as { id: number }[];
      groups.push(subtree.map((s) => s.id));
    }
    if (groups.length) {
      if (f.categoryMatchAll) {
        for (const g of groups) {
          where.push(
            `EXISTS (SELECT 1 FROM firmware_categories fc WHERE fc.firmware_id = f.id AND fc.category_id IN (${g.map(() => '?').join(',')}))`,
          );
          params.push(...g);
        }
      } else {
        const all = groups.flat();
        where.push(
          `EXISTS (SELECT 1 FROM firmware_categories fc WHERE fc.firmware_id = f.id AND fc.category_id IN (${all.map(() => '?').join(',')}))`,
        );
        params.push(...all);
      }
    }
  }

  if (f.tagIds && f.tagIds.length) {
    if (f.tagMatchAll) {
      for (const tid of f.tagIds) {
        where.push(
          `EXISTS (SELECT 1 FROM firmware_tags ft WHERE ft.firmware_id = f.id AND ft.tag_id = ?)`,
        );
        params.push(tid);
      }
    } else {
      where.push(
        `EXISTS (SELECT 1 FROM firmware_tags ft WHERE ft.firmware_id = f.id AND ft.tag_id IN (${f.tagIds.map(() => '?').join(',')}))`,
      );
      params.push(...f.tagIds);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM firmwares f ${whereSql}`).get(...params) as {
    n: number;
  }).n;
  const rows = db
    .prepare(
      `${baseSelect} ${whereSql} ORDER BY f.uploaded_at DESC, f.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize) as any[];
  return { total, items: attachRelations(rows), page, pageSize };
}

export interface CreateFirmwareInput {
  title: string;
  version: string;
  patch_suffix?: string | null;
  channel_id: number;
  changelog?: string;
  file_sha256: string;
  file_size: number;
  original_filename: string;
  category_ids?: number[];
  tag_ids?: number[];
  uploaded_by?: string | null;
}

export function createFirmware(input: CreateFirmwareInput): FirmwareDetail {
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO firmwares
         (title, version, patch_suffix, channel_id, changelog, file_sha256, file_size, original_filename, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        input.version,
        input.patch_suffix ?? null,
        input.channel_id,
        input.changelog ?? '',
        input.file_sha256,
        input.file_size,
        input.original_filename,
        input.uploaded_by ?? null,
      );
    const id = Number(info.lastInsertRowid);
    if (input.category_ids?.length) {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO firmware_categories (firmware_id, category_id) VALUES (?, ?)`,
      );
      for (const cid of input.category_ids) stmt.run(id, cid);
    }
    if (input.tag_ids?.length) {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO firmware_tags (firmware_id, tag_id) VALUES (?, ?)`,
      );
      for (const tid of input.tag_ids) stmt.run(id, tid);
    }
    return id;
  });
  const id = tx();
  return getFirmwareById(id)!;
}

export function updateFirmware(
  id: number,
  patch: Partial<{
    title: string;
    version: string;
    patch_suffix: string | null;
    channel_id: number;
    changelog: string;
    is_yanked: boolean;
    category_ids: number[];
    tag_ids: number[];
  }>,
): FirmwareDetail {
  const cur = getFirmwareById(id);
  if (!cur) throw new Error('not found');
  const tx = db.transaction(() => {
    const fields: string[] = [];
    const params: any[] = [];
    const set = (k: string, v: any) => {
      fields.push(`${k} = ?`);
      params.push(v);
    };
    if (patch.title !== undefined) set('title', patch.title);
    if (patch.version !== undefined) set('version', patch.version);
    if (patch.patch_suffix !== undefined) set('patch_suffix', patch.patch_suffix);
    if (patch.channel_id !== undefined) set('channel_id', patch.channel_id);
    if (patch.changelog !== undefined) set('changelog', patch.changelog);
    if (patch.is_yanked !== undefined) set('is_yanked', patch.is_yanked ? 1 : 0);
    if (fields.length) {
      params.push(id);
      db.prepare(`UPDATE firmwares SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }
    if (patch.category_ids) {
      db.prepare(`DELETE FROM firmware_categories WHERE firmware_id = ?`).run(id);
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO firmware_categories (firmware_id, category_id) VALUES (?, ?)`,
      );
      for (const cid of patch.category_ids) stmt.run(id, cid);
    }
    if (patch.tag_ids) {
      db.prepare(`DELETE FROM firmware_tags WHERE firmware_id = ?`).run(id);
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO firmware_tags (firmware_id, tag_id) VALUES (?, ?)`,
      );
      for (const tid of patch.tag_ids) stmt.run(id, tid);
    }
  });
  tx();
  return getFirmwareById(id)!;
}

export function deleteFirmware(id: number) {
  db.prepare(`DELETE FROM firmwares WHERE id = ?`).run(id);
  // 物理文件不删除（其它固件可能复用同一 sha256）
}

export function incrementDownload(id: number, ip?: string, ua?: string) {
  const tx = db.transaction(() => {
    db.prepare(`UPDATE firmwares SET download_count = download_count + 1 WHERE id = ?`).run(id);
    db.prepare(
      `INSERT INTO download_logs (firmware_id, ip, user_agent) VALUES (?, ?, ?)`,
    ).run(id, ip ?? null, ua ?? null);
  });
  tx();
}
