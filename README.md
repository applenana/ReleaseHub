<div align="center">

# 🚀 ReleaseHub

**轻量级固件 / 软件发布分发平台**

支持无限层级分类 · Markdown 更新日志 · API 自动上传 · 内容寻址去重

[![Node](https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4-000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

---

## ✨ 特性

- 🌳 **无限层级分类** — 物化路径森林结构，支持任意深度（`3.2寸 / 双光融合 / 海曼5.0 / 热成像`）
- 🎯 **智能分类筛选** — 同子树内祖先-后代自动互斥，兄弟节点共存
- ⚡ **实时筛选** — 关键字 300ms 防抖，分类/通道/标签即时生效
- 🏷️ **多维元数据** — 分类多选 + 通道互斥 + 标签多对多
- 📝 **Markdown 更新日志** — `md-editor-v3` 编辑预览一体
- 🔐 **双重鉴权** — Web 端 Session + API Bearer Token
- 📦 **内容寻址存储** — SHA-256 自动去重，相同文件零冗余
- 🚀 **Nginx X-Accel-Redirect** — 大文件下载交给 Nginx sendfile，Node 零负担
- 💎 **现代 UI** — 蓝绿渐变 + 毛玻璃 + 动画过渡，前后台风格统一
- 🪶 **极致轻量** — 运行内存 ~80MB，可跑在 128MB 余量的小服务器

## 🏗️ 技术栈

| 层 | 技术 |
|---|---|
| **后端** | Node.js · Fastify 4 · TypeScript · better-sqlite3 · Argon2 |
| **前端** | Vue 3 · Vite · Pinia · Vue Router · Naive UI · md-editor-v3 |
| **存储** | SQLite (WAL) + 文件系统（SHA-256 内容寻址） |
| **传输** | Nginx + X-Accel-Redirect |

## 📂 目录结构

```
ReleaseHub/
├── backend/              Fastify 后端
│   ├── src/              TS 源码
│   ├── scripts/          管理脚本（建管理员、种子数据）
│   └── package.json
├── frontend/             Vue 3 前端
│   ├── src/
│   └── package.json
├── deploy/
│   └── nginx.example.conf
├── scripts/
│   └── upload.mjs        API 上传示例
└── .github/workflows/    GitHub Actions
```

## 🛠️ 开发环境

### 前置要求

- Node.js ≥ 20
- npm

### 启动

```bash
# 1. 后端
cd backend
npm install
cp .env.example .env
# ⚠️ 必改：SESSION_SECRET
#   生成命令：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run migrate            # 建表
npm run create-admin       # 交互式创建管理员
npm run dev                # http://localhost:3001

# 2. 前端（新开终端）
cd frontend
npm install
npm run dev                # http://localhost:5173
```

- 前台：<http://localhost:5173>
- 后台：<http://localhost:5173/admin>
- API 文档（Swagger）：<http://localhost:3001/api/docs>

## 🚢 部署

### 方式 A：GitHub Release（推荐）

打 tag 触发 CI 自动构建并发布 release：

```bash
git tag v1.0.0
git push origin v1.0.0
```

CI 会在 [Releases](../../releases) 页面产出 `releasehub-v1.0.0.tar.gz`，包含：

```
release/
├── backend/        # 已编译产物 + package.json
└── public/         # 已编译前端静态资源
```

下载、解压、配置、启动：

```bash
tar xzf releasehub-v1.0.0.tar.gz -C /your-path/release.applenana.fun
cd /your-path/release.applenana.fun/backend
cp .env.example .env && vim .env       # 改 SESSION_SECRET 等
npm ci --omit=dev                      # 装运行时依赖
node dist/src/index.js                 # 启动（建议交给 systemd）
```

### 方式 B：手动构建

```bash
# 本地
cd backend && npm run build
cd ../frontend && npm run build

# 服务器需要的文件
# backend/dist + backend/package.json + backend/package-lock.json + backend/.env
# frontend/dist 的全部内容（不含 dist 本身）
```

### 服务器目录建议

```
release.applenana.fun/
├── backend/
│   ├── dist/                 (复制)
│   ├── package.json          (复制)
│   ├── package-lock.json     (复制)
│   ├── .env                  (从 .env.example 改)
│   ├── node_modules/         (npm ci 自动生成)
│   ├── data/                 (首次启动自动建)
│   └── storage/              (首次启动自动建)
└── public/                   (放 frontend/dist 内容，Nginx 静态根)
```

### Nginx 配置

参考 [`deploy/nginx.example.conf`](deploy/nginx.example.conf)，三处必改：

```nginx
server_name your-domain.com;
root /path/to/release.applenana.fun/public;

location /internal-firmware/ {
    internal;
    alias /path/to/release.applenana.fun/backend/storage/firmware/;
}
```

`location /api/` 反代到 `127.0.0.1:3001`，无需调整。

### systemd（推荐）

```ini
[Unit]
Description=ReleaseHub
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/release.applenana.fun/backend
ExecStart=/usr/bin/node dist/src/index.js
Restart=on-failure
MemoryMax=200M

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now releasehub
```

## 🔑 API 用法

### 创建 Token

后台 → **API 令牌** → 新建。**Token 仅创建时显示一次明文**，请立即保存。

### 上传固件

```bash
curl -X POST https://your-domain.com/api/v1/firmwares \
  -H "Authorization: Bearer rh_xxxxxxxxxxxx" \
  -F "file=@./firmware.bin" \
  -F 'meta={
    "title": "3.2寸 MLX 双光",
    "version": "1.2.3",
    "channel_key": "stable",
    "category_ids": [3, 5],
    "tag_names": ["推荐"],
    "changelog": "## 1.2.3\n- 修复 X 问题"
  }'
```

或使用 [`scripts/upload.mjs`](scripts/upload.mjs)：

```bash
API_URL=https://your-domain.com API_TOKEN=rh_xxx \
  node scripts/upload.mjs ./firmware.bin
```

## 🗄️ 数据模型

```
Category    ─── 森林 + 物化路径，支持无限层级
Channel     ─── 互斥单选（稳定 / 快速 / Beta）
Tag         ─── 多对多扁平标签
Firmware    ─── title + version + channel + sha256 + changelog
AdminUser   ─── Argon2 哈希密码
ApiToken    ─── Bearer Token（哈希存储）
```

文件以 `<storage>/<sha[0:2]>/<sha>` 路径保存，相同 SHA 的文件全网仅存一份。

## 💾 备份

只需备份两个目录：

```bash
tar czf releasehub-backup-$(date +%F).tgz \
    backend/data/ \
    backend/storage/
```

建议加 cron 每日执行。SQLite WAL 模式下热备份是安全的。

## 🧮 资源占用

| 资源 | 占用 |
|---|---|
| 运行时内存（Node） | 60–80 MB |
| 启动时间 | < 1s |
| 安装空间（含 node_modules） | ~120 MB |

可在 1GB 总内存 / 128MB 余量的小服务器流畅运行。

## 🤝 贡献

欢迎 issue 与 PR！开发约定：

- TypeScript strict 模式
- 后端：Fastify + better-sqlite3，无 ORM
- 前端：组合式 API + `<script setup>`
- Commit 信息推荐遵循 Conventional Commits

## 📄 License

[MIT](LICENSE) © applenana

---

<div align="center">

如果这个项目对你有帮助，欢迎点一个 ⭐

</div>
