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

---

## 服务器运维注意事项（⚠️ 勿回滚 / 覆盖）

### 1. DNS 已改为公共 DNS（勿改回阿里云内网 DNS）

阿里云新加坡 ECS 默认 DNS `100.100.2.136 / 100.100.2.138` **在新加坡节点不可达**，会导致：
- 容器内 DNS 解析失败（`lookup ... on 127.0.0.11:53: server misbehaving`）
- Caddy 申请/续期 Let's Encrypt 证书失败

**已通过 `/etc/netplan/50-cloud-init.yaml` 持久化改为公共 DNS**（备份在 `50-cloud-init.yaml.bak`）：

```yaml
nameservers:
    addresses: [223.5.5.5, 223.6.6.6]
```

**⚠️ 请勿把 nameservers 改回 `100.100.2.x`**，否则 DNS 解析与证书续期会再次失败。

### 2. OpenClaw 接入点 `bb3a.taichu.xyz` 仅允许 Tailscale

`Caddyfile` 里 `bb3a.taichu.xyz` 加了 `remote_ip 100.64.0.0/10` 白名单，**公网一律 403**：
- 仅 Tailnet 内设备可访问（DNS 需指向新加坡 ECS 的 Tailscale IP `100.121.191.96`）。
- **若移除该白名单，OpenClaw 会暴露公网**（远程控制风险），勿删。

### 3. 证书续期注意

`bb3a.taichu.xyz` 的 DNS 指向 Tailscale IP 后，Let's Encrypt 的 HTTP-01 续期（公网验证）会失败。
证书到期前（约 3 个月）需**临时把 DNS 切回公网 IP `47.237.91.97`** 完成续期，或改用 DNS-01 续期。

### 4. SSH 已改为密钥登录

服务器已禁用密码登录（`PasswordAuthentication no` + `PermitRootLogin prohibit-password`），仅可用本地私钥 `~/.ssh/taichu_sg_ed25519` 登录。改回密码登录需谨慎（弱密码有被爆破风险）。
