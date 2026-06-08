# Frontend and Caddy Architecture

## Unified Frontend

Nexus 当前采用一套 `frontend/` 代码服务 Web、PWA 和 Telegram Mini App。这样可以让页面、API client、认证、状态管理和设计系统保持一致，只把运行环境差异压缩到少量平台适配代码里。

当前差异点：

- PWA：由 `vite-plugin-pwa` 生成 manifest 和 service worker。
- Telegram Mini App：由 `TelegramThemeProvider` 检测 `window.Telegram.WebApp`，调用 `ready()` 并同步主题。
- Web：直接使用同一套 React Router 页面。

只有当某个端出现独立路由、独立依赖、独立构建或独立发布节奏时，才需要拆成 `frontend-web/`、`frontend-pwa/`、`frontend-telegram/`。

## Single Caddy Entry

部署时只使用一个 Caddy 配置文件：仓库根目录的 `Caddyfile`。

请求路径：

```text
Internet
  |
  v
Caddy :80
  |-- /api/*  -> backend:8080
  `-- /*      -> /srv React static files
```

Compose 中 `frontend` 容器承担 Caddy runtime 职责：它托管前端构建产物，同时把 API 请求转发给 `backend` 服务。这样对外只有一个端口和一个入口，内部仍保持前后端独立容器。

## Compose Modes

Nexus 提供两种 Compose 模式：

- `docker-compose.yml`：轻量应用栈，只启动 `frontend` 和 `backend`，PG、Redis、Crawl4AI 使用外部服务。
- `docker-compose.full.yml`：完整基础设施 overlay，额外启动 PostgreSQL、Redis、Crawl4AI，并让后端连接 Compose 内部服务名；仅作为没有外部基础设施时的临时环境。

轻量栈默认使用外部基础设施，真实地址只写入不入库的 `.env.dev` / `.env.prod`：

- 本地调试数据库：`.env.dev` 中配置 `DB_HOST` / `DB_PORT` / `DB_NAME=nexus_dev`。
- 部署数据库：`.env.prod` 中配置 `DB_HOST` / `DB_PORT` / `DB_NAME=nexus_prod`。
- Redis：通过 `REDIS_HOST` / `REDIS_PORT` 指向外部实例，dev/prod 通过 `REDIS_DATABASE` 或 `REDIS_KEY_PREFIX` 隔离。
- Crawl4AI：通过 `CRAWL4AI_BASE_URL` 指向外部服务，dev/prod 可共用同一个服务。

后端默认配置支持 `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`、`REDIS_HOST`、`REDIS_PORT`、`REDIS_DATABASE`、`REDIS_KEY_PREFIX`、`CRAWL4AI_BASE_URL`。`application-local.yml` 固定连接 dev 外部服务，Compose 的 dev/prod 模式分别由 `.env.dev` 和 `.env.prod` 指向目标环境。完整栈会覆盖 `DB_HOST=postgres` 和 `DB_PORT=5432`，数据库名、用户和密码仍来自当前 env 文件。
