import { getApiBase, getAuthHeader } from "../../../shared/api/client";

/**
 * Самодостаточный POST-SSE-ридер для narrator-генерации (advance/regenerate). Намеренно не тянет
 * ридер rp-chat, чтобы фичи не были связаны. Формат событий hono streamSSE: блоки
 * «event: <name>\ndata: <json>\n\n».
 */
export async function readStorySSE(
  path: string,
  body: Record<string, unknown>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  onError: (message: string) => void,
): Promise<void> {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: getAuthHeader() },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    onError("Request failed");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";
  let data = "";

  const flush = () => {
    if (!event) return;
    try {
      onEvent(event, data ? (JSON.parse(data) as Record<string, unknown>) : {});
    } catch {
      // битый JSON в data — пропускаем событие
    }
    event = "";
    data = "";
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // последняя (возможно неполная) строка остаётся в буфере

      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data = line.slice(5).trim();
        else if (line === "") flush(); // пустая строка завершает блок события
      }
    }
    flush();
  } finally {
    reader.releaseLock();
  }
}
