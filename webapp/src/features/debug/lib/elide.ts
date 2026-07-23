/**
 * Усечение длинного messages[] для показа: оставляем первые headK и последние tailK сообщений,
 * серединку заменяем маркером-заглушкой. Чисто отображательное — исходную запись не трогаем,
 * поэтому смена headK/tailK на экране мгновенно переприменяется к уже полученным записям.
 */

type Msg = { role?: unknown; content?: unknown };

/** Маркер пропуска в середине (отдельный «псевдо-элемент» массива, виден в JSON). */
export type ElidedMarker = { _elided: string };

export function isElidedMarker(m: unknown): m is ElidedMarker {
  return typeof m === "object" && m !== null && "_elided" in m;
}

/**
 * Возвращает копию request с усечённым messages[]. Если messages нет/короткий — возвращает
 * исходный объект без изменений. headK/tailK < 0 трактуются как 0.
 */
export function elideRequest(
  request: Record<string, unknown>,
  headK: number,
  tailK: number,
): Record<string, unknown> {
  const messages = request.messages;
  if (!Array.isArray(messages)) return request;

  const head = Math.max(0, Math.floor(headK));
  const tail = Math.max(0, Math.floor(tailK));
  // Если оставляемое перекрывает весь массив — показываем целиком, без маркера.
  if (messages.length <= head + tail) return request;

  const droppedCount = messages.length - head - tail;
  const marker: ElidedMarker = { _elided: `… пропущено ${droppedCount} сообщ. …` };
  const elided: Array<Msg | ElidedMarker> = [
    ...messages.slice(0, head),
    marker,
    ...messages.slice(messages.length - tail),
  ];
  return { ...request, messages: elided };
}

/**
 * Разворачивает экранированные `\n` внутри строковых значений JSON в настоящие переводы строк —
 * чисто для читаемости в <pre>. JSON.stringify всегда экранирует реальные переносы строк как `\n`,
 * из-за чего многострочный content сообщений схлопывается в одну «простыню» текста.
 */
export function unescapeNewlines(json: string): string {
  return json.replace(/\\n/g, "\n");
}
