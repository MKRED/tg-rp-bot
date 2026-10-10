# tg-rp-bot — Claude Code Instructions

## Language
- **Talk to the user in Russian.**
- **Code comments, commit descriptions, and `docs/` / README are written in Russian.** This file is in
  English for compactness; keep it English when editing.

## Project
Yarn-workspaces monorepo:
- **`bot/`** — Telegram bot (grammY) + HTTP API for the Mini App (**NestJS**; not-yet-migrated routes are
  all API routes are on Nest; legacy Hono behind a bridge only serves `/health` + static files until it is
  removed — plan in [docs/plan/roadmap.md](docs/plan/roadmap.md)). Node 24, native ESM.
- **`webapp/`** — Telegram Mini App (React + Vite).
- **`shared/`** — `@tg-rp-bot/shared`: API contract types + constants used by both bot and webapp
  (built by `tsc` into `shared/dist`; both packages consume the built output).

Root `package.json` only manages workspaces + cross-package scripts. Production is one Docker container
serving both the API and the Mini App static files ([docs/deploy.md](docs/deploy.md)).

## ⚠️ Critical invariants — never violate
- **There is no dev database.** `DATABASE_URL` in `bot/.env` points to the **production Postgres via an
  SSH tunnel**. Running the bot locally, `drizzle-kit generate/migrate`, ad-hoc queries — all hit prod
  data. Migrations are forward-only; be careful with destructive operations. The tunnel must be up
  before `yarn dev` / `drizzle-kit`.
- **Proxy only for services unreachable from the server network:** Telegram (`bot.ts` →
  `baseFetchConfig.agent`, HttpsProxyAgent) and Tavily (`tavily/tavilyUsage.ts`, undici ProxyAgent),
  both via `TELEGRAM_PROXY_URL`. **NEVER** set a global proxy (`HTTPS_PROXY` / `ALL_PROXY`) — it would
  route LLM traffic through it too. Why `agent` and not `dispatcher` — [docs/architecture.md](docs/architecture.md).
- **LLM/Tavily keys are server-side, per-user (BYOK).** Stored encrypted in `user_settings`
  (`ENCRYPTION_KEY`), never sent to the browser; no fallback to a shared/env key. Generation goes through
  the bot's HTTP API, not from the webapp directly. Details — [docs/llm.md](docs/llm.md).
- **Mini App auth:** webapp → `/api/*` requests carry signed `initData` (`Authorization: tma …`), the
  server verifies HMAC with **`@tma.js/init-data-node`** (NOT `@telegram-apps/*`) — [docs/architecture.md](docs/architecture.md).
- **Narrator: the prompt array must not start with `assistant`.** A synthetic leading-user is inserted
  before the root (openingBeat); played user turns are neutralized into `CONTINUE_MARKER` (except the
  last). Easy to break when editing `storyPromptBuilder` — read [docs/narrator.md](docs/narrator.md) first.
- **Commit/push only on explicit request.** Commits go straight to `main` unless asked for a branch.

## Commands
Run from the monorepo root. Dev environment is **Windows** (Bash tool = Git Bash). Don't suggest
unix-only commands (`pkill`, `lsof`, `kill $(...)`).

```
yarn dev           # build shared, start bot (nest start --watch) — run in background
yarn dev:web       # build shared, start Mini App (Vite dev server)
yarn dev:all       # shared tsc --watch + bot (nest start --watch) + Vite via concurrently
yarn build:shared  # rebuild shared/dist (root test/build/dev do it first automatically)
Stop-Process -Name "node"                # stop bot (PowerShell)
yarn workspace bot drizzle-kit generate  # migration from schema changes
yarn workspace bot drizzle-kit migrate   # apply migrations (→ PROD DB!)
yarn test          # bot + webapp unit tests (vitest run)
yarn test:watch    # bot tests in watch mode
cd bot && yarn vitest run src/path/file.test.ts   # single file (webapp: cd webapp); needs built shared/dist
yarn build         # build bot (nest build) + webapp
```

- **Always yarn, never npm.**
- **Root scripts must not call `yarn` recursively** (`yarn build:shared && …`): the owner's Windows profile
  path is Cyrillic and a nested yarn under cmd.exe fails with garbled `Cannot find module …yarn.js`. Call
  the tool directly (`cd shared && tsc && …`).
- **Don't run `yarn build` / `nest build` while `yarn dev`/`dev:all` is running:** `nest build` wipes
  `bot/dist` (`deleteOutDir`) and the running watcher dies with `Cannot find module …dist\main`.
- **Env:** `bot/.env` (template `bot/.env.example`); `BOT_TOKEN` + `DATABASE_URL` are required — without
  them `config.ts` (`requireEnv`) throws.

