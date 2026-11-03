import type { CardGenerationError } from "@tg-rp-bot/shared";
import { ApiError } from "../../../shared/api/client";

const FALLBACK = "Не удалось сгенерировать блок";

// satisfies — каждый код отказа сервера обязан иметь текст (контракт в @tg-rp-bot/shared).
const ERROR_MESSAGES: Record<string, string> = {
  preset_required: "Сначала выберите пресет ИИ для генерации",
  nothing_to_generate: "Все включённые блоки уже сгенерированы",
  target_not_found: "Этот блок больше не актуален — обновите карточку",
  busy: "Генерация уже идёт, подождите",
  images_unsupported: "Модель пресета не видит картинки — выберите пресет с deepseek-flash",
  not_found: "Карточка не найдена",
  no_pending_question: "Вопрос уже неактуален — сгенерируйте блок заново",
  answers_mismatch: "Не удалось отправить ответы — попробуйте сгенерировать блок заново",
} satisfies Record<CardGenerationError, string>;

/** Текст ошибки запроса генерации. Незнакомый код показываем как есть — это готовое сообщение сервера. */
export function generationErrorMessage(err: unknown): string {
  const code = err instanceof ApiError ? err.message : "";
  return ERROR_MESSAGES[code] ?? (code || FALLBACK);
}

/**
 * Текст по коду из статуса генерации (CardGenerationStatus failed). Здесь код — всегда код, не
 * сообщение: незнакомый (generation_failed, no_api_key) — общий текст.
 */
export function generationStatusErrorMessage(code: string): string {
  if (code === "no_api_key") return "Не задан ключ API ИИ — добавьте его в Настройки → ИИ";
  return ERROR_MESSAGES[code] ?? FALLBACK;
}
