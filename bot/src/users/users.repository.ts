import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { TgUser } from "../auth/auth.types.js";
import { schema } from "../db/index.js";
import { DatabaseService } from "../database/database.service.js";
import { isUniqueViolation } from "../common/unique-violation.js";
import logger from "../logger.js";
import { generateDataKey } from "../utils/index.js";

/** Профиль Telegram, из которого пишется строка users (initData Mini App или ctx.from бота). */
export type TelegramProfile = Pick<NonNullable<TgUser>, "id" | "username" | "first_name" | "last_name" | "language_code">;

/** Что нужно знать о пользователе для ответа GET /api/auth/session. */
export interface UserProfileRow {
  login: string | null;
  telegramId: number | null;
  firstName: string | null;
  lastName: string | null;
}

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

  /**
   * Новый пользователь с входом по логину (без Telegram) и своим ключом шифрования. null — логин
   * занят (UNIQUE users.login): проверка и вставка одним запросом, без гонки «проверил → вставил».
   */
  async createWithLogin(login: string, passwordHash: string): Promise<string | null> {
    const t0 = Date.now();
    try {
      const [row] = await this.database.db
        .insert(schema.users)
        .values({ login, passwordHash, dataKey: generateDataKey().wrapped })
        .returning({ id: schema.users.id });
      logger.info({ durationMs: Date.now() - t0, userId: row!.id }, "User registered with login");
      return row!.id;
    } catch (err) {
      if (isUniqueViolation(err)) {
        logger.info({ durationMs: Date.now() - t0 }, "Registration rejected: login taken");
        return null;
      }
      throw err;
    }
  }

  /**
   * Задать вход по логину существующему пользователю (аккаунт из Telegram). Логин задаётся один раз:
   * условие `login IS NULL` в том же UPDATE — без гонки «проверил → записал». "taken" — логин занят
   * другим (UNIQUE users.login), "already_set" — у пользователя логин уже есть.
   */
  async setLoginCredentials(
    userId: string,
    login: string,
    passwordHash: string,
  ): Promise<"ok" | "taken" | "already_set"> {
    const t0 = Date.now();
    try {
      const rows = await this.database.db
        .update(schema.users)
        .set({ login, passwordHash, updatedAt: new Date() })
        .where(and(eq(schema.users.id, userId), isNull(schema.users.login)))
        .returning({ id: schema.users.id });
      const result = rows.length ? "ok" : "already_set";
      logger.info({ durationMs: Date.now() - t0, userId, result }, "Login credentials set");
      return result;
    } catch (err) {
      if (isUniqueViolation(err)) {
        logger.info({ durationMs: Date.now() - t0, userId }, "Login credentials rejected: login taken");
        return "taken";
      }
      throw err;
    }
  }

  /** id и хэш пароля по логину (уже в нижнем регистре); undefined — логина нет или пароль не задан. */
  async findLoginCredentials(login: string): Promise<{ id: string; passwordHash: string } | undefined> {
    const t0 = Date.now();
    const [row] = await this.database.db
      .select({ id: schema.users.id, passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.login, login));
    logger.debug({ durationMs: Date.now() - t0, found: Boolean(row) }, "Login credentials looked up");
    return row?.passwordHash ? { id: row.id, passwordHash: row.passwordHash } : undefined;
  }

  async findProfile(userId: string): Promise<UserProfileRow | undefined> {
    const t0 = Date.now();
    const [row] = await this.database.db
      .select({
        login: schema.users.login,
        telegramId: schema.users.telegramId,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    logger.debug({ durationMs: Date.now() - t0, userId, found: Boolean(row) }, "User profile read");
    return row;
  }
}
