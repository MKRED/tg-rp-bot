import { randomBytes } from "node:crypto";

interface PendingCode {
  userId: string;
  expiresAt: number;
}

/**
 * Одноразовые коды установки агента, в памяти процесса (прод — один контейнер; после перезапуска
 * код просто нужно получить заново). Код живёт недолго и сгорает при первом использовании, поэтому
 * команда установки в логах nginx или истории PowerShell ничего не даёт.
 */
export class InstallCodes {
  private readonly codes = new Map<string, PendingCode>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Новый код; прежний неиспользованный код этого пользователя перестаёт действовать. */
  issue(userId: string): { code: string; expiresAt: number } {
    this.prune();
    for (const [code, pending] of this.codes) if (pending.userId === userId) this.codes.delete(code);
    const code = randomBytes(16).toString("base64url");
    const expiresAt = this.now() + this.ttlMs;
    this.codes.set(code, { userId, expiresAt });
    return { code, expiresAt };
  }

  /** Пользователь кода или null (нет такого, истёк, уже использован). Код сгорает в любом случае. */
  redeem(code: string): string | null {
    const pending = this.codes.get(code);
    this.codes.delete(code);
    if (!pending || pending.expiresAt <= this.now()) return null;
    return pending.userId;
  }

  private prune(): void {
    const now = this.now();
    for (const [code, pending] of this.codes) if (pending.expiresAt <= now) this.codes.delete(code);
  }
}
