-- 核心功能模块：ToDo / Inbox / Translate / Subscriptions / Coding Practice / Tasks

CREATE TABLE todos (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    priority        VARCHAR(20)  DEFAULT 'medium',
    status          VARCHAR(20)  DEFAULT 'not_started',
    scheduled_date  DATE,
    due_date        DATE,
    task_id         VARCHAR(36),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_todos_status_date ON todos(status, scheduled_date);

CREATE TABLE inbox_items (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title           VARCHAR(500),
    content         TEXT NOT NULL,
    tags            TEXT[],
    task_id         VARCHAR(36),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE translations (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source_text     TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    source_lang     VARCHAR(20),
    target_lang     VARCHAR(20) NOT NULL,
    style           VARCHAR(30),
    task_id         VARCHAR(36),
    explanation     TEXT,
    keywords        JSONB,
    alternatives    JSONB,
    provider        VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE subscriptions (
    id                  VARCHAR(36)    PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name                VARCHAR(200)   NOT NULL,
    category            VARCHAR(100),
    price               DECIMAL(10,2),
    currency            VARCHAR(10)    DEFAULT 'CNY',
    billing_type        VARCHAR(30),
    start_date          DATE,
    expire_date         DATE,
    next_billing_date   DATE,
    usage_limit         DECIMAL(15,4),
    usage_used          DECIMAL(15,4)  DEFAULT 0,
    usage_unit          VARCHAR(30),
    api_provider        VARCHAR(50),
    api_key_masked      VARCHAR(100),
    api_fetch_enabled   BOOLEAN        DEFAULT FALSE,
    api_last_fetched_at TIMESTAMP,
    api_balance_json    JSONB,
    notify_enabled      BOOLEAN        DEFAULT TRUE,
    notify_days_before  INTEGER        DEFAULT 7,
    url                 VARCHAR(1000),
    notes               TEXT,
    status              VARCHAR(20)    DEFAULT 'active',
    auto_renew          BOOLEAN        NOT NULL DEFAULT FALSE,
    archived            BOOLEAN        NOT NULL DEFAULT FALSE,
    remaining_balance   NUMERIC(12,2),
    monthly_spend       NUMERIC(12,2)  NOT NULL DEFAULT 0,
    low_balance_notify  BOOLEAN        NOT NULL DEFAULT FALSE,
    low_balance_threshold NUMERIC(12,2),
    created_at          TIMESTAMP      DEFAULT NOW(),
    updated_at          TIMESTAMP      DEFAULT NOW()
);

CREATE TABLE subscription_categories (
    id         VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name       VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE subscription_ledger_entries (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subscription_id VARCHAR(36) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    entry_type      VARCHAR(16) NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    balance_after   NUMERIC(12,2) NOT NULL,
    note            VARCHAR(255),
    occurred_on     DATE NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ledger_sub_created ON subscription_ledger_entries(subscription_id, created_at DESC);

CREATE TABLE subscription_balance_snapshots (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    subscription_id VARCHAR(36) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    balance         NUMERIC(12,2) NOT NULL,
    currency        VARCHAR(8) NOT NULL,
    raw_json        JSONB,
    snapshotted_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_balance_snap_sub ON subscription_balance_snapshots(subscription_id, snapshotted_at DESC);

CREATE TABLE exchange_rates (
    currency    VARCHAR(8) PRIMARY KEY,
    rate_to_cny NUMERIC(14,6) NOT NULL,
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE coding_practice_notes (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    problem_id          VARCHAR(50),
    problem_title       VARCHAR(300),
    problem_url         VARCHAR(500),
    difficulty          VARCHAR(20),
    tags                TEXT[],
    status              VARCHAR(20) DEFAULT 'in_progress',
    mindbank_doc_id     VARCHAR(200),
    task_id             VARCHAR(36),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE coding_practice_note_contents (
    note_id      VARCHAR(36) PRIMARY KEY REFERENCES coding_practice_notes(id) ON DELETE CASCADE,
    my_solution  TEXT,
    note_content TEXT,
    updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tasks (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type                VARCHAR(50) NOT NULL,
    status              VARCHAR(20) DEFAULT 'pending',
    input               JSONB,
    output              JSONB,
    error_message       TEXT,
    result_text         TEXT,
    result_markdown     TEXT,
    result_json         JSONB,
    result_files        JSONB,
    telegram_message_id VARCHAR(100),
    telegram_sent       BOOLEAN DEFAULT FALSE,
    keep_forever        BOOLEAN DEFAULT FALSE,
    archived            BOOLEAN DEFAULT FALSE,
    expires_at          TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_tasks_type    ON tasks(type);
CREATE INDEX idx_tasks_status  ON tasks(status);
CREATE INDEX idx_tasks_created ON tasks(created_at DESC);
