import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as schema from "./schema.js";

// postgres.js устанавливает соединение лениво (на первом запросе), поэтому импорт
// модуля безопасен даже если БД сейчас недоступна — бот стартует, упадёт только сам запрос.
const client = postgres(config.databaseUrl);

export const db = drizzle(client, { schema });
export { schema };
