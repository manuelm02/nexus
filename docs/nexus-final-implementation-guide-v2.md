# Nexus — 完整开发实施文档（定稿版）
> 供 Claude Code / Codex 直接执行
> 最后更新：所有设计决策已确认锁定

---

## 0. 项目定位

Nexus 是一个**个人 AI 工作台 / Knowledge OS**，统一管理个人输入、AI 处理、知识沉淀与多端结果输出。

**核心原则：**
- 前后端完全分离，后端 API 唯一，所有端复用
- 前端一套代码适配 Web 桌面端 / PWA / Telegram Mini App，预留 iOS App 接入口
- 所有任务处理结果优先落库（PostgreSQL），页面 / Telegram / Notion 是输出渠道
- 所有可替换的外部依赖均有抽象层（知识库引擎、爬虫、LLM Provider）

**支持端（按优先级）：**
1. Web 桌面端
2. PWA（手机桌面）
3. Telegram Mini App
4. iOS App（预留接口，未来开发）
5. 微信小程序（更远的未来）

---

## 1. 功能模块（最终命名）

| 模块代码 | 展示名 | 概述文案 | 优先级 |
|---|---|---|---|
| focus | **Focus** | 不是所有事情都值得今天去做，但今天值得做的事，值得你全力以赴。 | P0 |
| fleeting | **Fleeting** | 最好的想法往往诞生在最糟糕的时机。在它消失之前，给它一个落脚的地方。 | P0 |
| prism | **Prism** | 语言不是思想的容器，而是思想的形状。同一个意思，换一种语言，你会看见它不同的棱角。 | P0 |
| mindbank | **Mindbank** | 知识只有在被连接的时候才有价值。孤立的信息是噪声，流动的知识是资产。 | P1 |
| radar | **Radar** | 信息从不缺少，缺少的是知道什么值得留下。 | P1 |
| ledger | **Ledger** | 你为什么付费，比你付了多少钱更值得记录。 | P2 |
| forge | **Forge** | 算法题不是考试，是锻造。每一道题都在问：你是否真的理解，还是只是记住了答案。 | P2 |
| muse | **Muse** | 提问本身就是一种思考。你不需要知道答案，你只需要知道该问什么。 | P3 |

> ⚠️ Code Wiki 模块不做。

---

## 2. 部署架构

```
┌─────────────────────────────────────────┐
│           云服务器（2vCPU 4G）            │
│                                         │
│  外层 Caddy（443，HTTPS + Basic Auth）    │
│      ↓ 只反代到 frontend:80              │
│  nexus-frontend                         │
│  （内层 Caddy：API 反代 + 静态文件）       │
│      ├── /api/* → backend:8080          │
│      └── /*     → React 静态文件         │
│  nexus-backend（Spring Boot）            │
│  PostgreSQL 16（Nexus + 婚礼系统共用）    │
│  Crawl4AI                               │
│  Redis（阶段3）                          │
│  婚礼管理后端（独立 Spring Boot）         │
└──────────────┬──────────────────────────┘
               │ Tailscale 内网直连
┌──────────────▼──────────────────────────┐
│           Mac Studio（本地）              │
│  AnythingLLM + LanceDB                  │
│  （已实现域名反代，Tailscale 内网访问）    │
└─────────────────────────────────────────┘

NAS（独立设备）
├── /volume1/nexus-files/        ← 原始文件实际存储路径
│       ├── mindbank/
│       ├── forge/
│       └── radar/
└── MinIO（Docker，挂载上方路径）
        ↓ 提供 HTTP 访问 + S3 上传 API
    https://files.yourdomain.com/...
```

**服务器内存估算（AnythingLLM 不在服务器）：**

| 服务 | 估算内存 |
|---|---|
| Caddy | ~30MB |
| Nexus 后端 | ~400MB |
| PostgreSQL | ~200MB |
| Crawl4AI | ~300MB 空闲 / ~700MB 峰值 |
| Redis（阶段3） | ~50MB |
| 婚礼管理后端 | ~300MB |
| 系统底层 | ~300MB |
| **合计** | **基础 ~1.6GB，峰值 ~2.1GB** |

4GB 内存，峰值约 2.1GB，**富裕，可以部署 Crawl4AI**。

---

## 3. 技术栈（最终确认版）

### 3.1 前端

| 分类 | 技术 | 说明 |
|---|---|---|
| 框架 | React 18 + Vite + TypeScript | |
| 样式 | Tailwind CSS v3 | 响应式多端适配核心 |
| UI 组件 | shadcn/ui | 组件代码在项目内，完全可控 |
| 路由 | React Router v6 | |
| 状态管理 | Zustand | |
| 请求/异步 | TanStack Query | 轮询、缓存、异步状态 |
| 图标 | Lucide React | |
| TMA | @twa-dev/sdk | Telegram Mini App SDK |
| PWA | vite-plugin-pwa | |
| Markdown | react-markdown + rehype-highlight | |

### 3.2 后端

| 分类 | 技术 | 说明 |
|---|---|---|
| 框架 | Spring Boot 3.x | |
| 语言 | Java 21 | 虚拟线程 |
| AI（简单调用） | Spring AI | Prism / 简单摘要 |
| AI（复杂工作流） | LangChain4j | Mindbank 工作流 / Forge Agent / RAG |
| ORM | **MyBatis-Plus** | Lambda QueryWrapper，SQL 完全可见 |
| 认证 | **JWT**（access_token 15分钟 + refresh_token 30天） | 全端统一，无 Cookie |
| 参数校验 | Spring Validation | |
| API 文档 | SpringDoc OpenAPI 3 | |
| 定时任务 | Spring Scheduler | |
| 异步队列 | Spring @Async（阶段1）→ Redis + Redisson（阶段3） | |
| HTTP 客户端 | Spring WebClient | |
| SSE | Spring MVC SseEmitter | 流式对话 / 任务进度 |

### 3.3 数据层

| 分类 | 技术 |
|---|---|
| 数据库 | PostgreSQL 16（云服务器，Nexus 与婚礼系统共用实例，独立 database） |
| 迁移 | Flyway |
| 向量存储 | AnythingLLM 内部 LanceDB（Mac 本地，Tailscale 访问） |

### 3.4 外部服务

| 服务 | 部署位置 | 访问方式 |
|---|---|---|
| AnythingLLM | Mac Studio 本地 Docker | Tailscale 内网 IP 直连 |
| Crawl4AI | 云服务器 Docker | 同 Docker 网络内部调用 |
| MinIO | NAS Docker（挂载 NAS 指定路径） | Tailscale 内网 / 域名反代 |
| Jina Reader | 外部 API | HTTPS 调用，无需部署 |

---

## 4. 项目目录结构

### 4.1 前端

