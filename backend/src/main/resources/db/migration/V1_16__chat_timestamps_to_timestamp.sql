-- V1_16: 修复 V1_15 中 chat 表使用 TIMESTAMPTZ 导致的 MyBatis LocalDateTime 映射异常

ALTER TABLE chat_conversations
    ALTER COLUMN created_at TYPE TIMESTAMP,
    ALTER COLUMN updated_at TYPE TIMESTAMP;

ALTER TABLE chat_messages
    ALTER COLUMN created_at TYPE TIMESTAMP;
