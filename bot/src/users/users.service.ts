import { Injectable } from "@nestjs/common";
import { type TelegramProfile, UsersRepository } from "./users.repository.js";

/**
 * Пользователи: строка в users заводится из профиля Telegram — guard'ом API и командой /start бота.
 * Внутренний id — UUID; Telegram id только ищет его (users.telegram_id).
 */
@Injectable()
export class UsersService {
  // Telegram id → внутренний id для тех, у кого upsert уже прошёл в этом процессе: строка в users
  // нужна для FK, а гонять upsert на каждый запрос незачем. После рестарта первый запрос заодно
  // обновит username/имя.
  private readonly ensured = new Map<number, string>();

  constructor(private readonly users: UsersRepository) {}

  /** Гарантирует строку в users для пользователя Mini App (один upsert на процесс); внутренний id. */
  async ensureTelegramUser(user: TelegramProfile): Promise<string> {
    const cached = this.ensured.get(user.id);
    if (cached) return cached;
    // Неудачный upsert бросает и в кэш не попадает — следующий запрос попробует снова.
    const userId = await this.users.upsertTelegramProfile(user);
    this.ensured.set(user.id, userId);
    return userId;
  }

  /** /start: upsert всегда, без кэша — команда и есть повод обновить username/имя. */
  async saveTelegramProfile(user: TelegramProfile): Promise<string> {
    const userId = await this.users.upsertTelegramProfile(user);
    this.ensured.set(user.id, userId);
    return userId;
  }
}
