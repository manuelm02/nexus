# Nexus — 完整开发实施文档（精简工作流版）
> 供 Claude Code / Codex 直接执行
> 最后更新：按 2026-06-09 产品减法方向重排

---

## 0. 项目定位

Nexus 是一个**个人 AI 工作台 / Knowledge OS**，统一管理个人输入、AI 处理、知识沉淀与多端结果输出。

**核心原则：**
- 前后端完全分离，后端 API 唯一，所有端复用
- 前端一套代码适配 Web 桌面端 / PWA / Telegram Mini App，预留 iOS App 接入口
- ToDo、订阅、翻译历史、任务结果等结构化信息优先落 PostgreSQL；外部笔记系统只做可选输出
- Quick Note / Memo 属于笔记内容，不落业务库；后续通过 Obsidian 文件写入实现
- 所有可替换的外部依赖均有抽象层（知识库引擎、爬虫、LLM Provider、书签、文档库、笔记输出）

**支持端（按优先级）：**
1. Web 桌面端
2. PWA（手机桌面）
3. Telegram Mini App
4. iOS App（预留接口，未来开发）
5. 微信小程序（更远的未来）

---

## 1. 功能模块（当前收束版）

| 模块代码 | 展示名 | 概述文案 | 优先级 |
|---|---|---|---|
| todo | **ToDo** | 先把要做的事放入待分配池，再决定今天真正执行什么。 | P0 |
| translate | **Translate** | 简化版翻译软件，支持大模型/专业翻译 API 的可替换实现。 | P0 |
| inbox | **Inbox** | 统一承接书签、文档接入、快速笔记与备忘录。 | P0 |
| subscriptions | **Subscriptions** | 记录订阅、价格、周期、到期日、用量和提醒。 | P1 |
| chat | **Chat** | 简单日常问答，定位为简化版 DeepSeek 问答窗口。 | P1 |
| mindbank | **Mindbank** | 知识沉淀流程后续单独讨论和实现。 | P2 |
| crawl | **Crawl** | 网页收集 / Radar / Crawl 流程后续单独讨论和实现。 | P2 |

