-- 书签系统：原生书签 + 智能分组（基于标签/域名规则自动归类）

CREATE TABLE bookmarks (
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
CREATE UNIQUE INDEX idx_bookmarks_normalized_url ON bookmarks(normalized_url);
CREATE INDEX idx_bookmarks_archived   ON bookmarks(archived);
CREATE INDEX idx_bookmarks_unread     ON bookmarks(unread);
CREATE INDEX idx_bookmarks_created_at ON bookmarks(created_at);

CREATE TABLE bookmark_smart_groups (
    id           VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name         VARCHAR(200)  NOT NULL,
    description  TEXT,
    match_mode   VARCHAR(20)   NOT NULL DEFAULT 'any_tag',  -- any_tag / all_tags / domain / url_pattern
    match_value  TEXT          NOT NULL,
    order_index  INT           NOT NULL DEFAULT 0,
    enabled      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE bookmark_smart_group_assignments (
    id            VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    group_id      VARCHAR(36) NOT NULL REFERENCES bookmark_smart_groups(id) ON DELETE CASCADE,
    bookmark_id   VARCHAR(36) NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    assign_source VARCHAR(20) NOT NULL DEFAULT 'rule',  -- rule / manual
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, bookmark_id)
);
CREATE INDEX idx_bsga_group_id    ON bookmark_smart_group_assignments(group_id);
CREATE INDEX idx_bsga_bookmark_id ON bookmark_smart_group_assignments(bookmark_id);
