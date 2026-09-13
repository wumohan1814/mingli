# ops/deploy · 部署说明

命理太初线上部署采用「**模块化单体 Docker 镜像 + Caddy HTTPS 反代 + SQLite 持久卷**」。

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
git clone git@github.com:wumohan1814/mingli.git /opt/mingli/app

# 2. 一键部署
cd /opt/mingli/app
bash ops/deploy/deploy.sh
```

`deploy.sh` 首次会交互式让你填 `MINGLI_LLM_API_KEY`，并自动生成强随机 `MINGLI_JWT_SECRET` 写入 `.env`。

## 后续更新

```bash
cd /opt/mingli/app
git pull
docker compose up -d --build
```

## 每日备份

```bash
# 配置 crontab 每日 3 点备份
crontab -e
# 加入：
0 3 * * * /bin/bash /opt/mingli/app/ops/deploy/backup.sh
```

## 前置条件

1. 域名 `mingli.example.com` 的 A 记录指向服务器 IP。
2. 服务器安全组放行 80 / 443（HTTPS）、22（SSH）。
3. GitHub 部署密钥已加到仓库（只读 Deploy Key），服务器 `~/.ssh/config` 已配置指向该密钥。
4. 服务器已装 Docker + Docker Compose（`curl -fsSL https://get.docker.com | sh`）。

---

## 服务器运维注意事项（⚠️ 勿回滚 / 覆盖）

### 1. DNS 已改为海外公共 DNS（勿改回国内/阿里云内网 DNS）

阿里云新加坡 ECS 默认 DNS `100.100.2.136 / 100.100.2.138` **在新加坡节点不可达**；而国内公共 DNS `223.5.5.5` **跨境访问会超时**（会导致 sshd 的 UseDNS 反解析卡死、SSH 连不上）。两者都不可用。

**已通过 `/etc/netplan/50-cloud-init.yaml` 持久化改为海外 DNS**（备份在 `50-cloud-init.yaml.bak`）：

```yaml
nameservers:
    addresses: [8.8.8.8, 1.1.1.1]
```

**⚠️ 请勿把 nameservers 改回 `100.100.2.x` 或 `223.5.5.5`**，否则 DNS 解析失败 / SSH 卡死 / 证书续期失败。

**同时已关 sshd 的 UseDNS**（`/etc/ssh/sshd_config` 加 `UseDNS no`），避免 SSH 反向解析卡顿。

### 2. OpenClaw 接入点 `bb3a.mingli.example.com`（公网可访问 + 回程走 Tailscale）

**目标**：客户端在公网（**不开 Tailscale**）也能连杭州 OpenClaw；杭州 OpenClaw 本体不暴露公网。

- 架构：客户端 → 公网 `bb3a.mingli.example.com`（DNS 指向公网 IP `<你的服务器 IP>`）→ 新加坡 Caddy → Tailscale 隧道 → 杭州 serve（`<你的 Tailscale IP>:443`）→ OpenClaw（loopback）。
- **Caddy 上游必须用 Tailscale IP + 显式 SNI**（不能用 MagicDNS 域名，因为 Docker 容器内无法解析 `.ts.net`）：
  ```caddyfile
  bb3a.mingli.example.com {
      reverse_proxy https://<你的 Tailscale IP>:443 {
          transport http {
              tls_insecure_skip_verify
              tls_server_name <你的 Tailscale 主机名>
          }
          header_up Host {http.request.host}
          header_up X-Forwarded-Proto {scheme}
      }
  }
  ```
- 访问控制 = 随机子域 `bb3a` + OpenClaw 配对 token（双重保护）。**⚠️ 此入口公网可达，token 泄露即远程控制风险，勿移除配对 token。**

### 3. 证书续期

`bb3a.mingli.example.com` 的 DNS 指向公网 IP `<你的服务器 IP>`，Let's Encrypt HTTP-01 续期**正常**，无需特殊处理。

### 4. SSH 已改为密钥登录

服务器已禁用密码登录（`PasswordAuthentication no` + `PermitRootLogin prohibit-password`），仅可用本地私钥 `~/.ssh/<你的私钥文件>` 登录。改回密码登录需谨慎（弱密码有被爆破风险）。

> ⚠️ **该私钥文件名未随节147 改名**：它同时存在于服务器 `~/.ssh/` 与本地 `~/.ssh/`，
> 改名要两边同步 + 改 `~/.ssh/config`，做错会直接失去登录通道。要改名请按下方
> 「节147 迁移 · 可选：SSH 私钥改名」走。

---

