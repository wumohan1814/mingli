#!/bin/bash
# 太初 · 单端口启动脚本（前端免构建，无需 Vite）
#
# 前端不是独立构建/独立端口：frontend/public/index.html 由 FastAPI
# app.mount("/", StaticFiles(.../frontend/public)) 在 8000 端口直接托管。
# 因此本脚本只启动后端一个进程，不再 npx vite 起 5173。
echo "============================================"
echo "太初 · 命理 H5 启动"
echo "============================================"
echo ""
echo "启动后端 (FastAPI + 前端静态文件 :8000)..."
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

echo ""
echo "============================================"
echo "访问:     http://localhost:8000"
echo "API文档:  http://localhost:8000/docs"
echo "如需内网穿透，请运行: ngrok http 8000"
echo "============================================"
