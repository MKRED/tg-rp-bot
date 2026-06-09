# syntax=docker/dockerfile:1

# ============================================================================
# tg-rp-bot — единый образ: Telegram-бот (grammY) + HTTP API (Hono),
# который ТАКЖЕ раздаёт собранную статику Mini App (webapp). Node 24, native ESM.
# Сборка из КОРНЯ монорепо: context=. , dockerfile=Dockerfile (лежит в корне).
# ============================================================================

# ---- build: ставим зависимости монорепо, собираем bot (tsc) и webapp (vite) ----
FROM node:24-slim AS build
WORKDIR /app

# Манифесты всех workspace'ов нужны ДО install: yarn workspaces читает корневой
# package.json и требует, чтобы каждый объявленный workspace существовал на диске.
COPY package.json yarn.lock ./
COPY bot/package.json bot/package.json
COPY webapp/package.json webapp/package.json

# Полный install (с dev-зависимостями): нужны tsc/vite для сборки и drizzle-kit для миграций.
# yarn 1.22 поставляется в составе образа node:24.
RUN yarn install --frozen-lockfile

# Исходники бота (только нужное для сборки — НИКОГДА не `COPY bot/` целиком,
# иначе локальный bot/.env с секретами попал бы в слой образа).
COPY bot/tsconfig.json bot/tsconfig.json
COPY bot/drizzle.config.ts bot/drizzle.config.ts
COPY bot/drizzle bot/drizzle
COPY bot/src bot/src

# Исходники webapp.
COPY webapp/tsconfig.json webapp/tsconfig.json
COPY webapp/vite.config.ts webapp/vite.config.ts
COPY webapp/index.html webapp/index.html
COPY webapp/src webapp/src

# bot -> bot/dist ; webapp -> webapp/dist (статика)
RUN yarn workspace bot build && yarn workspace webapp build

# ---- runtime: один процесс Node отдаёт API и статику --------------------------
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# node_modules хойстятся в корень монорепо. Тащим целиком (с dev-зависимостями):
# drizzle-kit нужен, чтобы прогонять миграции из этого же образа
# (`docker compose run --rm bot yarn drizzle-kit migrate`).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/yarn.lock ./yarn.lock
# В /app/bot к этому моменту только собранный dist + drizzle + конфиги (без .env).
COPY --from=build /app/bot ./bot
# Статику Mini App кладём туда, откуда её ждёт Hono (cwd процесса = /app/bot, root = ./public).
COPY --from=build /app/webapp/dist ./bot/public

WORKDIR /app/bot

# HTTP-сервер (API + статика). Наружу на хост порт публикует docker-compose,
# а перед ним TLS-терминирует edge-nginx (+certbot) сервера.
EXPOSE 3000

# Переменные окружения приходят из env_file в docker-compose — .env в образе нет.
CMD ["node", "dist/index.js"]
