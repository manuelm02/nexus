-- V2: 核心功能模块

-- ToDo
CREATE TABLE todos (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    priority        VARCHAR(20)  DEFAULT 'medium',
    status          VARCHAR(20)  DEFAULT 'not_started',
    scheduled_date  DATE,
    due_date        DATE,
    task_id         VARCHAR(36),
    notion_page_url VARCHAR(500),
    notion_synced   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_todos_status_date ON todos(status, scheduled_date);

-- Inbox
CREATE TABLE inbox_items (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title           VARCHAR(500),
    content         TEXT NOT NULL,
    tags            TEXT[],
    task_id         VARCHAR(36),
    notion_page_url VARCHAR(500),
    notion_synced   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Translate
CREATE TABLE translations (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source_text     TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    source_lang     VARCHAR(20),
    target_lang     VARCHAR(20) NOT NULL,
    style           VARCHAR(30),
    task_id         VARCHAR(36),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Subscriptions
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
    notion_page_url     VARCHAR(500),
    notion_synced       BOOLEAN        DEFAULT FALSE,
    task_id             VARCHAR(36),
    created_at          TIMESTAMP      DEFAULT NOW(),
    updated_at          TIMESTAMP      DEFAULT NOW()
);

-- Coding Practice（LeetCode Notes）
CREATE TABLE coding_practice_notes (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    problem_id          VARCHAR(50),
    problem_title       VARCHAR(300),
    problem_url         VARCHAR(500),
    difficulty          VARCHAR(20),
    tags                TEXT[],
    status              VARCHAR(20) DEFAULT 'in_progress',
    notion_page_url     VARCHAR(500),
    notion_synced       BOOLEAN DEFAULT FALSE,
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

-- 统一任务表
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
    notion_page_url     VARCHAR(500),
    notion_synced       BOOLEAN DEFAULT FALSE,
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
