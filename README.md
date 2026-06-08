# Nexus

Nexus 是个人 AI 工作台 / Knowledge OS，用一套后端 API 和一套统一前端管理个人输入、AI 处理、知识沉淀与多端输出。

## Structure

```text
nexus/
├── backend/        # Spring Boot API
├── frontend/       # React/Vite unified frontend for Web, PWA, and Telegram Mini App
├── docs/           # Architecture, deployment, and development notes
├── Caddyfile       # Single ingress: frontend static files + /api reverse proxy
├── docker-compose.yml
├── Makefile
└── .env.example
```

## Frontend Model

`frontend/` 是一套统一前端代码。Web、PWA 和 Telegram Mini App 共用页面、API、状态管理和构建链路；PWA 通过 Vite PWA 插件增强，Telegram Mini App 通过少量 provider/hook 做环境适配。

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

## Database

Nexus 使用外部 PostgreSQL，不在 Compose 中启动数据库容器。

- 本地调试：`192.168.110.10:7001/nexus_dev`
- 部署环境：`.env` 中的 `DB_HOST` / `DB_PORT` / `DB_NAME`，默认示例为 `192.168.110.10:7001/nexus_prod`

需要提前在 PostgreSQL 中创建两个数据库，并授权给 `DB_USER`：

```sql
CREATE DATABASE nexus_dev;
CREATE DATABASE nexus_prod;
```

Start the stack:

```bash
make up
```

Stop the stack:

```bash
make down
```
