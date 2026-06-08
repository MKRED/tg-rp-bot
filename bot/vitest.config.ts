import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // forks вместо threads: на Windows холодный прогон thread-пула с дозагрузкой
    // зависимостей Vite иногда падает на первом запуске — forks делают это детерминированным
    pool: "forks",
    include: ["src/**/*.test.ts"],
  },
});
