-- Nexus 原生书签表，不依赖 Linkding。
-- normalized_url 用于去重（trim + 去除末尾斜杠），title 为空时前端从 URL domain 兜底。
CREATE TABLE bookmarks
(
    id             VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    url            VARCHAR(2048) NOT NULL,
    normalized_url VARCHAR(2048) NOT NULL,
    title          VARCHAR(500),
    description    TEXT,
    notes          TEXT,
    tags           JSONB        NOT NULL DEFAULT '[]'::jsonb,
    unread         BOOLEAN      NOT NULL DEFAULT TRUE,
    archived       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_bookmarks_normalized_url ON bookmarks (normalized_url);
CREATE INDEX idx_bookmarks_archived ON bookmarks (archived);
CREATE INDEX idx_bookmarks_unread ON bookmarks (unread);
CREATE INDEX idx_bookmarks_created_at ON bookmarks (created_at);
