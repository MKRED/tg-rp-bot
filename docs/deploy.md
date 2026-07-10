# Деплой — инфраструктура

Процесс команды «Задеплой» (гейт → ветка `deploy`) описан в CLAUDE.md. Здесь — как устроен прод.

Прод — **один Docker-контейнер** на сервере (`https://miniapp.aoshi.ru`): тот же процесс Node раздаёт
и HTTP API, и собранную статику Mini App (webapp вшит в образ). `Dockerfile` лежит **в корне**, контекст
сборки — корень монорепо (`docker build -f Dockerfile .`).

**CI/CD:** пуш в ветку **`deploy`** запускает GitHub Action (`.github/workflows/deploy.yml`), который
собирает образ **на демоне сервера** через docker context (SSH), без реестра (GHCR не используется),
и перезапускает контейнер по `docker-compose.yml` (он лежит на сервере, в репо — справочная копия).
Подробности инфраструктуры сервера — в auto-memory `server-deploy-setup`.
