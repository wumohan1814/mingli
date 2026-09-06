# ops/deploy · 部署说明

太初线上部署采用「**模块化单体 Docker 镜像 + Caddy HTTPS 反代 + SQLite 持久卷**」。

## 文件

| 文件 | 位置 | 作用 |
|---|---|---|
| `Dockerfile` | 仓库根 | Python 3.13 + Node 22 双运行时镜像（含排盘 node_modules/vendor） |
| `docker-compose.yml` | 仓库根 | web 单体 + Caddy 编排 |
| `Caddyfile` | 仓库根 | 域名 HTTPS + 反代 |
| `deploy.sh` | 本目录 | 服务器一键部署（拉代码 → 写 .env → 构建启动） |
| `backup.sh` | 本目录 | 每日 SQLite 备份 |

## 首次部署（服务器上）

```bash
# 1. 拉代码（需先配好 GitHub 部署密钥，见下）
git clone git@github.com:wumohan1814/taichu.git /opt/taichu/app

# 2. 一键部署
cd /opt/taichu/app
bash ops/deploy/deploy.sh
```

`deploy.sh` 首次会交互式让你填 `TAICHU_LLM_API_KEY`，并自动生成强随机 `TAICHU_JWT_SECRET` 写入 `.env`。

## 后续更新

```bash
cd /opt/taichu/app
git pull
docker compose up -d --build
```

## 每日备份

```bash
# 配置 crontab 每日 3 点备份
crontab -e
# 加入：
0 3 * * * /bin/bash /opt/taichu/app/ops/deploy/backup.sh
```

## 前置条件

1. 域名 `taichu.xyz` 的 A 记录指向服务器 IP。
2. 服务器安全组放行 80 / 443（HTTPS）、22（SSH）。
3. GitHub 部署密钥已加到仓库（只读 Deploy Key），服务器 `~/.ssh/config` 已配置指向该密钥。
4. 服务器已装 Docker + Docker Compose（`curl -fsSL https://get.docker.com | sh`）。
