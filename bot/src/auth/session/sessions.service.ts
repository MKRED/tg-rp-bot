import { Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import logger from "../../logger.js";
import { SESSION_REFRESH_AFTER_MS, SESSION_TTL_MS } from "./session.constants.js";
import { generateSessionToken, hashSessionToken } from "./session-token.js";
import { SessionsRepository } from "./sessions.repository.js";

export interface ResolvedSession {
  userId: string;
  /** Срок продлён — вызывающему нужно переотправить cookie с новым maxAge. */
  extended: boolean;
}

/** Сессии входа по логину: выдача, проверка со скользящим сроком, отзыв. */
@Injectable()
export class SessionsService implements OnApplicationBootstrap {
  constructor(private readonly sessions: SessionsRepository) {}

  onApplicationBootstrap(): void {
    // Чистка не блокирует старт: просроченная сессия и так не проходит findActive.
    this.sessions
      .deleteExpired()
      .catch((err) => logger.warn({ err }, "Expired sessions purge failed"));
  }

  /** Новая сессия; возвращает токен для cookie (в БД — только его хэш). */
  async create(userId: string, userAgent: string | null): Promise<string> {
    const token = generateSessionToken();
    await this.sessions.insert(userId, hashSessionToken(token), new Date(Date.now() + SESSION_TTL_MS), userAgent);
    return token;
  }

  /** Владелец непросроченной сессии; срок продлевается не чаще раза в SESSION_REFRESH_AFTER_MS. */
  async resolve(token: string): Promise<ResolvedSession | null> {
    const tokenHash = hashSessionToken(token);
    const session = await this.sessions.findActive(tokenHash);
    if (!session) return null;
    const extended = Date.now() - session.lastUsedAt.getTime() > SESSION_REFRESH_AFTER_MS;
    if (extended) await this.sessions.extend(tokenHash, new Date(Date.now() + SESSION_TTL_MS));
    return { userId: session.userId, extended };
  }

  async revoke(token: string): Promise<void> {
    await this.sessions.delete(hashSessionToken(token));
  }
}
