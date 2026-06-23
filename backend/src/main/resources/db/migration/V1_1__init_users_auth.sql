-- 用户与认证体系：用户主表 + Refresh Token + 验证码 + 设备推送

CREATE TABLE users (
    id                VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username          VARCHAR(100) UNIQUE,
    nickname          VARCHAR(100),
    avatar_url        VARCHAR(500),
    email             VARCHAR(200) UNIQUE,
    phone             VARCHAR(20)  UNIQUE,
    password_hash     VARCHAR(200),
    role              VARCHAR(20)  DEFAULT 'user',
    telegram_id       VARCHAR(100) UNIQUE,
    telegram_username VARCHAR(100),
    apple_user_id     VARCHAR(200) UNIQUE,
    wechat_openid     VARCHAR(200) UNIQUE,
    wechat_unionid    VARCHAR(200) UNIQUE,
    status            VARCHAR(20)  DEFAULT 'active',
    last_login_at     TIMESTAMP,
    created_at        TIMESTAMP    DEFAULT NOW(),
    updated_at        TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE refresh_tokens (
    id           VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id      VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   VARCHAR(200) NOT NULL,
    device_type  VARCHAR(20),
    device_info  VARCHAR(200),
    expires_at   TIMESTAMP NOT NULL,
    revoked      BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE verify_codes (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    target      VARCHAR(200) NOT NULL,
    code        VARCHAR(10)  NOT NULL,
    type        VARCHAR(20)  NOT NULL,
    purpose     VARCHAR(20)  NOT NULL,
    expires_at  TIMESTAMP    NOT NULL,
    used        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_devices (
    id           VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id      VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_type  VARCHAR(20) NOT NULL,
    push_token   VARCHAR(500),
    enabled      BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);
