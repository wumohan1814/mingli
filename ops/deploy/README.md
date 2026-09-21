# ops/deploy · 部署说明

命理线上部署采用「**模块化单体 Docker 镜像 + Caddy HTTPS 反代 + SQLite 持久卷**」。

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

## 环境变量与 LLM Key（服务器侧）

**key 不进仓库**这条规矩对服务器同样成立（本地开发机已改走系统环境变量，见 `docs/API-Key安全与LLM接入说明.md`）。服务器侧有**两种合法做法**：

1. **服务器自己的 `.env`（推荐、最省事）**：`/opt/mingli/app/.env` 是**服务器本地文件、不在仓库里**，且被 `.gitignore` 的 `.env` 规则覆盖；`deploy.sh` 首次部署就是往它里面写（含 `MINGLI_LLM_API_KEY`）。
2. **systemd `EnvironmentFile=` 或宿主机环境变量**：不想让 key 落在 app 目录时，把 key 写进 `/etc/mingli.env`（`chmod 600`）并由 systemd `EnvironmentFile=/etc/mingli.env` 注入；或 `export` 到启动 shell / 写宿主机 `/etc/environment`，由容器启动时继承。

> ⚠️ **D 方案（Docker Compose 部署）下，`docker-compose.yml` 的 `${MINGLI_LLM_API_KEY}` 由宿主机环境变量插值**：`docker compose` 是**在宿主机上**解析 compose 文件的，`${...}` 取宿主机环境变量（并以项目目录的 `.env` 作为插值默认值，**shell 环境优先于 `.env`**）。所以上面两种做法都能生效；但**换 key 后必须让 compose 重新解析**——`docker compose up -d --force-recreate web`（只 `restart` 容器不会换 key）。

## 后续更新

```bash
cd /opt/mingli/app
git pull
docker compose up -d --build
```

⚠️ **前端内容变更后必须 bump 缓存版本号**（节160 起）：Caddy 对静态资源（js/css/data）设了
`Cache-Control: public, max-age=3600`（1 小时）——`index.html` / `admin.html` 里的静态引用带
`?v=<数字>`（如 `/js/views-divination.js?v=160`），**改过任何前端文件（js/css/data/HTML）就把
所有 `?v=` 的数字整体换成一个新值**（用新节号），否则客户端最多 1 小时内仍会拿到旧文件。
改法：`node .tmp_pytest/cache_bust.js <新版本号>` 已随仓库记录（或手工全局替换 `?v=数字`）。
后端/数据文件变更（questions-120.json、prompts、marker.py 等）不依赖 `?v=`，无需 bump。

## 每日备份

```bash
# 配置 crontab 每日 3 点备份
crontab -e
# 加入：
0 3 * * * /bin/bash /opt/mingli/app/ops/deploy/backup.sh
```

## 前置条件

1. **站点域名**（`.env` 的 `MINGLI_SITE_DOMAIN`）的 A 记录指向服务器 IP —— 域名是**可配置项**，仓库里不写真实值（见下方「站点域名怎么配」）。
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

### 2. OpenClaw 接入点（**可选附加站点**，域名自填）

**目标**：客户端在公网（**不开 Tailscale**）也能连杭州 OpenClaw；杭州 OpenClaw 本体不暴露公网。

**它不是主站**，所以节147 起从 `Caddyfile` 抽成了**可选附加站点**：仓库里只放一个示例，
你填好的那份被 `.gitignore` 排除，**真实域名与内网地址不会进仓库**（开源/推送都不带出去）。

怎么启用（三步）：

```bash
cd /opt/mingli/app
cp ops/deploy/caddy-extra.example ops/deploy/caddy-extra.caddy
$EDITOR ops/deploy/caddy-extra.caddy      # 填自己的域名 / <隧道对端 IP> / <Tailscale 主机名>
echo 'MINGLI_CADDY_EXTRA=./ops/deploy/caddy-extra.caddy' >> .env
docker compose up -d --force-recreate caddy
```

- 架构：客户端 → 公网接入域名（DNS 指向服务器公网 IP）→ 新加坡 Caddy → Tailscale 隧道 → 杭州 serve → OpenClaw（loopback）。完整 Caddyfile 片段见 `ops/deploy/caddy-extra.example`。
- **Caddy 上游必须用 Tailscale IP + 显式 SNI**（不能用 MagicDNS 域名，因为 Docker 容器内无法解析 `.ts.net`）—— 示例里已写好。
- 访问控制 = 随机子域 + OpenClaw 配对 token（双重保护）。**⚠️ 此入口公网可达，token 泄露即远程控制风险，勿移除配对 token。**
- ⚠️ **`git reset --hard` 不会删掉 `caddy-extra.caddy`**（未跟踪文件），所以它能在多次部署间存活；但别对它跑 `git clean`。

### 3. 证书续期

两个站点（主站 + 可选的附加站点）都由 Caddy 自动经 Let's Encrypt HTTP-01 续期，只要各自域名的 A 记录仍指向本服务器即可，**无需特殊处理**。

> 到期前想确认：`docker compose logs --tail=200 caddy | grep -i -E 'certificate|renew'`。

### 4. SSH 已改为密钥登录

服务器已禁用密码登录（`PasswordAuthentication no` + `PermitRootLogin prohibit-password`），仅可用本地私钥登录（文件名见你的 `~/.ssh/config`；仓库里按 `<你的私钥文件>` 占位，不写真实文件名）。改回密码登录需谨慎（弱密码有被爆破风险）。

