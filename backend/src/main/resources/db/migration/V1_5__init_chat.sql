-- Chat 日常问答：会话表 + 消息表

CREATE TABLE chat_conversations (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         TEXT NOT NULL DEFAULT '新对话',
    title_ai      BOOLEAN NOT NULL DEFAULT TRUE,
    workflow_type TEXT NOT NULL DEFAULT 'chat',
    message_count INT  NOT NULL DEFAULT 0,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chat_conv_user_updated ON chat_conversations(user_id, updated_at DESC);

CREATE TABLE chat_messages (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chat_msg_conv_created ON chat_messages(conversation_id, created_at ASC);