## Architecture
```
bot/src/    — main (Nest bootstrap + bot start) · app.module · bot.ts (grammY) · config · logger · proxy ·
              Nest modules: auth/ database/ users/ common/ <domain>/ (characters, …) ·
              db/ (schema + legacy DAO per table) · llm/ (LLM client, per-user provider) ·
              prompt/ (prompt assembly, no Nest) · tavily/ ·
              handlers/ · server/ (legacy Hono: /health + Mini App static, behind legacyBridge) · utils/
webapp/src/ — main/init (Telegram SDK) · app/ (shell, HashRouter) · pages/ (one screen per route) ·
              features/ (domain modules) · shared/ (cross-cutting)
shared/src/ — @tg-rp-bot/shared: API contract types (JSON over the wire) + constants, one file per domain
```
bot and webapp domains mirror each other: characters, personas, cards, generation-presets, rp-templates,
rp-chat, narrator, knowledge-books, narrator-templates, debug.

Full tree, webapp layout rules, router/deep-link details — [docs/architecture.md](docs/architecture.md).

## Code conventions

### ESM imports
- **`bot/`** (`nodenext`): every **relative** import/export MUST end in `.js` even though the source is
  `.ts` (`import { config } from "../config.js"`). Directory imports don't work — point at the barrel:
  `"../utils/index.js"`. Bare package imports stay extensionless.
- **`webapp/`** (`moduleResolution: bundler`): imports WITHOUT extensions (`./App`).
- **`shared/`** (`nodenext`, like bot): relative imports end in `.js`. Consumers import the package
  name `@tg-rp-bot/shared`, never a relative path into `shared/`.

### shared package
- **Holds the API contract** — what travels as JSON (request bodies, list items, limits both sides
  enforce). Not DB rows/DAO return types (`Date` vs `string`), not React or Node-specific code.
- **A type/constant duplicated between bot and webapp belongs here.** Move it, don't copy it; the old
  location imports/re-exports from `@tg-rp-bot/shared` (webapp feature `types/*.ts` re-export so feature
  barrels stay unchanged).
- **Consumed from `shared/dist`** (package `exports`), so after editing `shared/src` rebuild it — `yarn
  dev:all` watches it; otherwise `yarn build:shared`. Dockerfile builds it first and copies
  `shared/package.json` + `shared/dist` into the runtime stage (the workspace symlink points there).

### bot — NestJS backend (mandatory)
- **Target is idiomatic Nest structure, not just ported routes.** Rewriting existing backend code to fit
  it is approved — one domain per block, with tests, prod working between blocks.
- **Domain module = `bot/src/<domain>/`**: `<domain>.module.ts`, `.controller.ts` (HTTP only),
  `.service.ts` (domain rules, throws Nest `HttpException`s), `.repository.ts` (drizzle via injected
  `DatabaseService`; the old `db/<domain>/` DAO moves here), `dto/` (class-validator, `implements` the
  `@tg-rp-bot/shared` contract type), tests beside. Reference project with the same stack:
  `D:\GitProject\dnd-online` (`apps/server`).
- **All API domains are on Nest:** a new `/api/*` prefix goes into a Nest module and into
  `NEST_ROUTE_PREFIXES` (`server/legacyBridge.ts`), otherwise the bridge hands it to Hono (JSON 404).
  Non-Nest callers of a Nest repository go through a temporary shim in `db/<domain>/index.ts`
  (see `db/settings`), removed when they get the repository via DI.
- **Auth:** global `TelegramAuthGuard` (`auth/`) — every controller is protected; read the user with
  `@CurrentUser() userId: number` (internal id), never the Telegram profile. Only endpoints that are
  Telegram by nature (`me/`: initData profile, Bot API calls needing the Telegram id) use
  `@TelegramUser()`. The guard also ensures the
  `users` row, so controllers don't call `ensureUser`.
- **Response contract is the webapp's:** keep Hono-era codes and bodies (`201 {character}`,
  `200 {ok:true}`, never `204` — `apiFetch` parses every OK body as JSON). Errors go through the global
  `ApiExceptionFilter` → `{ error: string }`; custom bodies (`{ error: "no_api_key", message }`) pass through.
- **Decorator metadata:** DI needs `emitDecoratorMetadata` → build/dev via Nest CLI (tsc), never `tsx`
  for the server. Injected classes are value imports, not `import type`.
- **JSON body limit** is set explicitly in `main.ts` (images travel as data URLs; Express default is 100 KB).
- **No `helmet` with defaults** — its `X-Frame-Options`/`frame-ancestors` break the Mini App in Telegram Web.

