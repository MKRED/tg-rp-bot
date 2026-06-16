import { apiFetch } from "../../../shared/api/client";
import type { ImpersonationVariant } from "../types/chat";
import { readSSE } from "./sse";

/** Список сохранённых вариантов для текущего момента диалога. */
export async function listImpersonations(chatId: number): Promise<ImpersonationVariant[]> {
  const res = await apiFetch<{ variants: ImpersonationVariant[] }>(`/chats/${chatId}/impersonate`);
  return res.variants;
}

/** Удалить сохранённый вариант реплики от лица пользователя. */
export async function deleteImpersonation(chatId: number, variantId: number): Promise<void> {
  await apiFetch(`/chats/${chatId}/impersonate/${variantId}`, { method: "DELETE" });
}

/** Перевод произвольного текста (эфемерно, без кэша) — для перевода вариантов в шторе. */
export async function translateText(
  chatId: number,
  text: string,
  targetLang: string,
): Promise<string> {
  const res = await apiFetch<{ translation: string }>(`/chats/${chatId}/translate-text`, {
    method: "POST",
    body: JSON.stringify({ text, targetLang }),
  });
  return res.translation;
}

export type ImpersonateEvents = {
  onToken?: (text: string) => void;
  /** Сервер ретраит пустой/отказной вариант — стереть уже показанный стриминговый текст. */
  onReset?: () => void;
  onDone?: (variant: ImpersonationVariant) => void;
  onError?: (message: string) => void;
};

/**
 * Генерирует один вариант реплики от лица пользователя и читает SSE-поток.
 * Если стриминг в пресете выключен — token-события не приходят, только done (клиент покажет спиннер).
 */
export async function streamImpersonate(
  chatId: number,
  events: ImpersonateEvents,
): Promise<void> {
  await readSSE(
    `/chats/${chatId}/impersonate`,
    {},
    (event, data) => {
      if (event === "token") {
        events.onToken?.(data.text as string);
      } else if (event === "reset") {
        events.onReset?.();
      } else if (event === "done") {
        events.onDone?.(data.variant as unknown as ImpersonationVariant);
      } else if (event === "error") {
        events.onError?.(data.message as string);
      }
    },
    (message) => events.onError?.(message),
  );
}
