#!/bin/bash
# 太初 · 服务器一键部署脚本（在服务器上执行）
# 用法：bash ops/deploy/deploy.sh
set -e

REPO_URL="git@github.com:wumohan1814/taichu.git"
APP_DIR="/opt/taichu/app"

echo "==> [1/4] 拉取代码"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull
fi
cd "$APP_DIR"

echo "==> [2/4] 准备环境变量（.env）"
if [ ! -f ".env" ]; then
  if [ -z "$TAICHU_LLM_API_KEY" ]; then
    read -rp "请输入 TAICHU_LLM_API_KEY（DeepSeek key）: " TAICHU_LLM_API_KEY
  fi
  # JWT 密钥自动生成强随机值（首次）
  TAICHU_JWT_SECRET=$(openssl rand -hex 32)
  cat > .env <<EOF
TAICHU_LLM_API_KEY=$TAICHU_LLM_API_KEY
TAICHU_JWT_SECRET=$TAICHU_JWT_SECRET
EOF
  echo "   已生成 .env（JWT_SECRET 已随机生成）"
else
  echo "   .env 已存在，跳过"
fi

echo "==> [3/4] 构建镜像并启动"
docker compose up -d --build

echo "==> [4/4] 完成"
docker compose ps
echo ""
echo "访问: https://mingli.example.com"
echo "日志: docker compose logs -f web"
