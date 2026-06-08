# Nexus 项目架构规范

## 目标

Nexus 采用：

* Monorepo（单仓库）
* Spring Boot + Maven（后端）
* React + Vite + pnpm（前端）
* Docker Compose（部署）
* Makefile（统一命令入口）

实现：

* 代码统一管理
* 前后端独立开发
* 前后端独立容器部署
* 一键构建和部署
* 后续可扩展 PWA、Telegram Mini App、AI Agent

---

# 项目结构

```text
nexus/
├── backend/
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── src/
│
├── docs/
│
├── docker-compose.yml
├── Makefile
├── .env
├── README.md
└── .gitignore
```

未来扩展：

```text
nexus/
├── backend/
├── frontend/
├── frontend-pwa/
├── frontend-telegram/
├── ai-agent/
└── docs/
```

---

# 架构原则

## Monorepo

整个 Nexus 只有一个 Git 仓库。

禁止：

```text
nexus-backend
nexus-frontend
nexus-agent
```

多个仓库拆分。

统一使用：

```text
nexus/
```

作为唯一仓库。

---

## 后端

技术栈：

```text
Java 21
Spring Boot 3.x
Maven
PostgreSQL
Redis（可选）
```

职责：

```text
REST API
业务逻辑
认证授权
数据库访问
AI 编排
Telegram Bot 集成
```

---

## 前端

技术栈：

```text
React
Vite
TypeScript
TanStack Query
React Router
TailwindCSS
```

职责：

```text
管理后台
用户门户
PWA
Telegram Mini App
```

---

# 容器部署策略

采用分容器部署。

禁止：

```text
Spring Boot 打包前端资源
生成单体 Jar
```

部署结构：

```text
nexus-backend
nexus-frontend
postgres
redis
```

Docker Compose 统一管理。

---

# 网络结构

```text
Internet
    │
    ▼
  Caddy
    │
 ┌──┴─────────────┐
 │                │
 ▼                ▼
Frontend       Backend
                │
                ▼
         PostgreSQL
```

域名规划：

```text
nexus.example.com
    -> frontend

api.nexus.example.com
    -> backend
```

未来：

```text
pwa.nexus.example.com

tg.nexus.example.com
```

---

# 开发模式

前后端独立启动。

Backend：

```bash
cd backend
mvn spring-boot:run
```

Frontend：

```bash
cd frontend
pnpm dev
```

开发环境：

```text
Frontend : localhost:5173

Backend  : localhost:8080
```

通过 Vite Proxy 转发 API。

---

# Docker 规范

Backend Dockerfile：

```dockerfile
Maven Build
↓
Spring Boot Jar
↓
JRE Runtime
```

Frontend Dockerfile：

```dockerfile
pnpm build
↓
Nginx/Caddy
↓
静态资源服务
```

---

# Makefile

统一项目命令入口。

支持：

```bash
make dev
make build
make up
make down
make logs
```

建议实现：

```makefile
dev:
	@echo "Start local development"

build:
	@echo "Build all modules"

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f
```

---

# 数据库

默认：

```text
PostgreSQL
```

Docker 服务名：

```text
postgres
```

数据库名：

```text
nexus
```

---

# 配置管理

统一使用：

```text
.env
```

管理：

```text
数据库配置
Redis配置
OpenAI配置
DeepSeek配置
Telegram配置
JWT配置
```

禁止将敏感配置写死在代码中。

---

# CI/CD 目标

后续接入：

GitHub Actions

流程：

```text
Push
 ↓
Test
 ↓
Build
 ↓
Docker Image
 ↓
Deploy
```

---

# 设计原则

1. Monorepo 管理所有代码
2. 前后端独立运行
3. 前后端独立容器
4. Docker Compose 统一部署
5. Makefile 统一命令
6. Maven 只负责 Java
7. pnpm 只负责前端
8. PostgreSQL 作为主数据库
9. Caddy 统一入口
10. 保持可扩展到 PWA、Telegram Mini App、AI Agent

```
```

