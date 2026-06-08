# Compose Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Nexus Docker Compose into a lightweight frontend/backend stack and a full stack with PostgreSQL, Redis, and Crawl4AI.

**Architecture:** `docker-compose.yml` remains the base application stack and only starts `frontend` and `backend`. `docker-compose.full.yml` is an overlay that adds infrastructure services and overrides backend environment variables to point at internal Compose service names.

**Tech Stack:** Docker Compose, Caddy, Spring Boot, PostgreSQL 16, Redis 7, Crawl4AI.

---

### Task 1: Base Compose

**Files:**
- Modify: `docker-compose.yml`

- [x] **Step 1: Keep only Nexus frontend/backend**

Remove infrastructure services from the base file so `docker compose up` starts only the application services.

- [x] **Step 2: Verify base config**

Run: `docker compose config`

Expected: config includes `frontend` and `backend`, and does not include `postgres`, `redis`, or `crawl4ai`.

### Task 2: Full Compose Overlay

**Files:**
- Create: `docker-compose.full.yml`

- [x] **Step 1: Add infrastructure services**

Add `postgres`, `redis`, and `crawl4ai` services with persistent data under `./data`.

- [x] **Step 2: Override backend internal service endpoints**

Set `DB_HOST=postgres`, `DB_PORT=5432`, `CRAWL4AI_ENABLED=true`, and `CRAWL4AI_BASE_URL=http://crawl4ai:11235`.

- [x] **Step 3: Verify full config**

Run: `docker compose -f docker-compose.yml -f docker-compose.full.yml config`

Expected: config includes `frontend`, `backend`, `postgres`, `redis`, and `crawl4ai`.

### Task 3: Developer Commands And Docs

**Files:**
- Modify: `Makefile`
- Modify: `README.md`

- [x] **Step 1: Add full-stack commands**

Add `up-full`, `down-full`, `logs-full`, and `compose-config-full`.

- [x] **Step 2: Document both Compose modes**

Explain which stack uses external services and which stack starts infrastructure internally.

### Task 4: External Dev/Prod Environments

**Files:**
- Modify: `Makefile`
- Modify: `docker-compose.yml`
- Create: `.env.dev.example`
- Create: `.env.prod.example`

- [x] **Step 1: Make backend env file selectable**

Use `NEXUS_ENV_FILE` so `--env-file` also controls the file mounted into the backend container.

- [x] **Step 2: Add dev/prod commands**

Add `up-dev`, `down-dev`, `logs-dev`, `compose-config-dev`, `up-prod`, `down-prod`, `logs-prod`, and `compose-config-prod`.

- [x] **Step 3: Document external infrastructure without local addresses**

Use environment variables for PG, Redis, and Crawl4AI so local addresses remain only in ignored `.env.dev` / `.env.prod` files.
