import type { TgUser } from "../server/middleware/initData.types.js";
import logger from "../logger.js";
import { db, schema } from "./index.js";

/**
 * Upsert пользователя перед записью связанных сущностей (персонажи, пресеты): строка в users
 * заводится только на /start (см. handlers/start.ts), а Mini App можно открыть, не нажав /start.
 * Без этого FK <таблица>.user_id → users.id упадёт. Паттерн upsert повторяет /start.
 */
export async function ensureUser(user: NonNullable<TgUser>): Promise<void> {
  const t0 = Date.now();
  await db
    .insert(schema.users)
    .values({
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      languageCode: user.language_code,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: {
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        languageCode: user.language_code,
        updatedAt: new Date(),
      },
    });
  logger.debug({ durationMs: Date.now() - t0, userId: user.id }, "User ensured");
}
