-- Panel Hub: API Keys 保险箱 + 账号凭据管理 + 关联流水/快照表
-- 将 per_token 数据从 subscriptions 迁移到独立的 api_keys 体系

-- a) API Keys 表：管理各平台 API 密钥的加密存储与状态
CREATE TABLE api_keys (
    id                    VARCHAR(36)   PRIMARY KEY,
    label                 VARCHAR(100)  NOT NULL,
    provider              VARCHAR(50)   NOT NULL,
    encrypted_key         TEXT          NOT NULL,
    base_url              VARCHAR(500),
    status                VARCHAR(20)   NOT NULL DEFAULT 'active',
    plan_name             VARCHAR(100),
    plan_expire_date      DATE,
    subscription_id       VARCHAR(36)   REFERENCES subscriptions(id) ON DELETE SET NULL,
    remaining_balance     NUMERIC(12,2),
    monthly_spend         NUMERIC(12,2) NOT NULL DEFAULT 0,
    low_balance_notify    BOOLEAN       NOT NULL DEFAULT false,
    low_balance_threshold NUMERIC(12,2),
    api_fetch_enabled     BOOLEAN       NOT NULL DEFAULT false,
    api_last_fetched_at   TIMESTAMP,
    api_balance_json      JSONB,
    notes                 TEXT,
    archived              BOOLEAN       NOT NULL DEFAULT false,
    created_at            TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP     NOT NULL DEFAULT now()
);

-- b) Credentials 表：管理各平台登录账号、密码和 TOTP 密钥的加密存储
CREATE TABLE credentials (
    id                    VARCHAR(36)   PRIMARY KEY,
    platform              VARCHAR(100)  NOT NULL,
    label                 VARCHAR(100),
    category              VARCHAR(50),
    username              VARCHAR(200),
    encrypted_password    TEXT,
    encrypted_totp_secret TEXT,
    url                   VARCHAR(500),
    expire_date           DATE,
    subscription_id       VARCHAR(36)   REFERENCES subscriptions(id) ON DELETE SET NULL,
    notes                 TEXT,
    archived              BOOLEAN       NOT NULL DEFAULT false,
    created_at            TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP     NOT NULL DEFAULT now()
);

-- c) API Key 流水记录：记录充值和消费明细
CREATE TABLE api_key_ledger_entries (
    id            VARCHAR(36)   PRIMARY KEY,
    api_key_id    VARCHAR(36)   NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    entry_type    VARCHAR(16)   NOT NULL,
    amount        NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    note          VARCHAR(255),
    occurred_on   DATE          NOT NULL,
    created_at    TIMESTAMP     NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_key_ledger_api_key ON api_key_ledger_entries (api_key_id, created_at DESC);

-- d) API Key 余额快照：记录每次余额同步时的快照数据
CREATE TABLE api_key_balance_snapshots (
    id             VARCHAR(36)   PRIMARY KEY,
    api_key_id     VARCHAR(36)   NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    balance        NUMERIC(12,2) NOT NULL,
    currency       VARCHAR(8)    NOT NULL,
    raw_json       JSONB,
    snapshotted_at TIMESTAMP     NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_key_balance_api_key ON api_key_balance_snapshots (api_key_id, snapshotted_at DESC);

-- e) 清理 per_token 数据（按 FK 依赖顺序删除）
DELETE FROM subscription_balance_snapshots WHERE subscription_id IN
    (SELECT id FROM subscriptions WHERE billing_type = 'per_token');
DELETE FROM subscription_ledger_entries WHERE subscription_id IN
    (SELECT id FROM subscriptions WHERE billing_type = 'per_token');
DELETE FROM subscriptions WHERE billing_type = 'per_token';
