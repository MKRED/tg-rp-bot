import type { VerifyDeepSeekKeyResult } from "@tg-rp-bot/shared";
import { apiFetch } from "../../../shared/api/client";

/**
 * Модели DeepSeek для выбора в пресете: реверификация сохранённого ключа (тот же POST
 * /settings/llm/verify, что и в настройках, — DeepSeek отдаёт список моделей вместе с проверкой).
 */
export function listDeepSeekModels(): Promise<VerifyDeepSeekKeyResult> {
  return apiFetch<VerifyDeepSeekKeyResult>("/settings/llm/verify", { method: "POST", body: "{}" });
}
