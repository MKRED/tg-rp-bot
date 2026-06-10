/** Сторона квадратного аватара после даунскейла и качество JPEG. */
const AVATAR_SIZE = 512;
const JPEG_QUALITY = 0.85;

/**
 * Готовит файл-картинку к хранению как аватар: квадратный центр-кроп, даунскейл до 512px,
 * кодирование в JPEG data URL. Тяжёлый исходник в БД не нужен — в webview аватар показывается
 * мелко. Бросает, если файл не изображение или не удалось его декодировать.
 *
 * Ориентацию EXIF современные движки (Chromium/WebKit в Telegram) применяют к <img> по
 * умолчанию (image-orientation: from-image), и drawImage рисует уже повёрнутый кадр — отдельной
 * обработки не делаем.
 */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Not an image file"));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        // центр-кроп до квадрата по меньшей стороне
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;

        const canvas = document.createElement("canvas");
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context unavailable"));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}
