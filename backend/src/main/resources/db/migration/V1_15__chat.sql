-- V1_15: Chat 日常问答会话与消息表，并注册 chat 工作流类型

CREATE TABLE IF NOT EXISTS chat_conversations (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         TEXT NOT NULL DEFAULT '新对话',
    title_ai      BOOLEAN NOT NULL DEFAULT TRUE,
    workflow_type TEXT NOT NULL DEFAULT 'chat',
    message_count INT  NOT NULL DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_conv_user_updated ON chat_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv_created ON chat_messages(conversation_id, created_at ASC);

-- 注册 chat 工作流，使 Settings 中可为 Chat 配置专用模型
INSERT INTO workflow_llm_configs (id, workflow_type)
VALUES (gen_random_uuid()::text, 'chat')
ON CONFLICT (workflow_type) DO NOTHING;
