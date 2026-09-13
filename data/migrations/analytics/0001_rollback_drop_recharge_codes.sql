-- 节146 · 回滚脚本：重建充值码表（0001_drop_recharge_codes.sql 的逆操作）
-- 适用库：analytics
-- 说明：结构按节146 删除前的 app/models/analytics.py::RechargeCode 原样重建
--   （code PK String(16) / user_id FK users.id index / status String(8) 默认 unused /
--    expires_at DateTime / created_at DateTime）。
-- ⚠️ 只重建**表结构**，不恢复已删数据（充值从未真实开放，存量仅测试假数据）。
-- 幂等：CREATE TABLE IF NOT EXISTS。
CREATE TABLE IF NOT EXISTS recharge_codes (
    code       VARCHAR(16) NOT NULL,
    user_id    INTEGER,
    status     VARCHAR(8),
    expires_at DATETIME,
    created_at DATETIME,
    PRIMARY KEY (code),
    FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE INDEX IF NOT EXISTS ix_recharge_codes_user_id ON recharge_codes (user_id);
