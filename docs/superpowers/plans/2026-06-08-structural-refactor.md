# Nexus Structural Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Nexus 工程结构整理为标准 monorepo，并让一个根级 Caddyfile 统一处理前端静态文件和后端 API 反代。

**Architecture:** `backend/` 保持 Spring Boot API，`frontend/` 保持统一 React/Vite 前端。部署时 `frontend` 容器使用 Caddy runtime，对外暴露 80，并按 URL 将 `/api/*` 转发到 `backend:8080`。

**Tech Stack:** Java 21, Spring Boot 3.3.5, Maven, React 18, Vite 5, TypeScript, Tailwind CSS v3, pnpm 11, Docker Compose, Caddy.

---

### Task 1: Rename Project Directories

**Files:**
- Move: `nexus-backend/` to `backend/`
- Move: `nexus-frontend/` to `frontend/`
- Move: `.doc/` to `docs/`
- Move: `backend/.env` to `.env`

- [x] **Step 1: Rename backend directory**

Run: `mv nexus-backend backend`

- [x] **Step 2: Rename frontend directory**

Run: `mv nexus-frontend frontend`

- [x] **Step 3: Rename documentation directory**

Run: `mv .doc docs`

- [x] **Step 4: Move local Compose env to root**

Run: `mv backend/.env .env`

- [x] **Step 5: Align Compose database host**

Set root `.env` `DB_HOST=postgres`, while local backend development continues to use `backend/src/main/resources/application-local.yml`.

### Task 2: Unify Caddy Entry

**Files:**
- Create: `Caddyfile`
- Modify: `docker-compose.yml`
- Modify: `frontend/Dockerfile`
- Delete: `frontend/Caddyfile`

- [x] **Step 1: Add root Caddyfile**

Create a root Caddyfile that serves `/srv` and proxies `/api/*` to `backend:8080`.

- [x] **Step 2: Update Compose**

Expose port 80 on the `frontend` service, mount root `Caddyfile`, and remove the separate `caddy` service.

- [x] **Step 3: Update frontend Dockerfile**

Remove the image-local `COPY Caddyfile` instruction because the root Caddyfile is mounted at runtime.

### Task 3: Add Root Tooling and Docs

**Files:**
- Modify: `backend/Dockerfile`
- Create: `Makefile`
- Create: `README.md`
- Create: `.gitignore`
- Create: `docs/architecture/frontend-and-caddy.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

- [x] **Step 1: Add Makefile**

Add root commands for backend dev, frontend dev, build, compose up/down, and logs.

- [x] **Step 2: Add README**

Document the monorepo structure, one-frontend model, and one-Caddy deployment.

- [x] **Step 3: Add root gitignore**

Ignore generated artifacts, local env files, data volumes, IDE files, and dependency folders.

- [x] **Step 4: Fix backend Docker build**

Use the official Maven builder image because the project does not currently include `mvnw` or `.mvn`.

### Task 4: Verify

**Files:**
- No source files modified.

- [x] **Step 1: Validate Compose config**

Run: `docker compose config`

- [x] **Step 2: Build backend**

Run: `cd backend && mvn -DskipTests package`

- [x] **Step 3: Build frontend**

Run: `cd frontend && pnpm build`

- [x] **Step 4: Fix Vite environment types**

Create `frontend/src/vite-env.d.ts` so TypeScript knows about `import.meta.env`.
