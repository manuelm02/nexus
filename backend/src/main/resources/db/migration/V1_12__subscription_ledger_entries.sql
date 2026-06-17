-- V1_12: 按量订阅充值/消费统一流水表，替代 recharge_records JSONB

CREATE TABLE IF NOT EXISTS subscription_ledger_entries (
    id VARCHAR(36) PRIMARY KEY,
    subscription_id VARCHAR(36) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    entry_type VARCHAR(16) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    note VARCHAR(255),
    occurred_on DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_ledger_entries_sub
    ON subscription_ledger_entries (subscription_id, created_at DESC);

-- 迁移历史充值记录：recharge_records JSONB 数组的每一项变成一条 entry_type='recharge' 的流水
INSERT INTO subscription_ledger_entries (id, subscription_id, entry_type, amount, balance_after, note, occurred_on, created_at)
SELECT
    r->>'id',
    s.id,
    'recharge',
    (r->>'amount')::numeric,
    (r->>'balanceAfter')::numeric,
    r->>'note',
    (r->>'date')::date,
    COALESCE((r->>'createdAt')::timestamp, now())
FROM subscriptions s, jsonb_array_elements(s.recharge_records) r
WHERE s.recharge_records IS NOT NULL AND jsonb_array_length(s.recharge_records) > 0;

ALTER TABLE subscriptions DROP COLUMN IF EXISTS recharge_records;
