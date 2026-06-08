import { defineConfig } from "drizzle-kit";

// drizzle-kit не грузит .env сам — подтягиваем его вручную (Node 24).
try {
  process.loadEnvFile();
} catch {
  // .env отсутствует — переменные ожидаются из окружения
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
