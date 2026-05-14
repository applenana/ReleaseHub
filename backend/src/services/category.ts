import { db } from '../db/index.js';

export interface CategoryRow {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  path: string;
  depth: number;
  sort_order: number;
  created_at: number;
}

export interface CategoryNode extends CategoryRow {
  children: CategoryNode[];
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\p{Letter}\p{Number}_\-]/gu, '') || 'item'
  );
}

export function listAllCategories(): CategoryRow[] {
  return db
    .prepare(`SELECT * FROM categories ORDER BY depth ASC, sort_order ASC, id ASC`)
    .all() as CategoryRow[];
}

export function getCategoryById(id: number): CategoryRow | undefined {
  return db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id) as CategoryRow | undefined;
}

export function buildTree(rows: CategoryRow[]): CategoryNode[] {
  const map = new Map<number, CategoryNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: CategoryNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id == null) {
      roots.push(node);
    } else {
      const p = map.get(node.parent_id);
      if (p) p.children.push(node);
      else roots.push(node);
    }
  }
  const sortRec = (arr: CategoryNode[]) => {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export function createCategory(input: {
  parent_id: number | null;
  name: string;
  slug?: string;
  description?: string | null;
  sort_order?: number;
}): CategoryRow {
  const slug = (input.slug && input.slug.trim()) || slugify(input.name);
  let parentPath = '/';
  let depth = 0;
  if (input.parent_id != null) {
    const parent = getCategoryById(input.parent_id);
    if (!parent) throw new Error('parent not found');
    parentPath = parent.path;
    depth = parent.depth + 1;
  }
  const existing = db
    .prepare(
      `SELECT id FROM categories WHERE ${input.parent_id == null ? 'parent_id IS NULL' : 'parent_id = ?'} AND slug = ?`,
    )
    .get(...(input.parent_id == null ? [slug] : [input.parent_id, slug]));
  if (existing) throw new Error('slug conflict under parent');

  const info = db
    .prepare(
      `INSERT INTO categories (parent_id, name, slug, description, path, depth, sort_order)
       VALUES (?, ?, ?, ?, '', ?, ?)`,
    )
    .run(
      input.parent_id,
      input.name,
      slug,
      input.description ?? null,
      depth,
      input.sort_order ?? 0,
    );
  const id = Number(info.lastInsertRowid);
  const path = `${parentPath}${id}/`;
  db.prepare(`UPDATE categories SET path = ? WHERE id = ?`).run(path, id);
  return getCategoryById(id)!;
}

export function updateCategory(
  id: number,
  patch: { name?: string; slug?: string; description?: string | null; sort_order?: number },
): CategoryRow {
  const cur = getCategoryById(id);
  if (!cur) throw new Error('not found');
  const name = patch.name ?? cur.name;
  const slug = patch.slug !== undefined ? patch.slug || slugify(name) : cur.slug;
  const description = patch.description !== undefined ? patch.description : cur.description;
  const sort_order = patch.sort_order ?? cur.sort_order;
  db.prepare(
    `UPDATE categories SET name = ?, slug = ?, description = ?, sort_order = ? WHERE id = ?`,
  ).run(name, slug, description, sort_order, id);
  return getCategoryById(id)!;
}

export function deleteCategory(id: number) {
  // ON DELETE CASCADE 会处理子分类与关联
  db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
}

/** 移动分类到新父节点，重写自身及所有后代的 path 和 depth */
export function moveCategory(id: number, newParentId: number | null): CategoryRow {
  const cur = getCategoryById(id);
  if (!cur) throw new Error('not found');
  let newParentPath = '/';
  let newDepth = 0;
  if (newParentId != null) {
    if (newParentId === id) throw new Error('cannot move into self');
    const np = getCategoryById(newParentId);
    if (!np) throw new Error('new parent not found');
    if (np.path.startsWith(cur.path)) throw new Error('cannot move into descendant');
    newParentPath = np.path;
    newDepth = np.depth + 1;
  }
  const newSelfPath = `${newParentPath}${id}/`;
  const oldPath = cur.path;
  const depthDelta = newDepth - cur.depth;

  const tx = db.transaction(() => {
    // 更新自身
    db.prepare(`UPDATE categories SET parent_id = ?, path = ?, depth = ? WHERE id = ?`).run(
      newParentId,
      newSelfPath,
      newDepth,
      id,
    );
    // 更新所有后代：path 前缀替换 + depth 偏移
    const descendants = db
      .prepare(`SELECT id, path, depth FROM categories WHERE path LIKE ? AND id != ?`)
      .all(`${oldPath}%`, id) as { id: number; path: string; depth: number }[];
    const upd = db.prepare(`UPDATE categories SET path = ?, depth = ? WHERE id = ?`);
    for (const d of descendants) {
      const newP = newSelfPath + d.path.slice(oldPath.length);
      upd.run(newP, d.depth + depthDelta, d.id);
    }
  });
  tx();
  return getCategoryById(id)!;
}
