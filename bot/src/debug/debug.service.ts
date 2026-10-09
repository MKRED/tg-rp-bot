import { Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import type { LlmDebugSettings, LlmDebugSettingsPatch, LlmDebugView } from "@tg-rp-bot/shared";
import { cacheDebugSettings, clearDebugRecords, getDebugRecords, primeDebugSettings } from "../llm/debugCapture.js";
import logger from "../logger.js";
import { DebugRepository } from "./debug.repository.js";

/**
 * Экран отладки LLM: настройки перехвата (БД — источник истины) и записи из in-memory кольца
 * llm/debugCapture.ts. Каждое чтение/запись настроек синхронизирует кэш горячего пути перехвата.
 */
@Injectable()
export class DebugService implements OnApplicationBootstrap {
  constructor(private readonly debug: DebugRepository) {}

  /**
   * Прайм кэша на старте: перехват уважает сохранённый тумблер/N ещё до первого открытия экрана.
   * Fire-and-forget — старт сервера не ждёт БД, на сбое перехват просто стартует с дефолтами.
   */
  onApplicationBootstrap(): void {
    this.debug
      .listAllSettings()
      .then((rows) => primeDebugSettings(rows))
      .catch((err) => logger.warn({ err }, "Failed to prime LLM debug settings cache"));
  }

  async view(userId: number): Promise<LlmDebugView> {
    // БД — источник истины; синхронизируем кэш на случай, если прайм на старте не удался.
    const settings = await this.debug.getSettings(userId);
    cacheDebugSettings(userId, settings);
    return { settings, records: getDebugRecords(userId) };
  }

  async updateSettings(userId: number, patch: LlmDebugSettingsPatch): Promise<LlmDebugSettings> {
    const settings = await this.debug.upsertSettings(userId, patch);
    cacheDebugSettings(userId, settings); // кэш горячего пути — в ногу с БД
    return settings;
  }

  /** Очистить накопленные записи пользователя (настройки не трогаем). */
  clearRecords(userId: number): void {
    clearDebugRecords(userId);
  }
}