```
nexus-frontend/
├── public/icons/                 # PWA 图标
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx
│   ├── pages/
│   │   ├── Home/index.tsx
│   │   ├── Focus/index.tsx           # Todo List
│   │   ├── Fleeting/index.tsx        # Quick Note
│   │   ├── Prism/index.tsx           # Translate
│   │   ├── Mindbank/
│   │   │   ├── index.tsx             # 知识库主页
│   │   │   ├── Inbox.tsx             # 文件收件箱
│   │   │   ├── Review.tsx            # 元数据审核
│   │   │   └── Chat.tsx              # 知识库问答
│   │   ├── Radar/index.tsx           # Gather
│   │   ├── Ledger/index.tsx          # Subscription
│   │   ├── Forge/index.tsx           # LeetCode
│   │   ├── Muse/index.tsx            # Daily Assistant
│   │   ├── Tasks/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx
│   │   └── Settings/
│   │       ├── index.tsx
│   │       ├── LlmConfig.tsx         # 大模型配置
│   │       ├── SystemConfig.tsx      # 系统参数（归档天数等）
│   │       └── NotificationConfig.tsx
│   ├── components/
│   │   ├── ui/                       # shadcn/ui 组件
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── TaskStatusBadge.tsx
│   │   ├── TaskResultView.tsx
│   │   ├── TelegramThemeProvider.tsx
│   │   └── MarkdownRenderer.tsx
│   ├── hooks/
│   │   ├── useTaskPoller.ts
│   │   ├── useTelegramApp.ts
│   │   └── useAuth.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   └── themeStore.ts
│   ├── api/
│   │   ├── client.ts                 # Axios + JWT 拦截器 + token 刷新
│   │   ├── auth.api.ts
│   │   ├── focus.api.ts
│   │   ├── fleeting.api.ts
│   │   ├── prism.api.ts
│   │   ├── mindbank.api.ts
│   │   ├── radar.api.ts
│   │   ├── ledger.api.ts
│   │   ├── forge.api.ts
│   │   ├── muse.api.ts
│   │   └── task.api.ts
│   ├── types/
│   │   ├── api.types.ts
│   │   ├── task.types.ts
│   │   └── domain.types.ts
│   └── lib/
│       ├── utils.ts
│       └── constants.ts
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

### 4.2 后端

```
nexus-backend/
└── src/main/java/com/nexus/
    ├── NexusApplication.java
    │
    ├── controller/
    │   ├── AuthController.java
    │   ├── FocusController.java
    │   ├── FleetingController.java
    │   ├── PrismController.java
    │   ├── MindbankController.java
    │   ├── RadarController.java
    │   ├── LedgerController.java
    │   ├── ForgeController.java
    │   ├── MuseController.java
    │   ├── TaskController.java
    │   └── SettingsController.java
    │
    ├── service/
    │   ├── AuthService.java
    │   ├── FocusService.java
    │   ├── FleetingService.java
    │   ├── PrismService.java
    │   ├── MindbankService.java
    │   ├── RadarService.java
    │   ├── LedgerService.java
    │   ├── ForgeService.java
    │   ├── MuseService.java
    │   ├── TaskService.java
    │   └── LlmConfigService.java     # 解析工作流对应的 LLM Provider
    │
    ├── workflow/
    │   ├── WorkflowRegistry.java
    │   ├── FocusWorkflow.java
    │   ├── FleetingWorkflow.java
    │   ├── PrismWorkflow.java
    │   ├── MindbankInboxWorkflow.java
    │   ├── MindbankIngestWorkflow.java
    │   ├── RadarWorkflow.java
    │   ├── ForgeWorkflow.java
    │   └── LedgerApiSyncWorkflow.java  # 订阅 API 用量同步
    │
    ├── step/
    │   ├── LlmTranslateStep.java
    │   ├── LlmSummarizeStep.java
    │   ├── LlmExtractMetadataStep.java
    │   ├── LlmCheckRelatedStep.java
    │   ├── CrawlUrlStep.java           # 调用 WebCrawlerDispatcher
    │   ├── WriteNotionStep.java
    │   ├── SendNotificationStep.java   # 统一通知 Step
    │   ├── MindbankIngestStep.java     # 调用 MindBankPort
    │   └── SaveTaskResultStep.java
    │
    ├── port/
    │   ├── MindBankPort.java           # 知识库抽象（原 KnowledgeStorePort）
    │   └── WebCrawlerPort.java         # 爬虫抽象
    │
    ├── adapter/
    │   ├── mindbank/
    │   │   ├── AnythingLlmMindBank.java   # 实现A：当前使用
    │   │   └── CustomRagMindBank.java     # 实现B：注释中，未来自建 RAG
    │   └── crawler/
    │       ├── WebCrawlerDispatcher.java  # 自动选择实现
    │       ├── JinaReaderCrawler.java     # 默认首选，零部署
    │       ├── Crawl4AiCrawler.java       # 备选，本地容器
    │       ├── XiaohongshuCrawler.java    # 预留，暂未实现
    │       └── BiliBiliCrawler.java       # 预留，暂未实现
    │
    ├── integration/
    │   ├── llm/
    │   │   ├── LlmClientFactory.java      # 根据 LlmConfigService 动态创建 Client
    │   │   └── LangChainAgentClient.java
    │   ├── NotionClient.java
    │   ├── AnythingLlmClient.java
    │   ├── Crawl4AiClient.java
    │   ├── MinioClient.java               # 文件存储
    │   └── notification/
    │       ├── NotificationService.java   # 接口
    │       └── TelegramNotificationService.java
    │
    ├── mapper/                            # MyBatis-Plus Mapper
    │   ├── UserMapper.java
    │   ├── RefreshTokenMapper.java
    │   ├── UserDeviceMapper.java
    │   ├── FocusMapper.java
    │   ├── FleetingMapper.java
    │   ├── TranslationMapper.java
    │   ├── MindbankDocMapper.java
    │   ├── LedgerMapper.java
    │   ├── ForgeNoteMapper.java
    │   ├── TaskMapper.java
    │   ├── LlmProviderMapper.java
    │   ├── WorkflowLlmConfigMapper.java
    │   ├── SystemConfigMapper.java
    │   └── UserNotificationConfigMapper.java
    │
    ├── entity/
    │   ├── User.java
    │   ├── RefreshToken.java
    │   ├── UserDevice.java
    │   ├── VerifyCode.java
    │   ├── Focus.java                    # Todo
    │   ├── Fleeting.java                 # Quick Note
    │   ├── Translation.java
    │   ├── MindbankDoc.java
    │   ├── Ledger.java                   # Subscription
    │   ├── ForgeNote.java                # LeetCode Note
    │   ├── Task.java
    │   ├── LlmProvider.java
    │   ├── WorkflowLlmConfig.java
    │   ├── SystemConfig.java
    │   └── UserNotificationConfig.java
    │
    ├── dto/
    │   ├── request/
    │   │   ├── LoginRequest.java
    │   │   ├── RefreshTokenRequest.java
    │   │   ├── FocusCreateRequest.java
    │   │   ├── FleetingCreateRequest.java
    │   │   ├── PrismTranslateRequest.java
    │   │   ├── MindbankInboxRequest.java
    │   │   ├── MindbankFromRadarRequest.java
    │   │   ├── RadarRequest.java
    │   │   ├── LedgerCreateRequest.java
    │   │   ├── ForgeStartRequest.java
    │   │   └── ForgeChatRequest.java
    │   └── response/
    │       ├── ApiResponse.java
    │       ├── TokenResponse.java
    │       ├── TaskResponse.java
    │       └── MindbankMetaResponse.java
    │
    ├── config/
    │   ├── SecurityConfig.java            # Spring Security + JWT Filter
    │   ├── JwtConfig.java
    │   ├── CorsConfig.java
    │   ├── SpringAiConfig.java
    │   ├── LangChain4jConfig.java
    │   └── AsyncConfig.java
    │
    └── scheduler/
        ├── FocusRolloverScheduler.java    # 每天 00:05
        ├── TaskCleanupScheduler.java      # 每天 02:00
        └── LedgerNotifyScheduler.java     # 每天 09:00，订阅到期提醒
