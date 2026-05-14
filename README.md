<div align="center">

# 🚀 ReleaseHub

**轻量级固件 / 软件发布分发平台**

无限层级分类 · Markdown 更新日志 · API 自动上传 · 内容寻址去重

[![Node](https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4-000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

</div>

---

## ✨ 特性

- 🌳 **无限层级分类** — 物化路径森林结构，任意深度
- 🎯 **智能筛选** — 同子树祖先-后代自动互斥；关键字 300ms 防抖实时刷新
- 🏷️ **多维元数据** — 分类多选 + 通道互斥 + 标签多对多
- 📝 **Markdown 更新日志** — 编辑预览一体
- 🔐 **双重鉴权** — Web Session + API Bearer Token
- 📦 **内容寻址存储** — SHA-256 自动去重
- 🚀 **Nginx X-Accel-Redirect** — 大文件下载由 Nginx sendfile，Node 零负担
- 💎 **蓝绿渐变 + 毛玻璃 UI**
- 🪶 **极致轻量** — 运行内存 ~80MB

## 🏗️ 技术栈

| 层 | 技术 |
|---|---|
| **后端** | Node.js · Fastify 4 · TypeScript · better-sqlite3 · Argon2 |
| **前端** | Vue 3 · Vite · Pinia · Naive UI · md-editor-v3 |
| **存储** | SQLite (WAL) + 文件系统 |
| **代理** | Nginx + X-Accel-Redirect |

## 🔌 端口约定

| 端口 | 用途 | 暴露范围 |
|---|---|---|
| **3001** | 后端 Fastify | 仅 `127.0.0.1`，由 Nginx 反代 |
| **5173** | 前端 Vite 开发服 | 仅本地开发用 |
| **80 / 443** | Nginx | 对外服务端口 |

**生产环境用户只访问 80/443**。后端 3001 不应直接对外开放。

## 🛠️ 本地开发

需要 Node.js ≥ 20、npm。

```bash
# === 后端 ===
cd backend
npm install
cp .env.example .env
# 生成 SESSION_SECRET 并填入 .env：
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run migrate            # 建表
npm run create-admin       # 交互式建管理员
npm run dev                # 监听 127.0.0.1:3001

# === 前端（新开终端） ===
cd frontend
npm install
npm run dev                # 监听 http://localhost:5173
```

访问：
- 前台：<http://localhost:5173>
- 后台：<http://localhost:5173/admin>
- API 文档：<http://localhost:3001/api/docs>

## 🚢 生产部署

### 一键安装（推荐）

从 [Releases](../../releases) 页下载 `releasehub-vX.Y.Z.tar.gz`：

```bash
tar xzf releasehub-vX.Y.Z.tar.gz
cd release
chmod +x install.sh

# 三选一
./install.sh              # 装依赖 + 生成 .env（手动启动）
./install.sh --systemd    # 装依赖 + 写入 systemd 服务并 enable（需 sudo）
./install.sh --pm2        # 装依赖 + 用 pm2 启动
```

`install.sh` 做的事：
1. 检查 Node 版本（要求 ≥ 20，推荐 24.x）
2. 在 `backend/` 跑 `npm ci --omit=dev` —— 原生模块（`better-sqlite3`、`argon2`）在目标机器现编，跨发行版/glibc/架构无障碍
3. 复制 `.env.example` → `.env`，自动写入 `openssl rand -hex 32` 生成的 `SESSION_SECRET`

> 服务器需预先安装：`node`（≥ 20）、`npm`、`gcc`/`make`/`python3`（编译原生模块）。
> 想从源码自构建，见下方"方式 B"。

### 包内结构

```
release/
├── install.sh                ← 一键脚本
├── nginx.example.conf        ← Nginx 配置范例
├── backend/
│   ├── dist/                 ← 编译后的 JS（已带）
│   ├── package.json          ← 已带
│   ├── package-lock.json     ← 已带
│   ├── .env.example          ← 已带；install.sh 会生成 .env
│   ├── node_modules/         ← install.sh 现场装
│   ├── data/                 ← 首次启动自动建（SQLite）
│   └── storage/              ← 首次启动自动建（固件文件）
└── public/                   ← Nginx 静态根（assets/ + index.html）
```

### 方式 B：源码自构建

```bash
cd backend && npm ci && npm run build && npm prune --omit=dev
cd ../frontend && npm ci && npm run build
# 然后把 backend/{dist,package.json,package-lock.json,.env.example} 与 frontend/dist/* 部署到服务器
```

### 配 `.env`（install.sh 已自动生成基础版，可按需微调）

```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 复制 64 位 hex
vim .env
```

**生产配置范例**：
```ini
PORT=3001
HOST=127.0.0.1
DATABASE_PATH=./data/releasehub.db
FIRMWARE_STORAGE_DIR=./storage/firmware

SESSION_SECRET=刚才生成的64位hex      # 必改

COOKIE_SECURE=true                   # HTTPS 站点必须 true
MAX_UPLOAD_BYTES=104857600           # 100MB，按需调

# Nginx X-Accel 直传（要在 Nginx 配 internal location 后才能用）
XACCEL_REDIRECT_PREFIX=/internal-firmware/

# CORS（同域部署可留空；跨域填前端实际地址）
CORS_ORIGINS=
```

### 建库 + 建管理员（首次部署）

```bash
cd backend
node dist/src/db/migrate.js          # 建表（启动时也会自动 migrate）
node dist/scripts/create-admin.js    # 交互式建管理员
```

### 启动后端

> 用 `./install.sh --systemd` 或 `./install.sh --pm2` 已经帮你做完了。下方仅作参考。

**手动验证**：
```bash
cd backend && node dist/src/index.js
# 看到 "Server listening on http://127.0.0.1:3001" 即成功
```

**systemd 模板**（`install.sh --systemd` 自动生成等价文件）：
```ini
# /etc/systemd/system/releasehub.service
[Unit]
Description=ReleaseHub
After=network.target

[Service]
Type=simple
WorkingDirectory=/www/wwwroot/releaseHub/backend
ExecStart=/usr/bin/node dist/src/index.js
Restart=on-failure
MemoryMax=256M
User=root

[Install]
WantedBy=multi-user.target
```
```bash
systemctl daemon-reload
systemctl enable --now releasehub
systemctl status releasehub
```

**或宝塔面板「Node 项目 → 传统项目」**：

| 字段 | 值 |
|---|---|
| 项目名称 | `releasehub` |
| Node 版本 | ≥ v20 |
| 启动文件 | `/www/wwwroot/releaseHub/backend/dist/src/index.js` |
| 运行目录 | `/www/wwwroot/releaseHub/backend` |
| 参数 | （留空） |
| 环境变量 | （留空，由 `.env` 自动加载） |

### 配 Nginx

参考 [`deploy/nginx.example.conf`](deploy/nginx.example.conf)，三处必改：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /www/wwwroot/releaseHub/public;
    index index.html;

    # 前端 SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反代到后端
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100M;       # 与 MAX_UPLOAD_BYTES 一致
    }

    # 固件下载 X-Accel-Redirect 内部转发
    location /internal-firmware/ {
        internal;
        alias /www/wwwroot/releaseHub/backend/storage/firmware/;
    }
}
```

`systemctl reload nginx` 后即可对外访问。

## 🔑 API 用法

### 创建 Token

后台 → **API 令牌** → 新建。**明文仅在创建时显示一次**，请立即保存。

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
    "changelog": "## 1.2.3\n- 修复 X"
  }'
```

