# 命理 H5 后端镜像（Python 3.13 + Node 22 双运行时）
# 说明：排盘引擎需要 Node 子进程（紫微 iztro / 占星·七政·奇门·五运六气 mingyu-core），
#       因此镜像必须同时具备 Python 与 Node 两个运行时。
FROM python:3.13-slim

ARG NODE_VERSION=22.14.0

# 1. 装系统依赖 + Node 22（官方二进制，可跨平台一致）
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates xz-utils && \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
        | tar -xJ -C /usr/local --strip-components=1 && \
    node --version && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2a. 先复制「依赖清单」再装依赖（节113：层缓存只看清单，后端源码改动不再触发全量重装）
COPY backend/pyproject.toml /app/backend/pyproject.toml
COPY backend/paipan-node/package.json /app/backend/paipan-node/package.json
RUN pip install --no-cache-dir /app/backend/
RUN cd /app/backend/paipan-node && npm install --no-audit --no-fund

# 2b. 复制后端源码与前端免构建静态文件（前端由 Caddy 直服 + FastAPI 兜底托管）
COPY backend/ /app/backend/
COPY frontend/public/ /app/frontend/public/

# 3. 数据目录（运行时挂载持久卷）
RUN mkdir -p /app/data

WORKDIR /app/backend
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# 启动 uvicorn（main.py lifespan 会自动拉起 paipan-node/server.mjs 常驻排盘服务）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]