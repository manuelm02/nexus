# Nexus Structural Refactor Findings

## 2026-06-08 Initial Findings

- `.doc/structural-refactor.md` 的核心意图是把 Nexus 明确为单仓 monorepo：`backend/`、`frontend/`、`docs/`、根级 `docker-compose.yml`、`Makefile`、`.env`、`README.md`。
- 文档强调前后端独立开发、独立容器部署，禁止把前端打进 Spring Boot 单体 Jar。
- 当前仓库已经是单仓，但目录命名为 `nexus-backend/` 和 `nexus-frontend/`，与目标结构的 `backend/`、`frontend/` 不一致。
- 当前仓库已有根级 `docker-compose.yml`，后端和前端也已有各自 Dockerfile。
- 当前仓库根目录暂未从初步列表看到 `Makefile`、`README.md`、`docs/`，但存在 `.doc/`、`.planning/`、`.interview/` 等辅助目录。

## Open Questions

- 需要继续确认 `docker-compose.yml` 是否仍引用 `nexus-backend` / `nexus-frontend`，以及服务名是否符合目标的 `nexus-backend` / `nexus-frontend`。
- 需要继续确认前端 Vite proxy、后端配置、CI 是否含目录名硬编码。

## 2026-06-08 Deployment and Build Findings

- `docker-compose.yml` 当前 build context 是 `./nexus-frontend` 与 `./nexus-backend`，服务名为 `frontend` / `backend`，容器名为 `nexus-frontend` / `nexus-backend`。
- `docker-compose.yml` 当前把根目录 `./Caddyfile` 挂载到 Caddy 容器，但实际 Caddy 配置位于 `nexus-frontend/Caddyfile`，这是部署规范化时需要修复的路径不一致。
- 前端 Dockerfile 使用 `node:20-alpine` 构建并用 `caddy:2-alpine` 托管静态资源，符合目标文档“前端独立容器”的方向。
- 后端 Dockerfile 使用 Maven wrapper 构建 Spring Boot Jar，再用 JRE runtime 运行，符合目标文档“后端独立容器”的方向。
- 前端已启用 `vite-plugin-pwa`，说明当前实现已经开始覆盖目标文档里“后续可扩展 PWA”的方向；重构时不应退回纯 Web 壳。
- `.env.example` 已按容器网络使用 `DB_HOST=postgres`，并保留 AnythingLLM、MinIO、Notion、Telegram、crawler 等 Knowledge OS 集成配置。
- 当前没有后端 `src/test` 目录，前端初步未发现 test/spec 文件；结构迁移时验收应至少跑 Maven package、前端 build，后续再补关键 smoke tests。

## 2026-06-08 Design Intent Findings

- `.doc/nexus-final-implementation-guide-v1.md` 和 `v2.md` 均强调 Nexus 是个人 AI 工作台 / Knowledge OS，前后端完全分离，后端 API 唯一，多端复用。
- 原设计理念要求所有任务处理结果优先落 PostgreSQL，页面、Telegram、Notion 只是输出渠道；所以结构改造不应把业务结果处理耦合到前端或单一输出端。
- 原设计理念要求可替换外部依赖均有抽象层：当前已有 `port/MindBankPort.java`、`port/WebCrawlerPort.java`、`adapter/mindbank`、`adapter/crawler`，应保留并继续扩展。
- 当前前端路由已经覆盖 Focus、Fleeting、Prism、Mindbank、Radar、Ledger、Forge、Muse、Tasks、Settings；其中 Mindbank/Radar/Forge/Muse 在路由注释中仍是 Phase 2 占位。
- 当前后端 API 已实现 Auth、Focus、Fleeting、Prism、Ledger、Tasks、Settings；尚未看到 Mindbank/Radar/Forge/Muse Controller。
- `git status` 在当前目录失败，说明该工作区不是一个可直接执行 git 状态检查的仓库根，或 `.git` 不在当前可见文件树中；实施迁移前需要确认真实 VCS 根目录。
- 后端 Dockerfile 依赖 `mvnw` 和 `.mvn`，但当前 `nexus-backend/` 下未发现 Maven wrapper；应改用 Maven 镜像构建或补齐 wrapper。
- 前端 `public/icons` 目录为空，但 Vite PWA manifest 引用了 `icons/icon-192.png` 和 `icons/icon-512.png`；PWA 交付前需要补齐图标资产。

## Recommended Direction

- 优先做“工程结构收束”：目录改名为 `backend/`、`frontend/`，修 Compose/Caddy/Makefile/README/docs，而不是立刻重构 Java package 或 React 模块。
- 保留当前 `com.nexus` 包名、API 路径 `/api/v1`、JWT 无 cookie 模式、LLM 配置中心、port/adapter 外部依赖抽象。
- 后续业务模块补齐应按原设计的 workflow/step/integration 方向渐进增加，而非一次性大搬迁。
