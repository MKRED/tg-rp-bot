import { getApiBase, getAuthHeader } from "../../../shared/api/client";
import { parseSSELines } from "./parseSSE";

/**
 * Открывает POST-SSE-поток к API бота и вызывает onEvent для каждого завершённого события.
 * Общий ридер для обычной генерации (messages-api) и impersonate (impersonate-api) —
 * раньше этот цикл дублировался дважды. Дисперсию событий делает вызывающая сторона.
 */
export async function readSSE(
  path: string,
  body: Record<string, unknown>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  onError: (message: string) => void,
): Promise<void> {
  const base = getApiBase();
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    onError("Request failed");
    return;
  }

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

      for (const { event, data } of parseSSELines(lines)) {
        onEvent(event, data);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
