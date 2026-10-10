import { Injectable } from "@nestjs/common";
import type { TgUser } from "../auth/auth.types.js";
import { schema } from "../db/index.js";
import { DatabaseService } from "../database/database.service.js";
import logger from "../logger.js";
import { generateDataKey } from "../utils/index.js";

/** Профиль Telegram, из которого пишется строка users (initData Mini App или ctx.from бота). */
export type TelegramProfile = Pick<NonNullable<TgUser>, "id" | "username" | "first_name" | "last_name" | "language_code">;

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Upsert строки users по telegram_id: создаёт при первом появлении (с новым ключом шифрования),
   * иначе обновляет username/имя/язык. Возвращает внутренний id (UUID).
   */
  async upsertTelegramProfile(user: TelegramProfile): Promise<string> {
    const t0 = Date.now();
    const profile = {
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      languageCode: user.language_code,
    };
    // dataKey пишется только при вставке: в set конфликта его нет, иначе существующий пользователь
    // получил бы новый ключ и потерял доступ к своим данным.
    const [row] = await this.database.db
      .insert(schema.users)
      .values({ telegramId: user.id, dataKey: generateDataKey().wrapped, ...profile })
      .onConflictDoUpdate({ target: schema.users.telegramId, set: { ...profile, updatedAt: new Date() } })
      .returning({ id: schema.users.id });
    logger.debug({ durationMs: Date.now() - t0, telegramId: user.id, userId: row!.id }, "User upserted");
    return row!.id;
  }
}
