import { chatCompletion } from "../llm/client.js";
import { MissingApiKeyError } from "../llm/errors.js";
import type { ChatCompletionOptions, ChatCompletionResult } from "../llm/types.js";

/**
 * Куда писать SSE-события генерации. Минимальный интерфейс без привязки к фреймворку: ему
 * структурно удовлетворяет SSEStreamingApi из Hono (legacy stories), а Nest-маршруты (@Sse,
 * Observable) передают обёртку над Subject. Так один хелпер обслуживает оба стека, пока идёт миграция.
 */
export interface SseSink {
  writeSSE(message: { event: string; data: string }): Promise<unknown>;
}

/**
 * Запускает chatCompletion со стандартной разводкой SSE-событий token/reset в поток.
 * Это единственная общая часть всех стриминговых генераций (send/edit/regenerate/impersonate,
 * narrator); вставку сообщения/варианта, управление курсором и события done/error вызывающий
 * делает сам — там логика у каждого своя.
 *
 * doStream=false отключает token/reset (пресет без стриминга → клиент покажет спиннер).
 */
export function streamCompletion(
  sink: SseSink,
  options: ChatCompletionOptions,
  doStream = true,
): Promise<ChatCompletionResult> {
  return chatCompletion(
    options,
    doStream
      ? (token) => {
          // Запись внутри callback — fire-and-forget (не ждём промис): клиент мог уйти, генерацию
          // это не прерывает — ответ всё равно сохранится.
          sink.writeSSE({ event: "token", data: JSON.stringify({ text: token }) }).catch(() => {});
        }
      : undefined,
    // Перед ретраем пустого/отказного ответа — просим клиента стереть показанный текст.
    doStream ? () => sink.writeSSE({ event: "reset", data: "{}" }).catch(() => {}) : undefined,
  );
}

/**
 * Пишет SSE-событие ошибки генерации. На MissingApiKeyError (нет персонального ключа DeepSeek —
 * BYOK) отдаёт готовый пользователю текст с подсказкой, что делать; иначе — общий текст.
 */
export async function writeGenerationError(sink: SseSink, err: unknown): Promise<void> {
  const message =
    err instanceof MissingApiKeyError ? err.message : "Не удалось сгенерировать ответ. Попробуйте ещё раз.";
  await sink.writeSSE({ event: "error", data: JSON.stringify({ message }) });
}
