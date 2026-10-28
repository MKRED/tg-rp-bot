/**
 * Копия RAW-тела запроса для экрана отладки, где data URL картинок (image_url в составных
 * user-сообщениях) заменены коротким описанием. Иначе каждая запись перехвата держала бы в памяти
 * процесса сотни КБ base64 на картинку, а экран отладки гонял бы их в браузер. Исходное тело не трогаем.
 */
export function redactImageUrls(body: Record<string, unknown>): Record<string, unknown> {
  const messages = body.messages;
  if (!Array.isArray(messages)) return body;
  return { ...body, messages: messages.map(redactMessage) };
}

function redactMessage(message: unknown): unknown {
  if (typeof message !== "object" || message === null) return message;
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) return message;
  return { ...message, content: content.map(redactPart) };
}

function redactPart(part: unknown): unknown {
  if (typeof part !== "object" || part === null) return part;
  const { type, image_url: imageUrl } = part as { type?: unknown; image_url?: { url?: unknown } };
  if (type !== "image_url" || typeof imageUrl?.url !== "string" || !imageUrl.url.startsWith("data:")) return part;
  const url = imageUrl.url;
  const kb = Math.round(url.length / 1024);
  // Заголовок data URL (тип) оставляем — по нему видно, в каком формате ушла картинка.
  return { ...part, image_url: { ...imageUrl, url: `${url.slice(0, url.indexOf(",") + 1)}… (${kb} КБ)` } };
}
