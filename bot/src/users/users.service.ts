import { Injectable } from "@nestjs/common";
import { type TelegramProfile, UsersRepository } from "./users.repository.js";

/** Пользователи: строка в users заводится из профиля Telegram — guard'ом API и командой /start бота. */
@Injectable()
export class UsersService {
  // id, для которых upsert уже прошёл в этом процессе: строка в users нужна для FK, а гонять
  // upsert на каждый запрос незачем. После рестарта первый запрос заодно обновит username/имя.
  private readonly ensured = new Set<number>();

  constructor(private readonly users: UsersRepository) {}

  /** Гарантирует строку в users для пользователя Mini App (один upsert на процесс). */
  async ensureTelegramUser(user: TelegramProfile): Promise<void> {
    if (this.ensured.has(user.id)) return;
    // Неудачный upsert бросает и в кэш не попадает — следующий запрос попробует снова.
    await this.users.upsertTelegramProfile(user);
    this.ensured.add(user.id);
  }

  /** /start: upsert всегда, без кэша — команда и есть повод обновить username/имя. */
  async saveTelegramProfile(user: TelegramProfile): Promise<void> {
    await this.users.upsertTelegramProfile(user);
    this.ensured.add(user.id);
  }
}
