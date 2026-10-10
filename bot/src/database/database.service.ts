import { Injectable } from "@nestjs/common";
import { db } from "../db/index.js";

export type Database = typeof db;

/**
 * Доступ к drizzle-клиенту через DI. Сам клиент (один пул соединений на процесс) создаётся в
 * db/index.ts; кроме этого сервиса его никто не импортирует — репозитории берут оттуда только schema.
 */
@Injectable()
export class DatabaseService {
  readonly db: Database = db;
}
