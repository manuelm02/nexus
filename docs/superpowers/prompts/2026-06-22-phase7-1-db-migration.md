# Phase 7.1 — 数据库迁移提示词

执行计划：`docs/superpowers/plans/2026-06-22-panel-hub-phase7.md`（Phase 7.1 节）  
前置：Phase 6 已完成，当前最新迁移版本为 V1_19

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），这是一个 Spring Boot 3.x + MyBatis-Plus 3.5.7 + React 18 的个人 AI 工作台。请先阅读 `CLAUDE.md` 了解项目规范，再阅读 `docs/superpowers/plans/2026-06-22-panel-hub-phase7.md` 的 Phase 7.1 节了解本阶段任务。

本阶段目标：创建 Panel Hub 所需的 4 张数据库表，清理现有 per_token 数据。不涉及任何 Java 或前端代码。

---

请按以下步骤执行：

1. **参考现有迁移脚本的风格**：阅读以下文件了解命名和 SQL 风格：
   - `backend/src/main/resources/db/migration/V1_12__subscription_ledger_entries.sql`
   - `backend/src/main/resources/db/migration/V1_13__subscription_balance_snapshots.sql`
   - `backend/src/main/resources/db/migration/V1_10__subscriptions_redesign.sql`

2. **创建迁移脚本** `backend/src/main/resources/db/migration/V1_20__panel_hub_api_keys_and_credentials.sql`，包含以下内容（按顺序）：

   **a) 创建 `api_keys` 表：**
   ```sql
   CREATE TABLE api_keys (
       id                    VARCHAR(36)   PRIMARY KEY,
       label                 VARCHAR(100)  NOT NULL,
       provider              VARCHAR(50)   NOT NULL,
       encrypted_key         TEXT          NOT NULL,
       base_url              VARCHAR(500),
       status                VARCHAR(20)   NOT NULL DEFAULT 'active',
       plan_name             VARCHAR(100),
       plan_expire_date      DATE,
       subscription_id       VARCHAR(36)   REFERENCES subscriptions(id) ON DELETE SET NULL,
       remaining_balance     NUMERIC(12,2),
       monthly_spend         NUMERIC(12,2) NOT NULL DEFAULT 0,
       low_balance_notify    BOOLEAN       NOT NULL DEFAULT false,
       low_balance_threshold NUMERIC(12,2),
       api_fetch_enabled     BOOLEAN       NOT NULL DEFAULT false,
       api_last_fetched_at   TIMESTAMP,
       api_balance_json      JSONB,
       notes                 TEXT,
       archived              BOOLEAN       NOT NULL DEFAULT false,
       created_at            TIMESTAMP     NOT NULL DEFAULT now(),
       updated_at            TIMESTAMP     NOT NULL DEFAULT now()
   );
   ```

   **b) 创建 `credentials` 表：**
   ```sql
   CREATE TABLE credentials (
       id                    VARCHAR(36)   PRIMARY KEY,
       platform              VARCHAR(100)  NOT NULL,
       label                 VARCHAR(100),
       category              VARCHAR(50),
       username              VARCHAR(200),
       encrypted_password    TEXT,
       encrypted_totp_secret TEXT,
       url                   VARCHAR(500),
       expire_date           DATE,
       subscription_id       VARCHAR(36)   REFERENCES subscriptions(id) ON DELETE SET NULL,
       notes                 TEXT,
       archived              BOOLEAN       NOT NULL DEFAULT false,
       created_at            TIMESTAMP     NOT NULL DEFAULT now(),
       updated_at            TIMESTAMP     NOT NULL DEFAULT now()
   );
   ```

   **c) 创建 `api_key_ledger_entries` 表（镜像 subscription_ledger_entries 结构）：**
   ```sql
   CREATE TABLE api_key_ledger_entries (
       id            VARCHAR(36)   PRIMARY KEY,
       api_key_id    VARCHAR(36)   NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
       entry_type    VARCHAR(16)   NOT NULL,
       amount        NUMERIC(12,2) NOT NULL,
       balance_after NUMERIC(12,2) NOT NULL,
       note          VARCHAR(255),
       occurred_on   DATE          NOT NULL,
       created_at    TIMESTAMP     NOT NULL DEFAULT now()
   );
   CREATE INDEX idx_api_key_ledger_api_key ON api_key_ledger_entries (api_key_id, created_at DESC);
   ```

   **d) 创建 `api_key_balance_snapshots` 表（镜像 subscription_balance_snapshots 结构）：**
   ```sql
   CREATE TABLE api_key_balance_snapshots (
       id             VARCHAR(36)   PRIMARY KEY,
       api_key_id     VARCHAR(36)   NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
       balance        NUMERIC(12,2) NOT NULL,
       currency       VARCHAR(8)    NOT NULL,
       raw_json       JSONB,
       snapshotted_at TIMESTAMP     NOT NULL DEFAULT now()
   );
   CREATE INDEX idx_api_key_balance_api_key ON api_key_balance_snapshots (api_key_id, snapshotted_at DESC);
   ```

   **e) 清理 per_token 数据（按 FK 依赖顺序删除）：**
   ```sql
   DELETE FROM subscription_balance_snapshots WHERE subscription_id IN
       (SELECT id FROM subscriptions WHERE billing_type = 'per_token');
   DELETE FROM subscription_ledger_entries WHERE subscription_id IN
       (SELECT id FROM subscriptions WHERE billing_type = 'per_token');
   DELETE FROM subscriptions WHERE billing_type = 'per_token';
   ```

3. **启动验证**：
   ```bash
   mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local
   # 观察日志：确认 V1_20 migration applied
   # 确认 4 张新表创建成功
   # 确认 subscriptions 表中不再有 billing_type = 'per_token' 的记录
   # 启动成功后 Ctrl+C 停止
   ```

**注意事项：**
- Flyway 命名规范：`V{major}_{minor}__{desc}.sql`（双下划线分隔），一旦应用不可修改
- `api_keys.subscription_id` 和 `credentials.subscription_id` 的外键用 `ON DELETE SET NULL`（Key/凭证可以比关联订阅活得更久）
- `api_key_ledger_entries` 和 `api_key_balance_snapshots` 的外键用 `ON DELETE CASCADE`（跟随主记录级联删除）
- **不要**删除或修改 `subscriptions` 表上的任何列（per_token 相关列如 remaining_balance 等保留为未使用字段）
- **不要**创建任何 Java 文件，本阶段只做 SQL 迁移
