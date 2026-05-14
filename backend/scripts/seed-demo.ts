// 一次性演示数据：构造 "3.2寸 › 双光融合 › 海曼5.0 › 热成像" 这样的 4 层分类，
// 并插入一个固件挂在叶节点上，用于前端面包屑效果验证。
import { db } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config.js';

runMigrations();

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '')
    .replace(/^-+|-+$/g, '') || 'n-' + Math.random().toString(36).slice(2, 6);
}

function upsertCategory(name: string, parentId: number | null): number {
  const parent = parentId
    ? (db.prepare(`SELECT id, path, depth FROM categories WHERE id = ?`).get(parentId) as any)
    : null;
  const slug = slugify(name);
  const existing = db
    .prepare(`SELECT id FROM categories WHERE parent_id IS ? AND slug = ?`)
    .get(parentId, slug) as any;
  if (existing) return existing.id;
  const r = db
    .prepare(
      `INSERT INTO categories (parent_id, name, slug, description, path, depth, sort_order)
       VALUES (?, ?, ?, NULL, '', ?, 0)`,
    )
    .run(parentId, name, slug, parent ? parent.depth + 1 : 0);
  const id = Number(r.lastInsertRowid);
  const newPath = parent ? `${parent.path}${id}/` : `/${id}/`;
  db.prepare(`UPDATE categories SET path = ? WHERE id = ?`).run(newPath, id);
  return id;
}

const c1 = upsertCategory('3.2寸', null);
const c2 = upsertCategory('双光融合', c1);
const c3 = upsertCategory('海曼5.0', c2);
const c4 = upsertCategory('热成像', c3);

// 第二条深路径示例
const d1 = upsertCategory('2.4寸', null);
const d2 = upsertCategory('单光', d1);
const d3 = upsertCategory('GuideIR', d2);

// 标签
function upsertTag(name: string, color = '#5b8def') {
  const r = db.prepare(`SELECT id FROM tags WHERE name = ?`).get(name) as any;
  if (r) return r.id as number;
  const x = db.prepare(`INSERT INTO tags (name, color) VALUES (?, ?)`).run(name, color);
  return Number(x.lastInsertRowid);
}
const tagHot = upsertTag('推荐', '#fa541c');
const tagNew = upsertTag('新功能', '#13c2c2');

// 一个虚拟固件
const channel = db.prepare(`SELECT id FROM channels WHERE key = 'stable'`).get() as any;
const fakeContent = randomBytes(2048);
const sha = createHash('sha256').update(fakeContent).digest('hex');
const storageRoot = config.firmwareStorageDir;
mkdirSync(storageRoot, { recursive: true });
const subDir = join(storageRoot, sha.slice(0, 2));
mkdirSync(subDir, { recursive: true });
const dest = join(subDir, sha);
if (!existsSync(dest)) writeFileSync(dest, fakeContent);

const existsFw = db
  .prepare(`SELECT id FROM firmwares WHERE title = ? AND version = ?`)
  .get('演示固件 A', 'v1.0.0') as any;
let fwId: number;
if (existsFw) {
  fwId = existsFw.id;
} else {
  const r = db
    .prepare(
      `INSERT INTO firmwares
       (title, version, patch_suffix, channel_id, changelog, file_sha256, file_size,
        original_filename, download_count, is_yanked, uploaded_at, uploaded_by)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 0, 0, strftime('%s','now'), 'seed')`,
    )
    .run(
      '演示固件 A',
      'v1.0.0',
      channel.id,
      '# 演示更新日志\n\n- 初始版本\n- 用于面包屑效果验证',
      sha,
      fakeContent.length,
      'demo-firmware-v1.0.0.bin',
    );
  fwId = Number(r.lastInsertRowid);
}

const insertFc = db.prepare(
  `INSERT OR IGNORE INTO firmware_categories (firmware_id, category_id) VALUES (?, ?)`,
);
insertFc.run(fwId, c4);
insertFc.run(fwId, d3);

const insertFt = db.prepare(
  `INSERT OR IGNORE INTO firmware_tags (firmware_id, tag_id) VALUES (?, ?)`,
);
insertFt.run(fwId, tagHot);
insertFt.run(fwId, tagNew);

console.log('✓ Seed 完成。固件 ID =', fwId);
console.log('  分类链 1：3.2寸 › 双光融合 › 海曼5.0 › 热成像');
console.log('  分类链 2：2.4寸 › 单光 › GuideIR');
