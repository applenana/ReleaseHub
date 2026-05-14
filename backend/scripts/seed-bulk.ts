// 批量测试固件：生成 100 个不同的固件，覆盖多种分类/通道/标签组合
// 用法：npm run seed-bulk  或  npx tsx scripts/seed-bulk.ts [count]
import { db } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config.js';

runMigrations();

const COUNT = parseInt(process.argv[2] ?? '100', 10);

// ---------- 工具 ----------
function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '')
    .replace(/^-+|-+$/g, '') || 'n-' + Math.random().toString(36).slice(2, 6);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------- 分类（多条 3~4 层路径） ----------
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

// 屏幕尺寸 › 模块 › 探测器型号
const sizes = ['2.4寸', '3.2寸', '3.5寸', '5.0寸'];
const modules = ['单光', '双光融合', '红外夜视', '激光测距'];
const detectors = ['海曼5.0', '海曼7.0', 'GuideIR', 'FLIR Lepton', 'InfiRay Tiny1'];

const leafCategoryIds: number[] = [];
for (const sz of sizes) {
  const a = upsertCategory(sz, null);
  for (const m of modules) {
    const b = upsertCategory(m, a);
    for (const d of pickN(detectors, randInt(2, 4))) {
      const c = upsertCategory(d, b);
      leafCategoryIds.push(c);
    }
  }
}

// ---------- 标签 ----------
function upsertTag(name: string, color: string) {
  const r = db.prepare(`SELECT id FROM tags WHERE name = ?`).get(name) as any;
  if (r) return r.id as number;
  const x = db.prepare(`INSERT INTO tags (name, color) VALUES (?, ?)`).run(name, color);
  return Number(x.lastInsertRowid);
}
const tagPool = [
  upsertTag('推荐', '#fa541c'),
  upsertTag('新功能', '#13c2c2'),
  upsertTag('紧急修复', '#f5222d'),
  upsertTag('性能优化', '#722ed1'),
  upsertTag('实验性', '#eb2f96'),
  upsertTag('LTS', '#1677ff'),
  upsertTag('安全更新', '#52c41a'),
  upsertTag('UI 优化', '#faad14'),
];

// ---------- 通道 ----------
const channels = db.prepare(`SELECT id, key FROM channels`).all() as { id: number; key: string }[];

// ---------- 标题语料 ----------
const productLines = [
  'TC-Vision', 'NightHawk', 'Falcon', 'Phoenix', 'Aurora',
  'Vulcan', 'Polaris', 'Orion', 'Stellar', 'Nebula',
  'IRPro', 'ThermoEye', 'SkyView', '猎隼', '苍鹰', '夜枭', '北极星', '猎户座',
];
const suffixes = [
  'Standard', 'Pro', 'Pro Max', 'Lite', 'Ultra', 'Plus', 'X', 'Edge', '增强版', '专业版',
];
const changelogTemplates = [
  '## 更新内容\n\n- 修复 {{topic}} 相关崩溃\n- 优化 {{topic}} 响应速度\n- 提升整体稳定性',
  '## 新特性\n\n1. 新增 {{topic}} 模式\n2. 改进 {{topic}} 算法\n3. 兼容性提升\n\n## 已知问题\n\n- 某些低端机型可能首次启动较慢',
  '> 本版本主要为 **{{topic}}** 优化\n\n- 内存占用降低 12%\n- 启动速度提升 18%\n- 修复多语言显示问题',
  '### 修复列表\n\n- [#1234] {{topic}} 偶发卡顿\n- [#1267] 电池续航统计偏差\n- [#1289] OTA 升级失败重试',
];
const topics = ['热成像', '夜视', '测温', '双光融合', '人脸识别', '运动检测', '蓝牙', 'OTA', '调色板', '帧率'];

// ---------- 写入固件 ----------
const insertFw = db.prepare(
  `INSERT INTO firmwares
   (title, version, patch_suffix, channel_id, changelog, file_sha256, file_size,
    original_filename, download_count, is_yanked, uploaded_at, uploaded_by)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'seed-bulk')`,
);
const insertFc = db.prepare(
  `INSERT OR IGNORE INTO firmware_categories (firmware_id, category_id) VALUES (?, ?)`,
);
const insertFt = db.prepare(
  `INSERT OR IGNORE INTO firmware_tags (firmware_id, tag_id) VALUES (?, ?)`,
);

mkdirSync(config.firmwareStorageDir, { recursive: true });

const now = Math.floor(Date.now() / 1000);
const oneYear = 365 * 24 * 3600;

const tx = db.transaction((n: number) => {
  let created = 0;
  for (let i = 0; i < n; i++) {
    const line = pick(productLines);
    const suf = pick(suffixes);
    const title = `${line} ${suf}`;
    const version = `v${randInt(1, 5)}.${randInt(0, 20)}.${randInt(0, 30)}`;
    const patch = Math.random() < 0.3 ? `build${randInt(100, 999)}` : null;
    const channel = pick(channels);
    const topic = pick(topics);
    const changelog = pick(changelogTemplates).replaceAll('{{topic}}', topic);

    // 独特内容 → 独特 sha256
    const content = randomBytes(randInt(1024, 8192));
    // 附加索引保证唯一
    const buf = Buffer.concat([content, Buffer.from(`#${i}-${Date.now()}-${Math.random()}`)]);
    const sha = createHash('sha256').update(buf).digest('hex');
    const subDir = join(config.firmwareStorageDir, sha.slice(0, 2));
    mkdirSync(subDir, { recursive: true });
    const dest = join(subDir, sha);
    if (!existsSync(dest)) writeFileSync(dest, buf);

    const originalName = `${slugify(line)}-${suf.toLowerCase().replace(/\s+/g, '-')}-${version}.bin`;
    const uploadedAt = now - randInt(0, oneYear);
    const downloads = Math.random() < 0.2 ? randInt(500, 5000) : randInt(0, 200);

    const r = insertFw.run(
      title,
      version,
      patch,
      channel.id,
      changelog,
      sha,
      buf.length,
      originalName,
      downloads,
      uploadedAt,
    );
    const fwId = Number(r.lastInsertRowid);

    // 1~3 个分类
    for (const cid of pickN(leafCategoryIds, randInt(1, 3))) {
      insertFc.run(fwId, cid);
    }
    // 0~3 个标签
    for (const tid of pickN(tagPool, randInt(0, 3))) {
      insertFt.run(fwId, tid);
    }
    created++;
  }
  return created;
});

const n = tx(COUNT);
const totalFw = (db.prepare(`SELECT COUNT(*) AS c FROM firmwares`).get() as any).c;

console.log(`✓ 批量种子完成：新增 ${n} 个固件`);
console.log(`  当前固件总数：${totalFw}`);
console.log(`  叶节点分类数：${leafCategoryIds.length}`);
console.log(`  标签池大小：${tagPool.length}`);
console.log(`  通道：${channels.map((c) => c.key).join(', ')}`);
