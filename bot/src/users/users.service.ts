import { Injectable } from "@nestjs/common";
import type { TgUser } from "../auth/auth.types.js";
import { ensureUser } from "../db/users.js";

/**
 * Пользователи. Пока строка в users заводится upsert'ом из профиля Telegram (db/users.ts —
 * общий с legacy Hono-контроллерами); при переносе остальных доменов логика переедет сюда.
 */
@Injectable()
export class UsersService {
  // id, для которых upsert уже прошёл в этом процессе: строка в users нужна для FK, а гонять
  // upsert на каждый запрос незачем. После рестарта первый запрос заодно обновит username/имя.
  private readonly ensured = new Set<number>();

  /** Гарантирует строку в users для пользователя Telegram (один upsert на процесс). */
  async ensureTelegramUser(user: NonNullable<TgUser>): Promise<void> {
    if (this.ensured.has(user.id)) return;
    // Неудачный upsert бросает и в кэш не попадает — следующий запрос попробует снова.
    await ensureUser(user);
    this.ensured.add(user.id);
  }
}