> ⚠️ **私钥文件在两个地方各有一份**（服务器 `~/.ssh/` 与本地 `~/.ssh/`），改名要两边同步 + 改 `~/.ssh/config`，
> 做错会直接失去登录通道 —— 所以**仓库里只写占位名**，要改名请按最下方「可选：SSH 私钥改名」走。

---

## 站点域名怎么配（节147：**可配置项**）

用户 2026-09-14 定：**域名是部署配置，不是项目标识**；并且**真实域名不进开源仓库**（否则一开源就把自己的域名暴露了）。

| 项 | 位置 | 说明 |
|---|---|---|
| 主站域名 | `.env` 的 `MINGLI_SITE_DOMAIN` | 必填。`docker-compose.yml` 把它透传给 caddy 容器，`Caddyfile` 用 `{$MINGLI_SITE_DOMAIN}` 取。**未配置时 Caddy 直接启动失败**（有意为之：不让占位域名去申请证书） |
| 可选附加站点 | `.env` 的 `MINGLI_CADDY_EXTRA` + `ops/deploy/caddy-extra.caddy` | 不设 = 挂仓库里的空文件，等于不启用 |
| 仓库里的值 | `.env.example` | **一律占位**（`mingli.example.com` / `agent.example.com`） |
| 本机 / 线上真实值 | 各自的 `.env` | `.env` 已被 `.gitignore` 排除，**永不入库** |

**开源前自检**：`git grep -n -i -E '你的域名|你的服务器 IP'` 应为空；
`.env` / `ops/deploy/caddy-extra.caddy` / `docs/未公开/` 都不在 git 里。

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

⚠️🔴 **并补上四个新键 —— 不补 Caddy 与合规文书都会出问题**：

```bash
cd /opt/mingli/app
# ① 站点域名（Caddyfile 已改为从环境变量取域名；不补 caddy 起不来）
echo 'MINGLI_SITE_DOMAIN=<你的真实域名>' >> .env
# ② 合规文书的运营主体（用户协议 / 隐私政策线上要展示；不补则 /legal/*.html 返回 500）
cat >> .env <<'EOF'
MINGLI_OPERATOR_NAME=<运营者名称>
MINGLI_OPERATOR_CONTACT=<联系方式>
MINGLI_OPERATOR_EMAIL=<邮箱>
EOF
docker compose config >/dev/null && echo 'compose 配置可解析'
```

需要那个可选 Agent 接入点的话，按上方「OpenClaw 接入点（可选附加站点）」三步一并做掉。

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
curl -s https://<你的域名>/api/health                 # {"status":"ok",...}
curl -sI https://<你的域名>/ | head -1                # 200
docker compose logs --tail=50 web                     # 无循环重启、无 KeyError
```

`docker-compose.yml` 的**服务名 / 网络名 / 卷名 / 宿主路径**已改为 `mingli`，`down` + `up` 一次即生效。

### 个人基础设施（**不进仓库**，各有各的规矩）

| 项 | 现状 | 为什么 | 要动它时 |
|---|---|---|---|
| 站点域名 | **已改为可配置项**：值在 `.env` 的 `MINGLI_SITE_DOMAIN`，仓库里只有占位 | 用户 2026-09-14：域名是部署配置、不是项目标识；且一开源就会把自己的域名暴露出去 | 换域名 = 改 `.env` 一处 + A 记录 + `docker compose up -d --force-recreate caddy`（Caddy 自动重签证书） |
| 可选附加站点 | 值在 `.env` 的 `MINGLI_CADDY_EXTRA` + 未入库的 `ops/deploy/caddy-extra.caddy` | 同上（含内网 IP / Tailscale 主机名等**更敏感**的信息） | 见上方「OpenClaw 接入点（可选附加站点）」 |
| SSH 私钥文件名 | 仓库里按 `<你的私钥文件>` 占位，真实名只在你的 `~/.ssh/config` | 服务端与本地各一份，改名要两边同步；做错失去登录通道 | **先保一条可用会话**：`cp ~/.ssh/<旧> ~/.ssh/<新>` → 新开一个会话验证能登录 → 再改 `~/.ssh/config` 与服务器 `authorized_keys`/文件名 → 最后删旧文件 |
| 合规文书运营主体 | 仓库里 `frontend/public/legal/*.html` 与 `docs/legal/*.md` **只含 `{{OPERATOR_*}}` 占位符**；真实值在 `.env` 的 `MINGLI_OPERATOR_*`，由后端服务端渲染注入 | 协议与隐私政策是线上必须写真实主体的合规文书，但一开源就公开个人信息 | 改主体信息 = 改 `.env` 三项 + 重启 web 容器（**不用改仓库文件**）；换主体记得同时更新协议里的生效日期与 `docs/legal/交付说明与风险清单.md` |

> 本节的口径：**凡是能定位到你个人的东西（域名 / 公网 IP / 内网 IP / 私钥名 / 真实姓名与联系方式），
> 一律不进仓库**，只出现在 `.env`、`.gitignore` 覆盖的本地文件、或 `docs/未公开/`。

### 回退

代码回退：`git reset --hard <节147 之前的 commit>` + 把 `.env` 键名改回 `TAICHU_`、
DB 文件改回 `taichu_*.db`、跑 `0002_rollback_rename_share_mingli_ui.sql`。
**注意：回退不会自动发生** —— 数据库文件名与列名必须手工还原。
