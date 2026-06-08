SHELL := /bin/sh
FULL_COMPOSE := docker compose -f docker-compose.yml -f docker-compose.full.yml
DEV_COMPOSE := NEXUS_ENV_FILE=.env.dev docker compose --env-file .env.dev
PROD_COMPOSE := NEXUS_ENV_FILE=.env.prod docker compose --env-file .env.prod

.PHONY: dev backend-dev frontend-dev build backend-build frontend-build up down logs compose-config up-dev down-dev logs-dev compose-config-dev up-prod down-prod logs-prod compose-config-prod up-full down-full logs-full compose-config-full

dev:
	@echo "Start backend:  make backend-dev"
	@echo "Start frontend: make frontend-dev"

backend-dev:
	cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=local

frontend-dev:
	cd frontend && pnpm dev

build: backend-build frontend-build

backend-build:
	cd backend && mvn -DskipTests package

frontend-build:
	cd frontend && pnpm build

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

compose-config:
	docker compose config

up-dev:
	$(DEV_COMPOSE) up -d --build

down-dev:
	$(DEV_COMPOSE) down

logs-dev:
	$(DEV_COMPOSE) logs -f

compose-config-dev:
	$(DEV_COMPOSE) config

up-prod:
	$(PROD_COMPOSE) up -d --build

down-prod:
	$(PROD_COMPOSE) down

logs-prod:
	$(PROD_COMPOSE) logs -f

compose-config-prod:
	$(PROD_COMPOSE) config

up-full:
	$(FULL_COMPOSE) up -d --build

down-full:
	$(FULL_COMPOSE) down

logs-full:
	$(FULL_COMPOSE) logs -f

compose-config-full:
	$(FULL_COMPOSE) config
