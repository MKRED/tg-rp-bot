// Одноразовая выдача логина и пароля браузерного аккаунта Claude на проде (шаг 4 роадмапа).
// Песочница Playwright MCP (browser_run_code_unsafe) не читает файлы, а пароль не должен попадать в чат,
// поэтому скрипт поднимает сервер на 127.0.0.1, отдаёт CLAUDE_PROD_LOGIN/CLAUDE_PROD_PASSWORD из
// bot/.env первому запросу и сразу закрывается (или через 2 минуты, если запроса не было).
//
// Запуск (в фоне): node .claude/prod-login/serve-creds.mjs
// Затем Playwright MCP: browser_run_code_unsafe с filename ".claude/prod-login/login.js".
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = 47811;
const env = readFileSync(new URL("../../bot/.env", import.meta.url), "utf8");
const get = (key) => {
  const value = env.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();
  if (!value) throw new Error(`${key} не задан в bot/.env`);
  return value;
};
const body = JSON.stringify({ login: get("CLAUDE_PROD_LOGIN"), password: get("CLAUDE_PROD_PASSWORD") });

const server = createServer((_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end(body);
  server.close();
  console.log("credentials served once");
}).listen(PORT, "127.0.0.1", () => console.log(`waiting on 127.0.0.1:${PORT}`));

setTimeout(() => {
  console.log("timeout, no request");
  process.exit(0);
}, 120_000).unref();
