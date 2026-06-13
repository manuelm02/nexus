-- V8: 书签智能分组系统 + Inbox 工作流注册
-- 智能分组基于标签/域名等规则自动归类书签，无需手动维护分组关系

-- 智能分组定义表：存储分组名称、匹配模式和规则
CREATE TABLE bookmark_smart_groups
(
    id           VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name         VARCHAR(200)  NOT NULL,
    description  TEXT,
    match_mode   VARCHAR(20)   NOT NULL DEFAULT 'any_tag',
    match_value  TEXT          NOT NULL,
    order_index  INT           NOT NULL DEFAULT 0,
    enabled      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP     NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN bookmark_smart_groups.match_mode IS '匹配模式：any_tag(任一标签匹配) / all_tags(全部标签匹配) / domain(域名匹配) / url_pattern(URL 模式)';
COMMENT ON COLUMN bookmark_smart_groups.match_value IS '匹配值：标签名用逗号分隔，domain 用域名，url_pattern 用正则';

-- 智能分组分配表：书签与分组的 N:N 关系，由规则引擎自动维护
CREATE TABLE bookmark_smart_group_assignments
(
    id            VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    group_id      VARCHAR(36) NOT NULL REFERENCES bookmark_smart_groups (id) ON DELETE CASCADE,
    bookmark_id   VARCHAR(36) NOT NULL REFERENCES bookmarks (id) ON DELETE CASCADE,
    assign_source VARCHAR(20) NOT NULL DEFAULT 'rule',
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, bookmark_id)
);

COMMENT ON COLUMN bookmark_smart_group_assignments.assign_source IS '分配来源：rule(规则匹配) / manual(手动添加)';

-- 索引加速按分组查询书签
CREATE INDEX idx_bsga_group_id ON bookmark_smart_group_assignments (group_id);
CREATE INDEX idx_bsga_bookmark_id ON bookmark_smart_group_assignments (bookmark_id);

-- 注册 Inbox 工作流类型，供 LLM 配置页面选择模型
INSERT INTO workflow_llm_configs (id, workflow_type)
VALUES (gen_random_uuid()::text, 'inbox');
