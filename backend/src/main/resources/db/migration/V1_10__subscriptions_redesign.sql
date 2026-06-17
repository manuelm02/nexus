-- V1_10: Subscriptions UI 重构 — 新增自动续费、归档、按量余额/消费/充值记录、订阅分类表

ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS monthly_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recharge_records JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS low_balance_notify BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS low_balance_threshold NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS subscription_categories (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
