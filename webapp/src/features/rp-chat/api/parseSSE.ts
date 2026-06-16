export type SSEEvent = { event: string; data: Record<string, unknown> };

/**
 * Чистый парсер строк одного чанка SSE → завершённые события (event/data).
 * Без зависимостей (в т.ч. от Telegram SDK), чтобы покрываться unit-тестами в node-окружении.
 * Битый JSON в data игнорируется (как в оригинале).
 */
export function parseSSELines(lines: string[]): SSEEvent[] {
  const events: SSEEvent[] = [];
  let currentEvent = "";
  for (const line of lines) {
    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      const raw = line.slice(6).trim();
      try {
        events.push({ event: currentEvent, data: JSON.parse(raw) as Record<string, unknown> });
      } catch {
        // Игнорируем неверный JSON в потоке
      }
      currentEvent = "";
    }
  }
  return events;
}
