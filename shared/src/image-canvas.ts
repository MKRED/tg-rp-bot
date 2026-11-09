// Контракт /api/image-canvases — раздел «Картинки»: холсты редактирования картинок через ComfyUI пользователя.
// Картинки (data URL) не ездят в списках и состоянии холста: только миниатюры, полные — отдельными запросами.

import type { ComfyModelId } from "./comfy-agent.js";

/** Сколько холстов у пользователя. */
export const MAX_IMAGE_CANVASES_PER_USER = 20;
/** Сколько прикреплённых картинок у холста (`<image1>`…`<image3>`). */
export const MAX_CANVAS_REFERENCES = 3;
/** Сколько несохранённых результатов хранит холст: новый вытесняет самый старый. */
export const MAX_CANVAS_DRAFTS = 6;
/** Сколько сохранённых вариантов у холста. */
export const MAX_CANVAS_VARIANTS = 30;
/** Потолок длины промпта. */
export const MAX_CANVAS_PROMPT_CHARS = 4000;
/** Потолок data URL прикреплённой картинки (вариант PNG «в работу» ~2 МБ → ~2,7 млн символов). */
export const MAX_CANVAS_IMAGE_CHARS = 3_500_000;
/** Потолок data URL миниатюры. */
export const MAX_CANVAS_THUMB_CHARS = 200_000;
/** Длинная сторона прикрепляемой картинки и миниатюры (webapp ужимает перед отправкой). */
export const CANVAS_REFERENCE_MAX_SIDE = 1536;
export const CANVAS_THUMB_MAX_SIDE = 320;

/** Строка списка холстов. */
export interface ImageCanvasListItem {
  id: number;
  name: string;
  model: ComfyModelId;
  variantCount: number;
  /** Миниатюра последнего варианта, иначе первой картинки; null — пусто. */
  thumb: string | null;
  running: boolean;
  updatedAt: string;
}

export type CanvasGenerationStatus = "idle" | "running" | "error";

export interface CanvasGeneration {
  status: CanvasGenerationStatus;
  startedAt: string | null;
  /** Текст ошибки последней генерации (status "error"). */
  error: string | null;
}

/** Черновик — несохранённый результат. Картинка — отдельным запросом. */
export interface CanvasDraft {
  id: number;
  model: ComfyModelId;
  prompt: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

/** Сохранённый вариант: с миниатюрой для галереи. */
export interface CanvasVariant extends CanvasDraft {
  thumb: string;
}

export interface ImageCanvas {
  id: number;
  name: string;
  model: ComfyModelId;
  prompt: string;
  /** Миниатюры прикреплённых картинок по порядку: индекс 0 — `<image1>`. */
  references: string[];
  generation: CanvasGeneration;
  /** Новые первыми. */
  drafts: CanvasDraft[];
  variants: CanvasVariant[];
  updatedAt: string;
}

export interface ImageCanvasPatch {
  name?: string;
  model?: ComfyModelId;
  prompt?: string;
}

/** Прикрепить картинку в слот (slot = число картинок — добавить в конец). */
export interface CanvasReferenceInput {
  image: string;
  thumb: string;
}

/** Сохранить черновик в варианты: миниатюру готовит webapp (у него уже есть картинка). */
export interface SaveCanvasDraftInput {
  thumb: string;
}

export interface CanvasImageResponse {
  image: string;
}
