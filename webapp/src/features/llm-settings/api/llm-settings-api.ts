import { apiFetch } from "../../../shared/api/client";
import type {
  DeepSeekBalance,
  LlmSettingsPatch,
  LlmSettingsStatus,
  VerifyDeepSeekKeyResult,
} from "../types/llmSettings";

/** Статус ключа/модели (без самого ключа). */
export function getLlmSettings(): Promise<LlmSettingsStatus> {
  return apiFetch<LlmSettingsStatus>("/settings/llm");
}

/**
 * Проверяет ключ и заодно возвращает список доступных моделей. apiKey — ключ из поля ввода,
 * ещё не сохранён; без аргумента — реверификация уже сохранённого (сервер расшифрует сам).
 */
export function verifyDeepSeekKey(apiKey?: string): Promise<VerifyDeepSeekKeyResult> {
  return apiFetch<VerifyDeepSeekKeyResult>("/settings/llm/verify", {
    method: "POST",
    body: JSON.stringify(apiKey ? { apiKey } : {}),
  });
}

export function saveLlmSettings(patch: LlmSettingsPatch): Promise<LlmSettingsStatus> {
  return apiFetch<LlmSettingsStatus>("/settings/llm", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** Остаток баланса DeepSeek для сохранённого ключа. */
export function getDeepSeekBalance(): Promise<DeepSeekBalance> {
  return apiFetch<DeepSeekBalance>("/settings/llm/balance");
}