## 节147 · 代号 `taichu`→`mingli` 的线上迁移步骤

> **本节是唯一迁移清单**。代码侧已全部改完（env 前缀 / DB 文件名 / 目录 / 镜像 / 卷 / docker 网络 /
> 前端本地存储键 / DB 列名），**线上还没动** —— 按下面顺序做，每步都能回退。

### 第 0 步 · 备份（必做，不可跳过）

```bash
bash /opt/taichu/app/ops/deploy/backup.sh        # 数据 + 配置快照
ls -l /opt/taichu/backup/                        # 确认产物存在且非空
```

### 第 1 步 · 仓库改名（GitHub 侧）

本仓库地址已改为 `git@github.com:wumohan1814/mingli.git`。请在 GitHub 上把仓库改名
（旧名会自动 301 重定向，但**部署脚本用的是新地址**，所以改名必须在服务器 `git pull` 前完成）。

### 第 2 步 · 部署目录改名

```bash
cd /opt && git -C taichu status --short   # 确认工作区干净（有在制品先处理）
docker compose -f taichu/app/docker-compose.yml down
mv /opt/taichu /opt/mingli
```

`backup.sh` 里的 `DATA_DIR` / `BACKUP_DIR` 已指向 `/opt/mingli/...`，无需手改。

### 第 3 步 · `.env` 逐键改名（**最容易漏的一步**）

`.env` 不在仓库里，**旧键名在新代码下全部失效**（`env_prefix` 已改为 `MINGLI_`）。
逐键把 `TAICHU_` 换成 `MINGLI_`，核对清单以 `.env.example` 为唯一来源：

```bash
cd /opt/mingli/app
sed -i 's/^TAICHU_/MINGLI_/' .env
grep -c '^MINGLI_' .env          # 应与 .env.example 的键数一致
grep '^TAICHU_' .env             # 必须为空
```

⚠️ 同时**删掉节146 遗留的金数据键**（`*_JINSHUJU_*`，已整组废弃）。

### 第 4 步 · 数据库文件名 + 列名

```bash
cd /opt/mingli/data
mv taichu_analytics.db mingli_analytics.db
mv taichu_feedback.db  mingli_feedback.db
mv taichu_ops.db       mingli_ops.db

# 列改名（幂等：重复执行会报 no such column，说明已改过，可忽略）
sqlite3 mingli_analytics.db < /opt/mingli/app/data/migrations/analytics/0002_rename_share_mingli_ui.sql
# 节146 遗留：充值码表（若上次部署没执行过）
sqlite3 mingli_analytics.db < /opt/mingli/app/data/migrations/analytics/0001_drop_recharge_codes.sql
```

### 第 5 步 · 起服务 + 验证链

```bash
cd /opt/mingli/app
docker compose up -d --build
docker compose ps                                     # web / caddy 均 healthy
curl -s https://mingli.example.com/api/health                 # {"status":"ok",...}
curl -sI https://mingli.example.com/ | head -1                # 200
docker compose logs --tail=50 web                     # 无循环重启、无 KeyError
```

`docker-compose.yml` 的**服务名 / 网络名 / 卷名 / 宿主路径**已改为 `mingli`，`down` + `up` 一次即生效。

### 例外两项（**有意不改**，见 `40_节/完成/节147-*.md`）

| 项 | 现值 | 为什么不改 | 若要改 |
|---|---|---|---|
| 线上域名 | `mingli.example.com`、`bb3a.mingli.example.com` | 已注册 + DNS 生效 + Let's Encrypt 在跑；节142 拍板本实例只是发布/内容载体，不是官方托管服务 → 改名零收益、有中断窗口 | 注册新域名 → A 记录指 `<你的服务器 IP>` → 改 `Caddyfile` 两处 → `docker compose restart caddy` 让它重签证书 |
| SSH 私钥文件名 | `~/.ssh/<你的私钥文件>` | 服务端与本地各一份，改名要同步 + 改 `~/.ssh/config`；做错失去登录通道 | **先保一条可用会话**：`cp ~/.ssh/<你的私钥文件> ~/.ssh/<你的私钥文件>` → 新开一个会话验证能登录 → 再改 `~/.ssh/config` 与服务器 `authorized_keys`/文件名 → 最后删旧文件 |

### 回退

代码回退：`git reset --hard <节147 之前的 commit>` + 把 `.env` 键名改回 `TAICHU_`、
DB 文件改回 `taichu_*.db`、跑 `0002_rollback_rename_share_mingli_ui.sql`。
**注意：回退不会自动发生** —— 数据库文件名与列名必须手工还原。
