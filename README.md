# Nexus

Nexus 是个人 AI 工作台 / Knowledge OS，用一套后端 API 和一套统一前端管理个人输入、AI 处理、知识沉淀与多端输出。

当前产品主线按以下顺序推进：

- `ToDo`：待分配池、今日执行、历史状态恢复
- `Translate`：简化版翻译软件，先保留 LLM，后续可接专业翻译 API
- `Inbox`：Linkding 书签、paperless-ngx 文档接入、Obsidian Quick Note / Memo
- `Subscriptions`：基础 CRUD、用量记录、到期提醒
- `Chat`：轻量日常问答
- `Mindbank` / `Crawl`：后续单独设计

## Structure

```text
nexus/
├── backend/        # Spring Boot API
├── frontend/       # React/Vite unified frontend for Web, PWA, and Telegram Mini App
├── docs/           # Architecture, deployment, and development notes
├── Caddyfile       # Single ingress: frontend static files + /api reverse proxy
├── docker-compose.yml
├── docker-compose.full.yml
├── Makefile
└── .env.example
```

## Frontend Model

`frontend/` 是一套统一前端代码。Web、PWA 和 Telegram Mini App 共用页面、API、状态管理和构建链路；PWA 通过 Vite PWA 插件增强，Telegram Mini App 通过少量 provider/hook 做环境适配。

旧 `Focus` / `Prism` / `Ledger` / `Fleeting` 命名只作为数据库或迁移兼容存在；当前展示命名统一使用 `ToDo` / `Translate` / `Subscriptions` / `Inbox`。

## Local Development

Backend:

```bash
make backend-dev
```

Frontend:

```bash
make frontend-dev
```

Build all modules:

```bash
make build
```

## Deployment

`frontend` 容器使用 Caddy runtime，对外暴露 80 端口，并使用根目录 `Caddyfile`：

- `/api/*` -> `backend:8080`
- `/*` -> React static files under `/srv`

## Compose Modes

日常本地调试和生产部署都可以使用外部基础设施，真实地址只写入不入库的 `.env.dev` / `.env.prod`：

- PostgreSQL：通过 `DB_HOST` / `DB_PORT` 配置
- Redis：通过 `REDIS_HOST` / `REDIS_PORT` 配置
- Crawl4AI：通过 `CRAWL4AI_BASE_URL` 配置

先从示例文件生成真实环境文件，并填入密码和密钥：

```bash
cp .env.dev.example .env.dev
cp .env.prod.example .env.prod
```

开发环境使用 `nexus_dev` 和 `nexus:dev:` 命名空间：

```bash
make up-dev
make logs-dev
make down-dev
```

生产环境使用 `nexus_prod` 和 `nexus:prod:` 命名空间：

```bash
make up-prod
make logs-prod
make down-prod
```

默认轻量栈仍读取 `.env`，只启动 Nexus 前后台，适合临时验证当前活动配置：

```bash
make up
make logs
make down
```

完整栈在轻量栈基础上额外启动 PG、Redis、Crawl4AI，主要用于没有外部基础设施时的临时本机/单机环境：

```bash
make up-full
make logs-full
make down-full
```

完整栈仍然只通过 `frontend` 暴露 80 端口；PG、Redis、Crawl4AI 只在 Compose 内部网络暴露。

## Database

dev/prod 轻量栈使用外部 PostgreSQL，不在 Compose 中启动数据库容器。

- 本地调试：`.env.dev` 中的 `DB_HOST` / `DB_PORT` / `DB_NAME=nexus_dev`
- 生产部署：`.env.prod` 中的 `DB_HOST` / `DB_PORT` / `DB_NAME=nexus_prod`

需要提前在 PostgreSQL 中创建两个数据库，并授权给 `DB_USER`：

```sql
CREATE DATABASE nexus_dev;
CREATE DATABASE nexus_prod;
```

完整栈通过 `docker-compose.full.yml` 启动内部 PostgreSQL，数据库名、用户和密码来自根目录 `.env`。
