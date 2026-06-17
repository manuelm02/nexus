-- V1_13: DeepSeek 等 API 余额监控的历史快照，供卡片内迷你趋势图和定时同步使用

CREATE TABLE IF NOT EXISTS subscription_balance_snapshots (
    id VARCHAR(36) PRIMARY KEY,
    subscription_id VARCHAR(36) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    balance NUMERIC(12,2) NOT NULL,
    currency VARCHAR(8) NOT NULL,
    raw_json JSONB,
    snapshotted_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_balance_snapshots_sub
    ON subscription_balance_snapshots (subscription_id, snapshotted_at DESC);
