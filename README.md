# ReleaseHub

> 热成像固件分发平台 · 无限层级分类 · 双层标签 · API 上传

## 技术栈

- **后端**：Node.js + Fastify + TypeScript + better-sqlite3
- **前端**：Vue 3 + Vite + Naive UI + md-editor-v3
- **存储**：SQLite (WAL) + 本地文件系统（SHA256 内容寻址，自动去重）
- **下载传输**：生产环境通过 Nginx `X-Accel-Redirect` 接管，Node 进程零文件传输负担

## 目录

```
backend/    Fastify 服务
frontend/   Vue 3 前端
deploy/     Nginx 配置示例
scripts/    示例脚本（API 上传等）
```

## 开发环境快速启动

### 1. 后端

```powershell
cd backend
npm install
Copy-Item .env.example .env
# 生产部署前请生成新的 SESSION_SECRET：
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm run migrate         # 初始化数据库
npm run create-admin    # 创建第一个管理员
npm run dev             # 启动开发服务 :3001
```

### 2. 前端

```powershell
cd frontend
npm install
npm run dev             # :5173，自动代理 /api 到 3001
```

访问 http://localhost:5173 浏览前台；http://localhost:5173/admin 进入管理后台（首次跳转登录页）。

API 文档（Swagger UI）：http://localhost:3001/api/docs

## 数据模型

- **Category**：森林结构，**无限层级**，物化路径 `/1/4/12/`。一个固件可挂多个节点
- **Channel**：发布通道（稳定/快速/Beta），一个固件归属一个通道（互斥）
- **Tag**：扁平的描述性标签，多对多
- **Firmware**：`title + version + patch_suffix + channel + changelog(Markdown) + sha256 去重 + download_count + is_yanked`
- **AdminUser** / **ApiToken**

## 部署

### 后端

```bash
cd backend
npm ci --omit=dev
npm run build
NODE_ENV=production node dist/index.js
# 或交给你既有的 PM2 / systemd
```

`backend/.env` 关键项：
- `SESSION_SECRET`：**生产务必随机生成** 64 位十六进制
- `COOKIE_SECURE=true`（HTTPS 下）
- `XACCEL_REDIRECT_PREFIX=/internal-firmware`（启用 Nginx 直传）
- `DATABASE_PATH`、`FIRMWARE_STORAGE_DIR` 指向持久化目录

### 前端

```bash
cd frontend
npm ci
npm run build
# 把 dist/ 部署到 Nginx root
```

### Nginx

参考 [`deploy/nginx.example.conf`](deploy/nginx.example.conf)。要点：
1. 静态前端：root 指到 `frontend/dist`，SPA fallback 到 `index.html`
2. `/api/` 反代到 Node 进程
3. `internal` 的 `/internal-firmware/` 直接 alias 固件存储目录，让 Nginx 接管 sendfile

## API 上传示例

```bash
curl -X POST https://firmware.example.com/api/v1/firmwares \
  -H "Authorization: Bearer rh_xxxxxxxxxxxx" \
  -F "file=@./firmware.bin" \
  -F 'meta={"title":"3.2寸 MLX 双光","version":"1.2.3","channel_key":"stable","category_ids":[3,5],"tag_names":["推荐"],"changelog":"## 1.2.3\n- 修复 xxx"}'
```

或使用 [`scripts/upload.mjs`](scripts/upload.mjs)：

```bash
API_URL=https://firmware.example.com API_TOKEN=rh_xxx node scripts/upload.mjs ./firmware.bin
```

Token 在管理后台「API 令牌」页创建，**仅创建时显示一次明文**。

## 备份

只需备份两个目录：

```bash
tar czf releasehub-backup-$(date +%F).tgz \
    backend/data/releasehub.db \
    backend/data/releasehub.db-wal \
    backend/data/releasehub.db-shm \
    backend/storage/
```

建议加 cron 每日执行。SQLite WAL 模式下热备份是安全的。

## 内存预算

- Node + Fastify + better-sqlite3：~60-80 MB
- Nginx 复用既有进程，零增量
- 总计在轻量服务器 128MB 余量内安全运行

## 路线图（可选增强）

- [ ] RSS / Atom 订阅新版本
- [ ] Webhook 通知（QQ 机器人 / 钉钉 / 企业微信）
- [ ] 按通道的下载趋势图
- [ ] QQ 群文件批量迁移工具（按文件名正则解析维度）
