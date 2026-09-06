# docker/ — 容器化

## 镜像要求

- 基础镜像需同时提供 **Python 3.13** 与 **Node 22**（`paipan.py` 通过 subprocess 调 Node 脚本）。
- 多阶段构建：Node 阶段装排盘依赖（国内构建用 npmmirror），Python 阶段装应用依赖。
- 非 root 用户运行；镜像内不含任何密钥。

## 待补

- [ ] `Dockerfile`（多阶段）
- [ ] `docker-compose.yml`（本地一键起：应用 + 双库 + 前端）
- [ ] `.dockerignore`