> ⚠️ Forge / Code Wiki 暂不进入当前阶段计划。旧 Focus / Prism / Ledger / Fleeting 命名仅作为历史 API 或迁移兼容存在。

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
│  Redis（后续按需引入）                    │
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
│       ├── paperless/
│       └── crawl/
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
| Redis（后续按需） | ~50MB |
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
| AI（简单调用） | Spring AI / LangChain4j | Translate / Chat / 摘要 |
| AI（复杂工作流） | LangChain4j | Mindbank / Crawl 后续工作流 |
| ORM | **MyBatis-Plus** | Lambda QueryWrapper，SQL 完全可见 |
| 认证 | **JWT**（access_token 15分钟 + refresh_token 30天） | 全端统一，无 Cookie |
| 参数校验 | Spring Validation | |
| API 文档 | SpringDoc OpenAPI 3 | |
| 定时任务 | Spring Scheduler | |
| 异步队列 | Spring @Async 起步，Redis + Redisson 后续按需引入 | |
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
| Linkding | 外部/自建服务 | 通过 REST API 接入书签能力 |
| paperless-ngx | 外部/自建服务 | 通过 REST API 接入文档上传和展示 |
| Obsidian | 本地/同步目录 | Quick Note / Memo 写入 Markdown 文件，具体路径开发时确认 |

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
│   │   ├── Todo/index.tsx            # 待分配池 + 今日执行
│   │   ├── Inbox/index.tsx           # 书签 / 文档 / 快速笔记入口
│   │   ├── Translate/index.tsx       # 翻译工作台
│   │   ├── Mindbank/
│   │   │   ├── index.tsx             # 知识库主页
│   │   │   ├── Inbox.tsx             # 文件收件箱
│   │   │   ├── Review.tsx            # 元数据审核
│   │   │   └── Chat.tsx              # 知识库问答
│   │   ├── Crawl/index.tsx           # 网页收集，后续讨论
│   │   ├── Subscriptions/index.tsx   # Subscription
│   │   ├── Chat/index.tsx            # 简单日常问答
│   │   ├── Tasks/
│   │   │   ├── index.tsx
│   │   │   └── [id].tsx
│   │   ├── Profile/index.tsx         # 用户信息与退出登录
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
│   │   ├── todo.api.ts
│   │   ├── inbox.api.ts
│   │   ├── translate.api.ts
│   │   ├── mindbank.api.ts
│   │   ├── crawl.api.ts
│   │   ├── subscriptions.api.ts
│   │   ├── chat.api.ts
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
    │   ├── TodoController.java
    │   ├── InboxController.java
    │   ├── TranslateController.java
    │   ├── MindbankController.java
    │   ├── CrawlController.java
    │   ├── SubscriptionController.java
    │   ├── ChatController.java
    │   ├── TaskController.java
    │   ├── ProfileController.java
    │   └── SettingsController.java
    │
    ├── service/
    │   ├── AuthService.java
    │   ├── TodoService.java
    │   ├── InboxService.java
    │   ├── TranslateService.java
    │   ├── MindbankService.java
    │   ├── CrawlService.java
    │   ├── SubscriptionService.java
    │   ├── ChatService.java
    │   ├── TaskService.java
    │   └── LlmConfigService.java     # 解析工作流对应的 LLM Provider
    │
    ├── workflow/
    │   ├── WorkflowRegistry.java
    │   ├── TranslateWorkflow.java
    │   ├── ChatWorkflow.java
    │   ├── MindbankInboxWorkflow.java
    │   ├── MindbankIngestWorkflow.java
    │   ├── CrawlWorkflow.java
    │   └── SubscriptionNotifyWorkflow.java
    │
    ├── step/
    │   ├── LlmTranslateStep.java
    │   ├── LlmSummarizeStep.java
    │   ├── LlmExtractMetadataStep.java
    │   ├── LlmCheckRelatedStep.java
    │   ├── CrawlUrlStep.java           # 调用 WebCrawlerDispatcher
    │   ├── WriteObsidianNoteStep.java
    │   ├── SendNotificationStep.java   # 统一通知 Step
    │   ├── MindbankIngestStep.java     # 调用 MindBankPort
    │   └── SaveTaskResultStep.java
    │
    ├── port/
    │   ├── MindBankPort.java           # 知识库抽象（原 KnowledgeStorePort）
    │   └── WebCrawlerPort.java         # 爬虫抽象
    │   ├── BookmarkPort.java           # Linkding 书签抽象
    │   ├── DocumentArchivePort.java    # paperless-ngx 文档抽象
    │   └── NoteSinkPort.java           # Obsidian Markdown 写入抽象
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
    │   ├── LinkdingClient.java
    │   ├── PaperlessClient.java
    │   ├── ObsidianFileWriter.java
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
    │   ├── TodoMapper.java
    │   ├── InboxMapper.java
    │   ├── TranslationMapper.java
    │   ├── MindbankDocMapper.java
    │   ├── SubscriptionMapper.java
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
    │   ├── Todo.java                     # ToDo，映射历史 focus 表
    │   ├── InboxItem.java                # Linkding / paperless 接入展示
    │   ├── Translation.java
    │   ├── MindbankDoc.java
    │   ├── Subscription.java             # Subscription，映射历史 ledger 表
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
    │   │   ├── TodoCreateRequest.java
    │   │   ├── TodoUpdateRequest.java
    │   │   ├── TodoStatusRequest.java
    │   │   ├── InboxCreateRequest.java
    │   │   ├── TranslateRequest.java
    │   │   ├── MindbankInboxRequest.java
    │   │   ├── MindbankFromCrawlRequest.java
    │   │   ├── CrawlRequest.java
    │   │   ├── SubscriptionCreateRequest.java
    │   │   ├── SubscriptionUpdateRequest.java
    │   │   ├── SubscriptionUsageRequest.java
    │   │   └── ChatRequest.java
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
        ├── TodoRolloverScheduler.java     # 可选：每天 00:05
        ├── TaskCleanupScheduler.java      # 每天 02:00
        └── SubscriptionNotifyScheduler.java # 每天 09:00，订阅到期提醒
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
-- ToDo（历史表名仍为 focus；Flyway 已应用后不直接改表名）
CREATE TABLE focus (
    id              VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    priority        VARCHAR(20)  DEFAULT 'medium',       -- low|medium|high|urgent
    status          VARCHAR(20)  DEFAULT 'pending',      -- pending|cancelled|not_started|in_progress|done|archived
    scheduled_date  DATE,          -- 被选入今日执行时写入当前日期
    due_date        DATE,          -- 截止日期
    task_id         VARCHAR(36),
    notion_page_url VARCHAR(500),  -- 历史兼容字段；ToDo 不再写入 Notion
    notion_synced   BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_focus_status_date ON focus(status, scheduled_date);

-- Inbox（当前阶段不强制新增业务表）
-- Linkding 书签和 paperless-ngx 文档分别以外部系统为事实源
-- Quick Note / Memo 直接写入 Obsidian Markdown，不落 PostgreSQL 业务表

-- Translate（历史表名可为 prism/translation；新实现展示名统一为 Translate）
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

-- Subscriptions（历史命名 ledger；API 展示名统一为 Subscriptions）
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
    -- 历史兼容同步字段；Subscriptions 当前阶段不写 Notion
    notion_page_url     VARCHAR(500),
    notion_synced       BOOLEAN        DEFAULT FALSE,
    task_id             VARCHAR(36),
    created_at          TIMESTAMP      DEFAULT NOW(),
    updated_at          TIMESTAMP      DEFAULT NOW()
);