### webapp — mandatory
- **tgui first.** Any new or edited UI uses `@telegram-apps/telegram-ui` components (`Text`/`Subheadline`/
  `Caption`, `Cell`/`Section`/`List`, forms, overlays). No suitable component → build one in
  `shared/components/` on top of tgui primitives, not bare `div`/`span` + custom CSS. Catalog —
  [docs/tgui-components.md](docs/tgui-components.md); themes/viewport/safe area/platforms —
  [docs/telegram-ui.md](docs/telegram-ui.md) (check before UI edits or tgui/SDK upgrades).
- **`pages/<screen>/`** = thin route target; **`features/<feature>/`** = self-contained domain module.
- **Feature files go into `api/ hooks/ components/ types/ lib/`** subfolders, not loose in the root.
  Don't create empty categories.
- **Feature barrel `index.ts`** exports only the public surface; consumers import the feature as a module.
- **Inside a feature, import files directly** (`../types/character`), NEVER via the feature's own barrel —
  that creates a cycle that compiles but yields `undefined` at runtime.
- **`shared/`** — only what is reused across features.
- **Deep-link (`?dl=`) is resolved in `main.tsx` BEFORE `render()`**, never in a component inside the
  router — the catch-all `<Navigate>` would win in the same flush. Details — [docs/architecture.md](docs/architecture.md).

### File structure & size — mandatory (bot/ and webapp/)
- **One file — one responsibility.** Keep "main" files (entry points, register aggregators, worker loops)
  thin; move implementation into sibling files.
- **~100–150 lines is a guideline, not a hard limit.** Past ~150 lines, split if responsibilities are
  separable. Don't split cohesive single-responsibility files (data/strings, one handler, one table's DAO).
- **Entity folder when an entity grows files.** Once an entity has ≥2 implementation files beyond the main
  one (`.css`, `.constants.ts`, `.types.ts`, a second logic `.ts`…) it moves into its own folder:
  `EntityName/EntityName.ts(x)` + siblings + `index.ts` barrel. A single co-located `.test.ts` doesn't
  trigger this. Applies to new/growing entities; migrate existing flat clusters only when you touch them.
- **Co-locate constants/types** with their usage (`<feature>/constants.ts`); `src/constants/` and
  `src/types/` are for cross-cutting things only.
- **New background worker / external source** — always a folder (`worker.ts` + `client.ts` + `types.ts` +
  `constants.ts`) exporting a start function wired with one line in `index.ts`.

### Logging — mandatory
Every module doing external I/O (API calls, DB writes, Telegram API) must:
1. `import logger from "../logger.js"` (adjust path).
2. Log start/key params at `debug` or `info`.
3. Measure duration: `const t0 = Date.now()` before, `durationMs: Date.now() - t0` after.
4. Log completion with timing + relevant metadata (token counts for LLM, row counts for DB, `dims` for embeddings).
5. Log errors as `logger.error({ err, ...context }, "description")` — never swallow.

```typescript
const t0 = Date.now();
const result = await externalCall(...);
logger.info({ durationMs: Date.now() - t0, ...relevantFields }, "Operation completed");
```

### Error handling — mandatory
- Every new `async` function either propagates errors or catches and logs them explicitly.
- Never an empty `catch {}` — log at minimum.
- Fire-and-forget chains always end with `.catch`:
  ```typescript
  someAsyncWork()
    .then((result) => logger.info({ result }, "Background work done"))
    .catch((err) => logger.warn({ err, ...ctx }, "Background work failed"));
  ```
- Handlers: unexpected errors → `logger.error` + a user-facing reply.
- **Exception — group handlers:** log with `logger.error` but do **not** reply (the bot is one of many
  chat participants; surfacing internal errors would spam the group).

### Key patterns
- **Retry** all transiently failing external calls:
  ```typescript
  await retry(() => someApiCall(), 3, 1500, "Label");
  await retry(() => call(), 3, 1500, "Label", (err) => !(err instanceof NonRetryableError));
  ```
- **Processing lock** — `Set<string>` keyed by context (e.g. `"chatId:threadId"`) to reject concurrent
  requests; always release in `finally`:
  ```typescript
  const key = `${chatId}:${threadId}`;
  if (processing.has(key)) return;
  processing.add(key);
  try { /* ... */ } finally { processing.delete(key); }
  ```

### Comments
Encouraged, **in Russian**, explaining the **why** (non-trivial conditionals/flows, invariants, external
API quirks, "why is it done this way?") — not restating the obvious.

