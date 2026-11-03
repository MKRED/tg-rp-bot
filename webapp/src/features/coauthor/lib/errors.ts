import type { CoauthorError } from "@tg-rp-bot/shared";
import { ApiError } from "../../../shared/api/client";

const MESSAGES: Record<string, string> = {
  busy: "ИИ ещё отвечает — подождите",
  preset_required: "Выберите пресет ИИ в настройках чата",
  no_cards: "В чате нет карточек — добавьте их в настройках",
  no_pending_question: "Вопросы уже неактуальны",
  answers_mismatch: "Не удалось отправить ответы",
  turn_failed: "ИИ не смог ответить — попробуйте ещё раз",
} satisfies Record<CoauthorError, string>;

const NO_API_KEY = "Не задан ключ API ИИ — добавьте его в Настройки → ИИ";

/** Текст ошибки запроса. Незнакомый код — это уже готовое сообщение сервера. */
export function coauthorErrorMessage(err: unknown, fallback = MESSAGES.turn_failed!): string {
  const code = err instanceof ApiError ? err.message : "";
  return MESSAGES[code] ?? (code || fallback);
}

/** Текст по коду lastError чата (ход упал, пока страницу обновляли). */
export function coauthorErrorCodeMessage(code: string): string {
  if (code === "no_api_key") return NO_API_KEY;
  return MESSAGES[code] ?? MESSAGES.turn_failed!;
}
