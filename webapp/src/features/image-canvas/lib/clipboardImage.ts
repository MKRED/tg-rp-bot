/** Картинка из события вставки (Ctrl+V): первый файл-картинка; null — в буфере нет картинки. */
export function imageFromDataTransfer(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const file of Array.from(data.files)) {
    if (file.type.startsWith("image/")) return file;
  }
  return null;
}

/**
 * Можно ли прочитать картинку из буфера по кнопке (Async Clipboard API). На телефоне это единственный
 * способ: событие вставки там приходит только в поле ввода. В Telegram webview и старых браузерах нет.
 */
export function canReadClipboardImage(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.clipboard?.read === "function";
}

export class ClipboardImageError extends Error {
  constructor(public readonly reason: "denied" | "empty") {
    super(reason === "denied" ? "Нет доступа к буферу обмена" : "В буфере обмена нет картинки");
  }
}

/** Картинка из буфера обмена; браузер может спросить разрешение. */
export async function readClipboardImage(): Promise<File> {
  let items: ClipboardItems;
  try {
    items = await navigator.clipboard.read();
  } catch (err) {
    console.warn("Clipboard read failed", err);
    throw new ClipboardImageError("denied");
  }
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (type) {
      const blob = await item.getType(type);
      return new File([blob], `clipboard.${type.split("/")[1] ?? "png"}`, { type });
    }
  }
  throw new ClipboardImageError("empty");
}
