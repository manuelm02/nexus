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

## External PostgreSQL

Nexus 的 Compose 不再启动 PostgreSQL 容器。开发和部署都使用局域网 PostgreSQL：

- 本地调试数据库：`192.168.110.10:7001/nexus_dev`
- 部署数据库：`192.168.110.10:7001/nexus_prod`

后端默认配置支持 `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`。`application-local.yml` 固定连接 `nexus_dev`，部署时由根目录 `.env` 指向 `nexus_prod`。
