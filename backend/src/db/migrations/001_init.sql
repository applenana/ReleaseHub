-- 001_init.sql：初始数据库结构

-- 分类（无限层级森林，物化路径）
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  path TEXT NOT NULL,             -- e.g. "/1/4/12/"
  depth INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(parent_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_categories_path ON categories(path);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- 发布通道（互斥）
CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#1890ff',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 描述性标签（多对多）
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#52c41a',
  description TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 固件
CREATE TABLE IF NOT EXISTS firmwares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  patch_suffix TEXT,
  channel_id INTEGER NOT NULL REFERENCES channels(id),
  changelog TEXT NOT NULL DEFAULT '',
  file_sha256 TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  original_filename TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  is_yanked INTEGER NOT NULL DEFAULT 0,
  uploaded_at INTEGER NOT NULL DEFAULT (unixepoch()),
  uploaded_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_firmwares_channel ON firmwares(channel_id);
CREATE INDEX IF NOT EXISTS idx_firmwares_uploaded_at ON firmwares(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_firmwares_sha256 ON firmwares(file_sha256);
CREATE INDEX IF NOT EXISTS idx_firmwares_yanked ON firmwares(is_yanked);

-- 固件 ↔ 分类
CREATE TABLE IF NOT EXISTS firmware_categories (
  firmware_id INTEGER NOT NULL REFERENCES firmwares(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (firmware_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_fc_category ON firmware_categories(category_id);

-- 固件 ↔ 标签
CREATE TABLE IF NOT EXISTS firmware_tags (
  firmware_id INTEGER NOT NULL REFERENCES firmwares(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (firmware_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_ft_tag ON firmware_tags(tag_id);

-- 管理员
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login_at INTEGER
);

-- API 令牌（仅存哈希）
CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'write',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0
);

-- 下载日志（可定期清理）
CREATE TABLE IF NOT EXISTS download_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firmware_id INTEGER NOT NULL REFERENCES firmwares(id) ON DELETE CASCADE,
  ip TEXT,
  user_agent TEXT,
  downloaded_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_dl_firmware ON download_logs(firmware_id);
CREATE INDEX IF NOT EXISTS idx_dl_time ON download_logs(downloaded_at);

-- 迁移记录
CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 默认通道
INSERT OR IGNORE INTO channels (key, label, color, sort_order) VALUES
  ('stable', '稳定版', '#52c41a', 0),
  ('fast',   '快速版', '#1890ff', 1),
  ('beta',   '测试版', '#fa8c16', 2);
