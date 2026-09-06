# 太初 · 命理 H5 后端镜像（Python 3.13 + Node 22 双运行时）
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

# 2. 复制后端（含 pyproject.toml、app/ 代码、paipan-node/ 排盘 Node 依赖）并安装 Python 依赖
COPY backend/ /app/backend/
RUN cd /app/backend/paipan-node && npm install --no-audit --no-fund
RUN pip install --no-cache-dir /app/backend/

# 3. 复制前端免构建静态文件（frontend/public 由 FastAPI 直接托管）
COPY frontend/public/ /app/frontend/public/

# 4. 数据目录（运行时挂载持久卷）
RUN mkdir -p /app/data

WORKDIR /app/backend
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

# 启动 uvicorn（main.py lifespan 会自动拉起 paipan-node/server.mjs 常驻排盘服务）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
