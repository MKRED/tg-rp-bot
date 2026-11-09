import { apiFetch } from "../../../shared/api/client";
import type {
  CanvasImageResponse,
  CanvasReferenceInput,
  ImageCanvas,
  ImageCanvasListItem,
  ImageCanvasPatch,
  ReorderCanvasReferencesInput,
} from "../types/imageCanvas";

const BASE = "/image-canvases";

export function listCanvases(): Promise<ImageCanvasListItem[]> {
  return apiFetch<ImageCanvasListItem[]>(BASE);
}

/** Пустое имя — сервер назовёт «Новый холст». */
export function createCanvas(name?: string): Promise<ImageCanvas> {
  return apiFetch<ImageCanvas>(BASE, { method: "POST", body: JSON.stringify(name ? { name } : {}) });
}

export function getCanvas(id: number): Promise<ImageCanvas> {
  return apiFetch<ImageCanvas>(`${BASE}/${id}`);
}

export function updateCanvas(id: number, patch: ImageCanvasPatch): Promise<ImageCanvas> {
  return apiFetch<ImageCanvas>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteCanvas(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`${BASE}/${id}`, { method: "DELETE" });
}

/** slot = числу картинок — добавить в конец, меньше — заменить. */
export function setReference(id: number, slot: number, input: CanvasReferenceInput): Promise<ImageCanvas> {
  return apiFetch<ImageCanvas>(`${BASE}/${id}/references/${slot}`, { method: "PUT", body: JSON.stringify(input) });
}

/** order[i] — прежний слот картинки, которая встаёт на место i. */
export function reorderReferences(id: number, order: number[]): Promise<ImageCanvas> {
  const body: ReorderCanvasReferencesInput = { order };
  return apiFetch<ImageCanvas>(`${BASE}/${id}/references/order`, { method: "PUT", body: JSON.stringify(body) });
}

export function removeReference(id: number, slot: number): Promise<ImageCanvas> {
  return apiFetch<ImageCanvas>(`${BASE}/${id}/references/${slot}`, { method: "DELETE" });
}

export function getReferenceImage(id: number, slot: number): Promise<CanvasImageResponse> {
  return apiFetch<CanvasImageResponse>(`${BASE}/${id}/references/${slot}`);
}

export function generate(id: number): Promise<ImageCanvas> {
  return apiFetch<ImageCanvas>(`${BASE}/${id}/generate`, { method: "POST", body: "{}" });
}

export function cancelGeneration(id: number): Promise<ImageCanvas> {
  return apiFetch<ImageCanvas>(`${BASE}/${id}/cancel`, { method: "POST", body: "{}" });
}

export function getItemImage(id: number, itemId: number): Promise<CanvasImageResponse> {
  return apiFetch<CanvasImageResponse>(`${BASE}/${id}/items/${itemId}/image`);
}

export function saveDraft(id: number, itemId: number, thumb: string): Promise<ImageCanvas> {
  return apiFetch<ImageCanvas>(`${BASE}/${id}/items/${itemId}/save`, { method: "POST", body: JSON.stringify({ thumb }) });
}

/** «В работу»: вариант становится картинкой 1. */
export function useVariantAsBase(id: number, itemId: number): Promise<ImageCanvas> {
  return apiFetch<ImageCanvas>(`${BASE}/${id}/items/${itemId}/use`, { method: "POST", body: "{}" });
}

export function deleteItem(id: number, itemId: number): Promise<ImageCanvas> {
  return apiFetch<ImageCanvas>(`${BASE}/${id}/items/${itemId}`, { method: "DELETE" });
}