-- 统一任务表
CREATE TABLE tasks (
    id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type                VARCHAR(50) NOT NULL,
    -- todo|translate|inbox_note|subscription_notify|chat|mindbank|crawl
    status              VARCHAR(20) DEFAULT 'pending',   -- pending|running|completed|failed
    input               JSONB,
    output              JSONB,
    error_message       TEXT,
    result_text         TEXT,
    result_markdown     TEXT,
    result_json         JSONB,
    result_files        JSONB,   -- [{url, name, storage, size}]
    notion_page_url     VARCHAR(500),   -- 历史兼容字段，当前阶段不作为必需能力
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
    source_type         VARCHAR(50),             -- file|crawl
    -- 文件存储（通用，不绑定 NAS）
    file_url            VARCHAR(1000),           -- MinIO / 对象存储访问 URL
    file_storage        VARCHAR(20),             -- minio|local|s3|gdrive
    file_name           VARCHAR(300),
    file_size           BIGINT,                  -- 字节数
    -- 原始来源（若来自 Crawl）
    source_url          VARCHAR(1000),
    crawl_task_id       VARCHAR(36),             -- 关联的 Crawl 任务 ID
    -- 审核状态
    review_status       VARCHAR(20) DEFAULT 'pending', -- pending|approved|rejected
    -- AnythingLLM 集成
    workspace_slug      VARCHAR(200),
    anythingllm_doc_id  VARCHAR(200),
    ingested_at         TIMESTAMP,
    -- 外部人类可读输出，当前是否保留 Notion 开发时再确认
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
    -- translate|chat|mindbank_extract|mindbank_summary|mindbank_chat|crawl_extract
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
(gen_random_uuid(), 'todo.archive_days',              '30',    'ToDo 完成后归档天数'),
(gen_random_uuid(), 'todo.rollover_time',             '00:05', '每日 Rollover 时间'),
(gen_random_uuid(), 'task.cleanup_days',              '30',    '任务结果清理天数'),
(gen_random_uuid(), 'subscriptions.notify_days_before','7',    '订阅到期提醒天数'),
(gen_random_uuid(), 'mindbank.default_domain',        '其他',  'Mindbank 默认领域'),
(gen_random_uuid(), 'crawler.preferred',              'jina',  '默认爬虫：jina|crawl4ai');

-- 用户通知配置
CREATE TABLE user_notification_configs (
    id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel     VARCHAR(20) NOT NULL,   -- telegram|email|apns
    event_type  VARCHAR(50) NOT NULL,
    -- task_completed|mindbank_ingested|subscriptions_expiring|crawl_completed|todo_reminder
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
    SUBSCRIPTIONS_EXPIRING,
    CRAWL_COMPLETED,
    TODO_REMINDER
}
```

Subscriptions 到期提醒（`SubscriptionNotifyScheduler`，每天 09:00）：
```java
@Scheduled(cron = "0 0 9 * * *")
public void checkSubscriptionExpiry() {
    int days = Integer.parseInt(systemConfigService.get("subscriptions.notify_days_before"));
    LocalDate threshold = LocalDate.now().plusDays(days);
    List<Subscription> expiring = subscriptionMapper.selectExpiringSoon(threshold);
    expiring.forEach(l -> notificationService.send(userId, SUBSCRIPTIONS_EXPIRING,
        Map.of("name", l.getName(), "expire_date", l.getExpireDate())));
}
```

---

## 12. API 路由清单（当前收束版）

```
# 认证
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/send-code        # 发送验证码
GET    /api/v1/auth/me               # 当前用户信息

# Profile
GET    /api/v1/profile
PATCH  /api/v1/profile

# ToDo
GET    /api/v1/todos                 # ?status=&date=
POST   /api/v1/todos                 # 创建后进入 pending 池
PATCH  /api/v1/todos/{id}
PATCH  /api/v1/todos/{id}/status     # pending/cancelled/not_started/in_progress/done/archived
POST   /api/v1/todos/{id}/plan-today # 写入 scheduled_date=today，due_date 由用户选择或兜底今天
DELETE /api/v1/todos/{id}

# Translate
POST   /api/v1/translate
GET    /api/v1/translate/history

# Inbox - Linkding 书签
GET    /api/v1/inbox/bookmarks
POST   /api/v1/inbox/bookmarks
PATCH  /api/v1/inbox/bookmarks/{id}
DELETE /api/v1/inbox/bookmarks/{id}

# Inbox - paperless-ngx 文档
GET    /api/v1/inbox/documents
POST   /api/v1/inbox/documents          # Multipart 上传到 paperless-ngx
GET    /api/v1/inbox/documents/{id}

# Inbox - Quick Note / Memo
POST   /api/v1/inbox/notes              # 写入 Obsidian Markdown，不落业务库

# Subscriptions
GET    /api/v1/subscriptions
POST   /api/v1/subscriptions
PATCH  /api/v1/subscriptions/{id}
DELETE /api/v1/subscriptions/{id}
PATCH  /api/v1/subscriptions/{id}/usage # 手动更新用量

# Chat
POST   /api/v1/chat                     # SSE 流式或普通 JSON，按前端实现选择

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

> 旧 `/focus`、`/fleeting`、`/prism`、`/ledger` 路径只作为迁移兼容考虑；新开发统一使用当前收束版路由。

---

## 13. 核心工作流

### 认证与入口

```
Web / PWA / Telegram Mini App
↓
登录获取 access token + refresh token
↓
前端 client.ts 自动刷新 access token
↓
侧边栏 / 用户菜单提供用户信息入口和退出登录按钮
```

退出登录调用 `/api/v1/auth/logout`，清理本地 token 和 auth store 后回到登录页。用户信息页面优先级低于 ToDo/Translate/Inbox，但必须进入阶段计划。

### ToDo 状态机

```
创建 ToDo
  输入：内容、优先级
  默认：status=pending, scheduled_date=null, due_date=null
↓
待分配池 pending
  可取消：status=cancelled
  可恢复：cancelled → pending
  可选入今日：status=not_started, scheduled_date=today, due_date=用户选择或 today 兜底
↓
今日执行池
  not_started：空单选框
  in_progress：用户开始执行后的状态
  done：用户完成后的状态
↓
已过期分组 overdue
  条件：status != done 且 (scheduled_date < today 或 due_date < today)
  用户可直接修改状态、计划日期、截止日期
  调整后可重新回到待分配池、今日执行池或历史列表
↓
历史列表
  pending / cancelled / not_started / in_progress / done 都可按状态筛选
  历史 ToDo 可通过状态变更重新回到可见列表
```

ToDo 的全部事实状态只维护在 PostgreSQL，不写入 Notion 或其他外部笔记系统。

### Inbox 工作流

```
Linkding 书签
  Nexus 提供一层书签 UI 和 API adapter
  书签事实源为 Linkding

paperless-ngx 文档
  Nexus 提供上传、列表、详情展示层
  文档事实源为 paperless-ngx

Quick Note / Memo
  Nexus 收集内容后写入 Obsidian Markdown
  不落 PostgreSQL 业务表
  Obsidian vault 路径和文件命名规则开发该模块时再确认
```

### Translate 工作流

```
用户输入文本、目标语言、风格和可选上下文
↓
TranslateService 根据配置选择翻译 Provider
  方案 A：LLM 翻译，适合上下文改写、语气、解释
  方案 B：有道等专业翻译 API，适合稳定机器翻译
↓
输出包括译文、可选解释、关键词、备选表达
↓
保存翻译历史到 PostgreSQL
```

第一阶段先保留 LLM 翻译能力，同时抽象 `TranslationProviderPort`，为有道等专业 API 留实现口。

### Subscriptions 工作流

用户记录订阅名称、价格、币种、周期、开始日期、到期日、下次扣费日、用量和备注。当前核心是 CRUD、手动用量更新、到期提醒；API 用量拉取和余额同步后续增强。

### Chat 工作流

Chat 是轻量日常问答窗口，不承担 Mindbank 知识库职责。首版支持单轮或简单多轮上下文，模型通过 `LlmConfigService.resolveModel("chat")` 获取；是否持久化会话在实现前再确认。

### Mindbank & Crawl

Mindbank 和 Crawl 保留为后续重点模块，具体流程开发前再单独讨论。当前文档只保留抽象口子，不把 AnythingLLM、Crawl4AI、复杂关联总结纳入 ToDo/Translate/Inbox 的实现前置条件。

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

# Linkding
linkding:
  base-url: ${LINKDING_BASE_URL:}
  token: ${LINKDING_TOKEN:}

# paperless-ngx
paperless:
  base-url: ${PAPERLESS_BASE_URL:}
  token: ${PAPERLESS_TOKEN:}

# Obsidian
obsidian:
  vault-path: ${OBSIDIAN_VAULT_PATH:}
  inbox-dir: ${OBSIDIAN_INBOX_DIR:Inbox}

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

### 阶段 0：文档与命名收束

- [ ] 保留唯一主开发文档，删除旧 v1 / 旧结构重构 / 旧阶段计划文档
- [ ] 统一展示命名：ToDo / Translate / Inbox / Subscriptions / Chat / Mindbank / Crawl
- [ ] 旧 Focus / Prism / Ledger / Fleeting 仅作为数据库表名或兼容路径存在
- [ ] 更新导航、路由、类型、API client 命名，消除 Forge / Muse / Radar 的当前阶段入口

### 阶段 1：ToDo

后端：
- [ ] ToDo 创建只接收内容和优先级，默认进入 `pending` 待分配池
- [ ] 支持 `pending → cancelled` 和 `cancelled → pending`
- [ ] 支持选入今日：`pending → not_started`，写入 `scheduled_date=today`
- [ ] 选入今日时用户选择 `due_date`；未选择时兜底为今天
- [ ] 支持 `not_started → in_progress → done`，并允许历史列表中重新变更状态
- [ ] 新增已过期分组：`status != done` 且 `scheduled_date < today` 或 `due_date < today`
- [ ] 已过期分组允许用户直接调整状态、规划日期、截止日期
- [ ] ToDo 全部信息只维护在 PostgreSQL，不写 Notion

前端：
- [ ] 待分配池：展示 pending，支持取消、恢复、选入今日
- [ ] 今日列表：展示 not_started / in_progress / done
- [ ] 已过期分组：集中展示过期未完成 ToDo，支持就地调整状态、计划日期、截止日期
- [ ] 状态切换 UI：空单选框代表 not_started，开始执行后进入 in_progress，完成后进入 done
- [ ] 历史列表：按状态和日期筛选，允许状态恢复

认证补充：
- [ ] 页面增加退出登录按钮
- [ ] 增加用户信息页面，优先级低于 ToDo 主流程但纳入阶段 1 或阶段 2 收尾

### 阶段 2：Translate

- [ ] 抽象 `TranslationProviderPort`
- [ ] 保留 LLM 翻译作为首个 Provider
- [ ] 为有道等专业翻译 API 预留 Provider 实现口
- [ ] 输出从“单一译文”扩展为译文、解释、关键词、备选表达
- [ ] 前端做成简化版翻译软件：输入、语言、风格、结果区、历史记录
- [ ] 当 LLM provider 未配置时给出明确引导

### 阶段 3：Inbox

- [ ] Linkding：通过 API 复刻核心书签能力，Nexus 提供统一展示层
- [ ] paperless-ngx：通过 API 实现文档上传、列表和详情展示
- [ ] Quick Note / Memo：写入 Obsidian Markdown，不落 PostgreSQL 业务表
- [ ] 抽象 `BookmarkPort`、`DocumentArchivePort`、`NoteSinkPort`
- [ ] Obsidian vault 路径、文件命名规则、目录结构在开发该模块前确认

### 阶段 4：Subscriptions

- [ ] 基础 CRUD：名称、分类、价格、币种、周期、开始日期、到期日、下次扣费日
- [ ] 手动维护用量：额度、已用量、单位
- [ ] 到期提醒：默认提前 7 天，可配置
- [ ] API 用量拉取、余额同步只保留字段和抽象，不进入本阶段

### 阶段 5：Chat

- [ ] 简单日常问答窗口
- [ ] 模型通过 `LlmConfigService.resolveModel("chat")` 获取
- [ ] 首版支持普通请求或 SSE 流式输出，开发前按前端体验确认
- [ ] 不承担 Mindbank 知识库问答职责

### 阶段 6：Mindbank & Crawl

- [ ] Mindbank 具体知识沉淀流程开发前单独讨论
- [ ] Crawl / Radar 网页收集流程开发前单独讨论
- [ ] AnythingLLM、Crawl4AI、复杂任务队列、知识关联总结均不作为前五阶段前置条件

---

## 19. 数据职责边界

```
PostgreSQL    → 业务数据 / 任务历史 / 元数据索引 / 配置（无向量）
AnythingLLM  → 向量知识库（LanceDB，Mac 本地；可切换 PGVector）
MinIO（NAS）      → 文件对象存储，挂载 NAS 实际路径，提供 HTTP 访问 URL
Linkding      → 书签事实源
paperless-ngx → 文档事实源
Obsidian      → Quick Note / Memo Markdown 输出
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
| 翻译 Provider | LLM | 有道等专业翻译 API | 实现 `TranslationProviderPort` |
| 书签系统 | Linkding | Wallabag / 自建 | 实现 `BookmarkPort` |
| 文档系统 | paperless-ngx | 自建文档库 | 实现 `DocumentArchivePort` |
| 笔记输出 | Obsidian Markdown | 其他文件系统 / 新笔记后端 | 实现 `NoteSinkPort` |
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
4. Flyway 当前阶段完整 SQL 文件
5. 所有 Controller 的 Request/Response DTO 定义
6. 环境变量清单（必填 / 可选 / 默认值 / 说明）

**第二次执行（按当前路线逐模块实现）：**

每模块包含：SQL → Entity → Mapper → Service → Workflow → Controller → 前端 API 函数 → 前端页面

**代码规范：**
- 所有外部调用（LLM / Linkding / paperless-ngx / Obsidian 文件写入 / AnythingLLM / MinIO / Crawl4AI）必须有 try-catch
- Controller 只做校验 + 调 Service
- 知识库操作只能通过 `MindBankPort`
- 爬虫调用只能通过 `WebCrawlerDispatcher`
- LLM 调用通过 `LlmConfigService.resolveModel(workflowType)` 获取模型
- SSE 超时 5 分钟
- 所有时间字段存 UTC，API 返回 ISO 8601 格式
- 路由前缀统一 `/api/v1/`
