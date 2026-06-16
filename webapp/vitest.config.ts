import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // forks вместо threads: на Windows холодный прогон thread-пула с дозагрузкой
    // зависимостей Vite иногда падает на первом запуске — forks делают это детерминированным
    // (та же причина, что в bot/vitest.config.ts).
    pool: "forks",
    include: ["src/**/*.test.ts"],
  },
});
