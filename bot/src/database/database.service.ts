import { Injectable } from "@nestjs/common";
import { db } from "../db/index.js";

export type Database = typeof db;

/**
 * Доступ к drizzle-клиенту через DI. Клиент тот же, что у legacy-кода (db/index.ts): один пул
 * соединений на процесс, пока не перенесённые на Nest DAO продолжают импортировать его напрямую.
 */
@Injectable()
export class DatabaseService {
  readonly db: Database = db;
}