```

---

## 5. 数据库设计（完整版）

### Flyway 迁移文件规划

```
V1__init_users_and_auth.sql
V2__init_core_modules.sql
V3__init_mindbank.sql
V4__init_settings_and_config.sql
```

---

### V1：用户与认证

```sql
-- 用户表
CREATE TABLE users (
    id                VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username          VARCHAR(100) UNIQUE,
    nickname          VARCHAR(100),
    avatar_url        VARCHAR(500),
    email             VARCHAR(200) UNIQUE,
    phone             VARCHAR(20)  UNIQUE,
    password_hash     VARCHAR(200),
    role              VARCHAR(20)  DEFAULT 'user',       -- user | admin
    -- Telegram
    telegram_id       VARCHAR(100) UNIQUE,
    telegram_username VARCHAR(100),
    -- Apple（iOS Sign in with Apple）
    apple_user_id     VARCHAR(200) UNIQUE,
    -- 微信（预留）
    wechat_openid     VARCHAR(200) UNIQUE,
    wechat_unionid    VARCHAR(200) UNIQUE,
    -- 状态
    status            VARCHAR(20)  DEFAULT 'active',     -- active | disabled
    last_login_at     TIMESTAMP,
    created_at        TIMESTAMP    DEFAULT NOW(),
    updated_at        TIMESTAMP    DEFAULT NOW()
);

