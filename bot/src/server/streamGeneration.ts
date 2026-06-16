import type { SSEStreamingApi } from "hono/streaming";
import { chatCompletion } from "../llm/client.js";
import type { ChatCompletionOptions, ChatCompletionResult } from "../llm/types.js";

/**
 * Запускает chatCompletion со стандартной разводкой SSE-событий token/reset в поток.
 * Это единственная общая часть всех стриминговых хендлеров (send/edit/regenerate/impersonate);
 * вставку сообщения/варианта, управление курсором и события done/error хендлеры делают сами —
 * там логика у каждого своя.
 *
 * doStream=false отключает token/reset (пресет без стриминга → клиент покажет спиннер).
 */
export function streamCompletion(
  stream: SSEStreamingApi,
  options: ChatCompletionOptions,
  doStream = true,
): Promise<ChatCompletionResult> {
  return chatCompletion(
    options,
    doStream
      ? (token) => {
          // writeSSE внутри callback — fire-and-forget (не ждём промис)
          stream.writeSSE({ event: "token", data: JSON.stringify({ text: token }) }).catch(() => {});
        }
      : undefined,
    // Перед ретраем пустого/отказного ответа — просим клиента стереть показанный текст.
    doStream
      ? () => stream.writeSSE({ event: "reset", data: "{}" }).catch(() => {})
      : undefined,
  );
}
