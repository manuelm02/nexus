# Nexus

**Nexus 是个人 AI 工作台 / Knowledge OS。** 它用一套后端 API + 一套统一前端，把"个人输入 → AI 处理 → 知识沉淀 → 多端输出"的完整链路收敛到一个工作台里：待办、翻译、收纳、订阅、对话、笔记、网页爬取、知识库问答等模块共享同一套认证、LLM 配置与数据层。

前端是**一套代码三端共用**：Web、PWA、Telegram Mini App 共用页面、API、状态管理和构建链路，PWA 通过 Vite PWA 插件增强，Telegram Mini App 通过少量 provider/hook 做环境适配。

> 本文档面向接手项目的开发者与 AI agent，读完即可对 Nexus 的功能范围、技术栈、架构约束与开发流程有完整准确的理解。

---

## 目录

- [功能模块矩阵](#功能模块矩阵)
- [技术栈](#技术栈)
- [架构概览](#架构概览)
- [后端 API 概览](#后端-api-概览)
- [数据模型与 Flyway 迁移](#数据模型与-flyway-迁移)
- [前端结构](#前端结构)
- [快速开始](#快速开始)
- [部署与 Compose 模式](#部署与-compose-模式)
- [项目结构总览](#项目结构总览)
- [开发规范速查](#开发规范速查)
- [路线图与开发进度](#路线图与开发进度)
- [相关文档索引](#相关文档索引)

---

## 功能模块矩阵

| 模块 | 路由 | 职责 | 状态 |
|---|---|---|---|
| **Chat** | `/`、`/chat` | 轻量日常 AI 问答：多会话、SSE 流式、AI 自动命名、Markdown 渲染、动态推荐 | ✅ 已落地 |
| **ToDo** | `/todo` | 减法待办：待分配池、今日执行、已过期分组、历史状态恢复（看板四分组） | ✅ 已落地 |
| **Translate** | `/translate` | AI 翻译：译文/解释/关键词/备选表达，SSE 流式，历史记录，Tencent TMT + LLM 双 Provider | ✅ 已落地 |
| **Inbox** | `/inbox` | 三类收纳：本地书签（含智能分组/批量导入）、paperless-ngx 文档、Obsidian Quick Note / Memo | ✅ 已落地 |
| **Subscriptions** | `/subscriptions` | 订阅管理：多币种、月/年/一次性/买断/按量计费、API 余额自动监控、汇率折算、成本图表 | ✅ 已落地 |
| **Mindbank** | `/mindbank` | 知识库：Workspace、文档入库 5 步 Pipeline、RAG 问答、Prompt 模板管理（基于 AnythingLLM） | ✅ 已落地 |
| **Crawl** | `/crawl` | 网页爬取（Crawl4AI）+ 文件转 Markdown（MarkItDown），导入 Mindbank | ✅ 已落地 |
| **Notes** | `/notes` | Obsidian Vault 笔记管理：文件树、Markdown 编辑器、AI 辅助 | ✅ 已落地 |
| **Tasks** | `/tasks` | 后台异步任务统一查询、保留标记、删除 | ✅ 已落地 |
| **Settings** | `/settings` | 集成设置：LLM 提供商、工作流模型、Inbox / Mindbank / Crawl / Notes | ✅ 已落地 |
| **Profile** | `/profile` | 用户个人资料、退出登录 | ✅ 已落地 |
| **CodingPractice** | `/coding-practice` | 编程练习记录（早期模块，保留） | ✅ 已落地 |
| **Mindbank Agent 层** | — | 双层架构 Phase 6-6~6-8：知识库巡检 Agent、融合自检、检索增强、巡检建议自动执行 | ✅ 已落地 |
| **Panel Hub** | — | Phase 7：API Keys + Credentials 统一凭据管理面板 | 🚧 规划中 |


> **旧命名兼容**：早期模块曾命名为 `Focus` / `Prism` / `Ledger` / `Fleeting` / `Muse` / `Radar` / `Forge`。这些名称仅作为路由别名（如 `/focus` → ToDo）和数据库迁移兼容保留，当前展示统一使用上表新命名。

---

## 技术栈

### 后端

| 类别 | 选型 |
|---|---|
| 语言 / 框架 | Java 21、Spring Boot 3.3.5 |
| ORM / 迁移 | MyBatis-Plus 3.5.7、Flyway（PostgreSQL 方言） |
| 数据库 / 缓存 | PostgreSQL 16、Redis |
| LLM | LangChain4j 0.35.0（openai / anthropic / ollama） |
| 认证 | jjwt 0.12.6（无 Cookie，全走 `Authorization: Bearer`） |
| 对象存储 | MinIO 8.5.12 |
| 翻译 | Tencent Cloud TMT SDK |
| 其他 | Spring WebFlux WebClient、SpringDoc OpenAPI、PDFBox、Spring Scheduler、`@Async` 线程池 |

### 前端

| 类别 | 选型 |
|---|---|
| 框架 / 构建 | React 18、Vite 5、TypeScript 5.6、pnpm 11 |
| 样式 / 组件 | Tailwind CSS v3、shadcn/ui（Radix 原语）、lucide-react |
| 数据 / 状态 | TanStack Query v5（服务器状态）、Zustand 5（客户端状态）、Axios |
| 路由 | React Router v6（全页面懒加载 + 代码分割） |
| 富文本 / 图表 | react-markdown + remark-gfm + rehype-highlight、@uiw/react-md-editor、recharts |
| 多端 | vite-plugin-pwa（PWA）、@twa-dev/sdk（Telegram Mini App） |

### 外部集成

- **AnythingLLM** — Mindbank RAG 知识库（Workspace 1:1 映射，上传/删除/问答）
- **Crawl4AI** — 网页异步爬取（返回 Markdown + HTML）
- **MarkItDown** — PDF / DOCX / 图片等转 Markdown
- **paperless-ngx** — Inbox 文档管理网关
- **Obsidian Vault** — Notes / Quick Note 本地 Markdown 存储（含路径穿越防护）
- **Frankfurter** — 实时汇率 API（订阅多币种折算）
- **DeepSeek balance API** — 按量订阅 API 余额自动监控

---

## 架构概览

### 统一前端模型

`frontend/` 是一套统一前端代码，Web / PWA / Telegram Mini App 共享页面、API、状态管理与构建链路。复杂页面普遍拆分为 `XxxDesktopView` / `XxxMobileView` 双视图，用 Tailwind 响应式类条件渲染（参见 `AGENTS.md` 前端响应式架构规范）。

### 后端分层

```
controller/    REST 入口（16 个 Controller）
service/       业务逻辑
port/          抽象接口（NotePort / StoragePort / KnowledgeBasePort / WebCrawlerPort）
adapter/       Port 的具体实现（爬虫 / 笔记 / 存储）
integration/   第三方客户端（anythingllm / crawl4ai / markitdown / minio / llm / balance / exchange / notification）
mapper/        MyBatis-Plus 数据访问
entity/        数据库实体
step/          Mindbank 文档入库 5 步 Pipeline
workflow/      工作流引擎
scheduler/     定时任务（ToDo rollover、订阅 expired 扫描、余额/汇率同步）
config/        安全 / JWT / CORS / 异步任务 / 集成属性
```

### 关键架构模式

- **无状态 JWT**：access token 15 分钟 + refresh token 30 天，全部走 `Authorization: Bearer`，无 Cookie；refresh token 失效走 Redis 黑名单。
- **SSE 流式**：Chat / Translate 用 `fetch` + `ReadableStream` 手动解析 Server-Sent Events（避免 EventSource 无法携带请求体的限制）。
- **Mindbank Pipeline**：文档入库为 5 步确定性流水线，用 `@Async` 异步执行，前端可视化每步状态并支持单步重跑。
- **Port 抽象**：笔记、存储、知识库、爬虫均通过 Port 接口解耦，便于替换底层实现（Obsidian / MinIO / AnythingLLM / Crawl4AI）。
- **多 LLM 工作流配置**：通过 `workflow_llm_configs` 表按 `workflowType`（translate / chat / mindbank_* / subscriptions 等）独立配置模型与温度，统一经 `LlmConfigService.resolveModel(workflowType)` 解析，**不要直接 new 模型对象**。
- **API Key 加密存储**：存储前调用 `llmConfigService.encrypt()`，读取时框架自动解密，`@JsonIgnore` + 脱敏防止泄露到前端。
- **统一响应结构**：所有接口返回 `{ success, data, message, errorCode }`，前端取数据用 `res.data.data`。

---

## 后端 API 概览

> 所有业务接口前缀 `/api/v1`，需 `Authorization: Bearer <accessToken>`（`/auth/login`、`/auth/refresh` 除外）。下表为代表性端点，完整定义见 SpringDoc OpenAPI（启动后 `/swagger-ui.html`）。

| 模块（Controller） | 前缀 | 代表性端点 |
|---|---|---|
| **Auth** | `/auth` | `POST /login`、`POST /refresh`、`POST /logout` |
| **Chat** | `/chat` | `GET/POST/DELETE /conversations`、`POST /conversations/{id}/messages/stream`（SSE）、`POST /conversations/{id}/title/ai` |
| **ToDo** | `/todo`（别名 `/focus`） | `GET /board`（today/future/overdue/tasks 四分组）、`POST /`、`PATCH /{id}/status`、`PATCH /{id}/schedule-today` |
| **Translate** | `/translate`（别名 `/prism`） | `POST /translate`、`POST /stream`（SSE）、`GET /history`、`DELETE /history/{id}` |
| **Inbox** | `/inbox`（别名 `/fleeting`） | 书签 `GET/POST/PATCH/DELETE /bookmarks`、`POST /bookmarks/analyze`、`POST /bookmarks/import/*`、智能分组 `/bookmarks/groups/*`；文档 `GET/POST /documents`；笔记 `POST /notes`、`POST /notes/analyze`、`POST /notes/summarize` |
| **Subscriptions** | `/subscriptions`（别名 `/ledger`） | `GET/POST/PATCH/DELETE /`、`GET /stats`、`GET /exchange-rates`、`POST /{id}/recharge`、`POST /{id}/consume`、`GET /{id}/ledger`、`POST /{id}/sync-balance`、`GET /{id}/balance-history` |
| **SubscriptionCategory** | `/subscription-categories` | `GET/POST/DELETE /` |
| **Mindbank · Workspace** | `/mindbank/workspaces` | `GET/POST/PUT/DELETE /`、`GET /{id}/master-note`、`GET /{id}/session-notes` |
| **Mindbank · Document** | `/mindbank/documents` | `GET ?workspaceId=`、`GET /{id}/status`（5 步状态）、`POST /{id}/retry-step` |
| **Mindbank · QA** | `/mindbank/qa` | `POST /{workspaceId}/chat`（RAG 问答） |
| **Mindbank · PromptTemplate** | `/mindbank/prompt-templates` | `GET ?type=`、`POST /`、`PUT/DELETE /{id}`（内置模板不可改/删） |
| **Crawl** | `/crawl` | `POST /web`、`POST /file`、`GET /files`、`DELETE /files/{docId}`、`POST /import` |
| **Notes** | `/notes` | `GET /tree`、`GET/PUT/POST /file`、`POST /folder`、`PUT /rename`、`DELETE /file`/`/folder`（路径穿越防护） |
| **Settings** | `/settings` | LLM `/llm/providers`、`/llm/workflows/{type}`；系统 `/system`；`/inbox`（+ `/inbox/paperless/test`、`/inbox/obsidian/test`）；`/crawl`；`/notes`；`/mindbank`（Mindbank Key 脱敏/加密） |
| **Tasks** | `/tasks` | `GET ?type=&status=`、`GET /{id}`、`PATCH /{id}/keep`、`DELETE /{id}` |

---

## 数据模型与 Flyway 迁移

数据库迁移位于 `backend/src/main/resources/db/migration/`，启动时由 Flyway 自动执行。

| 版本 | 名称 | 主要内容 |
|---|---|---|
| V1_1 | init_users_and_auth | users、refresh_tokens、verify_codes、user_devices |
| V1_2 | init_core_modules | todos、inbox_items、translations、subscriptions、coding_practice_notes、tasks |
| V1_3 | init_mindbank | 旧 mindbank_docs |
| V1_4 | init_settings_and_config | llm_providers、workflow_llm_configs、system_configs、user_notification_configs |
| V1_5 | rename_module_keys | 配置键名迁移 |
| V1_6 | expand_translation_result_fields | 扩展翻译结果字段 |
| V1_7 | init_bookmarks | bookmarks（原生书签） |
| V1_8 | init_bookmark_smart_groups | bookmark_smart_groups + assignments |
| V1_9 | subscriptions_phase4_cleanup | 删除 Notion 同步遗留字段 |
| V1_10 | subscriptions_redesign | 自动续费 / 归档 / 按量计费字段 + subscription_categories |
| V1_11 | subscriptions_status_and_model | 状态与专用模型字段 |
| V1_12 | subscription_ledger_entries | 按量订阅流水 |
| V1_13 | subscription_balance_snapshots | 余额历史快照 |
| V1_14 | exchange_rates | 汇率缓存表 |
| V1_15 | chat | chat_conversations、chat_messages |
| V1_16 | chat_timestamps_to_timestamp | Chat 时间戳类型调整 |
| V1_17 | mindbank_init | mindbank_workspaces、mindbank_documents、mindbank_prompt_templates |
| V1_18 | mindbank_workflow_types | 注册 Mindbank 工作流类型 |
| V1_19 | rename_config_keys | 配置键重命名 |

> **Flyway 约束**：迁移脚本命名为 `V{major}_{minor}__{desc}.sql`，**一旦应用不可修改**；新增变更只能追加新版本脚本。

---

## 前端结构

```
frontend/src/
├── pages/        13 个功能页面（复杂页拆 Desktop/Mobile 双视图）
├── components/   ui/（shadcn/Radix 封装）、layout/（AppLayout/Sidebar/MobileNav）、brand/
├── api/          11 个 API 模块 + client.ts（Axios 拦截器 / 401 自动刷新 / SSE）
├── stores/       Zustand：authStore（持久化 token）、themeStore（明暗主题）
├── hooks/        useAuth 等自定义 hook
├── lib/          utils（cn / 日期格式化）、constants（导航/标签）
├── types/        api.types / domain.types / mindbank.types
├── router.tsx    路由树（13 主路由 + 旧命名别名）
└── main.tsx      入口（TanStack Query QueryClient 配置）
```

- **状态管理**：服务器状态用 TanStack Query（`useQuery` / `useMutation` + `invalidateQueries`，默认 `staleTime` 30s、`retry` 1）；客户端状态用 Zustand（auth / theme 持久化到 localStorage）。
- **API 基址**：`VITE_API_BASE_URL ?? '/api/v1'`；开发态由 Vite proxy 转发到 `http://localhost:8080`，并对 `text/event-stream` 禁用缓冲以支持 SSE。
- **Token 刷新**：`client.ts` 的 401 拦截器自动 refresh，用 `refreshPromise` 去重防止并发重复刷新，`_retry` 标志防死循环。

---

## 快速开始

### 前置条件

- **Java 21**（若默认 JDK 较低，用 `mise exec java@21 -- mvn ...`）
- **pnpm 11**（新增带 postinstall 的依赖需 `pnpm approve-builds`）
- 外部 **PostgreSQL 16 / Redis / Crawl4AI**，或使用完整 Compose 栈临时启动内部服务

### 启动后端

```bash
make backend-dev
# 等价于 cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=local
# 注意：fish shell 不支持 export $(cat .env)，请用 make 入口
```

### 启动前端

```bash
make frontend-dev   # Vite dev server，http://localhost:5173，/api 代理到 :8080
```

### 构建全部

```bash
make build
```

### 环境与数据库

环境文件分三套，真实地址/密钥只写入**不入库**的文件：

```bash
cp .env.dev.example  .env.dev    # 本地调试（nexus_dev / nexus:dev: 命名空间）
cp .env.prod.example .env.prod   # 生产（nexus_prod / nexus:prod: 命名空间）
# .env 用于默认轻量栈
```

外部 PostgreSQL 需预先创建两个库并授权给 `DB_USER`：

```sql
CREATE DATABASE nexus_dev;
CREATE DATABASE nexus_prod;
```

---

## 部署与 Compose 模式

`frontend` 容器使用 Caddy runtime 对外暴露 80 端口，根目录 `Caddyfile` 作为单入口：

- `/api/*` → `backend:8080`
- `/*` → React 静态文件（`/srv`）

外部基础设施通过环境变量配置：`DB_HOST`/`DB_PORT`（PostgreSQL）、`REDIS_HOST`/`REDIS_PORT`（Redis）、`CRAWL4AI_BASE_URL`（Crawl4AI）。

| 模式 | 命令 | 说明 |
|---|---|---|
| 轻量栈（默认，读 `.env`） | `make up` / `make logs` / `make down` | 仅启 Nexus 前后台，验证当前活动配置 |
| dev 栈 | `make up-dev` / `make logs-dev` / `make down-dev` | 外部基础设施，`nexus_dev` + `nexus:dev:` |
| prod 栈 | `make up-prod` / `make logs-prod` / `make down-prod` | 外部基础设施，`nexus_prod` + `nexus:prod:` |
| 完整栈 | `make up-full` / `make logs-full` / `make down-full` | 额外启动内部 PG / Redis / Crawl4AI，用于无外部基础设施的临时单机环境 |

完整栈仍只通过 `frontend` 暴露 80 端口，PG / Redis / Crawl4AI 只在 Compose 内部网络可见；其库名/用户/密码来自根目录 `.env`。

---

## 项目结构总览

```text
nexus/
├── backend/                 # Spring Boot API（见上文后端分层）
├── frontend/                # React/Vite 统一前端（Web / PWA / Telegram Mini App）
├── docs/                    # 架构、实施与设计文档（含 superpowers/plans、specs、prompts）
├── services/               # markitdown 等辅助服务
├── .planning/              # 当前阶段产品路线图与任务计划
├── Caddyfile               # 单入口：前端静态文件 + /api 反向代理
├── docker-compose.yml      # 轻量栈
├── docker-compose.full.yml # 完整栈（含内部 PG/Redis/Crawl4AI）
├── Makefile                # 统一开发/部署入口
├── CLAUDE.md               # 项目开发准则（强制遵守）
├── DESIGN.md               # UI/UX 设计系统
├── AGENTS.md               # 前端响应式架构规范
└── .env.example
```

---

## 开发规范速查

> 完整规范见 `CLAUDE.md`，以下为高频约束。

**代码注释**：注释说明 **WHY**（为什么）而非 WHAT；`@Service`/`@RestController`/`@Component` 顶部一句话说明职责；非平凡 public 方法写 Javadoc；外部约束（API 限制、框架 bug、历史原因）必须注释。中文优先，技术术语保留英文。

**后端约束**：
- LLM 统一经 `LlmConfigService.resolveModel(workflowType)` 获取，不直接 new 模型。
- API Key 存储前 `encrypt()`，`@JsonIgnore` 防序列化。
- MyBatis-Plus 避免 `boolean isXxx` 命名（会导致 lambda cache 解析错误），改用语义化命名（如 `defaultProvider`）并加 `@TableField("is_xxx")`。
- Flyway 脚本一旦应用不可修改，只能追加新版本。
- JWT：access 15 分钟 / refresh 30 天，全走 Bearer。

**前端约束**：
- 取数据用 `res.data.data`（统一响应结构）。
- 401 由 `client.ts` 拦截器自动 refresh，`_retry` 防死循环。
- Tailwind v3 必须有 `postcss.config.js`，否则样式不生效。
- pnpm 11：带 postinstall 的新依赖执行 `pnpm approve-builds`。

**分支 / 提交**：功能分支 `feat/xxx`、修复 `fix/xxx`；commit message 如 `feat: 添加 LLM Provider 管理` / `fix: 修复 MyBatis lambda cache 错误`。

---

## 路线图与开发进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 1 | ToDo 减法工作流 | ✅ |
| Phase 2 | Translate 简化版翻译 | ✅ |
| Phase 3 | Inbox 三类接入（书签 / 文档 / 笔记） | ✅ |
| Phase 4 | Subscriptions 订阅管理（含 UI 重构、按量计费、余额监控、汇率图表 3 轮扩展） | ✅ |
| Phase 5 | Chat 日常问答 | ✅ |
| Phase 6-1~6-3 | Mindbank 基础设施 + Settings/Crawl + Notes 页面 | ✅ |
| Phase 6-4~6-5 | Port 抽象层、Workspace/文档管理 UI、5 步 Pipeline、Q&A、Prompt 模板（Layer 1 闭环） | ✅ |
| Phase 6-6~6-8 | Mindbank Agent 双层架构：知识库巡检 Agent、融合自检、检索增强、巡检建议自动执行（Layer 2） | ✅ |
| Phase 7 | Panel Hub：API Keys + Credentials 统一凭据管理 | 🚧 规划中 |


> **状态说明**：上表按**代码真实状态**标注。`.planning/.../task_plan.md` 中 Phase 6-4/6-5 仍标为未完成，但对应 Controller 与迁移（V1_17~V1_19、MindBank 四个 Controller）已落地，故按已完成处理。
>
> **Phase 6 closeout 已补齐**：Agent JSONB 映射、Master/Session Note 前端查看入口、orphan note 归档 Port 化。

**规划文档**：
- `.planning/2026-06-09-product-roadmap/task_plan.md` — 唯一阶段计划
- `docs/nexus-mindbank-pipeline-agent-design.md` — Mindbank Pipeline + Agent 双层架构设计
- `docs/superpowers/plans/2026-06-17-mindbank-crawl-phase6.md` — Phase 6 执行计划
- `docs/superpowers/plans/2026-06-22-panel-hub-phase7.md` — Phase 7 凭据管理计划

---

## 相关文档索引

| 文档 | 用途 |
|---|---|
| `CLAUDE.md` | 项目开发准则（注释规范、架构约束、分支/提交规范）——**强制遵守** |
| `DESIGN.md` | UI/UX 设计系统（色彩、圆角、阴影、组件规范） |
| `AGENTS.md` | 前端响应式架构规范（Desktop/Mobile 双视图拆分约定） |
| `docs/nexus-final-implementation-guide.md` | 完整开发实施文档 |
| `docs/superpowers/plans/` | 各阶段执行计划 |
| `docs/superpowers/specs/` | 设计规范 |
| `docs/superpowers/prompts/` | AI 提示词库 |
