import { apiFetch } from "../../../shared/api/client";
import type { TranslateMode } from "../../../shared/components/TranslateSheet";

/**
 * Перевод черновика сообщения перед отправкой (эфемерно, без кэша). Тот же эндпоинт, что и у
 * перевода вариантов impersonate; mode переключает Google ↔ ИИ-промпт перевода из пресета.
 */
export async function composeTranslate(
  chatId: number,
  params: { text: string; targetLang: string; mode: TranslateMode },
): Promise<string> {
  const res = await apiFetch<{ translation: string }>(`/chats/${chatId}/translate-text`, {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.translation;
}
