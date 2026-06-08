-- V3: Mindbank

CREATE TABLE mindbank_docs (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title               VARCHAR(500) NOT NULL,
    summary             TEXT,
    domain              VARCHAR(100),
    tags                TEXT[],
    source_type         VARCHAR(50),
    file_url            VARCHAR(1000),
    file_storage        VARCHAR(20),
    file_name           VARCHAR(300),
    file_size           BIGINT,
    source_url          VARCHAR(1000),
    radar_task_id       VARCHAR(36),
    review_status       VARCHAR(20) DEFAULT 'pending',
    workspace_slug      VARCHAR(200),
    anythingllm_doc_id  VARCHAR(200),
    ingested_at         TIMESTAMP,
    notion_page_url     VARCHAR(500),
    notion_synced       BOOLEAN DEFAULT FALSE,
    summary_doc_id      VARCHAR(36),
    task_id             VARCHAR(36),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_mindbank_docs_domain ON mindbank_docs(domain);
CREATE INDEX idx_mindbank_docs_review ON mindbank_docs(review_status);

-- 预留注释：未来自建 RAG 时在 V5 中新增
-- CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE TABLE mindbank_embeddings (
--     id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
--     doc_id      VARCHAR(36) NOT NULL REFERENCES mindbank_docs(id) ON DELETE CASCADE,
--     chunk_text  TEXT NOT NULL,
--     chunk_index INTEGER DEFAULT 0,
--     embedding   vector(1536),
--     created_at  TIMESTAMP DEFAULT NOW()
-- );
-- CREATE INDEX ON mindbank_embeddings USING ivfflat (embedding vector_cosine_ops);
