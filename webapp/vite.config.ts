import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(() => {
  // PORT бота лежит в bot/.env, а не в webapp/.env — читаем его оттуда явно,
  // чтобы прокси не рассинхронизировался при смене порта бота (envDir по умолчанию — webapp/).
  const botEnv = loadEnv("development", "../bot", "");
  const botPort = botEnv.PORT ?? "3000";

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
