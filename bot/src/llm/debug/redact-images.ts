/**
 * Копия RAW-тела запроса для экрана отладки, где data URL картинок заменены коротким описанием. Иначе
 * каждая запись перехвата держала бы в памяти процесса сотни КБ base64 на картинку, а экран отладки
 * гонял бы их в браузер. Исходное тело не трогаем.
 *
 * Два формата: Chat Completions (`messages[].content[]`, `image_url: { url }`) и Responses
 * (`input[].content[]` и `input[].output[]` у результата инструмента, `input_image` с image_url строкой).
 */
export function redactImageUrls(body: Record<string, unknown>): Record<string, unknown> {
  const { messages, input } = body;
  if (Array.isArray(messages)) return { ...body, messages: messages.map(redactItem) };
  if (Array.isArray(input)) return { ...body, input: input.map(redactItem) };
  return body;
}

/** Сообщение или элемент input: картинки могут лежать в content[] (сообщение) или output[] (результат инструмента). */
function redactItem(item: unknown): unknown {
  if (typeof item !== "object" || item === null) return item;
  const { content, output } = item as { content?: unknown; output?: unknown };
  return {
    ...item,
    ...(Array.isArray(content) && { content: content.map(redactPart) }),
    ...(Array.isArray(output) && { output: output.map(redactPart) }),
  };
}

function redactPart(part: unknown): unknown {
  if (typeof part !== "object" || part === null) return part;
  const { type, image_url: imageUrl } = part as { type?: unknown; image_url?: unknown };
  if (type === "image_url" && typeof imageUrl === "object" && imageUrl !== null) {
    const url = (imageUrl as { url?: unknown }).url;
    if (typeof url === "string" && url.startsWith("data:")) return { ...part, image_url: { ...imageUrl, url: shorten(url) } };
  }
  if (type === "input_image" && typeof imageUrl === "string" && imageUrl.startsWith("data:")) {
    return { ...part, image_url: shorten(imageUrl) };
  }
  return part;
}

/** Заголовок data URL (тип) оставляем — по нему видно, в каком формате ушла картинка. */
function shorten(url: string): string {
  const kb = Math.round(url.length / 1024);
  return `${url.slice(0, url.indexOf(",") + 1)}… (${kb} КБ)`;
}
