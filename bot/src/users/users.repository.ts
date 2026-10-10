import { Injectable } from "@nestjs/common";
import type { TgUser } from "../auth/auth.types.js";
import { schema } from "../db/index.js";
import { DatabaseService } from "../database/database.service.js";
import logger from "../logger.js";

/** Профиль Telegram, из которого пишется строка users (initData Mini App или ctx.from бота). */
export type TelegramProfile = Pick<NonNullable<TgUser>, "id" | "username" | "first_name" | "last_name" | "language_code">;

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Upsert строки users: создаёт при первом появлении, иначе обновляет username/имя/язык. */
  async upsertTelegramProfile(user: TelegramProfile): Promise<void> {
    const t0 = Date.now();
    const profile = {
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      languageCode: user.language_code,
    };
    await this.database.db
      .insert(schema.users)
      .values({ id: user.id, ...profile })
      .onConflictDoUpdate({ target: schema.users.id, set: { ...profile, updatedAt: new Date() } });
    logger.debug({ durationMs: Date.now() - t0, userId: user.id }, "User upserted");
  }
}