-- JWT Refresh Token
CREATE TABLE refresh_tokens (
    id           VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id      VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   VARCHAR(200) NOT NULL,
    device_type  VARCHAR(20),     -- web | ios | android | tma
    device_info  VARCHAR(200),
    expires_at   TIMESTAMP NOT NULL,
    revoked      BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- 验证码（手机/邮箱登录）
CREATE TABLE verify_codes (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    target      VARCHAR(200) NOT NULL,   -- 手机号或邮箱
    code        VARCHAR(10)  NOT NULL,
    type        VARCHAR(20)  NOT NULL,   -- sms | email
    purpose     VARCHAR(20)  NOT NULL,   -- login | register | reset_password
    expires_at  TIMESTAMP    NOT NULL,
    used        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- 用户设备（多端推送）
CREATE TABLE user_devices (
    id           VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id      VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_type  VARCHAR(20) NOT NULL,   -- ios | android | web | tma
    push_token   VARCHAR(500),           -- APNs / FCM / Web Push token
    enabled      BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);
```

---

### V2：核心功能模块

```sql
-- Focus（Todo List）
CREATE TABLE focus (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    priority        VARCHAR(20)  DEFAULT 'medium',       -- low|medium|high|urgent
    status          VARCHAR(20)  DEFAULT 'not_started',  -- not_started|in_progress|done|archived
    scheduled_date  DATE,          -- 今日规划日期
    due_date        DATE,          -- 截止日期
    task_id         VARCHAR(36),
    notion_page_url VARCHAR(500),
    notion_synced   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_focus_status_date ON focus(status, scheduled_date);

-- Fleeting（Quick Note）
CREATE TABLE fleeting (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title           VARCHAR(500),
    content         TEXT NOT NULL,
    tags            TEXT[],
    task_id         VARCHAR(36),
    notion_page_url VARCHAR(500),
    notion_synced   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Prism（Translation）
CREATE TABLE prism (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source_text     TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    source_lang     VARCHAR(20),
    target_lang     VARCHAR(20) NOT NULL,
    style           VARCHAR(30),   -- formal|casual|technical
    task_id         VARCHAR(36),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Ledger（Subscription）
CREATE TABLE ledger (
    id                  VARCHAR(36)    PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name                VARCHAR(200)   NOT NULL,
    category            VARCHAR(100),               -- AI工具|云服务|娱乐|开发工具|...
    -- 费用
    price               DECIMAL(10,2),
    currency            VARCHAR(10)    DEFAULT 'CNY',
    -- 订阅方式
    billing_type        VARCHAR(30),                -- monthly|yearly|per_token|lifetime|one_time
    start_date          DATE,
    expire_date         DATE,                       -- 买断/一次性为 null
    next_billing_date   DATE,
    -- 用量（本地维护）
    usage_limit         DECIMAL(15,4),
    usage_used          DECIMAL(15,4)  DEFAULT 0,
    usage_unit          VARCHAR(30),                -- tokens|GB|requests|...
    -- API 用量拉取（预留，暂不实现）
    api_provider        VARCHAR(50),                -- deepseek|openai|anthropic|...
    api_key_masked      VARCHAR(100),               -- 脱敏显示
    api_fetch_enabled   BOOLEAN        DEFAULT FALSE,
    api_last_fetched_at TIMESTAMP,
    api_balance_json    JSONB,                      -- 余额/用量快照
    -- 提醒
    notify_enabled      BOOLEAN        DEFAULT TRUE,
    notify_days_before  INTEGER        DEFAULT 7,
    -- 链接与备注
    url                 VARCHAR(1000),
    notes               TEXT,
    status              VARCHAR(20)    DEFAULT 'active', -- active|expired|cancelled|paused
    -- 同步
    notion_page_url     VARCHAR(500),
    notion_synced       BOOLEAN        DEFAULT FALSE,
    task_id             VARCHAR(36),
    created_at          TIMESTAMP      DEFAULT NOW(),
    updated_at          TIMESTAMP      DEFAULT NOW()
);

-- Forge（LeetCode Notes）
CREATE TABLE forge_notes (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    problem_id          VARCHAR(50),
    problem_title       VARCHAR(300),
    problem_url         VARCHAR(500),
    difficulty          VARCHAR(20),              -- easy|medium|hard
    tags                TEXT[],
    status              VARCHAR(20) DEFAULT 'in_progress', -- in_progress|completed
    notion_page_url     VARCHAR(500),
    notion_synced       BOOLEAN DEFAULT FALSE,
    mindbank_doc_id     VARCHAR(200),             -- AnythingLLM 文档 ID
    task_id             VARCHAR(36),
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- Forge 内容（大字段拆分，避免列表查询拖累）
CREATE TABLE forge_note_contents (
    note_id      VARCHAR(36) PRIMARY KEY REFERENCES forge_notes(id) ON DELETE CASCADE,
    my_solution  TEXT,          -- 我的解答代码
    note_content TEXT,          -- AI 生成的总结笔记（Markdown）
    updated_at   TIMESTAMP DEFAULT NOW()
);

-- 统一任务表
CREATE TABLE tasks (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type                VARCHAR(50) NOT NULL,
    -- focus|fleeting|prism|mindbank_inbox|mindbank_ingest
    -- radar|forge|muse|ledger_sync|focus_rollover
    status              VARCHAR(20) DEFAULT 'pending',   -- pending|running|completed|failed
    input               JSONB,
    output              JSONB,
    error_message       TEXT,
    result_text         TEXT,
    result_markdown     TEXT,
    result_json         JSONB,
    result_files        JSONB,   -- [{url, name, storage, size}]
    notion_page_url     VARCHAR(500),
    notion_synced       BOOLEAN DEFAULT FALSE,
    telegram_message_id VARCHAR(100),
    telegram_sent       BOOLEAN DEFAULT FALSE,
    keep_forever        BOOLEAN DEFAULT FALSE,
    archived            BOOLEAN DEFAULT FALSE,
    expires_at          TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_tasks_type    ON tasks(type);
CREATE INDEX idx_tasks_status  ON tasks(status);
CREATE INDEX idx_tasks_created ON tasks(created_at DESC);
```

---

### V3：Mindbank

```sql
-- Mindbank 文档元数据（向量由 AnythingLLM/LanceDB 管理，这里只存业务元数据）
CREATE TABLE mindbank_docs (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title               VARCHAR(500) NOT NULL,
    summary             TEXT,
    domain              VARCHAR(100),            -- 领域（对应 AnythingLLM workspace）
    tags                TEXT[],
    source_type         VARCHAR(50),             -- file|radar（来自 Radar 模块）
    -- 文件存储（通用，不绑定 NAS）
    file_url            VARCHAR(1000),           -- MinIO / 对象存储访问 URL
    file_storage        VARCHAR(20),             -- minio|local|s3|gdrive
    file_name           VARCHAR(300),
    file_size           BIGINT,                  -- 字节数
    -- 原始来源（若来自 Radar）
    source_url          VARCHAR(1000),
    radar_task_id       VARCHAR(36),             -- 关联的 Radar 任务 ID
    -- 审核状态
    review_status       VARCHAR(20) DEFAULT 'pending', -- pending|approved|rejected
    -- AnythingLLM 集成
    workspace_slug      VARCHAR(200),
    anythingllm_doc_id  VARCHAR(200),
    ingested_at         TIMESTAMP,
    -- Notion
    notion_page_url     VARCHAR(500),
    notion_synced       BOOLEAN DEFAULT FALSE,
    -- 关联总结（一篇总结对应多个源文件）
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
```

---

### V4：配置与通知

```sql
-- 大模型 Provider 配置
CREATE TABLE llm_providers (
    id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name        VARCHAR(100) NOT NULL,    -- 显示名称
    provider    VARCHAR(50)  NOT NULL,    -- openai|anthropic|deepseek|gemini|ollama
    api_key     VARCHAR(500),             -- AES 加密存储
    base_url    VARCHAR(500),             -- 自定义接入点（Ollama 本地等）
    model       VARCHAR(100),            -- 默认模型
    is_default  BOOLEAN DEFAULT FALSE,
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- 工作流级别的模型配置
CREATE TABLE workflow_llm_configs (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workflow_type   VARCHAR(50) UNIQUE NOT NULL,
    -- prism|mindbank_extract|mindbank_summary|mindbank_chat
    -- radar_extract|forge_tutor|forge_summary|muse|focus_ai
    provider_id     VARCHAR(36) REFERENCES llm_providers(id),  -- null = 使用全局默认
    model_override  VARCHAR(100),    -- 覆盖 provider 默认模型
    temperature     DECIMAL(3,2),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- 系统参数配置
CREATE TABLE system_configs (
    id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
    config_key  VARCHAR(100) UNIQUE NOT NULL,
    config_val  TEXT NOT NULL,
    description VARCHAR(300),
    updated_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO system_configs (id, config_key, config_val, description) VALUES
(gen_random_uuid(), 'focus.archive_days',             '30',    'Focus 完成后归档天数'),
(gen_random_uuid(), 'focus.rollover_time',            '00:05', '每日 Rollover 时间'),
(gen_random_uuid(), 'task.cleanup_days',              '30',    '任务结果清理天数'),
(gen_random_uuid(), 'ledger.notify_days_before',      '7',     '订阅到期提醒天数'),
(gen_random_uuid(), 'mindbank.default_domain',        '其他',  'Mindbank 默认领域'),
(gen_random_uuid(), 'crawler.preferred',              'jina',  '默认爬虫：jina|crawl4ai');

-- 用户通知配置
CREATE TABLE user_notification_configs (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel     VARCHAR(20) NOT NULL,   -- telegram|email|apns
    event_type  VARCHAR(50) NOT NULL,
    -- task_completed|mindbank_ingested|ledger_expiring
    -- forge_note_generated|radar_completed|focus_reminder
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 6. JWT 认证设计

### Token 流程

```
POST /api/auth/login
  → 验证密码/验证码/第三方凭证
  → 返回 { access_token, refresh_token, expires_in }

每次请求 Header：
  Authorization: Bearer <access_token>

access_token 过期时：
POST /api/auth/refresh
  Body: { refresh_token }
  → 返回新的 access_token（+ 可选轮换 refresh_token）

登出：
POST /api/auth/logout
  → 服务端将 refresh_token 标记为 revoked
```

### 登录方式（按阶段）

| 登录方式 | 阶段 |
|---|---|
| 用户名 + 密码 | 阶段1 |
| 邮箱验证码 | 阶段4 |
| 手机验证码 | 阶段4 |
| Telegram Login | 阶段4（TMA） |
| Sign in with Apple | 阶段5（iOS App） |
| 微信扫码 / 小程序 | 阶段6 |

### 前端 Token 自动刷新

```typescript
// api/client.ts
axios.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      const newToken = await refreshAccessToken()
      err.config.headers.Authorization = `Bearer ${newToken}`
      return axios(err.config)
    }
    return Promise.reject(err)
  }
)
```

---

## 7. LLM 配置系统

### 工作流解析逻辑

```java
@Service
public class LlmConfigService {

    public ChatLanguageModel resolveModel(String workflowType) {
        // 1. 查工作流专属配置
        WorkflowLlmConfig wf = workflowLlmConfigMapper
            .selectOne(new LambdaQueryWrapper<WorkflowLlmConfig>()
                .eq(WorkflowLlmConfig::getWorkflowType, workflowType));

        LlmProvider provider = null;

        if (wf != null && wf.getProviderId() != null) {
            provider = llmProviderMapper.selectById(wf.getProviderId());
        }

        // 2. 降级：全局默认
        if (provider == null) {
            provider = llmProviderMapper.selectOne(
                new LambdaQueryWrapper<LlmProvider>()
                    .eq(LlmProvider::getIsDefault, true)
                    .eq(LlmProvider::getEnabled, true));
        }

        return buildModel(provider, wf);
    }

    private ChatLanguageModel buildModel(LlmProvider p, WorkflowLlmConfig wf) {
        String model = (wf != null && wf.getModelOverride() != null)
            ? wf.getModelOverride() : p.getModel();
        String apiKey = decrypt(p.getApiKey());

        return switch (p.getProvider()) {
            case "openai"    -> OpenAiChatModel.builder()
                .apiKey(apiKey).modelName(model).build();
            case "deepseek"  -> OpenAiChatModel.builder()
                .apiKey(apiKey).baseUrl("https://api.deepseek.com/v1")
                .modelName(model).build();
            case "anthropic" -> AnthropicChatModel.builder()
                .apiKey(apiKey).modelName(model).build();
            case "ollama"    -> OllamaChatModel.builder()
                .baseUrl(p.getBaseUrl()).modelName(model).build();
            default -> throw new IllegalStateException("未知 Provider: " + p.getProvider());
        };
    }
}
```

---

## 8. 爬虫抽象层

```java
// port/WebCrawlerPort.java
public interface WebCrawlerPort {
    String name();
    boolean supports(String url);
    CrawlResult crawl(CrawlRequest request);
}

public record CrawlRequest(String url, Map<String, String> options) {
    public CrawlRequest(String url) { this(url, Map.of()); }
}

public record CrawlResult(
    boolean success,
    String markdown,
    String title,
    String author,
    List<String> imageUrls,
    String errorMsg
) {
    public static CrawlResult success(String markdown, String title) {
        return new CrawlResult(true, markdown, title, null, List.of(), null);
    }
    public static CrawlResult failure(String msg) {
        return new CrawlResult(false, null, null, null, List.of(), msg);
    }
}
```

```java
// adapter/crawler/WebCrawlerDispatcher.java
@Service
public class WebCrawlerDispatcher {

    private final List<WebCrawlerPort> crawlers;

    // Spring 自动注入所有实现，按 @Order 排序
    public WebCrawlerDispatcher(List<WebCrawlerPort> crawlers) {
        this.crawlers = crawlers;
    }

    public CrawlResult crawl(String url) {
        return crawlers.stream()
            .filter(c -> c.supports(url))
            .findFirst()
            .map(c -> c.crawl(new CrawlRequest(url)))
            .orElse(CrawlResult.failure("没有可用的爬虫实现"));
    }
}
```

```java
// adapter/crawler/JinaReaderCrawler.java（默认首选）
@Component
@Order(10)
public class JinaReaderCrawler implements WebCrawlerPort {

    private static final String JINA_BASE = "https://r.jina.ai/";

    @Value("${nexus.crawler.jina.api-key:}")
    private String jinaApiKey;

    @Override
    public String name() { return "jina-reader"; }

    @Override
    public boolean supports(String url) {
        return !url.contains("xiaohongshu.com")
            && !url.contains("xhslink.com")
            && !url.contains("bilibili.com")
            && !url.contains("b23.tv");
    }

    @Override
    public CrawlResult crawl(CrawlRequest request) {
        try {
            var spec = WebClient.create().get()
                .uri(JINA_BASE + request.url())
                .header("Accept", "text/markdown")
                .header("X-Return-Format", "markdown");
            if (!jinaApiKey.isBlank()) {
                spec = spec.header("Authorization", "Bearer " + jinaApiKey);
            }
            String md = spec.retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(30))
                .block();
            return CrawlResult.success(md, extractTitle(md));
        } catch (Exception e) {
            return CrawlResult.failure("Jina Reader 失败: " + e.getMessage());
        }
    }

    private String extractTitle(String markdown) {
        if (markdown == null) return "";
        return Arrays.stream(markdown.split("\n"))
            .filter(l -> l.startsWith("# "))
            .map(l -> l.substring(2).trim())
            .findFirst().orElse("");
    }
}
```

```java
// adapter/crawler/Crawl4AiCrawler.java（备选）
@Component
@Order(20)
@ConditionalOnProperty(name = "nexus.crawler.crawl4ai.enabled", havingValue = "true")
public class Crawl4AiCrawler implements WebCrawlerPort {

    @Value("${nexus.crawler.crawl4ai.base-url:http://crawl4ai:11235}")
    private String baseUrl;

    @Override
    public String name() { return "crawl4ai"; }

    @Override
    public boolean supports(String url) { return true; } // 兜底

    @Override
    public CrawlResult crawl(CrawlRequest request) {
        // 调用 Crawl4AI REST API
        // POST /crawl { url, ... }
        // ...
    }
}
```

```java
// adapter/crawler/XiaohongshuCrawler.java（预留）
@Component
@Order(1)
public class XiaohongshuCrawler implements WebCrawlerPort {
    @Override public String name() { return "xiaohongshu"; }
    @Override public boolean supports(String url) {
        return url.contains("xiaohongshu.com") || url.contains("xhslink.com");
    }
    @Override public CrawlResult crawl(CrawlRequest request) {
        return CrawlResult.failure("小红书爬取暂未实现");
    }
}

// adapter/crawler/BiliBiliCrawler.java（预留）
@Component
@Order(2)
public class BiliBiliCrawler implements WebCrawlerPort {
    @Override public String name() { return "bilibili"; }
    @Override public boolean supports(String url) {
        return url.contains("bilibili.com") || url.contains("b23.tv");
    }
    @Override public CrawlResult crawl(CrawlRequest request) {
        return CrawlResult.failure("B站爬取暂未实现");
    }
}
```

---

## 9. Mindbank 抽象层（MindBankPort）

```java
// port/MindBankPort.java
public interface MindBankPort {
    IngestResult ingest(IngestRequest request);
    List<RetrievedChunk> search(SearchRequest request);
    void delete(String docId);
    List<WorkspaceInfo> listWorkspaces();
    WorkspaceInfo ensureWorkspace(String domain);
}

public record IngestRequest(
    String domain,
    String docId,
    String content,
    Map<String, Object> metadata   // title, tags, fileUrl, notionUrl 等
) {}

public record RetrievedChunk(
    String docId,
    String chunkText,
    double score,
    Map<String, Object> metadata
) {}

public record SearchRequest(
    String query,
    String domain,  // null = 全库搜索
    int topK
) {}
```

```java
// adapter/mindbank/AnythingLlmMindBank.java
@Component
@ConditionalOnProperty(name = "nexus.mindbank.store", havingValue = "anythingllm", matchIfMissing = true)
public class AnythingLlmMindBank implements MindBankPort {
    @Autowired
    private AnythingLlmClient client;
    // 实现所有接口方法，内部调用 AnythingLLM REST API
}

// adapter/mindbank/CustomRagMindBank.java（未来自建 RAG，目前注释）
// @Component
// @ConditionalOnProperty(name = "nexus.mindbank.store", havingValue = "custom")
// public class CustomRagMindBank implements MindBankPort { ... }
```

---

## 10. MinIO 文件存储

### 核心设计：MinIO 挂载 NAS 路径

文件**实际存储在 NAS 指定目录**，MinIO 只是在上面加一层 HTTP 访问能力和 S3 上传 API。两种写入方式都支持：

```
NAS /volume1/nexus-files/
    ↑ 程序自动上传（后端通过 S3 API 写入）
    ↑ 手动放文件（直接拷贝到 NAS 目录，MinIO 自动识别）
    ↓
MinIO（NAS 上的 Docker 容器，挂载上方路径）
    ↓
https://files.yourdomain.com/nexus-files/mindbank/xxx.pdf
```

### NAS 上的 Docker Compose

```yaml
# NAS 上单独的 docker-compose.yml
services:
  minio:
    image: minio/minio
    container_name: minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - /volume1/nexus-files:/data   # 直接挂载 NAS 实际路径
    ports:
      - "9000:9000"   # S3 API（后端上传用）
      - "9001:9001"   # 管理控制台
    restart: unless-stopped
```

> `/volume1/nexus-files` 是 Synology NAS 的路径格式，根据你的 NAS 型号调整。
> MinIO 容器内的 `/data` 就是 NAS 上的 `/volume1/nexus-files`，两者完全同步，文件只有一份。

### 目录结构规范

```
/volume1/nexus-files/        ← MinIO bucket: nexus-files
    ├── mindbank/
    │   └── {docId}/
    │       └── {filename}.pdf
    ├── forge/
    │   └── {noteId}/
    │       └── solution.md
    └── radar/
        └── {taskId}/
            └── content.md
```

### 访问方式

通过 Tailscale 内网 + 域名反代对外暴露（和 AnythingLLM 同样的方式）：

```caddyfile
# NAS 或 Mac 上的 Caddy 配置（已有 Tailscale 通道）
files.yourdomain.com {
    reverse_proxy localhost:9000
}
```

### 后端 MinioClient

```java
// integration/MinioClient.java
@Component
public class MinioClient {

    @Value("${nexus.minio.endpoint}")
    private String endpoint;

    @Value("${nexus.minio.access-key}")
    private String accessKey;

    @Value("${nexus.minio.secret-key}")
    private String secretKey;

    @Value("${nexus.minio.bucket:nexus-files}")
    private String bucket;

    @Value("${nexus.minio.public-url}")
    private String publicUrl;    // https://files.yourdomain.com

    private io.minio.MinioClient client;

    @PostConstruct
    public void init() {
        client = io.minio.MinioClient.builder()
            .endpoint(endpoint)
            .credentials(accessKey, secretKey)
            .build();
    }

    /**
     * 上传文件，返回永久访问 URL
     * 文件实际写入 NAS /volume1/nexus-files/{objectKey}
     */
    public String upload(String objectKey, InputStream stream, String contentType) {
        client.putObject(PutObjectArgs.builder()
            .bucket(bucket).object(objectKey)
            .stream(stream, -1, 10485760)
            .contentType(contentType).build());
        // 返回公开访问 URL（通过域名反代）
        return publicUrl + "/" + bucket + "/" + objectKey;
    }

    /**
     * 生成带签名的临时 URL（用于私有文件的临时授权访问）
     */
    public String presignedUrl(String objectKey, int expirySeconds) {
        return client.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
            .bucket(bucket).object(objectKey)
            .expiry(expirySeconds).method(Method.GET).build());
    }
}
```

### 文件 URL 规范（存入 `file_url` 字段）

```
https://files.yourdomain.com/nexus-files/mindbank/{docId}/{filename}
https://files.yourdomain.com/nexus-files/forge/{noteId}/solution.md
https://files.yourdomain.com/nexus-files/radar/{taskId}/content.md
```

> 手动放入 NAS 目录的文件，URL 同样适用，MinIO 自动识别已有文件。

---

## 11. 通知系统

```java
// integration/notification/NotificationService.java
public interface NotificationService {
    String channel();   // "telegram" | "email" | "apns"
    void send(String userId, NotificationEvent event, Map<String, Object> payload);
}

public enum NotificationEvent {
    TASK_COMPLETED,
    MINDBANK_INGESTED,
    LEDGER_EXPIRING,
    FORGE_NOTE_GENERATED,
    RADAR_COMPLETED,
    FOCUS_REMINDER
}
```

Ledger 到期提醒（`LedgerNotifyScheduler`，每天 09:00）：
```java
@Scheduled(cron = "0 0 9 * * *")
public void checkLedgerExpiry() {
    int days = Integer.parseInt(systemConfigService.get("ledger.notify_days_before"));
    LocalDate threshold = LocalDate.now().plusDays(days);
    List<Ledger> expiring = ledgerMapper.selectExpiringSoon(threshold);
    expiring.forEach(l -> notificationService.send(userId, LEDGER_EXPIRING,
        Map.of("name", l.getName(), "expire_date", l.getExpireDate())));
}
```

---

## 12. API 路由清单（完整版）

```
# 认证
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/send-code        # 发送验证码

# Focus
GET    /api/v1/focus                 # ?status=&date=
POST   /api/v1/focus
PATCH  /api/v1/focus/{id}/status
PATCH  /api/v1/focus/{id}
DELETE /api/v1/focus/{id}

# Fleeting
GET    /api/v1/fleeting
POST   /api/v1/fleeting
DELETE /api/v1/fleeting/{id}

# Prism
POST   /api/v1/prism/translate
GET    /api/v1/prism/history

# Mindbank
POST   /api/v1/mindbank/inbox           # 提交文件（Multipart）
GET    /api/v1/mindbank/inbox           # 待审核列表
PATCH  /api/v1/mindbank/inbox/{id}/approve
PATCH  /api/v1/mindbank/inbox/{id}/reject
POST   /api/v1/mindbank/inbox/from-radar  # 从 Radar 结果录入
GET    /api/v1/mindbank/docs            # ?domain=
GET    /api/v1/mindbank/workspaces
POST   /api/v1/mindbank/chat            # SSE 流式

# Radar
POST   /api/v1/radar                    # 异步，返回 taskId
GET    /api/v1/radar/history

# Ledger
GET    /api/v1/ledger
POST   /api/v1/ledger
PATCH  /api/v1/ledger/{id}
DELETE /api/v1/ledger/{id}
PATCH  /api/v1/ledger/{id}/usage        # 更新用量

# Forge
POST   /api/v1/forge/start
POST   /api/v1/forge/{id}/chat          # SSE 多轮
POST   /api/v1/forge/{id}/complete
GET    /api/v1/forge/notes
GET    /api/v1/forge/notes/{id}

# Muse
POST   /api/v1/muse/chat                # SSE 流式

# Tasks
GET    /api/v1/tasks
GET    /api/v1/tasks/{id}
PATCH  /api/v1/tasks/{id}/keep
DELETE /api/v1/tasks/{id}

# Settings
GET    /api/v1/settings/llm/providers
POST   /api/v1/settings/llm/providers
PATCH  /api/v1/settings/llm/providers/{id}
DELETE /api/v1/settings/llm/providers/{id}
GET    /api/v1/settings/llm/workflows
PATCH  /api/v1/settings/llm/workflows/{type}
GET    /api/v1/settings/system
PATCH  /api/v1/settings/system
GET    /api/v1/settings/notifications
PATCH  /api/v1/settings/notifications
```

> 所有路由加 `/api/v1/` 前缀，为未来多版本共存预留。

---

## 13. 核心工作流

### Focus Rollover（每天 00:05）

```
status IN (not_started, in_progress) AND scheduled_date < TODAY
  → scheduled_date = TODAY
```

归档天数从 `system_configs` 表读取，可在设置页面修改。

### Mindbank Inbox 工作流

```
用户上传文件（PDF / Markdown / txt）
↓
1. 文件存入 MinIO → 获得 file_url
↓
2. 提取文本内容（PDF → PDFBox，Markdown → 直接使用）
↓
3. LlmExtractMetadataStep（调 LlmConfigService 解析 mindbank_extract 对应模型）
   → 生成 { title, domain, tags, summary, key_points }
   → 存入 mindbank_docs（review_status=pending）
↓
4. 前端展示元数据给用户审核（可修改 domain / tags）
↓
5. 用户审核通过 → MindBankPort.ensureWorkspace(domain)
↓
6. MindBankPort.ingest(...)（含 metadata：fileUrl, notionUrl 等）
↓
7. MindBankPort.search(summary, domain, topK=5)
   AI 判断是否有关联已有总结
↓
8a. 有关联 → 合并提炼 → 更新 Notion + 更新 Mindbank
8b. 无关联 → 新建总结 → WriteNotionStep + MindBankPort.ingest(总结文本)
↓
9. 更新 mindbank_docs 状态
```

Radar → Mindbank 入口：
```
POST /api/v1/mindbank/inbox/from-radar
Body: { radarTaskId }
  → 取 Task.result_markdown 作为内容
  → 取 Task.input.url 作为 source_url
  → 直接进入步骤 3（跳过文件上传）
```

### Forge 工作流

```
开始一题 → 多轮 SSE 对话辅导（LangChain4j ChatMemory）
↓
用户完成 → AI 生成固定模板笔记
↓
存入 forge_notes + forge_note_contents
↓
WriteNotionStep
↓
MindBankPort.ingest(domain="算法刷题", metadata 含 problemId / difficulty / notionUrl)
```

---

## 14. 环境变量（完整版）

### 前端

```env
VITE_API_BASE_URL=https://nexus.yourdomain.com/api/v1
VITE_APP_NAME=Nexus
```

### 后端

```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:postgres}:5432/nexus
    username: ${DB_USER:nexus}
    password: ${DB_PASSWORD}
  flyway:
    enabled: true
    locations: classpath:db/migration
  servlet:
    multipart:
      max-file-size: 50MB
      max-request-size: 50MB

# JWT
jwt:
  secret: ${JWT_SECRET}
  access-token-expiry: 900        # 秒，15分钟
  refresh-token-expiry: 2592000   # 秒，30天

# Spring AI（全局默认 LLM，工作流可覆盖）
spring:
  ai:
    openai:
      api-key: ${OPENAI_API_KEY:}
      chat.options.model: ${LLM_MODEL:gpt-4o-mini}

# LangChain4j
langchain4j:
  open-ai:
    api-key: ${OPENAI_API_KEY:}
    chat-model.model-name: ${LLM_MODEL:gpt-4o-mini}
    embedding-model.model-name: text-embedding-3-small

# Mindbank
nexus:
  mindbank:
    store: anythingllm             # anythingllm | custom

# AnythingLLM（Mac 本地，Tailscale 内网访问）
anythingllm:
  base-url: ${ANYTHINGLLM_BASE_URL:http://100.x.x.x:3001}
  api-key: ${ANYTHINGLLM_API_KEY}

# 爬虫
nexus:
  crawler:
    preferred: jina                # jina | crawl4ai
    jina:
      api-key: ${JINA_API_KEY:}    # 可选
    crawl4ai:
      enabled: ${CRAWL4AI_ENABLED:true}
      base-url: ${CRAWL4AI_BASE_URL:http://crawl4ai:11235}

# MinIO（NAS 上，Tailscale 访问）
# NAS 上 MinIO 容器挂载 /volume1/nexus-files，文件实际存在 NAS
nexus:
  minio:
    endpoint: ${MINIO_ENDPOINT:http://nas-tailscale-ip:9000}  # NAS 的 Tailscale IP
    access-key: ${MINIO_ACCESS_KEY}
    secret-key: ${MINIO_SECRET_KEY}
    bucket: ${MINIO_BUCKET:nexus-files}
    public-url: ${MINIO_PUBLIC_URL:https://files.yourdomain.com}  # 对外访问域名

# Notion
notion:
  token: ${NOTION_TOKEN}
  db:
    focus: ${NOTION_FOCUS_DB_ID}
    fleeting: ${NOTION_FLEETING_DB_ID}
    mindbank: ${NOTION_MINDBANK_DB_ID}
    ledger: ${NOTION_LEDGER_DB_ID}
    forge: ${NOTION_FORGE_DB_ID}
    radar: ${NOTION_RADAR_DB_ID}

# Telegram
telegram:
  bot-token: ${TELEGRAM_BOT_TOKEN}
  admin-chat-id: ${TELEGRAM_ADMIN_CHAT_ID}

# LLM API Key 加密
nexus:
  encrypt:
    secret: ${ENCRYPT_SECRET}     # AES 加密 llm_providers.api_key 用
```

---

## 15. Docker Compose（云服务器）

```yaml
services:
  frontend:
    build:
      context: ./nexus-frontend
    container_name: nexus-frontend
    restart: unless-stopped
    expose: ["80"]          # 只对内部网络暴露，不对公网
    depends_on: [backend]   # 内部要反代后端，需要后端先启动

  backend:
    build:
      context: ./nexus-backend
    container_name: nexus-backend
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
    expose: ["8080"]        # 只对内部网络暴露，不对公网

  postgres:
    image: postgres:16-alpine
    container_name: nexus-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: nexus
      POSTGRES_USER: nexus
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nexus"]
      interval: 5s
      timeout: 5s
      retries: 5

  crawl4ai:
    image: unclecode/crawl4ai:latest
    container_name: nexus-crawl4ai
    restart: unless-stopped
    shm_size: "2g"
    expose: ["11235"]       # 只对内部网络暴露
    deploy:
      resources:
        limits:
          memory: 1G

  caddy:
    image: caddy:2-alpine
    container_name: nexus-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile   # 外层 Caddyfile，只做 HTTPS + 反代到 frontend:80
      - ./data/caddy/data:/data
      - ./data/caddy/config:/config
    depends_on: [frontend]

# 阶段3引入：
#  redis:
#    image: redis:7-alpine
#    container_name: nexus-redis
#    restart: unless-stopped
#    command: redis-server --appendonly yes
#    volumes:
#      - ./data/redis:/data
```

---

## 16. Caddy 配置

### 架构说明

采用两层结构，与婚礼管理系统保持一致：

```
外层 Caddy（443，HTTPS + Basic Auth + 域名路由）
    ↓ 只反代到前端容器
前端 Caddy 容器（80，内部负责 API 反代 + 静态文件）
    ├── /api/* → backend:8080
    └── /*     → 静态文件（SPA 路由兜底）
```

外层 Caddy 不需要知道后端的存在，职责单一。前端容器自包含，路由逻辑全部在内部管理。

---

### 外层 Caddyfile（服务器上，负责 HTTPS + 域名）

```caddyfile
# Nexus 主应用
nexus.yourdomain.com {
    basicauth {
        nexus YOUR_BCRYPT_HASHED_PASSWORD
    }
    # 只反代到前端容器，其他什么都不管
    reverse_proxy frontend:80
}

# AnythingLLM（Mac 本地，Tailscale 内网访问，已有）
anythingllm.yourdomain.com {
    basicauth {
        nexus YOUR_BCRYPT_HASHED_PASSWORD
    }
    reverse_proxy 100.x.x.x:3001   # Tailscale 分配给 Mac 的 IP
}

# MinIO 文件访问（Mac 本地 / NAS）
files.yourdomain.com {
    reverse_proxy 100.x.x.x:9000
}
```

生成 Basic Auth 密码哈希：
```bash
docker run --rm caddy:2-alpine caddy hash-password --plaintext "你的密码"
```

---

### 前端容器内部 Caddyfile（负责路由分发）

```caddyfile
# nexus-frontend/Caddyfile
:80 {
    # 安全头
    header X-Frame-Options SAMEORIGIN
    header X-Content-Type-Options nosniff
    header Referrer-Policy strict-origin-when-cross-origin

    # gzip 压缩
    encode gzip

    # index.html 禁止缓存，确保用户拿到最新版本
    @index path /index.html
    header @index Cache-Control "no-cache, no-store, must-revalidate"
    header @index Pragma "no-cache"
    header @index Expires "0"

    # 静态资源长期缓存（带哈希的 JS/CSS 可放心永久缓存）
    @assets path_regexp assets \.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$
    header @assets Cache-Control "public, max-age=2592000, immutable"

    # API 反代到后端容器
    handle /api/* {
        reverse_proxy backend:8080
    }

    # SPA 路由兜底：所有非文件请求回退到 index.html
    handle /* {
        root * /srv
        try_files {path} /index.html
        file_server
    }
}
```

---

## 17. Dockerfile

### 前端（Caddy serve 静态文件，内部反代后端）

```dockerfile
# nexus-frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 用 Caddy 作为运行时，和婚礼系统 Nginx 的角色一致
FROM caddy:2-alpine
# 复制构建产物
COPY --from=builder /app/dist /srv
# 复制内部 Caddyfile（负责 API 反代 + 静态文件 + 缓存策略）
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
```

> 前端仓库根目录放两个 Caddy 配置文件：
> - `Caddyfile`：容器内部使用（上一节的前端内部配置）
> - 服务器上的外层 `Caddyfile` 单独维护，不在前端仓库里

### 后端

```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
COPY .mvn .mvn
COPY mvnw .
RUN chmod +x mvnw && ./mvnw package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

## 18. 阶段开发任务清单

### ✅ 阶段 1：基础 MVP

后端：
- [ ] Spring Boot 初始化（Java 21，MyBatis-Plus）
- [ ] Flyway V1 V2（用户认证 + 核心模块建表）
- [ ] JWT 认证（登录 / 刷新 / 登出）
- [ ] Focus 完整 CRUD + 状态流转
- [ ] Fleeting 完整 CRUD
- [ ] Prism 翻译（Spring AI）
- [ ] Ledger 完整 CRUD
- [ ] Task 表 + 查询 API
- [ ] FocusRolloverScheduler
- [ ] LedgerNotifyScheduler（Telegram Bot 推送）
- [ ] NotionClient 基础封装
- [ ] LlmConfigService（Provider 解析）
- [ ] Docker Compose + Caddy
- [ ] MindBankPort 接口定义 + AnythingLlmMindBank 骨架（阶段2填充）
- [ ] WebCrawlerPort 接口 + JinaReaderCrawler 实现
- [ ] Crawl4AiCrawler / XiaohongshuCrawler / BiliBiliCrawler 占位实现

前端：
- [ ] Vite + React + TypeScript + Tailwind 初始化
- [ ] shadcn/ui 配置
- [ ] JWT 认证流程（登录页 + token 刷新拦截器）
- [ ] AppLayout（侧边栏 + 移动底部导航）
- [ ] Focus / Fleeting / Prism / Ledger 页面
- [ ] Task History 页面（基础）
- [ ] Settings 页面（LLM 配置 + 系统参数）
- [ ] PWA 基础配置
- [ ] TelegramThemeProvider

---

### 🔧 阶段 2：Mindbank 核心

后端：
- [ ] Flyway V3（mindbank_docs）
- [ ] LangChain4j 接入
- [ ] MetadataExtractorAI
- [ ] MinioClient
- [ ] AnythingLlmClient 完整封装
- [ ] AnythingLlmMindBank 完整实现
- [ ] MindbankInboxWorkflow（文件 → 元数据）
- [ ] MindbankIngestWorkflow（审核 → 录入 → 关联检查 → Notion）
- [ ] Radar 工作流（Jina/Crawl4AI + LLM 提取）
- [ ] Radar → Mindbank 连接接口

前端：
- [ ] Mindbank Inbox 页面（文件上传）
- [ ] 元数据审核页面
- [ ] 知识库文档列表（按 domain）
- [ ] 知识库问答（SSE 流式）
- [ ] Radar 页面
- [ ] MarkdownRenderer

---

### ⚡ 阶段 3：Forge + 异步优化

后端：
- [ ] Flyway V4（settings 配置表）
- [ ] ForgeTutorAI（LangChain4j ChatMemory）
- [ ] Forge 多轮对话 SSE
- [ ] Forge 总结笔记 → Notion + Mindbank
- [ ] Redis + Redisson 引入
- [ ] Mindbank / Radar 改为异步队列
- [ ] TaskCleanupScheduler

前端：
- [ ] Forge 页面（对话辅导 + 完成提交）
- [ ] Task History 完整版（轮询 + keep 标记）

---

### 📱 阶段 4：多端 + 认证完善

- [ ] Telegram Login + TMA initData 校验
- [ ] 邮箱/手机验证码登录
- [ ] Telegram Bot 通知完整实现
- [ ] PWA 离线 fallback
- [ ] iOS App 接口预备验证（JWT + APNs device token 注册）

---

### 🤖 阶段 5：Muse + iOS

- [ ] Muse 多轮问答（LangChain4j + 对话记忆）
- [ ] Sign in with Apple
- [ ] APNs 推送实现
- [ ] iOS App 开发（React Native 或原生 Swift，独立项目）

---

### 🌐 阶段 6：微信小程序

- [ ] 微信小程序登录（openid + unionid）
- [ ] 微信消息推送
- [ ] 微信小程序前端（独立项目）

---

## 19. 数据职责边界

```
PostgreSQL    → 业务数据 / 任务历史 / 元数据索引 / 配置（无向量）
AnythingLLM  → 向量知识库（LanceDB，Mac 本地；可切换 PGVector）
MinIO（NAS）      → 文件对象存储，挂载 NAS 实际路径，提供 HTTP 访问 URL
Notion        → 长期可读知识沉淀 / 人类友好的结构化内容
```

## 20. 可替换口子总览

| 口子 | 当前方案 | 切换为 | 切换代价 |
|---|---|---|---|
| 知识库引擎 | AnythingLLM | 自建 RAG | 实现 CustomRagMindBank |
| AnythingLLM 内部向量库 | LanceDB | PGVector | 改一行环境变量 |
| 首选爬虫 | Jina Reader | Crawl4AI | 改 `nexus.crawler.preferred` |
| 小红书爬取 | 预留占位 | Python 容器 | 实现 XiaohongshuCrawler |
| B站爬取 | 预留占位 | Python 容器 | 实现 BiliBiliCrawler |
| LLM Provider | 任意配置 | 随时切换 | 设置页面修改 |
| 订阅 API 用量拉取 | 预留字段 | 实现 ApiUsageFetchPort | 按需实现各平台 Fetcher |
| 通知渠道 | Telegram Bot | Email / APNs | 实现 NotificationService |
| 文件存储 | MinIO 挂载 NAS 路径 | 纯 Caddy file_server（只读） / S3 | 改 MinioClient 实现 |

---

## 21. 给 Claude Code 的执行指令

**第一次执行（方案细化，不写代码）：**

输出：
1. 完整 `pom.xml`（Spring Boot 3.x + MyBatis-Plus + LangChain4j + Spring AI + JWT + MinIO SDK）
2. 完整 `package.json`
3. 项目初始化命令序列
4. Flyway V1-V4 完整 SQL 文件
5. 所有 Controller 的 Request/Response DTO 定义
6. 环境变量清单（必填 / 可选 / 默认值 / 说明）

**第二次执行（按阶段1清单逐模块实现）：**

每模块包含：SQL → Entity → Mapper → Service → Workflow → Controller → 前端 API 函数 → 前端页面

**代码规范：**
- 所有外部调用（LLM / Notion / AnythingLLM / MinIO / Crawl4AI）必须有 try-catch
- Notion 写入检查 `notion_synced`（幂等）
- Controller 只做校验 + 调 Service
- 知识库操作只能通过 `MindBankPort`
- 爬虫调用只能通过 `WebCrawlerDispatcher`
- LLM 调用通过 `LlmConfigService.resolveModel(workflowType)` 获取模型
- SSE 超时 5 分钟
- 所有时间字段存 UTC，API 返回 ISO 8601 格式
- 路由前缀统一 `/api/v1/`
