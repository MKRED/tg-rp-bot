import type { CardGenerationStatus } from "@tg-rp-bot/shared";

/**
 * Сколько помнить исход генерации. Клиент, обновивший страницу посреди генерации, опрашивает статус
 * каждые несколько секунд — ему хватает и минуты; запас — на свёрнутый Mini App, где таймеры спят.
 */
export const GENERATION_OUTCOME_TTL_MS = 10 * 60 * 1000;

interface Entry {
  userId: string;
  status: CardGenerationStatus;
  /** Когда исход перестаёт отдаваться; у идущей генерации не задано. */
  expiresAt?: number;
}

/**
 * Статус генерации блоков по карточкам — в памяти процесса, как и card-lock.ts: прод — один процесс,
 * а после рестарта идущих генераций всё равно нет. Отдельно от лока, потому что лок берёт и PUT, и он
 * не знает ни цели, ни исхода.
 */
export class GenerationStatusRegistry {
  private readonly entries = new Map<number, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  start(cardId: number, userId: string): void {
    this.entries.set(cardId, { userId, status: { state: "running" } });
  }

  /** Сервер выбрал целевой блок — с этого момента клиент знает, какой блок крутить. */
  setTarget(cardId: number, categoryId: string): void {
    const entry = this.entries.get(cardId);
    if (entry?.status.state === "running") entry.status = { state: "running", categoryId };
  }

  finish(cardId: number, status: Exclude<CardGenerationStatus, { state: "running" }>): void {
    const entry = this.entries.get(cardId);
    if (!entry) return;
    this.entries.set(cardId, { userId: entry.userId, status, expiresAt: this.now() + GENERATION_OUTCOME_TTL_MS });
  }

  /** null — генерации не было, исход устарел или карточка чужая (её существование не раскрываем). */
  get(cardId: number, userId: string): CardGenerationStatus | null {
    const entry = this.entries.get(cardId);
    if (!entry || entry.userId !== userId) return null;
    if (entry.expiresAt !== undefined && entry.expiresAt <= this.now()) {
      this.entries.delete(cardId);
      return null;
    }
    return entry.status;
  }
}

/** Один реестр на процесс — как Set в card-lock.ts. */
export const generationStatus = new GenerationStatusRegistry();
