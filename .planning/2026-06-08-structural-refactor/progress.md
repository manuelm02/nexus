# Nexus Structural Refactor Progress

## 2026-06-08

- 读取了 `.doc/structural-refactor.md`，确认其目标是 monorepo 标准化、前后端独立部署、Docker Compose 和 Makefile 统一入口。
- 初步扫描仓库文件，确认现状为 `nexus-backend/`、`nexus-frontend/` 双目录，已有根级 `docker-compose.yml` 和各自 Dockerfile。
- 创建本次评估计划文件，避免后续分析丢失关键上下文。
- 读取了 Docker Compose、后端/前端 Dockerfile、pom、package、Vite 配置、Caddyfile、环境变量样例和 AGENTS 开发准则。
- 确认当前结构主要问题不是技术栈不匹配，而是目录命名、文档入口、Makefile 缺失、Caddyfile 挂载路径和测试骨架不足。
- 读取了最终实施指南 v1/v2，确认原设计理念是 Knowledge OS、多端复用、后端 API 唯一、结果优先落库、外部依赖抽象。
- 完成差异分析和推荐方向整理，准备输出改造方案。
- 将 `nexus-backend/` 重命名为 `backend/`，`nexus-frontend/` 重命名为 `frontend/`，`.doc/` 重命名为 `docs/`。
- 新增根目录 `Caddyfile`，让 `frontend` 容器作为唯一 Caddy 入口，只暴露 `80:80`，并将 `/api/*` 反代到 `backend:8080`。
- 更新 `docker-compose.yml`、`frontend/Dockerfile`、`backend/Dockerfile`、`Makefile`、`README.md`、根 `.gitignore`、`AGENTS.md`、`CLAUDE.md` 和结构说明文档。
- 将本地 Maven repository 配置从 `/Users/manuelm/devspace/devTools/repository` 统一改为 `/Users/manuelm/.m2/repository`，并备份原 settings。
- Docker 打开后重新验证：`docker compose config` 通过，最终 Compose 只对外暴露 `frontend` 的 `80:80`，后端只在内部网络暴露 `8080`。
- Caddy 验证通过：`docker compose run --rm --no-deps frontend caddy validate --config /etc/caddy/Caddyfile` 输出 `Valid configuration`；同时按 Caddy 标准格式整理了根目录 `Caddyfile`。
- 前端验证通过：`env CI=true pnpm build` 通过，PWA service worker 和 manifest 正常生成。
- 后端验证通过：`mise exec java@21 -- mvn -DskipTests package` 通过，生成 `backend/target/backend-1.0.0-SNAPSHOT.jar`。
- 已按局域网 PG 调整数据库策略：local profile 使用 `192.168.110.10:7001/nexus_dev`，Docker/部署环境通过 `.env` 使用 `192.168.110.10:7001/nexus_prod`，生产数据和本地调试数据用不同数据库隔离。
- 验证边界：`docker compose build backend` 因首次拉取 Maven builder 基础镜像速度极慢而手动中断，退出码 `130`；本地 Maven 构建已通过，后续部署前可重新执行该命令让 Docker 继续拉取/构建。
