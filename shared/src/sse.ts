/**
 * События SSE-стрима генерации (RP-чат и narrator). Поток — ответ на POST, кадры
 * «event: <name>\ndata: <json>\n\n»; data всегда JSON-объект.
 *   token       — очередной кусок текста ({ text });
 *   reset       — сервер ретраит пустой/отказной ответ: стереть показанный текст ({});
 *   userMessage — сохранённая реплика игрока (сообщение целиком);
 *   status      — промежуточная фаза narrator ({ phase }, напр. "compacting");
 *   done        — готовый результат (сообщение/вариант), конец потока;
 *   error       — ошибка генерации ({ message } — текст готов к показу), конец потока.
 */
export const SSE_EVENTS = {
  token: "token",
  reset: "reset",
  userMessage: "userMessage",
  status: "status",
  done: "done",
  error: "error",
} as const;
export type SseEventName = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS];

export interface SseTokenData {
  text: string;
}

export interface SseErrorData {
  message: string;
}
