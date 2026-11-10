import { buildScaledImage } from "../../../shared/image";
import { CANVAS_REFERENCE_MAX_SIDE, CANVAS_THUMB_MAX_SIDE } from "../types/imageCanvas";

/** JPEG почти без потерь: картинку править будет модель, артефакты сжатия она бы перенесла в результат. */
const REFERENCE_QUALITY = 0.92;
const THUMB_QUALITY = 0.8;

/** Прикрепляемая картинка и её миниатюра из выбранного файла. */
export async function prepareReference(file: File): Promise<{ image: string; thumb: string }> {
  const src = URL.createObjectURL(file);
  try {
    const [image, thumb] = await Promise.all([
      buildScaledImage(src, CANVAS_REFERENCE_MAX_SIDE, REFERENCE_QUALITY),
      buildScaledImage(src, CANVAS_THUMB_MAX_SIDE, THUMB_QUALITY),
    ]);
    return { image, thumb };
  } finally {
    URL.revokeObjectURL(src);
  }
}

/** Миниатюра для галереи из уже загруженной картинки (data URL). */
export function makeThumb(dataUrl: string): Promise<string> {
  return buildScaledImage(dataUrl, CANVAS_THUMB_MAX_SIDE, THUMB_QUALITY);
}
