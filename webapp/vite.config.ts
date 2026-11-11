import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * PORT бота — только из файла bot/.env, НЕ из окружения процесса. loadEnv из vite кладёт process.env
 * поверх файлов, а инструменты, запускающие Vite как dev-сервер (превью Claude, хостинги), выставляют
 * PORT = порту самого Vite (5173) — прокси /api уходил бы на сам Vite и отвечал 502.
 * Нет файла (CI, сборка) — порт по умолчанию: прокси нужен только dev-серверу.
 */
function readBotPort(): string {
  try {
    const env = parseEnv(readFileSync(new URL("../bot/.env", import.meta.url), "utf-8"));
    return env.PORT ?? "3000";
  } catch {
    // Нормальная ситуация без bot/.env — молча берём порт по умолчанию.
    return "3000";
  }
}

export default defineConfig(() => {
  // PORT бота лежит в bot/.env, а не в webapp/.env — читаем его оттуда явно,
  // чтобы прокси не рассинхронизировался при смене порта бота.
  const botPort = readBotPort();

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      // разрешаем внешние хосты — пригодится при прокидывании Mini App через туннель (ngrok/cloudflared)
      allowedHosts: true as const,
      // Vite раздаёт только webapp — /api/* нужно проксировать на HTTP-сервер бота (yarn dev, PORT из bot/.env).
      proxy: { "/api": `http://localhost:${botPort}` },
    },
    build: {
      outDir: "dist",
      target: "es2022",
    },
  };
});
