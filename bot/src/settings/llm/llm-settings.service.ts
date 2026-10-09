import { BadRequestException, Injectable } from "@nestjs/common";
import type { DeepSeekBalance, LlmSettingsPatch, LlmSettingsStatus, VerifyDeepSeekKeyResult } from "@tg-rp-bot/shared";
import { getDeepSeekBalance } from "../../llm/deepseekBalance.js";
import { listDeepSeekModels } from "../../llm/deepseekModels.js";
import { LlmHttpError } from "../../llm/errors.js";
import { assertValidKeyFormat } from "../key-format.js";
import { LlmSettingsRepository } from "./llm-settings.repository.js";

/** 401 от DeepSeek — сам ключ неверен (а не сбой сети/сервиса). */
const isInvalidKey = (err: unknown) => err instanceof LlmHttpError && err.status === 401;

/** Персональный ключ/модель DeepSeek (BYOK): статус, проверка ключа, баланс, сохранение. */
@Injectable()
export class LlmSettingsService {
  constructor(private readonly settings: LlmSettingsRepository) {}

  get(userId: number): Promise<LlmSettingsStatus> {
    return this.settings.getStatus(userId);
  }

  /**
   * Проверяет ключ и заодно возвращает список моделей (один вызов DeepSeek /models). typedKey —
   * только что введённый, ещё не сохранённый ключ; пустой — реверификация сохранённого.
   * Нет ключа / неверный ключ — штатный исход ok:false (200), а не ошибка: тот же канал результата.
   */
  async verify(userId: number, typedKey: string): Promise<VerifyDeepSeekKeyResult> {
    const apiKey = typedKey || (await this.settings.getDecryptedCredentials(userId))?.apiKey;
    if (!apiKey) return { ok: false, error: "no_key" };
    try {
      return { ok: true, models: await listDeepSeekModels(apiKey) };
    } catch (err) {
      if (isInvalidKey(err)) return { ok: false, error: "invalid_key" };
      throw err;
    }
  }

  /**
   * Остаток баланса для СОХРАНЁННОГО ключа — отдельно от verify: verify нужен и для ещё не
   * сохранённого ключа, баланс имеет смысл только для сохранённого.
   */
  async balance(userId: number): Promise<DeepSeekBalance> {
    const creds = await this.settings.getDecryptedCredentials(userId);
    if (!creds) throw new BadRequestException("no_key");
    try {
      return await getDeepSeekBalance(creds.apiKey);
    } catch (err) {
      if (isInvalidKey(err)) throw new BadRequestException("invalid_key");
      throw err;
    }
  }

  /** Сохраняет ключ и/или модель. apiKey: null — удалить ключ (вместе с моделью). */
  update(userId: number, patch: LlmSettingsPatch): Promise<LlmSettingsStatus> {
    assertValidKeyFormat(patch.apiKey);
    return this.settings.upsert(userId, patch);
  }
}
