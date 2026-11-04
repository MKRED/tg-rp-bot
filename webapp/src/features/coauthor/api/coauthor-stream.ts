import { ApiError, apiErrorFrom, getApiBase, getAuthHeaders } from "../../../shared/api/client";
import { parseSSELines } from "../../../shared/api/parseSSE";

/**
 * Ход ИИ: POST + SSE-поток, события уходят в onEvent. Отказ до начала потока (нет соединения, 409 busy,
 * 400 с кодом) — ApiError: ход не начался. Обрыв посреди потока — обычная ошибка чтения или просто конец
 * без done/error: ход на сервере при этом продолжается, и вызывающий это различает.
 */
export async function streamCoauthorTurn(
  path: string,
  body: unknown,
  onEvent: (event: string, data: Record<string, unknown>) => void,
): Promise<void> {
  const url = `${getApiBase()}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(body),
  }).catch((err: unknown) => {
    console.error("Coauthor stream: запрос не ушёл", err);
    throw new ApiError(0, "Не удалось отправить — проверьте соединение");
  });

  if (!response.ok) throw await apiErrorFrom(response, path);
  if (!response.body) throw new ApiError(response.status, "Не удалось получить ответ");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // последняя (возможно неполная) строка остаётся в буфере
      for (const { event, data } of parseSSELines(lines)) onEvent(event, data);
    }
  } finally {
    reader.releaseLock();
  }
}
