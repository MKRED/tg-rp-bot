import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthCredentials, AuthSession } from "@tg-rp-bot/shared";
import { UsersService } from "../users/users.service.js";
import { hashPassword, verifyPassword } from "./password/password.js";
import { SessionsService } from "./session/sessions.service.js";

/**
 * Вход по логину и паролю (браузер): регистрация, вход, выход, профиль сессии. Возвращает токен
 * сессии — cookie ставит контроллер (HTTP-деталь).
 */
@Injectable()
export class AuthService {
  // Хэш-пустышка для входа с несуществующим логином: сверка идёт так же долго, как с настоящим, —
  // по времени ответа не узнать, зарегистрирован ли логин.
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {}

  async register({ login, password }: AuthCredentials, userAgent: string | null): Promise<string> {
    const userId = await this.users.createWithLogin(login, await hashPassword(password));
    if (!userId) throw new ConflictException({ error: "login_taken", message: "Этот логин уже занят" });
    return this.sessions.create(userId, userAgent);
  }

  async login({ login, password }: AuthCredentials, userAgent: string | null): Promise<string> {
    const credentials = await this.users.findLoginCredentials(login);
    this.dummyHash ??= hashPassword("dummy-password-for-timing");
    const valid = credentials
      ? await verifyPassword(password, credentials.passwordHash)
      : await verifyPassword(password, await this.dummyHash).then(() => false);
    // Один ответ на «нет логина» и «неверный пароль» — не подсказываем, какие логины существуют.
    if (!credentials || !valid) {
      throw new UnauthorizedException({ error: "invalid_credentials", message: "Неверный логин или пароль" });
    }
    return this.sessions.create(credentials.id, userAgent);
  }

  /**
   * Аккаунт из Telegram задаёт логин и пароль для входа в браузере. Старый пароль не спрашиваем —
   * его нет; личность подтверждает initData (контроллер пускает сюда только Mini App).
   */
  async setCredentials(userId: string, { login, password }: AuthCredentials): Promise<void> {
    const result = await this.users.setLoginCredentials(userId, login, await hashPassword(password));
    if (result === "taken") throw new ConflictException({ error: "login_taken", message: "Этот логин уже занят" });
    if (result === "already_set") {
      throw new ConflictException({ error: "login_already_set", message: "Логин для входа уже задан" });
    }
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.sessions.revoke(token);
  }

  async session(userId: string): Promise<AuthSession> {
    const profile = await this.users.findProfile(userId);
    // guard только что нашёл пользователя по сессии/initData — строки нет лишь при гонке с удалением.
    if (!profile) throw new UnauthorizedException("User not found");
    const telegramName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
    return {
      id: userId,
      login: profile.login,
      telegramLinked: profile.telegramId !== null,
      displayName: telegramName || profile.login || "Пользователь",
    };
  }
}