也可用脚本：[`scripts/upload.mjs`](scripts/upload.mjs)
```bash
API_URL=https://your-domain.com API_TOKEN=rh_xxx \
  node scripts/upload.mjs ./firmware.bin
```

## 🗄️ 数据模型

```
Category    森林 + 物化路径，支持无限层级
Channel     互斥单选（稳定 / 快速 / Beta）
Tag         多对多扁平标签
Firmware    title + version + channel + sha256 + changelog
AdminUser   Argon2 哈希密码
ApiToken    Bearer Token（哈希存储）
```

文件以 `<storage>/<sha[0:2]>/<sha>` 路径保存，相同 SHA 全网仅存一份。

## 💾 备份

只需备份两个目录：

```bash
tar czf releasehub-backup-$(date +%F).tgz backend/data/ backend/storage/
```

SQLite WAL 模式下热备份安全，可加 cron 每日执行。

## 🧮 资源占用

| 资源 | 占用 |
|---|---|
| 运行内存 | 60–80 MB |
| 启动时间 | < 1s |
| 安装空间（含 node_modules，install.sh 装完） | ~120 MB |

可在 1 GB 内存 / 128 MB 余量的小服务器流畅运行。

## 📄 License

[MIT](LICENSE) © applenana

---

<div align="center">

如果这个项目对你有帮助，欢迎点 ⭐

</div>
