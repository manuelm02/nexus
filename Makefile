SHELL := /bin/sh

.PHONY: dev backend-dev frontend-dev build backend-build frontend-build up down logs compose-config

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
