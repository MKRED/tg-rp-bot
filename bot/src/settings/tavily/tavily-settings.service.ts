import { Injectable } from "@nestjs/common";
import type { TavilySettingsPatch, TavilySettingsStatus, VerifyTavilyKeyResult } from "@tg-rp-bot/shared";
import { TavilyHttpError } from "../../tavily/errors.js";
import { getTavilyUsage } from "../../tavily/tavilyUsage.js";
import { assertValidKeyFormat } from "../key-format.js";
import { TavilySettingsRepository } from "./tavily-settings.repository.js";

/** Персональный ключ Tavily (веб-поиск, BYOK) и лимит раундов поиска. */
@Injectable()
export class TavilySettingsService {
  constructor(private readonly settings: TavilySettingsRepository) {}

  get(userId: number): Promise<TavilySettingsStatus> {
    return this.settings.getStatus(userId);
  }

  /**
   * Проверяет ключ и заодно возвращает квоту: отдельного эндпоинта верификации у Tavily нет —
   * валидный ответ GET /usage сам по себе означает валидный ключ. typedKey — ещё не сохранённый
   * ключ; пустой — реверификация сохранённого. Нет/неверный ключ — ok:false (200).
   */
  async verify(userId: number, typedKey: string): Promise<VerifyTavilyKeyResult> {
    const apiKey = typedKey || (await this.settings.getDecryptedKey(userId));
    if (!apiKey) return { ok: false, error: "no_key" };
    try {
      return { ok: true, usage: await getTavilyUsage(apiKey) };
    } catch (err) {
      if (err instanceof TavilyHttpError && err.status === 401) return { ok: false, error: "invalid_key" };
      throw err;
    }
  }

  /** Сохраняет/удаляет ключ и/или лимит раундов (кламп — в репозитории). apiKey: null — удалить ключ. */
  update(userId: number, patch: TavilySettingsPatch): Promise<TavilySettingsStatus> {
    assertValidKeyFormat(patch.apiKey);
    return this.settings.upsert(userId, patch);
  }
}
