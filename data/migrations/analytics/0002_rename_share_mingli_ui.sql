-- 节147 · 项目代号 taichu→mingli：user_settings.share_taichu_ui 列改名
-- 适用库：analytics（本地 backend/data/mingli_analytics.db 与 data/mingli_analytics.db；
--         线上 /opt/mingli/data/mingli_analytics.db）
--
-- 为什么必须改：列名含项目代号 taichu，而 REST 字段名与列名同源
-- （backend/app/api/settings.py 的 SETTINGS_KEYS / models/analytics.py::UserSettings）。
-- 代码侧已同步改为 share_mingli_ui；若库里仍是旧列名，SQLAlchemy 读该列会报
-- no such column，而 PUT 写入会静默丢字段 → 用户「分享表单品牌条」开关失效。
--
-- 幂等：SQLite 的 ALTER TABLE RENAME COLUMN 无 IF EXISTS 语法。
--   重复执行会报 `no such column: share_taichu_ui` —— 那说明已经改过，可安全忽略。
--   执行前自检（返回 1 行 = 需要执行；0 行 = 已改过或该库无此表）：
--     SELECT name FROM pragma_table_info('user_settings') WHERE name='share_taichu_ui';
--
-- 回滚：0002_rollback_rename_share_mingli_ui.sql
-- 用户拍板（见 40_节/完成/节147-*.md）：本列随代号全改，不做「保留旧列名」的例外。

ALTER TABLE user_settings RENAME COLUMN share_taichu_ui TO share_mingli_ui;
