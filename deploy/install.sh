#!/usr/bin/env bash
# ReleaseHub 一键安装/部署脚本
# 用法（在解压后的 release/ 目录下）：
#   chmod +x install.sh
#   ./install.sh                     # 默认：安装依赖 + 生成 .env(若不存在)
#   ./install.sh --start             # 安装完直接前台启动后端
#   ./install.sh --systemd           # 写入 systemd 服务并 enable + start
#   ./install.sh --pm2               # 用 pm2 启动并保存
#
# 此脚本只做安装与启动，**不**配置 Nginx —— 参考同目录 nginx.example.conf 自行配置。

set -euo pipefail

# ---------- 颜色 ----------
if [ -t 1 ]; then
  C_GREEN='\033[1;32m'; C_RED='\033[1;31m'; C_YEL='\033[1;33m'; C_CYA='\033[1;36m'; C_DIM='\033[2m'; C_RST='\033[0m'
else
  C_GREEN=''; C_RED=''; C_YEL=''; C_CYA=''; C_DIM=''; C_RST=''
fi

log()   { echo -e "${C_CYA}[install]${C_RST} $*"; }
ok()    { echo -e "${C_GREEN}[ ok ]${C_RST} $*"; }
warn()  { echo -e "${C_YEL}[warn]${C_RST} $*"; }
fail()  { echo -e "${C_RED}[fail]${C_RST} $*" >&2; exit 1; }

# ---------- 解析参数 ----------
MODE="install"
for arg in "$@"; do
  case "$arg" in
    --start)    MODE="start" ;;
    --systemd)  MODE="systemd" ;;
    --pm2)      MODE="pm2" ;;
    -h|--help)
      sed -n '2,12p' "$0"; exit 0 ;;
    *) fail "未知参数: $arg" ;;
  esac
done

# ---------- 定位 release 根 ----------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

[ -d backend ] || fail "未在 release 根目录运行（缺少 backend/）"
[ -d public  ] || fail "未在 release 根目录运行（缺少 public/）"
[ -f backend/package.json ] || fail "backend/package.json 缺失"

# ---------- 检查 Node ----------
command -v node >/dev/null 2>&1 || fail "未安装 node，请先安装 Node 20+ (推荐 24.x)"
NODE_VER="$(node -v | sed 's/^v//; s/\..*//')"
if [ "$NODE_VER" -lt 20 ]; then
  fail "Node 版本过低: $(node -v)，需 >= 20.x（推荐 24.x）"
elif [ "$NODE_VER" -lt 24 ]; then
  warn "Node 版本 $(node -v) 低于推荐的 24.x（构建环境），原生模块兼容性可能有差异"
else
  ok "Node $(node -v)"
fi

command -v npm >/dev/null 2>&1 || fail "未安装 npm"

# ---------- 安装后端生产依赖 ----------
log "安装后端生产依赖 (npm ci --omit=dev)..."
pushd backend >/dev/null

if [ -f package-lock.json ]; then
  npm ci --omit=dev --no-audit --no-fund
else
  warn "缺少 package-lock.json，回退到 npm install --omit=dev"
  npm install --omit=dev --no-audit --no-fund
fi
ok "后端依赖安装完成"

# ---------- 生成 .env ----------
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    # 自动生成 SESSION_SECRET
    if command -v openssl >/dev/null 2>&1; then
      SECRET="$(openssl rand -hex 32)"
      # sed 兼容 GNU 与 BSD
      if sed --version >/dev/null 2>&1; then
        sed -i "s|^SESSION_SECRET=.*$|SESSION_SECRET=${SECRET}|" .env
      else
        sed -i '' "s|^SESSION_SECRET=.*$|SESSION_SECRET=${SECRET}|" .env
      fi
      ok "已生成 .env 并写入随机 SESSION_SECRET"
    else
      warn "未找到 openssl，已复制 .env.example → .env，请手动设置 SESSION_SECRET"
    fi
  else
    fail "缺少 .env.example 模板"
  fi
else
  ok ".env 已存在，跳过生成（如需重置请删除后重跑）"
fi

popd >/dev/null

# ---------- 完成提示 ----------
PUBLIC_ABS="$SCRIPT_DIR/public"
BACKEND_ABS="$SCRIPT_DIR/backend"

echo
ok "依赖与配置已就绪"
echo -e "${C_DIM}---- 后续步骤 ----${C_RST}"
echo "  1. 配置 Nginx，将 root 指向：${PUBLIC_ABS}"
echo "     参考：${SCRIPT_DIR}/nginx.example.conf"
echo "  2. 启动后端（任选其一）："
echo "     - 前台调试：cd backend && node dist/src/index.js"
echo "     - systemd ：./install.sh --systemd"
echo "     - pm2     ：./install.sh --pm2"
echo

# ---------- 启动模式 ----------
case "$MODE" in
  install)
    exit 0 ;;
  start)
    log "前台启动后端（Ctrl+C 退出）..."
    cd backend
    exec node dist/src/index.js
    ;;
  systemd)
    [ "$(id -u)" -eq 0 ] || fail "--systemd 需要 root 权限（请 sudo 运行）"
    command -v systemctl >/dev/null 2>&1 || fail "系统无 systemctl"

    SERVICE_FILE="/etc/systemd/system/releasehub.service"
    NODE_BIN="$(command -v node)"
    log "写入 systemd 服务: $SERVICE_FILE"
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=ReleaseHub Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=${BACKEND_ABS}
ExecStart=${NODE_BIN} ${BACKEND_ABS}/dist/src/index.js
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable releasehub.service
    systemctl restart releasehub.service
    sleep 1
    systemctl --no-pager status releasehub.service || true
    ok "systemd 服务已启用，查看日志: journalctl -u releasehub -f"
    ;;
  pm2)
    command -v pm2 >/dev/null 2>&1 || fail "未安装 pm2，请先: npm i -g pm2"
    cd backend
    pm2 delete releasehub >/dev/null 2>&1 || true
    pm2 start dist/src/index.js --name releasehub --time
    pm2 save
    ok "pm2 已启动，查看日志: pm2 logs releasehub"
    ;;
esac
