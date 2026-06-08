# Nexus Structural Refactor Design

## Goal

将 Nexus 收束为标准 monorepo：`backend/`、`frontend/`、`docs/`，并保留一套统一前端代码与一个根级 Caddy 入口。

## Frontend Naming

当前实现是一套 React/Vite 前端同时服务 Web、PWA 和 Telegram Mini App 的轻适配模式。PWA 通过 `vite-plugin-pwa` 增强同一个构建产物，Telegram Mini App 通过 `TelegramThemeProvider` 检测 `window.Telegram.WebApp` 并做主题/ready 适配。因此目录使用 `frontend/`，不拆成 `frontend-web/`、`frontend-pwa/` 或 `frontend-telegram/`。

如果未来这些端出现独立路由、独立构建、独立依赖或独立发布节奏，再考虑拆分；在当前阶段，差异应收敛到 `src/platform/` 或少量 provider/hook 中。

## Caddy Entry

根目录保留唯一 `Caddyfile`。当前 Compose 部署只暴露 Caddy 的 80 端口，所有请求先进入这个入口：

- `/api/*` 反代到 `backend:8080`
- 其他路径由 Caddy 从 `/srv` 返回前端静态文件，并用 `try_files` 支持 React Router

Compose 中不再额外定义单独的外层 `caddy` 服务；`frontend` 镜像使用 Caddy runtime 托管静态文件并反代 API。这样只有一个 Caddy 容器、一个 Caddyfile、一个对外端口和入口。

## Preserved Architecture

- 后端仍是 Spring Boot API，包名保持 `com.nexus`。
- API 前缀保持 `/api/v1`。
- JWT 仍通过 `Authorization: Bearer`，不引入 cookie。
- LLM 调用继续通过 `LlmConfigService.resolveModel(workflowType)`。
- 外部依赖继续保留 `port/adapter` 抽象。
- Flyway 已有 migration 不做内容修改。
