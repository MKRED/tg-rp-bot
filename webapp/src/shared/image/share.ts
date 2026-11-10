import { MAX_SEND_PHOTO_CHARS } from "@tg-rp-bot/shared";
import { buildScaledImage } from "./index";

/**
 * Попытки ужать картинку для отправки в чат: от почти без потерь к заметно легче. PNG из ComfyUI бывает
 * больше лимита фото — шлём JPEG; детальная картинка 2048 px может не влезть и в JPEG 0.92.
 */
const SHAREABLE_STEPS: readonly [maxSide: number, quality: number][] = [
  [2048, 0.92],
  [2048, 0.8],
  [1600, 0.8],
];

/** Расширение файла по MIME-типу картинки (для «Скачать» и «Поделиться»). */
export function extensionFor(mime: string): string {
  const sub = mime.toLowerCase().split(";")[0]!.split("/")[1] ?? "";
  if (sub === "jpeg" || sub === "pjpeg") return "jpg";
  if (sub === "svg+xml") return "svg";
  return /^[a-z0-9]+$/.test(sub) ? sub : "png";
}

/** Картинка (data URL, blob: или адрес) как файл — для «Скачать» и Web Share. */
export async function imageFile(src: string, baseName: string): Promise<File> {
  const blob = await (await fetch(src)).blob();
  const type = blob.type || "image/png";
  return new File([blob], `${baseName}.${extensionFor(type)}`, { type });
}

/** Умеет ли браузер делиться файлами (системное меню «Поделиться»): телефоны, Chrome/Edge на Windows. */
export function canShareFiles(): boolean {
  try {
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "x.jpg", { type: "image/jpeg" })] });
  } catch (err) {
    console.warn("navigator.canShare failed", err);
    return false;
  }
}

/** Скачать файл в браузере (в Telegram webview не работает — там отправка в чат). */
export function downloadFile(file: Blob, filename: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Скачивание стартует асинхронно — URL отзываем не сразу.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Копия для отправки в чат с ботом: JPEG, влезающий в лимит фото. Уже подходящий JPEG — как есть. */
export async function makeShareable(src: string): Promise<string> {
  if (src.startsWith("data:image/jpeg") && src.length <= MAX_SEND_PHOTO_CHARS) return src;
  for (const [maxSide, quality] of SHAREABLE_STEPS) {
    const out = await buildScaledImage(src, maxSide, quality);
    if (out.length <= MAX_SEND_PHOTO_CHARS) return out;
  }
  throw new Error("Image too large to send even after downscaling");
}
