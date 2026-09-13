-- 节147 · 回滚：user_settings.share_mingli_ui 列名还原为 share_taichu_ui
-- 适用库：analytics（同 0002_rename_share_mingli_ui.sql）
--
-- 用途：若节147 上线后需回退到旧代码（旧代码读 share_taichu_ui），先跑本脚本再回退部署。
-- 幂等：重复执行会报 `no such column: share_mingli_ui`（说明已还原），可安全忽略。
-- 注意：回滚**不回滚**数据库文件名 —— 文件名与 DB 路径由 MINGLI_* 环境变量控制，
--       回退部署时须同时把环境变量改回旧前缀、并把 mingli_*.db 改回 taichu_*.db。

ALTER TABLE user_settings RENAME COLUMN share_mingli_ui TO share_taichu_ui;