### DB schema changes
1. Edit `bot/src/db/schema.ts`.
2. `yarn workspace bot drizzle-kit generate` → migration SQL in `bot/drizzle/`.
3. pgvector: manually add `CREATE EXTENSION IF NOT EXISTS vector;` (drizzle-kit doesn't generate it).
4. `yarn workspace bot drizzle-kit migrate` (remember: prod DB).

**Rollback:** drizzle-kit is forward-only (no `migrate:down`). A **not yet applied** migration:
`yarn workspace bot drizzle-kit drop` + delete the `.sql`. An **applied** one: write a new corrective
migration (`generate` → edit SQL → `migrate`). Breaking prod changes only via forward migrations.

### Testing
vitest in both packages, pool `forks`. Details and "why" — [docs/testing.md](docs/testing.md).
- Co-locate tests: `foo.ts` → `foo.test.ts`. **Adding pure logic? Add a test beside it.**
- Test pure functions only (transformers, formatters, parsers, retry/decision logic). DAOs/repositories,
  workers, Telegram/LLM handlers are not unit-tested. Nest: test services with a mocked repository
  (construct directly, no `@nestjs/testing`) and DTOs through `createValidationPipe()` (`common/`).
- bot tests also need `.js` in relative imports; webapp tests — no extensions, isolate logic from the Telegram SDK.
- Code importing `logger.js` drags in `config.ts` (throws without `.env`) — mock it:
  `vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }))`.
- Keep pool `forks` and the explicit `vite` devDependency (vitest 4 peer, major within `^6 || ^7 || ^8`).

## External APIs

| Service | Used for | Key |
|---|---|---|
| Telegram | Bot API (via HTTP proxy) | `BOT_TOKEN`, `TELEGRAM_PROXY_URL` |
| DeepSeek | LLM chat completion — the **only active provider**, server-side, per-user (BYOK) | in DB, not env |
| Tavily | Web search (quota), server-side, per-user (BYOK), via HTTP proxy | in DB, not env |
| Postgres | DB (drizzle) | `DATABASE_URL` |

Provider resolution, `MissingApiKeyError`, dormant OpenRouter path and its untouchable request body,
reasoning/thinking rules — [docs/llm.md](docs/llm.md).

## Subagents (`.claude/agents/`)
Use them instead of manual work when a task fits. For approach advice, being stuck, and pre-"done"
checks use the built-in **`advisor`** tool (not a project agent).

| Agent | When | Edits code? |
|---|---|---|
| **`test-runner`** | Tests + build gate before commit/deploy (**mandatory** in Deploy) | yes, on request |
| **`code-reviewer`** | Review the current diff before commit (conventions + correctness) | no |
| **`docs-updater`** | Sync README/CLAUDE.md/docs after notable code changes | yes |
| **`bug-investigator`** | Find a bug's root cause from a symptom (tracing + prod logs) | no |
| **`codebase-explorer`** | "Where is X / how does Y work" without dumping files into context | no |
| **`log-analyzer`** | Analyze prod bot logs from Docker over SSH | no |
| **`web-researcher`** | Fresh external info (library docs, external APIs, LLM provider models) | no |

## Git
**Conventional Commits** with a Russian description: `type(scope): краткое описание`.
- Types: `feat` / `fix` / `chore` / `refactor` / `docs` / `test`.
- Scope = domain/package: `webapp`, `knowledge`, `agents`, `bot`, `server`, …
- Example: `fix(webapp): кнопка перевода первой в строке действий RP-чата`.

Branches: `main` (primary) and `deploy` (pushing it triggers auto-deploy).

## Deploy — the "Задеплой" command
When the user says "Задеплой" (or asks to deploy), follow strictly:
1. **Check gate.** Delegate tests + build to the **`test-runner`** subagent (`subagent_type: test-runner`)
   **without asking** — it runs `yarn test` then `yarn build` and returns one verdict. On failure — **STOP**,
   don't push, show its diagnosis. Proceed only on green.
2. **Remember the source branch:** `git branch --show-current`.
3. **Fast-forward and push:** `git checkout deploy` → `git merge --ff-only <source>` → `git push origin deploy`.
4. **Return:** `git checkout <source>`.

Changes must be **committed** on the source branch first (`--ff-only` moves commits). If fast-forward is
impossible (branches diverged) — don't silently create a merge commit; tell the user and ask.

## Keeping docs up to date
Docs describe the **current** state, not history — what's removed from code is removed from docs.
- **README.md** — what a new developer needs: new external service/dependency, setup steps (env, migrations,
  tooling), major feature, stale stack section.
- **CLAUDE.md** — process/convention changes: new architectural pattern or module type, new external
  API/model, new mandatory rule, significant structure change.
- **docs/** — reference narratives; when editing a feature, update its file and keep only a thin link here:
  `architecture.md` (tree, webapp layout, router, proxy/Mini App boundaries), `llm.md` (provider, BYOK),
  `narrator.md` (story director mode + compact), `testing.md`, `deploy.md`, `telegram-ui.md`,
  `tgui-components.md`; `plan/` — roadmaps of upcoming large changes (update or remove as steps land).
- **`.claude/agents/*.md`** — only replace stale literal facts (provider name, env var, path, command)
  that the diff changed; never rewrite agent frontmatter/role/instructions. Full rules live in
  `.claude/agents/docs-updater.md`.
