# OpenClaw 接入自有域名(taichu.xyz)方案

日期:2026-09-06
状态:方案待 review(未执行)

## 1. 目标
复用海外域名 `taichu.xyz`,使杭州 ECS(47.99.240.37,阿里云杭州,1.6G 内存)上的 OpenClaw 2026.9.2 可被**授权用户从任意网络配对**,同时**对陌生人不可见/不可连**。用户选择「**新加坡 ECS 绕行**」路径:公开项目与 OpenClaw 接入点都放在新加坡(海外),规避大陆 ICP 备案。

## 2. 备案结论
- 接入点(新加坡 ECS)在境外,域名解析到海外服务器对外提供 Web 服务,**无需 ICP 备案**。
- 此前评估的「直走杭州」因需备案(域名转入国内 + 实名 + 管局审核 1-2 周)复杂度高,已放弃。

## 3. 新加坡 ECS 准备(执行侧)
规格:**2 核 1G 内存**。该机只作 nginx 反代,**绝不在此运行 OpenClaw 实例**。
1. **Tailscale**:安装并加入同一 Tailnet(回程到杭州 OpenClaw 用);若已装则跳过。
2. **nginx**:确认已安装(公开项目在用,通常已装);若无则装轻量 nginx。
3. **证书(Let's Encrypt)**:`acme.sh` 签发 `x9f2.taichu.xyz`(海外正常签发);主推 **DNS-01**(需 DNS 服务商 API),或 **HTTP-01**(需 `80`)。
4. **nginx server block**:`listen 443 ssl; server_name x9f2.taichu.xyz;` 反代回杭州 OpenClaw,经 Tailscale(`proxy_pass http://<杭州 TS IP>:44733` 或 `https://ecs-openclaw.tail5b95c6.ts.net`,执行时确认端口);透传 `Host` / `X-Forwarded-Proto` / WebSocket 升级头。

## 4. 最终架构
- `taichu.xyz` 主域 → 新加坡 ECS(公开项目,不动)
- OpenClaw 随机前缀子域(示例 `x9f2.taichu.xyz`,执行时生成) → DNS A 指向**新加坡 ECS**
- 新加坡 ECS nginx `443`(Let's Encrypt)→ 反代回杭州 OpenClaw(经 Tailscale 隧道)
- 杭州 OpenClaw `gateway.bind` 维持 `loopback`,`tailscale.mode` 维持 `serve`(兜底 / 内网管理)
- 访问控制 = 随机子域(防 DNS 枚举) + OpenClaw 配对 token(防未授权连接)

## 5. 1G 内存约束(重要)
- **仅反代**:nginx 反代 worker 仅数 MB;绝不在此跑 OpenClaw(杭州那台才跑)。
- 建议**加 1G swap** 防 OOM(公开项目若偏重时兜底)。
- 调小 nginx:`worker_processes 1~2`、`worker_connections` 适度,避免内存浪费。
- Let's Encrypt 续期(cron / timer)极轻,无碍。
- 部署后观察 `free -m`,确保「公开项目 + nginx」不触顶。

## 6. 前置条件 / 待确认项
- [ ] 新加坡 ECS 是否已装 nginx / Tailscale
- [ ] 公开项目当前内存占用(`free -m`,评估 1G 余量)
- [ ] Let's Encrypt DNS-01 的 DNS 服务商 API 可用性
- [ ] 随机子域前缀:执行时由 `openssl rand -hex` 生成(如 `x9f2`),或由用户指定
- [ ] 杭州 OpenClaw 配对 URL 的 host 来源(SSH 查 device-pair 扩展):需返回 `wss://<子域>` 而非 Tailscale MagicDNS;预计 `gateway.publicHost` / `publicUrl` 或 serve host 配置

## 7. 备份(执行前,严格串行 SSH)
- 新加坡 `/etc/nginx/`(整目录)→ `/root/nginx-bak-<ts>/`
- 杭州 `/home/wumoh/.openclaw/openclaw.json` → 快照 `.pre-domain-<ts>`
- 杭州 `sudo tailscale serve status --json` 备份
- 生成回滚包 `openclaw-pre-domain-<ts>.tgz`

## 8. 执行步骤(分阶段,严格串行 SSH,禁并发)
阶段 A — 新加坡 ECS
1. 装 Tailscale 并加入同一 Tailnet(若无)
2. 装 `acme.sh`,签 `x9f2.taichu.xyz`(DNS-01 / HTTP-01)
3. nginx 加 server block 反代回杭州(经 Tailscale),透传 `Host` + WebSocket 头
4. `nginx -t && nginx -s reload`
5. (可选)加 1G swap;调小 nginx worker

阶段 B — 杭州 OpenClaw 配对 host
6. SSH 查 `device-pair` 扩展配对 URL 的 host 生成逻辑(上次定位在 `dist/extensions/device-pair/index.js` 附近)
7. 配置 gateway 使其配对 URL 使用子域(publicHost / publicUrl 或 serve host)
8. 完整重启 OpenClaw(经 root / systemctl)使配对 URL 生效

阶段 C — 验证
9. 外网 `curl` 子域 → 应返回配对端点(非 444 / 非拒绝)
10. 手机 / PC 客户端用子域配对(任意网络,无需 Tailscale)
11. 陌生人测试:无 token 应连不上任何业务

## 9. 回滚
- 撤新加坡 nginx server block / 删子域 DNS 记录 / 恢复杭州 `openclaw.json`
- `nginx -s reload` / OpenClaw 重启
- 验证回到 Tailscale 配对现状(8.2 修复后的可用状态)

## 10. 风险
- 新加坡 ↔ 杭州回程延迟(经 Tailscale 约 +几十 ms,配对 / 推理可接受)
- 1G 内存:仅反代安全;监控公开项目占用,必要时 swap 兜底
- 证书续期失败 → 加 SSL 到期告警
- 公开项目 ECS 与杭州 ECS 完全独立,互不影响
- 子域暴露:随机前缀 + 配对 token 双重降低风险
- state DB lease:SSH 严格串行,禁止并发命令

## 11. 暂不执行
本文件为方案文档,经用户 review 确认后再执行。
