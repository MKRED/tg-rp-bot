/** Сторона квадратной миниатюры и максимальная длинная сторона полноразмерного фото. */
const THUMB_SIZE = 512;
const FULL_MAX_SIDE = 1280;
const THUMB_QUALITY = 0.85;
const FULL_QUALITY = 0.82;

/** Прямоугольник кропа в натуральных пикселях исходного изображения (формат react-easy-crop). */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Пара представлений аватара: квадратная миниатюра (кроп) и фото целиком (уменьшенное). */
export interface AvatarImages {
  /** Квадрат THUMB_SIZE×THUMB_SIZE — для круглого аватара в списках/шапке. */
  thumb: string;
  /** Всё фото без кадрирования, длинная сторона ≤ FULL_MAX_SIDE — для лайтбокса. */
  full: string;
}

/** Загружает изображение из URL (обычно object URL) в готовый к отрисовке HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/** Рисует прямоугольник кропа в квадратный canvas THUMB_SIZE и кодирует в JPEG data URL. */
function renderThumb(img: HTMLImageElement, crop: CropArea): string {
  const canvas = document.createElement("canvas");
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, THUMB_SIZE, THUMB_SIZE);
  return canvas.toDataURL("image/jpeg", THUMB_QUALITY);
}

/** Уменьшает всё изображение так, чтобы длинная сторона была ≤ FULL_MAX_SIDE; кодирует в JPEG. */
function renderFull(img: HTMLImageElement): string {
  const { naturalWidth: w, naturalHeight: h } = img;
  // Не увеличиваем мелкие картинки — масштаб только вниз.
  const scale = Math.min(1, FULL_MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", FULL_QUALITY);
}

/**
 * Готовит оба представления аватара из выбранного пользователем кропа: квадратную миниатюру
 * (по области crop) и полное фото без кадрирования. Загружает изображение один раз.
 *
 * Ориентацию EXIF современные движки (Chromium/WebKit в Telegram) применяют к <img> по умолчанию
 * (image-orientation: from-image): naturalWidth/Height и drawImage уже учитывают поворот, и
 * react-easy-crop считает crop в тех же координатах — отдельной обработки не делаем.
 */
export async function buildAvatarImages(src: string, crop: CropArea): Promise<AvatarImages> {
  const img = await loadImage(src);
  return { thumb: renderThumb(img, crop), full: renderFull(img) };
}
