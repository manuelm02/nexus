-- LLM 配置 + 系统配置 + 通知配置 + 全部 workflow type 预置

CREATE TABLE llm_providers (
    id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name        VARCHAR(100) NOT NULL,
    provider    VARCHAR(50)  NOT NULL,
    api_key     VARCHAR(500),
    base_url    VARCHAR(500),
    model       VARCHAR(100),
    is_default  BOOLEAN DEFAULT FALSE,
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workflow_llm_configs (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workflow_type   VARCHAR(50) UNIQUE NOT NULL,
    provider_id     VARCHAR(36) REFERENCES llm_providers(id),
    model_override  VARCHAR(100),
    temperature     DECIMAL(3,2),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- 统一预置所有 workflow type（Phase 1-6 全量）
INSERT INTO workflow_llm_configs (id, workflow_type) VALUES
(gen_random_uuid()::text, 'translate'),
(gen_random_uuid()::text, 'mindbank_extract'),
(gen_random_uuid()::text, 'mindbank_summary'),
(gen_random_uuid()::text, 'mindbank_chat'),
(gen_random_uuid()::text, 'radar_extract'),
(gen_random_uuid()::text, 'coding_practice_tutor'),
(gen_random_uuid()::text, 'coding_practice_summary'),
(gen_random_uuid()::text, 'muse'),
(gen_random_uuid()::text, 'todo_ai'),
(gen_random_uuid()::text, 'inbox'),
(gen_random_uuid()::text, 'subscriptions'),
(gen_random_uuid()::text, 'chat'),
(gen_random_uuid()::text, 'mindbank_classify'),
(gen_random_uuid()::text, 'mindbank_organize'),
(gen_random_uuid()::text, 'mindbank_condense');

CREATE TABLE system_configs (
    id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
    config_key  VARCHAR(100) UNIQUE NOT NULL,
    config_val  TEXT NOT NULL,
    description VARCHAR(300),
    updated_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO system_configs (id, config_key, config_val, description) VALUES
(gen_random_uuid()::text, 'todo.archive_days',              '30',    'ToDo 完成后归档天数'),
(gen_random_uuid()::text, 'todo.rollover_time',             '00:05', '每日 ToDo Rollover 时间'),
(gen_random_uuid()::text, 'task.cleanup_days',              '30',    '任务结果清理天数'),
(gen_random_uuid()::text, 'subscription.notify_days_before','7',     '订阅到期提醒天数'),
(gen_random_uuid()::text, 'mindbank.default_domain',        '其他',  'Mindbank 默认领域'),
(gen_random_uuid()::text, 'crawler.preferred',              'jina',  '默认爬虫：jina|crawl4ai'),
(gen_random_uuid()::text, 'crawl.crawl4ai.url',             '',      'Crawl4AI 服务地址'),
(gen_random_uuid()::text, 'crawl.markitdown.url',           '',      'MarkItDown 服务地址'),
(gen_random_uuid()::text, 'notes.obsidian.vault_path',      '',      'Obsidian Vault 本地路径');

CREATE TABLE user_notification_configs (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel     VARCHAR(20) NOT NULL,
    event_type  VARCHAR(50) NOT NULL,
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);
